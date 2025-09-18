import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData, redirect, useActionData } from "react-router"
import { requireAuth } from "~/lib/auth.server"
import { prisma } from "~/lib/prisma.server"
import { AdminLayout } from "~/components/AdminLayout"
import { LinerBookingForm } from "~/components/LinerBookingForm"
import fs from "fs/promises"
import path from "path"

export const meta: MetaFunction = () => {
  return [{ title: "New Liner Booking - Cargo Care" }, { name: "description", content: "Create a new liner booking" }]
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request)

    // Only allow LINER_BOOKING_TEAM and ADMIN
    if (user.role.name !== "LINER_BOOKING_TEAM" && user.role.name !== "ADMIN") {
      return redirect("/dashboard")
    }

    // Fetch data points for dropdowns and available shipment plans
    const [availableShipmentPlans, carriers, vessels, organizations, equipment, loadingPorts, portsOfDischarge, destinationCountries] = await Promise.all([
      prisma.shipmentPlan.findMany({
        where: {
          linerBookingId: null, // Only unlinked plans
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

    return {
      user,
      availableShipmentPlans,
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
    return redirect("/login")
  }
}

async function handleFileUpload(file: FormDataEntryValue | null): Promise<string | null> {
  console.log("handleFileUpload called with:", file) // ADD THIS LINE
  console.log("File type:", typeof file) // ADD THIS LINE

  if (!file || typeof file === "string") {
    console.log("No file or string detected, returning:", typeof file === "string" ? file : null) // ADD THIS LINE
    return typeof file === "string" ? file : null
  }

  const uploadedFile = file as File
  console.log("File name:", uploadedFile.name) // ADD THIS LINE
  console.log("File size:", uploadedFile.size) // ADD THIS LINE

  if (uploadedFile.size === 0) {
    console.log("File size is 0, returning null") // ADD THIS LINE
    return null
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "liner-booking-pdfs")
  await fs.mkdir(uploadDir, { recursive: true })

  const uniqueFilename = `${Date.now()}-${uploadedFile.name}`
  const filePath = path.join(uploadDir, uniqueFilename)

  console.log("Saving file to:", filePath) // ADD THIS LINE

  const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer())
  console.log("File buffer size:", fileBuffer.length) // ADD THIS LINE

  await fs.writeFile(filePath, fileBuffer)
  console.log("File saved successfully") // ADD THIS LINE

  return `/uploads/liner-booking-pdfs/${uniqueFilename}`
}

export async function action({ request }: ActionFunctionArgs) {
  console.log("New liner booking action called")
  try {
    const user = await requireAuth(request)

    // Only allow LINER_BOOKING_TEAM and ADMIN
    if (user.role.name !== "LINER_BOOKING_TEAM" && user.role.name !== "ADMIN") {
      return redirect("/dashboard")
    }

    const formData = await request.formData()
    console.log("Creating new liner booking")

    // Get form values
    const carrier_booking_status = formData.get("carrier_booking_status") as string
    const unmapping_request = formData.get("unmapping_request") === "true"
    const unmapping_reason = formData.get("unmapping_reason") as string
    const booking_released_to = formData.get("booking_released_to") as string
    const link_to_shipment_plan = formData.get("link_to_shipment_plan") as string

    // Parse liner booking details from form data
    const linerBookingDetails: any[] = []
    let detailIndex = 0
    while (formData.get(`liner_booking_details[${detailIndex}][temporary_booking_number]`) !== null) {
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

      const originalPlannedVessel = (formData.get(
        `liner_booking_details[${detailIndex}][original_planned_vessel]`,
      ) || "") as string
      
      console.log(`[DEBUG] Detail ${detailIndex} - original_planned_vessel:`, originalPlannedVessel)
      console.log(`[DEBUG] Detail ${detailIndex} - all form data for this detail:`, {
        temporary_booking_number: formData.get(`liner_booking_details[${detailIndex}][temporary_booking_number]`),
        carrier: formData.get(`liner_booking_details[${detailIndex}][carrier]`),
        original_planned_vessel: originalPlannedVessel,
      })

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
        contract: formData.get(`liner_booking_details[${detailIndex}][contract]`) as string,
        original_planned_vessel: String(originalPlannedVessel || ""),
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
        equipment_type: formData.get(`liner_booking_details[${detailIndex}][equipment_type]`) as string,
        equipment_quantity: formData.get(`liner_booking_details[${detailIndex}][equipment_quantity]`) as string,
        booking_for: formData.get(`liner_booking_details[${detailIndex}][booking_for]`) as string,
        loading_port: formData.get(`liner_booking_details[${detailIndex}][loading_port]`) as string,
        destination_country: formData.get(`liner_booking_details[${detailIndex}][destination_country]`) as string,
        port_of_discharge: formData.get(`liner_booking_details[${detailIndex}][port_of_discharge]`) as string,
      })
      detailIndex++
    }

    // Validate mandatory fields for liner booking team
    const errors: string[] = [];

    linerBookingDetails.forEach((detail, index) => {
      if (!detail.liner_booking_number || detail.liner_booking_number.trim() === '') {
        errors.push(`Liner Booking Number is required for equipment ${index + 1}`);
      }
      if (!detail.carrier || detail.carrier.trim() === '') {
        errors.push(`Carrier is required for equipment ${index + 1}`);
      }
      if (!detail.e_t_d_of_original_planned_vessel) {
        errors.push(`ETD of Original Planned Vessel is required for equipment ${index + 1}`);
      }
      if (!detail.empty_pickup_validity_from) {
        errors.push(`Empty Pickup Validity From is required for equipment ${index + 1}`);
      }
    });

    if (errors.length > 0) {
      return {
        error: errors.join('; ')
      };
    }

    // Fan out creation: create 1 LinerBooking row per equipment detail (and per quantity if provided)
    const baseData = {
      carrier_booking_status,
      unmapping_request,
      unmapping_reason,
      booking_released_to,
    }

    const created: { id: string }[] = []

    for (const d of linerBookingDetails) {
      // If a quantity sneaks in, expand to N rows; otherwise default to 1
      const qty = Number.parseInt(d?.equipment_quantity || "1") || 1
      for (let i = 0; i < qty; i++) {
        const dataForOne = {
          ...baseData,
          liner_booking_details: [d], // one equipment per booking row
        }
        
        console.log(`[DEBUG] Saving to database - liner_booking_details:`, JSON.stringify(d, null, 2))
        console.log(`[DEBUG] dataForOne structure:`, JSON.stringify(dataForOne, null, 2))
        console.log(`[DEBUG] d.original_planned_vessel specifically:`, d.original_planned_vessel)
        
        const createdRow = await prisma.linerBooking.create({
          data: {
            data: dataForOne as any,
            userId: user.id,
          },
        })
        
        console.log(`[DEBUG] Created liner booking with ID:`, createdRow.id)
        
        // Verify what was actually saved
        const savedData = await prisma.linerBooking.findUnique({
          where: { id: createdRow.id },
          select: { data: true }
        })
        console.log(`[DEBUG] What was actually saved to database:`, JSON.stringify(savedData, null, 2))
        created.push({ id: createdRow.id })
      }
    }

    console.log(
      "[v0] Created liner bookings (fan-out):",
      created.map((c) => c.id),
    )

    // Only link to a shipment plan if exactly one booking was created (schema has unique linerBookingId)
    if (link_to_shipment_plan && created.length === 1) {
      console.log("[v0] Linking single booking to shipment plan:", link_to_shipment_plan, created[0].id)
      await prisma.shipmentPlan.update({
        where: { id: link_to_shipment_plan },
        data: {
          linerBookingId: created[0].id,
        },
      })
      console.log("[v0] Shipment plan linked successfully")
    } else if (link_to_shipment_plan && created.length !== 1) {
      console.log(
        "[v0] Skipping link_to_shipment_plan because multiple bookings were created:",
        created.length,
        "plan:",
        link_to_shipment_plan,
      )
    }

    return redirect(`/liner-bookings`)
  } catch (error) {
    console.error("Error creating liner booking:", error)
    return { error: "Failed to create liner booking. Please try again." }
  }
}

export default function NewLinerBooking() {
  const { user, availableShipmentPlans, dataPoints } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()

  return (
    <AdminLayout user={user}>
      <LinerBookingForm
        mode="new"
        availableShipmentPlans={availableShipmentPlans}
        dataPoints={dataPoints}
        actionData={actionData}
      />
    </AdminLayout>
  )
}
