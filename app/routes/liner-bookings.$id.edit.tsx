import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData, redirect, useActionData } from "react-router"
import { requireAuth } from "~/lib/auth.server"
import { prisma } from "~/lib/prisma.server"
import { AdminLayout } from "~/components/AdminLayout"
import { LinerBookingForm } from "~/components/LinerBookingForm"

export const meta: MetaFunction = () => {
  return [{ title: "Edit Liner Booking - Cargo Care" }, { name: "description", content: "Edit liner booking details" }]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request)

    // Only allow LINER_BOOKING_TEAM and ADMIN
    if (user.role.name !== "LINER_BOOKING_TEAM" && user.role.name !== "ADMIN" && user.role.name !== "MD") {
      return redirect("/dashboard")
    }

    const { id } = params
    if (!id) {
      throw new Response("Liner booking ID is required", { status: 400 })
    }

    const url = new URL(request.url)
    const assignmentId = url.searchParams.get("assignmentId")

    // If assignmentId present, load shipment assignment and map to form shape
    if (assignmentId) {
      console.log("[v0] loader: assignment mode", { id, assignmentId })

      const assignment = await prisma.shipmentAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          user: true,
          shipmentPlan: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      })

      if (!assignment) {
        throw new Response("Shipment assignment not found", { status: 404 })
      }

      const normalizedData = { ...(assignment.data as any) }
      if (assignment.shipmentPlan && assignment.shipmentPlan.linkedStatus === 0) {
        if (Array.isArray(normalizedData.equipment_details) && normalizedData.equipment_details.length > 0) {
          console.log("[v0] loader: clearing stale equipment_details for unlinked assignment", {
            assignmentId,
            equipmentCount: normalizedData.equipment_details.length,
          })
        }
        normalizedData.equipment_details = []
        // liner_booking_details should also be empty post-unlink; keep only if explicitly needed by UI
        if (Array.isArray(normalizedData.liner_booking_details) && normalizedData.liner_booking_details.length > 0) {
          console.log("[v0] loader: clearing stale liner_booking_details for unlinked assignment", {
            assignmentId,
            detailCount: normalizedData.liner_booking_details.length,
          })
        }
        normalizedData.liner_booking_details = []
      }

      const [availableShipmentPlans, carriers, vessels, organizations, equipment, loadingPorts, portsOfDischarge, destinationCountries, availableLinerBookings] =
        await Promise.all([
          prisma.shipmentPlan.findMany({
            where: { linkedStatus: 0 },
            select: { id: true, data: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          }),
          prisma.carrier.findMany({ orderBy: { name: "asc" } }),
          prisma.vessel.findMany({ orderBy: { name: "asc" } }),
          prisma.organization.findMany({ orderBy: { name: "asc" } }),
          prisma.equipment.findMany({ orderBy: { name: "asc" } }),
          prisma.loadingPort.findMany({ orderBy: { name: "asc" } }),
          prisma.portOfDischarge.findMany({ orderBy: { name: "asc" } }),
          prisma.destinationCountry.findMany({ orderBy: { name: "asc" } }),
          prisma.linerBooking.findMany({
            where: {
              OR: [
                { shipmentPlanId: null }, // Available bookings
                { shipmentPlanId: assignment.shipmentPlan?.id }, // Bookings linked to current shipment
              ],
            },
            select: {
              id: true,
              createdAt: true,
              data: true,
              shipmentPlanId: true, // Include to identify linked bookings
              user: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
          }),
        ])

      let filteredAvailableLinerBookings = availableLinerBookings
      try {
        const planData = (assignment?.shipmentPlan?.data as any) ?? {}
        const requiredEquipmentArr = Array.isArray(planData?.equipment_details) ? planData.equipment_details : []
        const requiredTypes = new Set(
          requiredEquipmentArr
            .map((e: any) => e?.equipment_type)
            .filter((t: any) => typeof t === "string" && t.trim() !== ""),
        )

        // Get route information from shipment plan's container movement
        const containerMovement = planData?.container_movement ?? {}
        const requiredLoadingPort = containerMovement?.loading_port?.trim()
        const requiredPortOfDischarge = containerMovement?.port_of_discharge?.trim()

        console.log("[DEBUG] Route validation - shipment plan requirements:", {
          requiredLoadingPort,
          requiredPortOfDischarge,
          requiredEquipmentTypes: Array.from(requiredTypes)
        })

        const allowedStatuses = new Set([
          "available",
          "ready for re-linking",
          "ready for re‑linking", // include variant with non-breaking hyphen, if present
        ])

        filteredAvailableLinerBookings = availableLinerBookings.filter((b: any) => {
          const statusRaw = (b?.data?.carrier_booking_status ?? "").toString()
          const status = statusRaw.toLowerCase()

          const isLinkedToCurrent = b.shipmentPlanId === assignment.shipmentPlan?.id
          // Only show truly unlinked bookings OR those linked to current assignment
          const statusOk = (b.shipmentPlanId === null && (status === "" || allowedStatuses.has(status))) || isLinkedToCurrent

          if (!statusOk) return false

          if (requiredTypes.size === 0) return true

          const ed: any[] = Array.isArray(b?.data?.equipment_details) ? b.data.equipment_details : []
          const lbd: any[] = Array.isArray(b?.data?.liner_booking_details) ? b.data.liner_booking_details : []

          const typesFromED = ed
            .map((e) => (typeof e?.equipment_type === "string" ? e.equipment_type.trim() : ""))
            .filter((t) => t.length > 0)

          const typesFromLBD = lbd
            .map((d) => (typeof d?.equipment_type === "string" ? d.equipment_type.split("|")[0].trim() : ""))
            .filter((t) => t.length > 0)

          const bookingTypes = new Set<string>([...typesFromED, ...typesFromLBD])

          // Equipment type validation
          let hasMatchingEquipment = false
          for (const t of bookingTypes) {
            if (requiredTypes.has(t)) {
              hasMatchingEquipment = true
              break
            }
          }

          if (!hasMatchingEquipment) {
            console.log(`[DEBUG] Booking ${b.id} filtered out - no matching equipment types`)
            return false
          }

          // Route validation - check if any booking detail matches the required route
          let hasMatchingRoute = false

          // If no route requirements are specified, consider it a match
          if (!requiredLoadingPort && !requiredPortOfDischarge) {
            hasMatchingRoute = true
          } else {
            // Check liner booking details for route match
            for (const detail of lbd) {
              const bookingLoadingPort = detail?.loading_port?.trim()
              const bookingPortOfDischarge = detail?.port_of_discharge?.trim()

              // A booking detail matches the route if:
              // 1. Loading port matches (when both are specified)
              // 2. Port of discharge matches (when both are specified)
              const loadingPortMatches = !requiredLoadingPort || !bookingLoadingPort || bookingLoadingPort === requiredLoadingPort
              const dischargePortMatches = !requiredPortOfDischarge || !bookingPortOfDischarge || bookingPortOfDischarge === requiredPortOfDischarge

              if (loadingPortMatches && dischargePortMatches) {
                hasMatchingRoute = true
                break
              }
            }
          }

          console.log(`[DEBUG] Booking ${b.id} validation result:`, {
            hasMatchingEquipment,
            hasMatchingRoute,
            requiredLoadingPort,
            requiredPortOfDischarge,
            bookingDetails: lbd.map(d => ({
              loading_port: d?.loading_port,
              port_of_discharge: d?.port_of_discharge
            }))
          })

          return hasMatchingEquipment && hasMatchingRoute
        })
      } catch (e) {
        console.error("[v0] loader: filtering availableLinerBookings by status/type failed", e)
      }

      // Provide linerBooking-like shape for the form
      const linerBooking = {
        ...assignment,
        data: normalizedData,
        shipmentPlan: assignment.shipmentPlan
          ? {
              ...assignment.shipmentPlan,
              linerBookingId: (assignment.shipmentPlan as any).linerBookingId ?? null,
            }
          : null,
      }

      // Extract available equipment from the linked shipment plan
      const availableEquipment: Array<{
        trackingNumber: string;
        equipmentType: string;
        displayName: string;
      }> = [];

      if (assignment.shipmentPlan && assignment.shipmentPlan.data) {
        const shipmentPlanData = assignment.shipmentPlan.data as any;

        if (shipmentPlanData.equipment_details && Array.isArray(shipmentPlanData.equipment_details)) {
          shipmentPlanData.equipment_details.forEach((eq: any, index: number) => {

            if (eq.trackingNumber) {
              availableEquipment.push({
                trackingNumber: eq.trackingNumber,
                equipmentType: eq.equipment_type || 'Unknown',
                displayName: `${eq.equipment_type || 'Unknown'} (${eq.trackingNumber})`
              });
            }
          });
        }
      }

      // Fetch pending individual unmapping requests for this shipment plan
      let pendingUnmappingRequests: any[] = [];
      try {
        pendingUnmappingRequests = assignment.shipmentPlan ? await prisma.individualEquipmentUnmappingRequest.findMany({
          where: {
            shipmentPlanId: assignment.shipmentPlan.id,
            status: "PENDING",
          },
          select: {
            id: true,
            equipmentIndex: true,
            equipmentType: true,
            linerBookingNumber: true,
            unmappingReason: true,
            requestedAt: true,
            requestedByUser: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }) : [];
      } catch (error) {
        console.error("Error fetching pending unmapping requests:", error);
        pendingUnmappingRequests = [];
      }
      

      return {
        user,
        linerBooking,
        availableShipmentPlans,
        availableLinerBookings: filteredAvailableLinerBookings, // use filtered list
        isAssignment: true,
        availableEquipment, // Add available equipment for the dropdown
        pendingUnmappingRequests, // Add pending unmapping requests
        dataPoints: { carriers, vessels, organizations, equipment, loadingPorts, portsOfDischarge, destinationCountries },
      }
    }

    const linerBooking = await prisma.linerBooking.findUnique({
      where: { id },
      include: {
        user: true,
        shipmentPlan: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!linerBooking) {
      throw new Response("Liner booking not found", { status: 404 })
    }

    // Fetch available shipment plans for linking (only those without existing liner bookings)
    const [availableShipmentPlans, carriers, vessels, organizations, equipment, loadingPorts, portsOfDischarge, destinationCountries] = await Promise.all([
      prisma.shipmentPlan.findMany({
        where: {
          linkedStatus: 0, // Only unlinked plans
        },
        select: {
          id: true,
          data: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.carrier.findMany({ orderBy: { name: "asc" } }),
      prisma.vessel.findMany({ orderBy: { name: "asc" } }),
      prisma.organization.findMany({ orderBy: { name: "asc" } }),
      prisma.equipment.findMany({ orderBy: { name: "asc" } }),
      prisma.loadingPort.findMany({ orderBy: { name: "asc" } }),
      prisma.portOfDischarge.findMany({ orderBy: { name: "asc" } }),
      prisma.destinationCountry.findMany({ orderBy: { name: "asc" } }),
    ])

    // Fetch pending individual unmapping requests for this liner booking's shipment plan
    let pendingUnmappingRequests: any[] = [];
    try {
      pendingUnmappingRequests = linerBooking.shipmentPlan ? await prisma.individualEquipmentUnmappingRequest.findMany({
        where: {
          shipmentPlanId: linerBooking.shipmentPlan.id,
          status: "PENDING",
        },
        select: {
          id: true,
          equipmentIndex: true,
          equipmentType: true,
          linerBookingNumber: true,
          unmappingReason: true,
          requestedAt: true,
          requestedByUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }) : [];
    } catch (error) {
      console.error("Error fetching pending unmapping requests:", error);
      pendingUnmappingRequests = [];
    }

    return {
      user,
      linerBooking,
      availableShipmentPlans,
      availableLinerBookings: [],
      isAssignment: false,
      availableEquipment: [], // Empty for non-assignment mode
      pendingUnmappingRequests, // Add pending unmapping requests
      dataPoints: {
        carriers,
        vessels,
        organizations,
        equipment,
        loadingPorts,
        portsOfDischarge,
        destinationCountries,
      },
    }
  } catch (error) {
    console.error("Error loading liner booking:", error)
    if (error instanceof Response) {
      throw error
    }
    return redirect("/login")
  }
}

// This function handles saving the uploaded file to your server
async function handleFileUpload(file: FormDataEntryValue | null): Promise<string | null> {
  console.log("[v0] handleFileUpload called:", { hasFile: !!file, type: typeof file })

  if (!file || typeof file === "string") {
    console.log("[v0] handleFileUpload early return:", typeof file === "string" ? "string path" : "null")
    return typeof file === "string" ? file : null
  }

  const uploadedFile = file as File
  if (uploadedFile.size === 0) {
    console.log("[v0] handleFileUpload empty file")
    return null
  }

  const [{ default: fs }, { default: path }] = await Promise.all([import("fs/promises"), import("path")])

  const uploadDir = path.join(process.cwd(), "public", "uploads", "liner-booking-pdfs")
  await fs.mkdir(uploadDir, { recursive: true })

  const uniqueFilename = `${Date.now()}-${uploadedFile.name}`
  const filePath = path.join(uploadDir, uniqueFilename)

  console.log("[v0] handleFileUpload saving to:", filePath)

  const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer())
  await fs.writeFile(filePath, fileBuffer)

  return `/uploads/liner-booking-pdfs/${uniqueFilename}`
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request)

    // Only allow LINER_BOOKING_TEAM and ADMIN
    if (user.role.name !== "LINER_BOOKING_TEAM" && user.role.name !== "ADMIN") {
      return redirect("/dashboard")
    }

    const { id } = params
    if (!id) {
      return Response.json({ error: "Liner booking ID is required" }, { status: 400 })
    }

    const url = new URL(request.url)
    const assignmentId = url.searchParams.get("assignmentId")
    const formData = await request.formData()
    const specialAction = (formData.get("_action") as string) || ""

    // Parse common fields and details (shared by both flows)
    const carrier_booking_status = formData.get("current_status") as string
    const unmapping_request = formData.get("unmapping_request") === "true" || formData.get("unmapping_request") === "on"
    const unmapping_reason = formData.get("unmapping_reason") as string
    const booking_released_to = formData.get("booking_released_to") as string

    const linerBookingDetails: any[] = []
    let detailIndex = 0
    while (formData.get(`liner_booking_details[${detailIndex}][temporary_booking_number]`) !== null) {
      // In assignment mode, only include allocated booking details
      const isAllocated = formData.get(`liner_booking_details[${detailIndex}][allocated]`) === "true"
      if (assignmentId && !isAllocated) {
        detailIndex++
        continue
      }
      const etdOriginal = formData.get(
        `liner_booking_details[${detailIndex}][e_t_d_of_original_planned_vessel]`,
      ) as string
      const etdRevised = formData.get(`liner_booking_details[${detailIndex}][etd_of_revised_vessel]`) as string
      const emptyPickupFrom = formData.get(
        `liner_booking_details[${detailIndex}][empty_pickup_validity_from]`,
      ) as string
      const emptyPickupTill = formData.get(
        `liner_booking_details[${detailIndex}][empty_pickup_validity_till]`,
      ) as string
      const gateOpeningDate = formData.get(
        `liner_booking_details[${detailIndex}][estimate_gate_opening_date]`,
      ) as string
      const gateCutoffDate = formData.get(`liner_booking_details[${detailIndex}][estimated_gate_cutoff_date]`) as string
      const siCutoffDate = formData.get(`liner_booking_details[${detailIndex}][s_i_cut_off_date]`) as string
      const bookingReceivedDate = formData.get(
        `liner_booking_details[${detailIndex}][booking_received_from_carrier_on]`,
      ) as string

      linerBookingDetails.push({
        temporary_booking_number: formData.get(
          `liner_booking_details[${detailIndex}][temporary_booking_number]`,
        ) as string,
        suffix_for_anticipatory_temporary_booking_number: formData.get(
          `liner_booking_details[${detailIndex}][suffix_for_anticipatory_temporary_booking_number]`,
        ) as string,
        liner_booking_number: formData.get(`liner_booking_details[${detailIndex}][liner_booking_number]`) as string,
        mbl_number: formData.get(`liner_booking_details[${detailIndex}][mbl_number]`) as string,
        carrier: formData.get(`liner_booking_details[${detailIndex}][carrier]`) as string,
        contract: (formData.get(`liner_booking_details[${detailIndex}][contract]`) as string) || null,
        original_planned_vessel: formData.get(
          `liner_booking_details[${detailIndex}][original_planned_vessel]`,
        ) as string,
        e_t_d_of_original_planned_vessel: etdOriginal ? new Date(etdOriginal).toISOString() : null,
        change_in_original_vessel:
          formData.get(`liner_booking_details[${detailIndex}][change_in_original_vessel]`) === "true",
        revised_vessel: formData.get(`liner_booking_details[${detailIndex}][revised_vessel]`) as string,
        etd_of_revised_vessel: etdRevised ? new Date(etdRevised).toISOString() : null,
        empty_pickup_validity_from: emptyPickupFrom ? new Date(emptyPickupFrom).toISOString() : null,
        empty_pickup_validity_till: emptyPickupTill ? new Date(emptyPickupTill).toISOString() : null,
        estimate_gate_opening_date: gateOpeningDate ? new Date(gateOpeningDate).toISOString() : null,
        estimated_gate_cutoff_date: gateCutoffDate ? new Date(gateCutoffDate).toISOString() : null,
        s_i_cut_off_date: siCutoffDate ? new Date(siCutoffDate).toISOString() : null,
        booking_received_from_carrier_on: bookingReceivedDate ? new Date(bookingReceivedDate).toISOString() : null,
        additional_remarks: formData.get(`liner_booking_details[${detailIndex}][additional_remarks]`) as string,
        line_booking_copy: formData.get(`liner_booking_details[${detailIndex}][line_booking_copy]`) as string,
        line_booking_copy_file: await handleFileUpload(
          formData.get(`liner_booking_details[${detailIndex}][line_booking_copy_file]`),
        ),
        equipment_type: (() => {
          const equipmentType = (formData.get(`liner_booking_details[${detailIndex}][equipment_type]`) as string) || ""
          const bookingFor = (formData.get(`liner_booking_details[${detailIndex}][booking_for]`) as string) || ""

          // If equipment_type is empty but booking_for contains "type|trackingNumber", extract the type
          if (!equipmentType && bookingFor && bookingFor.includes("|")) {
            return bookingFor.split("|")[0].trim()
          }

          return equipmentType
        })(),
        equipment_quantity: (formData.get(`liner_booking_details[${detailIndex}][equipment_quantity]`) as string) || "",
        booking_for: (formData.get(`liner_booking_details[${detailIndex}][booking_for]`) as string) || "",
        loading_port: (formData.get(`liner_booking_details[${detailIndex}][loading_port]`) as string) || "",
        destination_country: (formData.get(`liner_booking_details[${detailIndex}][destination_country]`) as string) || "",
        port_of_discharge: (formData.get(`liner_booking_details[${detailIndex}][port_of_discharge]`) as string) || "",
      })
      detailIndex++
    }

    // Handle individual equipment unmapping request
    if (specialAction === "request_individual_unmapping") {
      const equipmentIndex = formData.get("equipmentIndex") as string
      const equipmentType = formData.get("equipmentType") as string
      const linerBookingNumber = formData.get("linerBookingNumber") as string
      const unmappingReason = formData.get("unmappingReason") as string

      console.log("[v0] request_individual_unmapping action started", {
        equipmentIndex,
        equipmentType,
        linerBookingNumber,
        unmappingReason,
        assignmentId
      })

      if (!unmappingReason || unmappingReason.trim() === "") {
        return Response.json({ error: "Unmapping reason is required" }, { status: 400 })
      }

      if (assignmentId) {
        // Assignment mode: create individual unmapping request
        const current = await prisma.shipmentAssignment.findUnique({
          where: { id: assignmentId },
          include: { shipmentPlan: true },
        })
        if (!current || !current.shipmentPlan) {
          return Response.json({ error: "Shipment assignment or linked shipment plan not found" }, { status: 404 })
        }

        // Create individual equipment unmapping request
        try {
          const unmappingRequest = await prisma.individualEquipmentUnmappingRequest.create({
            data: {
              shipmentPlanId: current.shipmentPlan.id,
              equipmentIndex: parseInt(equipmentIndex, 10),
              equipmentType,
              linerBookingNumber,
              unmappingReason: unmappingReason.trim(),
              requestedBy: user.id,
              status: "PENDING",
            }
          })

          console.log("[v0] Individual equipment unmapping request created", {
            requestId: unmappingRequest.id,
            shipmentPlanId: current.shipmentPlan.id
          })
        } catch (error) {
          console.error("Error creating unmapping request:", error)
          return Response.json({ error: "Failed to create unmapping request. The feature may not be fully available yet." }, { status: 500 })
        }

        return redirect(`/liner-bookings/${params.id}/edit?assignmentId=${assignmentId}`)
      } else {
        // Regular liner booking mode: create individual unmapping request
        const linerBooking = await prisma.linerBooking.findUnique({
          where: { id },
          include: { shipmentPlan: true },
        })

        if (!linerBooking || !linerBooking.shipmentPlan) {
          return Response.json({ error: "Liner booking or linked shipment plan not found" }, { status: 404 })
        }

        // Create individual equipment unmapping request
        try {
          const unmappingRequest = await prisma.individualEquipmentUnmappingRequest.create({
            data: {
              shipmentPlanId: linerBooking.shipmentPlan.id,
              equipmentIndex: parseInt(equipmentIndex, 10),
              equipmentType,
              linerBookingNumber,
              unmappingReason: unmappingReason.trim(),
              requestedBy: user.id,
              status: "PENDING",
            }
          })

          console.log("[v0] Individual equipment unmapping request created", {
            requestId: unmappingRequest.id,
            shipmentPlanId: linerBooking.shipmentPlan.id
          })
        } catch (error) {
          console.error("Error creating unmapping request:", error)
          return Response.json({ error: "Failed to create unmapping request. The feature may not be fully available yet." }, { status: 500 })
        }

        return redirect(`/liner-bookings/${id}/edit`)
      }
    }

    if (assignmentId && specialAction === "unlink_booking") {
      const bookingIdToUnlink = formData.get("bookingId") as string
      if (!bookingIdToUnlink) {
        return redirect(`/liner-bookings/${params.id}/edit?assignmentId=${assignmentId}`)
      }

      console.log("[v0] unlink_booking action started", { bookingIdToUnlink, assignmentId })

      const current = await prisma.shipmentAssignment.findUnique({
        where: { id: assignmentId },
        include: { shipmentPlan: true },
      })
      if (!current || !current.shipmentPlan) {
        return Response.json({ error: "Shipment assignment or linked shipment plan not found" }, { status: 404 })
      }

      // Check if assignment is already booked (unlinking not allowed)
      const assignmentData = (current.data as any) || {}
      if (assignmentData.carrier_booking_status === "Booked") {
        return Response.json({ error: "Cannot unlink bookings from a booked assignment" }, { status: 400 })
      }

      // Get the booking to unlink
      const bookingToUnlink = await prisma.linerBooking.findUnique({
        where: { id: bookingIdToUnlink },
      })
      if (!bookingToUnlink) {
        return Response.json({ error: "Booking not found" }, { status: 404 })
      }

      console.log("[v0] unlink_booking - booking found", {
        bookingId: bookingToUnlink.id,
        bookingDetailsCount: ((bookingToUnlink.data as any)?.liner_booking_details || []).length,
      })

      // Remove the booking's details from the assignment's liner_booking_details
      const existingDetails = Array.isArray(assignmentData.liner_booking_details)
        ? assignmentData.liner_booking_details
        : []

      console.log("[v0] unlink_booking - existing details in assignment", {
        existingDetailsCount: existingDetails.length,
        existingDetails: existingDetails.map((d: any) => ({
          temp_booking: d?.temporary_booking_number,
          liner_booking: d?.liner_booking_number,
        })),
      })

      const bookingDetails = ((bookingToUnlink.data as any)?.liner_booking_details || []) as any[]
      const bookingDetailKeys = new Set(
        bookingDetails.map(
          (d: any) => (d?.temporary_booking_number || d?.liner_booking_number || JSON.stringify(d)) as string,
        ),
      )

      console.log("[v0] unlink_booking - booking detail keys to remove", {
        bookingDetailKeys: Array.from(bookingDetailKeys),
        bookingDetailsCount: bookingDetails.length,
      })

      const updatedDetails = existingDetails.filter((detail: any) => {
        const key = (detail?.temporary_booking_number ||
          detail?.liner_booking_number ||
          JSON.stringify(detail)) as string
        const shouldKeep = !bookingDetailKeys.has(key)
        console.log("[v0] unlink_booking - filtering detail", {
          detailKey: key,
          shouldKeep,
          temp_booking: detail?.temporary_booking_number,
          liner_booking: detail?.liner_booking_number,
        })
        return shouldKeep
      })

      console.log("[v0] unlink_booking - after filtering", {
        originalCount: existingDetails.length,
        updatedCount: updatedDetails.length,
        removedCount: existingDetails.length - updatedDetails.length,
      })

      // Transaction: unlink booking and update assignment
      await prisma.$transaction(async (tx) => {
        // Unlink the booking and set status to make it available again
        const bookingData = (bookingToUnlink.data as any) || {}

        console.log("[DEBUG] unlink_booking - Original booking data before unlinking:", {
          bookingId: bookingIdToUnlink,
          fullBookingData: bookingData,
          linerBookingDetails: bookingData.liner_booking_details,
          detailsCount: Array.isArray(bookingData.liner_booking_details) ? bookingData.liner_booking_details.length : 0,
          sampleDetail: Array.isArray(bookingData.liner_booking_details) && bookingData.liner_booking_details.length > 0
            ? {
                temporary_booking_number: bookingData.liner_booking_details[0]?.temporary_booking_number,
                liner_booking_number: bookingData.liner_booking_details[0]?.liner_booking_number,
                mbl_number: bookingData.liner_booking_details[0]?.mbl_number,
                carrier: bookingData.liner_booking_details[0]?.carrier,
                contract: bookingData.liner_booking_details[0]?.contract,
                original_planned_vessel: bookingData.liner_booking_details[0]?.original_planned_vessel,
                change_in_original_vessel: bookingData.liner_booking_details[0]?.change_in_original_vessel,
                revised_vessel: bookingData.liner_booking_details[0]?.revised_vessel,
                loading_port: bookingData.liner_booking_details[0]?.loading_port,
                destination_country: bookingData.liner_booking_details[0]?.destination_country,
                port_of_discharge: bookingData.liner_booking_details[0]?.port_of_discharge,
                line_booking_copy: bookingData.liner_booking_details[0]?.line_booking_copy,
                line_booking_copy_file: bookingData.liner_booking_details[0]?.line_booking_copy_file,
                additional_remarks: bookingData.liner_booking_details[0]?.additional_remarks,
                equipment_type: bookingData.liner_booking_details[0]?.equipment_type,
                booking_for: bookingData.liner_booking_details[0]?.booking_for,
              }
            : null
        })

        const unlinkedBookingData = {
          ...bookingData,
          carrier_booking_status: "Ready for Re-linking",
        }

        console.log("[DEBUG] unlink_booking - Data being saved after unlinking:", {
          unlinkedBookingData,
          preservedDetailsCount: Array.isArray(unlinkedBookingData.liner_booking_details) ? unlinkedBookingData.liner_booking_details.length : 0
        })

        const updatedBooking = await tx.linerBooking.update({
          where: { id: bookingIdToUnlink },
          data: {
            shipmentPlanId: null,
            data: unlinkedBookingData,
          },
        })

        console.log("[DEBUG] unlink_booking - Booking after database update:", {
          updatedBookingId: updatedBooking.id,
          updatedBookingData: updatedBooking.data,
          preservedDetailsInDb: Array.isArray((updatedBooking.data as any)?.liner_booking_details)
            ? (updatedBooking.data as any).liner_booking_details.length
            : 0
        })

        // Update assignment with filtered details
        await tx.shipmentAssignment.update({
          where: { id: assignmentId },
          data: {
            data: {
              ...assignmentData,
              liner_booking_details: updatedDetails,
            } as any,
          },
        })
      })

      console.log("[v0] unlink_booking - transaction completed, redirecting")

      return redirect(`/liner-bookings/${params.id}/edit?assignmentId=${assignmentId}`)
    }

    if (assignmentId && specialAction === "link_available") {
      const selectedIds = formData.getAll("selectedAvailableIds") as string[]
      if (selectedIds.length === 0) {
        return redirect(`/liner-bookings/${params.id}/edit?assignmentId=${assignmentId}`)
      }

      const current = await prisma.shipmentAssignment.findUnique({
        where: { id: assignmentId },
        include: { shipmentPlan: true },
      })
      if (!current || !current.shipmentPlan) {
        return Response.json({ error: "Shipment assignment or linked shipment plan not found" }, { status: 404 })
      }

      // Load the selected liner bookings
      const bookings = await prisma.linerBooking.findMany({
        where: { id: { in: selectedIds } },
      })

      // Merge their details into the assignment's data
      const existingData = ((current.data || {}) as any) ?? {}
      const existingDetails = Array.isArray(existingData.liner_booking_details)
        ? existingData.liner_booking_details
        : []
      const selectedDetails = bookings.flatMap((b) => {
        const d = ((b.data as any)?.liner_booking_details || []) as any[]
        return Array.isArray(d) ? d : []
      })

      // Deduplicate by temporary_booking_number or liner_booking_number
      const seen = new Set<string>()
      const mergedDetails = [...existingDetails]
      for (const d of selectedDetails) {
        const key = (d?.temporary_booking_number || d?.liner_booking_number || JSON.stringify(d)) as string
        if (key && !seen.has(key)) {
          seen.add(key)
          mergedDetails.push(d)
        }
      }

      // Transaction: link bookings to shipment plan, update assignment and mark plan as linked
      // Transaction: link bookings to shipment plan, update assignment and mark plan as linked
await prisma.$transaction(async (tx) => {
  for (const b of bookings) {
    const data = (b.data as any) || {}
    // Ensure the booking data maintains its status when being linked
    await tx.linerBooking.update({
      where: { id: b.id },
      data: {
        shipmentPlanId: current.shipmentPlan!.id,
        data: {
          ...data,
          // Keep existing status unless it's "Ready for Re-linking"
          carrier_booking_status: data.carrier_booking_status === "Ready for Re-linking"
            ? "Awaiting MD Approval"
            : (data.carrier_booking_status || "Awaiting MD Approval")
        },
      },
    })
  }

        // Update assignment with merged details (do not force Booked status here)
        await tx.shipmentAssignment.update({
          where: { id: assignmentId },
          data: {
            data: {
              ...(existingData || {}),
              liner_booking_details: mergedDetails,
            } as any,
          },
        })

        // Update equipment tracking numbers in linked shipment plan
        console.log("[DEBUG] link_available - Starting equipment tracking update process")
        console.log("[DEBUG] link_available - mergedDetails count:", mergedDetails.length)
        console.log("[DEBUG] link_available - mergedDetails with booking numbers:", mergedDetails.filter(d => d.liner_booking_number).length)

        // Initialize shipmentPlanData with current data
        let shipmentPlanData = current.shipmentPlan?.data as any

        if (current.shipmentPlan && mergedDetails.some(detail => detail.liner_booking_number)) {
          console.log("[DEBUG] link_available - Conditions met, proceeding with update")

          console.log("[DEBUG] link_available - Current shipment plan ID:", current.shipmentPlan.id)
          console.log("[DEBUG] link_available - Equipment details count:", shipmentPlanData.equipment_details?.length || 0)

          // Log current equipment details
          if (shipmentPlanData.equipment_details) {
            console.log("[DEBUG] link_available - Current equipment details:")
            shipmentPlanData.equipment_details.forEach((eq: any, idx: number) => {
              console.log(`[DEBUG]   Equipment ${idx}: ${eq.equipment_type} | ${eq.trackingNumber}`)
            })
          }

          // Log liner booking details
          console.log("[DEBUG] link_available - Merged liner booking details:")
          mergedDetails.forEach((detail: any, idx: number) => {
            console.log(`[DEBUG]   Detail ${idx}:`)
            console.log(`[DEBUG]     - booking_for: "${detail.booking_for}"`)
            console.log(`[DEBUG]     - equipment_type: "${detail.equipment_type}"`)
            console.log(`[DEBUG]     - trackingNumber: "${detail.trackingNumber}"`)
            console.log(`[DEBUG]     - liner_booking_number: "${detail.liner_booking_number}"`)
          })

          // Update equipment tracking numbers with liner booking numbers
          if (shipmentPlanData.equipment_details && Array.isArray(shipmentPlanData.equipment_details)) {
            // Create a map of equipmentType -> liner_booking_number
            const equipmentTypeToBookingMap = new Map()

            for (const detail of mergedDetails) {
              if (detail.liner_booking_number && detail.liner_booking_number.trim()) {
                // Get equipment type from the detail
                let equipmentType = null

                console.log(`[DEBUG] link_available - Processing detail:`)
                console.log(`[DEBUG] link_available - equipment_type: "${detail.equipment_type}"`)
                console.log(`[DEBUG] link_available - booking_for: "${detail.booking_for}"`)
                console.log(`[DEBUG] link_available - liner_booking_number: "${detail.liner_booking_number}"`)

                // Try to extract equipment type from various fields
                if (detail.equipment_type && detail.equipment_type.includes("|")) {
                  equipmentType = detail.equipment_type.split("|")[0].trim()
                  console.log(`[DEBUG] link_available - Extracted from equipment_type: "${equipmentType}"`)
                } else if (detail.equipment_type && !detail.equipment_type.includes("|")) {
                  equipmentType = detail.equipment_type.trim()
                  console.log(`[DEBUG] link_available - Using equipment_type directly: "${equipmentType}"`)
                } else if (detail.booking_for && detail.booking_for.includes("|")) {
                  equipmentType = detail.booking_for.split("|")[0].trim()
                  console.log(`[DEBUG] link_available - Extracted from booking_for: "${equipmentType}"`)
                }

                if (equipmentType) {
                  // If we don't have a booking number for this equipment type yet, or if we have multiple bookings for same type,
                  // collect all booking numbers for this equipment type
                  if (!equipmentTypeToBookingMap.has(equipmentType)) {
                    equipmentTypeToBookingMap.set(equipmentType, [])
                  }
                  equipmentTypeToBookingMap.get(equipmentType).push(detail.liner_booking_number)
                  console.log(`[DEBUG] link_available - MAPPED equipment type: ${equipmentType} -> ${detail.liner_booking_number}`)
                } else {
                  console.log(`[DEBUG] link_available - WARNING: Could not extract equipment type from detail`)
                }
              } else {
                console.log(`[DEBUG] link_available - Skipping detail without liner_booking_number`)
              }
            }

            console.log(`[DEBUG] link_available - Final mapping has ${equipmentTypeToBookingMap.size} equipment types`)
            for (const [type, bookings] of equipmentTypeToBookingMap.entries()) {
              console.log(`[DEBUG] link_available - Equipment type "${type}" has booking numbers:`, bookings)
            }

            // Update equipment details with liner booking numbers
            let hasUpdates = false
            let bookingNumberIndex = new Map() // Track which booking number to use for each equipment type

            shipmentPlanData.equipment_details = shipmentPlanData.equipment_details.map((equipment: any, idx: number) => {
              const originalTracking = equipment.trackingNumber
              const equipmentType = equipment.equipment_type

              console.log(`[DEBUG] link_available - Equipment ${idx}: type="${equipmentType}", tracking="${originalTracking}"`)

              // Check if we have booking numbers for this equipment type
              const bookingNumbers = equipmentTypeToBookingMap.get(equipmentType)
              if (bookingNumbers && bookingNumbers.length > 0) {
                // Get the next booking number for this equipment type
                if (!bookingNumberIndex.has(equipmentType)) {
                  bookingNumberIndex.set(equipmentType, 0)
                }
                const currentIndex = bookingNumberIndex.get(equipmentType)
                const newBookingNumber = bookingNumbers[currentIndex % bookingNumbers.length]

                // Move to next booking number for this equipment type
                bookingNumberIndex.set(equipmentType, currentIndex + 1)

                if (originalTracking !== newBookingNumber) {
                  hasUpdates = true
                  console.log(`[DEBUG] link_available - UPDATING equipment ${idx}: ${originalTracking} -> ${newBookingNumber}`)
                  return {
                    ...equipment,
                    trackingNumber: newBookingNumber,
                    originalTrackingNumber: originalTracking // Keep reference to original
                  }
                }
              } else {
                console.log(`[DEBUG] link_available - No booking numbers found for equipment type "${equipmentType}"`)
              }

              return equipment
            })

            console.log(`[DEBUG] link_available - hasUpdates: ${hasUpdates}`)

            // Update the shipment plan data if there were changes
            if (hasUpdates) {
              console.log("[DEBUG] link_available - ✅ Equipment tracking numbers updated in shipment plan data")
            } else {
              console.log("[DEBUG] link_available - ❌ No equipment tracking number updates made")
            }
          } else {
            console.log("[DEBUG] link_available - ❌ No equipment_details array found in shipment plan")
          }
        } else {
          console.log("[DEBUG] link_available - ❌ Conditions not met for equipment update")
          console.log("[DEBUG] link_available - Missing shipmentPlan or no booking numbers found")
        }

        // Ensure plan is marked as linked so loader doesn't clear details
        await tx.shipmentPlan.update({
          where: { id: current.shipmentPlan!.id },
          data: {
            data: shipmentPlanData,
            linkedStatus: 1,
          },
        })
      })

      return redirect(`/liner-bookings/${params.id}/edit?assignmentId=${assignmentId}`)
    }

    if (assignmentId && specialAction === "allocate_individual") {
      const detailIndex = formData.get("detailIndex") as string
      if (!detailIndex) {
        return redirect(`/liner-bookings/${params.id}/edit?assignmentId=${assignmentId}`)
      }

      console.log("[v0] allocate_individual action started", { assignmentId, detailIndex })

      const current = await prisma.shipmentAssignment.findUnique({
        where: { id: assignmentId },
        include: { shipmentPlan: true },
      })
      if (!current || !current.shipmentPlan) {
        return Response.json({ error: "Shipment assignment or linked shipment plan not found" }, { status: 404 })
      }

      // Check if assignment is already booked
      const assignmentData = (current.data as any) || {}
      if (assignmentData.carrier_booking_status === "Booked") {
        return Response.json({ error: "Cannot allocate to a booked assignment" }, { status: 400 })
      }

      // Get the specific booking detail to allocate
      const detailIndexNum = Number.parseInt(detailIndex, 10)
      if (detailIndexNum >= 0 && detailIndexNum < linerBookingDetails.length) {
        const detailToAllocate = linerBookingDetails[detailIndexNum]

        // Update the existing liner_booking_details array or create new one
        const existingDetails = Array.isArray(assignmentData.liner_booking_details)
          ? assignmentData.liner_booking_details
          : []

        // Add the allocated detail (mark it as allocated and update tracking number if liner booking number exists)
        const updatedDetails = [...existingDetails]
        const updatedDetail = { ...detailToAllocate, allocated: true }

        // If this detail has a liner booking number, use it as the tracking number for matching
        if (detailToAllocate.liner_booking_number) {
          updatedDetail.trackingNumber = detailToAllocate.liner_booking_number
          console.log(`[v0] allocate_individual - Updated detail trackingNumber to liner booking number: ${detailToAllocate.liner_booking_number}`)
        }

        updatedDetails[detailIndexNum] = updatedDetail

        const updatedData = {
          ...assignmentData,
          liner_booking_details: updatedDetails,
        }

        await prisma.shipmentAssignment.update({
          where: { id: assignmentId },
          data: {
            data: updatedData as any,
          },
        })

        // Update equipment tracking numbers in linked shipment plan for individual allocation
        if (current.shipmentPlan && detailToAllocate.liner_booking_number) {
          console.log("[v0] allocate_individual - Updating equipment tracking numbers with liner booking numbers")
          
          const shipmentPlanData = current.shipmentPlan.data as any
          
          // Update equipment tracking numbers with liner booking numbers
          if (shipmentPlanData.equipment_details && Array.isArray(shipmentPlanData.equipment_details)) {
            // Get tracking number from booking_for field which contains "equipment_type|trackingNumber"
            let trackingNumber = null
            
            if (detailToAllocate.booking_for && detailToAllocate.booking_for.includes("|")) {
              trackingNumber = detailToAllocate.booking_for.split("|")[1]
            } else if (detailToAllocate.equipment_type && detailToAllocate.equipment_type.includes("|")) {
              trackingNumber = detailToAllocate.equipment_type.split("|")[1]
            } else if (detailToAllocate.trackingNumber) {
              trackingNumber = detailToAllocate.trackingNumber
            }
            
            if (trackingNumber && detailToAllocate.liner_booking_number.trim()) {
              console.log(`[v0] allocate_individual - Mapping tracking ${trackingNumber} -> booking ${detailToAllocate.liner_booking_number}`)
              
              // Update equipment details with liner booking number
              let hasUpdates = false
              shipmentPlanData.equipment_details = shipmentPlanData.equipment_details.map((equipment: any) => {
                if (equipment.trackingNumber === trackingNumber && equipment.trackingNumber !== detailToAllocate.liner_booking_number) {
                  hasUpdates = true
                  console.log(`[v0] allocate_individual - Updating equipment tracking: ${equipment.trackingNumber} -> ${detailToAllocate.liner_booking_number}`)
                  return {
                    ...equipment,
                    trackingNumber: detailToAllocate.liner_booking_number,
                    originalTrackingNumber: equipment.trackingNumber // Keep reference to original
                  }
                }
                return equipment
              })
              
              // Save the updated shipment plan if there were changes
              if (hasUpdates) {
                await prisma.shipmentPlan.update({
                  where: { id: current.shipmentPlan.id },
                  data: {
                    data: shipmentPlanData,
                  },
                })
                console.log("[v0] allocate_individual - Shipment plan equipment tracking number updated")
              }
            }
          }
        }

        console.log("[v0] allocate_individual - allocation completed for detail", detailIndexNum)
      }

      return redirect(`/liner-bookings/${params.id}/edit?assignmentId=${assignmentId}`)
    }

    if (assignmentId && specialAction === "allocate_requested") {
      console.log("[v0] allocate_requested action started", { assignmentId })

      const current = await prisma.shipmentAssignment.findUnique({
        where: { id: assignmentId },
        include: { shipmentPlan: true },
      })
      if (!current || !current.shipmentPlan) {
        return Response.json({ error: "Shipment assignment or linked shipment plan not found" }, { status: 404 })
      }

      // Check if assignment is already booked
      const assignmentData = (current.data as any) || {}
      if (assignmentData.carrier_booking_status === "Booked") {
        return Response.json({ error: "Cannot allocate to a booked assignment" }, { status: 400 })
      }

      // Update assignment with the requested booking details
      const updatedData = {
        ...assignmentData,
        ...(carrier_booking_status ? { carrier_booking_status } : {}),
        ...(typeof unmapping_request === "boolean" ? { unmapping_request } : {}),
        ...(unmapping_reason ? { unmapping_reason } : {}),
        ...(booking_released_to ? { booking_released_to } : {}),
        ...(linerBookingDetails.length > 0 ? { liner_booking_details: linerBookingDetails } : {}),
      }

      await prisma.shipmentAssignment.update({
        where: { id: assignmentId },
        data: { data: updatedData },
      })

      // Update equipment tracking numbers in linked shipment plan
      console.log("[DEBUG] allocate_requested - Starting equipment tracking update process")
      console.log("[DEBUG] allocate_requested - Has shipmentPlan:", !!current.shipmentPlan)
      console.log("[DEBUG] allocate_requested - linerBookingDetails count:", linerBookingDetails.length)
      console.log("[DEBUG] allocate_requested - linerBookingDetails with booking numbers:", linerBookingDetails.filter(d => d.liner_booking_number).length)
      
      if (current.shipmentPlan && linerBookingDetails.some(detail => detail.liner_booking_number)) {
        console.log("[DEBUG] allocate_requested - Conditions met, proceeding with update")
        
        const shipmentPlanData = current.shipmentPlan.data as any
        console.log("[DEBUG] allocate_requested - Current shipment plan ID:", current.shipmentPlan.id)
        console.log("[DEBUG] allocate_requested - Equipment details count:", shipmentPlanData.equipment_details?.length || 0)
        
        // Log current equipment details
        if (shipmentPlanData.equipment_details) {
          console.log("[DEBUG] allocate_requested - Current equipment details:")
          shipmentPlanData.equipment_details.forEach((eq: any, idx: number) => {
            console.log(`[DEBUG]   Equipment ${idx}: ${eq.equipment_type} | ${eq.trackingNumber}`)
          })
        }
        
        // Log liner booking details
        console.log("[DEBUG] allocate_requested - Liner booking details:")
        linerBookingDetails.forEach((detail: any, idx: number) => {
          console.log(`[DEBUG]   Detail ${idx}:`)
          console.log(`[DEBUG]     - booking_for: "${detail.booking_for}"`)
          console.log(`[DEBUG]     - equipment_type: "${detail.equipment_type}"`)
          console.log(`[DEBUG]     - trackingNumber: "${detail.trackingNumber}"`)
          console.log(`[DEBUG]     - liner_booking_number: "${detail.liner_booking_number}"`)
        })
        
        // Update equipment tracking numbers with liner booking numbers
        if (shipmentPlanData.equipment_details && Array.isArray(shipmentPlanData.equipment_details)) {
          // Create a map of trackingNumber -> liner_booking_number
          const trackingToBookingMap = new Map()
          
          for (const detail of linerBookingDetails) {
            if (detail.liner_booking_number && detail.liner_booking_number.trim()) {
              // Get tracking number from booking_for field which contains "equipment_type|trackingNumber"
              let trackingNumber = null
              
              console.log(`[DEBUG] allocate_requested - Processing detail with booking_for: "${detail.booking_for}"`)
              
              if (detail.booking_for && detail.booking_for.includes("|")) {
                trackingNumber = detail.booking_for.split("|")[1]
                console.log(`[DEBUG] allocate_requested - Extracted from booking_for: "${trackingNumber}"`)
              } else if (detail.equipment_type && detail.equipment_type.includes("|")) {
                trackingNumber = detail.equipment_type.split("|")[1]
                console.log(`[DEBUG] allocate_requested - Extracted from equipment_type: "${trackingNumber}"`)
              } else if (detail.trackingNumber) {
                trackingNumber = detail.trackingNumber
                console.log(`[DEBUG] allocate_requested - Using trackingNumber field: "${trackingNumber}"`)
              }
              
              if (trackingNumber) {
                trackingToBookingMap.set(trackingNumber, detail.liner_booking_number)
                console.log(`[DEBUG] allocate_requested - MAPPED: ${trackingNumber} -> ${detail.liner_booking_number}`)
              } else {
                console.log(`[DEBUG] allocate_requested - WARNING: Could not extract tracking number from detail`)
              }
            } else {
              console.log(`[DEBUG] allocate_requested - Skipping detail without liner_booking_number`)
            }
          }
          
          console.log(`[DEBUG] allocate_requested - Final mapping has ${trackingToBookingMap.size} entries`)
          
          // Update equipment details with liner booking numbers
          let hasUpdates = false
          const originalEquipmentCount = shipmentPlanData.equipment_details.length
          
          shipmentPlanData.equipment_details = shipmentPlanData.equipment_details.map((equipment: any, idx: number) => {
            const originalTracking = equipment.trackingNumber
            const newBookingNumber = trackingToBookingMap.get(originalTracking)
            
            console.log(`[DEBUG] allocate_requested - Equipment ${idx}: checking "${originalTracking}" -> found mapping: "${newBookingNumber}"`)
            
            if (newBookingNumber && originalTracking !== newBookingNumber) {
              hasUpdates = true
              console.log(`[DEBUG] allocate_requested - UPDATING equipment ${idx}: ${originalTracking} -> ${newBookingNumber}`)
              return {
                ...equipment,
                trackingNumber: newBookingNumber,
                originalTrackingNumber: originalTracking // Keep reference to original
              }
            } else {
              console.log(`[DEBUG] allocate_requested - No update needed for equipment ${idx}`)
            }
            
            return equipment
          })
          
          console.log(`[DEBUG] allocate_requested - hasUpdates: ${hasUpdates}`)
          
          // Save the updated shipment plan if there were changes
          if (hasUpdates) {
            console.log("[DEBUG] allocate_requested - Saving updated shipment plan...")
            await prisma.shipmentPlan.update({
              where: { id: current.shipmentPlan.id },
              data: {
                data: shipmentPlanData,
              },
            })
            console.log("[DEBUG] allocate_requested - ✅ Shipment plan equipment tracking numbers updated successfully")
          } else {
            console.log("[DEBUG] allocate_requested - ❌ No updates made to shipment plan")
          }
        } else {
          console.log("[DEBUG] allocate_requested - ❌ No equipment_details array found in shipment plan")
        }
      } else {
        console.log("[DEBUG] allocate_requested - ❌ Conditions not met for equipment update")
        console.log("[DEBUG] allocate_requested - Missing shipmentPlan or no booking numbers found")
      }

      console.log("[v0] allocate_requested - allocation completed")
      return redirect(`/liner-bookings/${params.id}/edit?assignmentId=${assignmentId}`)
    }

    if (assignmentId) {
      console.log("[v0] action: assignment mode")
      const allBookingAssigned = formData.get("all_booking_assigned") === "true"
      const unmappingButtonClicked = formData.get("request_unmapping") === "true"

      const current = await prisma.shipmentAssignment.findUnique({
        where: { id: assignmentId },
        include: { shipmentPlan: true },
      })
      if (!current) {
        return Response.json({ error: "Shipment assignment not found" }, { status: 404 })
      }

      const existingData = (current.data || {}) as any
      const currentStatus = existingData?.carrier_booking_status || "Awaiting MD Approval"

      const updatedData: any = {
        ...existingData,
        ...(carrier_booking_status ? { carrier_booking_status } : {}),
        ...(typeof unmapping_request === "boolean" ? { unmapping_request } : {}),
        ...(unmapping_reason ? { unmapping_reason } : {}),
        ...(booking_released_to ? { booking_released_to } : {}),
        ...(linerBookingDetails.length > 0 ? { liner_booking_details: linerBookingDetails } : {}),
      }

      if (allBookingAssigned) {
  console.log("[v0] assignment: All Booking Assigned flow")
  updatedData.carrier_booking_status = "Booked"

  console.log("[v0] assignment: updating assignment status to Booked", {
    assignmentId,
    previousStatus: existingData?.carrier_booking_status,
    newStatus: "Booked",
  })

  // Use transaction to ensure all updates happen atomically
  await prisma.$transaction(async (tx) => {
    // Update the assignment
    await tx.shipmentAssignment.update({
      where: { id: assignmentId },
      data: { data: updatedData },
    })

    if (current.shipmentPlan) {
      const spData = ((current.shipmentPlan.data as any) || {}) as any
      const prevStatus = spData.booking_status
      spData.booking_status = "Booked"

      console.log("[v0] assignment: updating shipment plan status", {
        shipmentPlanId: current.shipmentPlan.id,
        previousStatus: prevStatus,
        newStatus: "Booked",
      })

      // Update equipment tracking numbers with liner booking numbers BEFORE updating shipment plan
      console.log("[DEBUG] Assignment All Booking Assigned - Starting equipment tracking update")
      console.log("[DEBUG] Assignment All Booking Assigned - Equipment details exists:", !!spData.equipment_details)
      console.log("[DEBUG] Assignment All Booking Assigned - Equipment details count:", spData.equipment_details?.length || 0)
      console.log("[DEBUG] Assignment All Booking Assigned - Assignment liner booking details count:", linerBookingDetails.length)

      if (spData.equipment_details && Array.isArray(spData.equipment_details) && linerBookingDetails.length > 0) {
        // Log current equipment details
        console.log("[DEBUG] Assignment All Booking Assigned - Current equipment details:")
        spData.equipment_details.forEach((eq: any, idx: number) => {
          console.log(`[DEBUG]   Equipment ${idx}: ${eq.equipment_type} | ${eq.trackingNumber}`)
        })
        
        // Log liner booking details
        console.log("[DEBUG] Assignment All Booking Assigned - Liner booking details:")
        linerBookingDetails.forEach((detail: any, idx: number) => {
          console.log(`[DEBUG]   Detail ${idx}:`)
          console.log(`[DEBUG]     - booking_for: "${detail.booking_for}"`)
          console.log(`[DEBUG]     - equipment_type: "${detail.equipment_type}"`)
          console.log(`[DEBUG]     - trackingNumber: "${detail.trackingNumber}"`)
          console.log(`[DEBUG]     - liner_booking_number: "${detail.liner_booking_number}"`)
        })

        // Create a map of trackingNumber -> liner_booking_number
        const trackingToBookingMap = new Map()
        
        for (const detail of linerBookingDetails) {
          if (detail.liner_booking_number && detail.liner_booking_number.trim()) {
            // Get tracking number from booking_for field which contains "equipment_type|trackingNumber"
            let trackingNumber = null
            
            console.log(`[DEBUG] Assignment All Booking Assigned - Processing detail with booking_for: "${detail.booking_for}"`)
            
            if (detail.booking_for && detail.booking_for.includes("|")) {
              trackingNumber = detail.booking_for.split("|")[1]
              console.log(`[DEBUG] Assignment All Booking Assigned - Extracted from booking_for: "${trackingNumber}"`)
            } else if (detail.equipment_type && detail.equipment_type.includes("|")) {
              trackingNumber = detail.equipment_type.split("|")[1]
              console.log(`[DEBUG] Assignment All Booking Assigned - Extracted from equipment_type: "${trackingNumber}"`)
            } else if (detail.trackingNumber) {
              trackingNumber = detail.trackingNumber
              console.log(`[DEBUG] Assignment All Booking Assigned - Using trackingNumber field: "${trackingNumber}"`)
            }
            
            if (trackingNumber) {
              trackingToBookingMap.set(trackingNumber, detail.liner_booking_number)
              console.log(`[DEBUG] Assignment All Booking Assigned - MAPPED: ${trackingNumber} -> ${detail.liner_booking_number}`)
            } else {
              console.log(`[DEBUG] Assignment All Booking Assigned - WARNING: Could not extract tracking number from detail`)
            }
          } else {
            console.log(`[DEBUG] Assignment All Booking Assigned - Skipping detail without liner_booking_number`)
          }
        }
        
        console.log(`[DEBUG] Assignment All Booking Assigned - Final mapping has ${trackingToBookingMap.size} entries`)
        
        // Update equipment details with liner booking numbers
        let hasUpdates = false
        spData.equipment_details = spData.equipment_details.map((equipment: any, idx: number) => {
          const originalTracking = equipment.trackingNumber
          const newBookingNumber = trackingToBookingMap.get(originalTracking)
          
          console.log(`[DEBUG] Assignment All Booking Assigned - Equipment ${idx}: checking "${originalTracking}" -> found mapping: "${newBookingNumber}"`)
          
          if (newBookingNumber && originalTracking !== newBookingNumber) {
            hasUpdates = true
            console.log(`[DEBUG] Assignment All Booking Assigned - UPDATING equipment ${idx}: ${originalTracking} -> ${newBookingNumber}`)
            return {
              ...equipment,
              trackingNumber: newBookingNumber,
              originalTrackingNumber: originalTracking // Keep reference to original
            }
          } else {
            console.log(`[DEBUG] Assignment All Booking Assigned - No update needed for equipment ${idx}`)
          }
          
          return equipment
        })
        
        console.log(`[DEBUG] Assignment All Booking Assigned - hasUpdates: ${hasUpdates}`)
        
        if (hasUpdates) {
          console.log("[DEBUG] Assignment All Booking Assigned - ✅ Equipment tracking numbers updated in shipment plan data")
        } else {
          console.log("[DEBUG] Assignment All Booking Assigned - ❌ No equipment tracking number updates made")
        }
      } else {
        console.log("[DEBUG] Assignment All Booking Assigned - ❌ Conditions not met: equipment_details or linerBookingDetails missing")
      }

      // Update shipment plan
      await tx.shipmentPlan.update({
        where: { id: current.shipmentPlan.id },
        data: { data: spData, linkedStatus: 1 },
      })

      // Update status of currently linked liner bookings to "Booked" but don't delete them
      // Only update bookings that are actually still linked (shipmentPlanId matches)
      console.log("[v0] assignment: updating linked liner bookings status to Booked", {
        shipmentPlanId: current.shipmentPlan.id,
      })

      const linkedBookingsToUpdate = await tx.linerBooking.findMany({
        where: { shipmentPlanId: current.shipmentPlan.id },
        select: { id: true, data: true }
      })

      console.log("[v0] assignment: found linked bookings to update", {
        count: linkedBookingsToUpdate.length,
        bookingIds: linkedBookingsToUpdate.map(b => b.id)
      })

      // Update each linked booking's status to "Booked"
      for (const booking of linkedBookingsToUpdate) {
        const bookingData = (booking.data as any) || {}
        await tx.linerBooking.update({
          where: { id: booking.id },
          data: {
            data: {
              ...bookingData,
              carrier_booking_status: "Booked",
            },
          },
        })
      }

      console.log("[v0] assignment: linked liner bookings status updated to Booked")
    }
  })

        // DISABLED: Cleanup logic that was incorrectly deleting properly unlinked bookings
        // This logic was intended to clean up "orphaned placeholders" but was actually
        // deleting legitimate unlinked bookings that users want to keep available.
        //
        // The problem: This logic couldn't distinguish between:
        // 1. Legitimate unlinked bookings (user clicked Unlink and wants to keep them available)
        // 2. Temporary placeholder bookings that should be cleaned up
        //
        // Since preserving user data is more important than cleanup, we're disabling this.
        
        console.log("[v0] assignment: skipping cleanup of orphaned bookings to preserve unlinked bookings")
        
        // Future cleanup logic should:
        // 1. Have explicit markers to identify temporary vs. permanent bookings
        // 2. Require user confirmation before deletion
        // 3. Run as a separate maintenance process, not during normal operations

        console.log("[v0] assignment: All Booking Assigned flow completed, redirecting")
        return redirect("/liner-bookings?tab=assignments")
      }

      // Request Unmapping flow (mirror liner-booking behavior)
      if ((unmapping_request || unmappingButtonClicked) && currentStatus === "Booked") {
        if (!unmapping_reason || unmapping_reason.trim() === "") {
          return Response.json({ error: "Unmapping reason is required" }, { status: 400 })
        }

        console.log("[v0] assignment: Request Unmapping from Booked")
        updatedData.carrier_booking_status = "Unmapping Requested"

        await prisma.shipmentAssignment.update({
          where: { id: assignmentId },
          data: { data: updatedData },
        })

        if (current.shipmentPlan) {
          const spData = ((current.shipmentPlan.data as any) || {}) as any
          const prevStatus = spData.booking_status
          spData.booking_status = "Unmapping Requested"
          await prisma.shipmentPlan.update({
            where: { id: current.shipmentPlan.id },
            data: { data: spData },
          })
          console.log("[v0] assignment: updated shipmentPlan unmapping", {
            shipmentPlanId: current.shipmentPlan.id,
            prevStatus,
            newStatus: spData.booking_status,
          })
        }

        return redirect("/liner-bookings?tab=assignments")
      }

      // No special flow: keep current status
      updatedData.carrier_booking_status = currentStatus
      await prisma.shipmentAssignment.update({
        where: { id: assignmentId },
        data: { data: updatedData },
      })
      console.log("[v0] assignment: regular update", { status: updatedData.carrier_booking_status })

      return redirect("/liner-bookings?tab=assignments")
    }

    const linerBookingData = {
      carrier_booking_status,
      unmapping_request,
      unmapping_reason,
      booking_released_to,
      liner_booking_details: linerBookingDetails,
    }

    // Check if the "All Booking Assigned" button was clicked
    const allBookingAssigned = formData.get("all_booking_assigned") === "true"

    console.log("All Booking Assigned button clicked:", allBookingAssigned)

    if (allBookingAssigned) {
      console.log("Processing 'All Booking Assigned' workflow...")
      // Update both liner booking and shipment plan statuses to "Booked"
      linerBookingData.carrier_booking_status = "Booked"

      // Update the liner booking
      const updatedLinerBooking = await prisma.linerBooking.update({
        where: { id },
        data: {
          data: linerBookingData,
        },
        include: {
          shipmentPlan: true,
        },
      })

      console.log("Liner booking updated. Has shipment plan:", !!updatedLinerBooking.shipmentPlan)

      // DISABLED: Clean up logic that was incorrectly deleting properly unlinked bookings
      // The issue was that this logic couldn't distinguish between:
      // 1. Legitimate unlinked bookings that users want to keep available
      // 2. Actual duplicate temporary bookings that should be cleaned up
      //
      // Since unlinked bookings should remain available for re-use, we're disabling
      // this cleanup logic to prevent accidental deletion of user data.
      
      console.log("Skipping cleanup of temporary bookings to preserve unlinked bookings")
      
      // If cleanup becomes necessary in the future, it should be implemented with:
      // 1. More specific criteria to identify true duplicates vs. legitimate unlinked bookings
      // 2. User confirmation before deletion
      // 3. A separate cleanup process that doesn't run during normal operations

      // Update status of other linked liner bookings to "Booked" but don't delete them
      if (updatedLinerBooking.shipmentPlan) {
        const otherLinkedBookings = await prisma.linerBooking.findMany({
          where: {
            shipmentPlanId: updatedLinerBooking.shipmentPlan.id,
            id: { not: id }, // Exclude the current liner booking
          },
        })

        if (otherLinkedBookings.length > 0) {
          console.log(`Found ${otherLinkedBookings.length} other linked liner bookings to update status`)

          // Update each booking's status to "Booked"
          for (const booking of otherLinkedBookings) {
            const bookingData = (booking.data as any) || {}
            await prisma.linerBooking.update({
              where: { id: booking.id },
              data: {
                data: {
                  ...bookingData,
                  carrier_booking_status: "Booked",
                },
              },
            })
          }

          console.log("Other linked liner bookings status updated to Booked")
        }
      }

      // Update the linked shipment plan status if it exists
      if (updatedLinerBooking.shipmentPlan) {
        const shipmentPlanData = updatedLinerBooking.shipmentPlan.data as any
        console.log("Original shipment plan status:", shipmentPlanData.booking_status)
        shipmentPlanData.booking_status = "Booked"
        console.log("Setting shipment plan status to:", shipmentPlanData.booking_status)

        // Update equipment tracking numbers with liner booking numbers
        console.log("[DEBUG] All Booking Assigned - Starting equipment tracking update")
        console.log("[DEBUG] All Booking Assigned - Equipment details exists:", !!shipmentPlanData.equipment_details)
        console.log("[DEBUG] All Booking Assigned - Equipment details count:", shipmentPlanData.equipment_details?.length || 0)
        
        if (shipmentPlanData.equipment_details && Array.isArray(shipmentPlanData.equipment_details)) {
          // Get liner booking details from the current booking
          const linerBookingData = updatedLinerBooking.data as any
          const linerBookingDetails = linerBookingData?.liner_booking_details || []
          
          console.log("[DEBUG] All Booking Assigned - Liner booking details count:", linerBookingDetails.length)
          
          // Log current equipment details
          console.log("[DEBUG] All Booking Assigned - Current equipment details:")
          shipmentPlanData.equipment_details.forEach((eq: any, idx: number) => {
            console.log(`[DEBUG]   Equipment ${idx}: ${eq.equipment_type} | ${eq.trackingNumber}`)
          })
          
          // Log liner booking details
          console.log("[DEBUG] All Booking Assigned - Liner booking details:")
          linerBookingDetails.forEach((detail: any, idx: number) => {
            console.log(`[DEBUG]   Detail ${idx}:`)
            console.log(`[DEBUG]     - booking_for: "${detail.booking_for}"`)
            console.log(`[DEBUG]     - equipment_type: "${detail.equipment_type}"`)
            console.log(`[DEBUG]     - trackingNumber: "${detail.trackingNumber}"`)
            console.log(`[DEBUG]     - liner_booking_number: "${detail.liner_booking_number}"`)
          })
          
          // Create a map of equipment_type|trackingNumber -> liner_booking_number
          const trackingToBookingMap = new Map()
          
          for (const detail of linerBookingDetails) {
            if (detail.liner_booking_number && detail.liner_booking_number.trim()) {
              // Get tracking number from booking_for field which contains "equipment_type|trackingNumber"
              let trackingNumber = null
              
              console.log(`[DEBUG] All Booking Assigned - Processing detail with booking_for: "${detail.booking_for}"`)
              
              if (detail.booking_for && detail.booking_for.includes("|")) {
                trackingNumber = detail.booking_for.split("|")[1]
                console.log(`[DEBUG] All Booking Assigned - Extracted from booking_for: "${trackingNumber}"`)
              } else if (detail.equipment_type && detail.equipment_type.includes("|")) {
                trackingNumber = detail.equipment_type.split("|")[1]
                console.log(`[DEBUG] All Booking Assigned - Extracted from equipment_type: "${trackingNumber}"`)
              } else if (detail.trackingNumber) {
                trackingNumber = detail.trackingNumber
                console.log(`[DEBUG] All Booking Assigned - Using trackingNumber field: "${trackingNumber}"`)
              }
              
              if (trackingNumber) {
                trackingToBookingMap.set(trackingNumber, detail.liner_booking_number)
                console.log(`[DEBUG] All Booking Assigned - MAPPED: ${trackingNumber} -> ${detail.liner_booking_number}`)
              } else {
                console.log(`[DEBUG] All Booking Assigned - WARNING: Could not extract tracking number from detail`)
              }
            } else {
              console.log(`[DEBUG] All Booking Assigned - Skipping detail without liner_booking_number`)
            }
          }
          
          console.log(`[DEBUG] All Booking Assigned - Final mapping has ${trackingToBookingMap.size} entries`)
          
          // Update equipment details with liner booking numbers
          let hasUpdates = false
          shipmentPlanData.equipment_details = shipmentPlanData.equipment_details.map((equipment: any, idx: number) => {
            const originalTracking = equipment.trackingNumber
            const newBookingNumber = trackingToBookingMap.get(originalTracking)
            
            console.log(`[DEBUG] All Booking Assigned - Equipment ${idx}: checking "${originalTracking}" -> found mapping: "${newBookingNumber}"`)
            
            if (newBookingNumber && originalTracking !== newBookingNumber) {
              hasUpdates = true
              console.log(`[DEBUG] All Booking Assigned - UPDATING equipment ${idx}: ${originalTracking} -> ${newBookingNumber}`)
              return {
                ...equipment,
                trackingNumber: newBookingNumber,
                originalTrackingNumber: originalTracking // Keep reference to original
              }
            } else {
              console.log(`[DEBUG] All Booking Assigned - No update needed for equipment ${idx}`)
            }
            
            return equipment
          })
          
          console.log(`[DEBUG] All Booking Assigned - hasUpdates: ${hasUpdates}`)
        } else {
          console.log("[DEBUG] All Booking Assigned - ❌ No equipment_details array found")
        }

        const updatedShipmentPlan = await prisma.shipmentPlan.update({
          where: { id: updatedLinerBooking.shipmentPlan.id },
          data: {
            data: shipmentPlanData,
            linkedStatus: 1,
          },
        })

        console.log("Shipment plan updated successfully:", updatedShipmentPlan.id)
      } else {
        console.log("No linked shipment plan found")
      }
    } else {
      // Get current liner booking to check actual status
      const currentLinerBooking = await prisma.linerBooking.findUnique({
        where: { id },
        include: { shipmentPlan: true },
      })

      if (!currentLinerBooking) {
        return Response.json({ error: "Liner booking not found" }, { status: 404 })
      }

      const currentData = currentLinerBooking.data as any
      const currentStatus = currentData?.carrier_booking_status || "Awaiting MD Approval"

      console.log("=== UNMAPPING DEBUG ===")
      console.log("unmapping_request from form:", unmapping_request)
      console.log("currentStatus:", currentStatus)
      console.log("unmapping_reason:", unmapping_reason)
      console.log("=== END UNMAPPING DEBUG ===")

      // Check if unmapping was requested via the "Request Unmapping" button
      if (unmapping_request && currentStatus === "Booked") {
        // Validate that unmapping reason is provided
        if (!unmapping_reason || unmapping_reason.trim() === "") {
          return Response.json({ error: "Unmapping reason is required" }, { status: 400 })
        }

        console.log("Unmapping requested via button - updating status from Booked to Unmapping Requested")
        linerBookingData.carrier_booking_status = "Unmapping Requested"

        // Also update the linked shipment plan status to reflect unmapping request
        if (currentLinerBooking.shipmentPlan) {
          const shipmentPlanData = currentLinerBooking.shipmentPlan.data as any
          shipmentPlanData.booking_status = "Unmapping Requested"

          await prisma.shipmentPlan.update({
            where: { id: currentLinerBooking.shipmentPlan.id },
            data: {
              data: shipmentPlanData,
            },
          })
          console.log("Updated shipment plan status to Unmapping Requested")
        }
      } else {
        console.log("No unmapping request or status not Booked - keeping current status:", currentStatus)
        // Keep the current status if no special action
        linerBookingData.carrier_booking_status = currentStatus
      }

      // Regular update
      const updatedLinerBooking = await prisma.linerBooking.update({
        where: { id },
        data: {
          data: linerBookingData,
        },
        include: {
          shipmentPlan: true,
        },
      })

      // Update equipment tracking numbers in linked shipment plan if it exists
      console.log("[DEBUG] Regular update - Starting equipment tracking update process")
      console.log("[DEBUG] Regular update - Has shipmentPlan:", !!updatedLinerBooking.shipmentPlan)
      console.log("[DEBUG] Regular update - linerBookingDetails count:", linerBookingDetails.length)
      console.log("[DEBUG] Regular update - linerBookingDetails with booking numbers:", linerBookingDetails.filter(d => d.liner_booking_number).length)
      
      if (updatedLinerBooking.shipmentPlan && linerBookingDetails.some(detail => detail.liner_booking_number)) {
        console.log("[DEBUG] Regular update - Conditions met, proceeding with update")
        
        const shipmentPlanData = updatedLinerBooking.shipmentPlan.data as any
        console.log("[DEBUG] Regular update - Shipment plan ID:", updatedLinerBooking.shipmentPlan.id)
        console.log("[DEBUG] Regular update - Equipment details count:", shipmentPlanData.equipment_details?.length || 0)
        
        // Log current equipment details
        if (shipmentPlanData.equipment_details) {
          console.log("[DEBUG] Regular update - Current equipment details:")
          shipmentPlanData.equipment_details.forEach((eq: any, idx: number) => {
            console.log(`[DEBUG]   Equipment ${idx}: ${eq.equipment_type} | ${eq.trackingNumber}`)
          })
        }
        
        // Log liner booking details
        console.log("[DEBUG] Regular update - Liner booking details:")
        linerBookingDetails.forEach((detail: any, idx: number) => {
          console.log(`[DEBUG]   Detail ${idx}:`)
          console.log(`[DEBUG]     - booking_for: "${detail.booking_for}"`)
          console.log(`[DEBUG]     - equipment_type: "${detail.equipment_type}"`)
          console.log(`[DEBUG]     - trackingNumber: "${detail.trackingNumber}"`)
          console.log(`[DEBUG]     - liner_booking_number: "${detail.liner_booking_number}"`)
        })
        
        // Update equipment tracking numbers with liner booking numbers
        if (shipmentPlanData.equipment_details && Array.isArray(shipmentPlanData.equipment_details)) {
          // Create a map of trackingNumber -> liner_booking_number
          const trackingToBookingMap = new Map()
          
          for (const detail of linerBookingDetails) {
            if (detail.liner_booking_number && detail.liner_booking_number.trim()) {
              // Get tracking number from booking_for field which contains "equipment_type|trackingNumber"
              let trackingNumber = null
              
              console.log(`[DEBUG] Regular update - Processing detail with booking_for: "${detail.booking_for}"`)
              
              if (detail.booking_for && detail.booking_for.includes("|")) {
                trackingNumber = detail.booking_for.split("|")[1]
                console.log(`[DEBUG] Regular update - Extracted from booking_for: "${trackingNumber}"`)
              } else if (detail.equipment_type && detail.equipment_type.includes("|")) {
                trackingNumber = detail.equipment_type.split("|")[1]
                console.log(`[DEBUG] Regular update - Extracted from equipment_type: "${trackingNumber}"`)
              } else if (detail.trackingNumber) {
                trackingNumber = detail.trackingNumber
                console.log(`[DEBUG] Regular update - Using trackingNumber field: "${trackingNumber}"`)
              }
              
              if (trackingNumber) {
                trackingToBookingMap.set(trackingNumber, detail.liner_booking_number)
                console.log(`[DEBUG] Regular update - MAPPED: ${trackingNumber} -> ${detail.liner_booking_number}`)
              } else {
                console.log(`[DEBUG] Regular update - WARNING: Could not extract tracking number from detail`)
              }
            } else {
              console.log(`[DEBUG] Regular update - Skipping detail without liner_booking_number`)
            }
          }
          
          console.log(`[DEBUG] Regular update - Final mapping has ${trackingToBookingMap.size} entries`)
          
          // Update equipment details with liner booking numbers
          let hasUpdates = false
          shipmentPlanData.equipment_details = shipmentPlanData.equipment_details.map((equipment: any, idx: number) => {
            const originalTracking = equipment.trackingNumber
            const newBookingNumber = trackingToBookingMap.get(originalTracking)
            
            console.log(`[DEBUG] Regular update - Equipment ${idx}: checking "${originalTracking}" -> found mapping: "${newBookingNumber}"`)
            
            if (newBookingNumber && originalTracking !== newBookingNumber) {
              hasUpdates = true
              console.log(`[DEBUG] Regular update - UPDATING equipment ${idx}: ${originalTracking} -> ${newBookingNumber}`)
              return {
                ...equipment,
                trackingNumber: newBookingNumber,
                originalTrackingNumber: originalTracking // Keep reference to original
              }
            } else {
              console.log(`[DEBUG] Regular update - No update needed for equipment ${idx}`)
            }
            
            return equipment
          })
          
          console.log(`[DEBUG] Regular update - hasUpdates: ${hasUpdates}`)
          
          // Save the updated shipment plan if there were changes
          if (hasUpdates) {
            console.log("[DEBUG] Regular update - Saving updated shipment plan...")
            await prisma.shipmentPlan.update({
              where: { id: updatedLinerBooking.shipmentPlan.id },
              data: {
                data: shipmentPlanData,
              },
            })
            console.log("[DEBUG] Regular update - ✅ Shipment plan equipment tracking numbers updated successfully")
          } else {
            console.log("[DEBUG] Regular update - ❌ No updates made to shipment plan")
          }
        } else {
          console.log("[DEBUG] Regular update - ❌ No equipment_details array found in shipment plan")
        }
      } else {
        console.log("[DEBUG] Regular update - ❌ Conditions not met for equipment update")
        console.log("[DEBUG] Regular update - Missing shipmentPlan or no booking numbers found")
      }
    }

    return redirect("/liner-bookings")
  } catch (error) {
    console.error("Error updating liner booking:", error)
    return Response.json({ error: "Failed to update liner booking" }, { status: 500 })
  }
}

export default function EditLinerBookingPage() {
  const { user, linerBooking, availableShipmentPlans, dataPoints, availableLinerBookings, isAssignment, availableEquipment, pendingUnmappingRequests } =
    useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()

  return (
    <AdminLayout user={user}>
      <LinerBookingForm
        mode="edit"
        linerBooking={linerBooking}
        availableShipmentPlans={availableShipmentPlans}
        dataPoints={dataPoints}
        actionData={actionData}
        user={user}
        availableLinerBookings={availableLinerBookings}
        isAssignment={isAssignment}
        availableEquipment={availableEquipment}
        pendingUnmappingRequests={pendingUnmappingRequests}
      />
    </AdminLayout>
  )
}
