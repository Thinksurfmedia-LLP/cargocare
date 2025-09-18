import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData, useNavigation, redirect, useActionData, Link } from "react-router"
import { requireAuth } from "~/lib/auth.server"
import { prisma } from "~/lib/prisma.server"
import { AdminLayout } from "~/components/AdminLayout"
import { ShipmentPlanForm } from "~/components/ShipmentPlanForm"
import { Button } from "~/components/ui/button"
import { Label } from "~/components/ui/label"

export const meta: MetaFunction = () => {
  return [{ title: "Edit Shipment Plan - Cargo Care" }, { name: "description", content: "Edit shipment plan" }]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request)

    // Only allow SHIPMENT_PLAN_TEAM and ADMIN
    if (user.role.name !== "SHIPMENT_PLAN_TEAM" && user.role.name !== "ADMIN" && user.role.name !== "MD") {
      return redirect("/dashboard")
    }

    const planId = params.id
    if (!planId) {
      return redirect("/shipment-plans")
    }
    const shipmentPlan = await prisma.shipmentPlan.findUnique({
      where: { id: planId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        linerBooking: {
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
        shipmentAssignment: {
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

    if (!shipmentPlan) {
      return redirect("/shipment-plans")
    }

    // Check permissions
    if (user.role.name !== "ADMIN" && user.role.name !== "MD") {
      // For SHIPMENT_PLAN_TEAM, check if user created the plan OR if it belongs to their business branch
      if (user.role.name === "SHIPMENT_PLAN_TEAM") {
        const isOwner = shipmentPlan.userId === user.id;
        const isSameBranch = user.businessBranch?.name &&
          (shipmentPlan.data as any)?.bussiness_branch === user.businessBranch.name;

        if (!isOwner && !isSameBranch) {
          return redirect("/shipment-plans");
        }
      } else {
        // For other roles, use the existing logic
        if (shipmentPlan.userId !== user.id) {
          return redirect("/shipment-plans");
        }
      }
    }

    // Fetch data points for dropdowns
    const [
      allBusinessBranches,
      commodities,
      equipment,
      loadingPorts,
      portsOfDischarge,
      destinationCountries,
      vessels,
      carriers,
      organizations,
      linerBookingUsers,
    ] = await Promise.all([
      prisma.businessBranch.findMany({ orderBy: { name: "asc" } }),
      prisma.commodity.findMany({ orderBy: { name: "asc" } }),
      prisma.equipment.findMany({ orderBy: { name: "asc" } }),
      prisma.loadingPort.findMany({ orderBy: { name: "asc" } }),
      prisma.portOfDischarge.findMany({ orderBy: { name: "asc" } }),
      prisma.destinationCountry.findMany({ orderBy: { name: "asc" } }),
      prisma.vessel.findMany({ orderBy: { name: "asc" } }),
      prisma.carrier.findMany({ orderBy: { name: "asc" } }),
      prisma.organization.findMany({ orderBy: { name: "asc" } }),
      prisma.user.findMany({
        where: {
          role: {
            name: "LINER_BOOKING_TEAM",
          },
        },
        include: {
          role: true,
          businessBranch: true, // include business branch info
        },
        orderBy: {
          name: "asc",
        },
      }),
    ])

    // Fetch individual equipment unmapping requests for this shipment plan
    const individualUnmappingRequests = await prisma.individualEquipmentUnmappingRequest.findMany({
      where: {
        shipmentPlanId: planId,
        status: "PENDING",
      },
      include: {
        requestedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        requestedAt: "desc",
      },
    })

    // Filter business branches based on user's role and assigned branch
    let businessBranches = allBusinessBranches;
    if (user.role.name === "SHIPMENT_PLAN_TEAM" && user.businessBranch) {
      // SHIPMENT_PLAN_TEAM users can only edit shipment plans for their assigned business branch
      businessBranches = allBusinessBranches.filter(branch => branch.id === user.businessBranch?.id);
    }
    // ADMIN users can edit any business branch

    return {
      user,
      shipmentPlan,
      individualUnmappingRequests,
      dataPoints: {
        businessBranches,
        commodities,
        equipment,
        loadingPorts,
        portsOfDischarge,
        destinationCountries,
        vessels,
        carriers,
        organizations,
        linerBookingUsers,
      },
    }
  } catch (error) {
    return redirect("/login")
  }
}

// Helper function to generate equipment code based on equipment type - Updated with your specifications
function generateEquipmentCode(equipmentType: string) {
  if (!equipmentType) return "EQP"

  const type = equipmentType.toLowerCase()

  // Standard containers
  if (type.includes("20ft standard container") || type.includes("20' standard container")) return "20SC"
  if (type.includes("40ft standard container") || type.includes("40' standard container")) return "40SC"

  // High Cube containers
  if (type.includes("40ft high cube container") || type.includes("40' high cube container")) return "40HCC"
  if (type.includes("45ft high cube container") || type.includes("45' high cube container")) return "45HCC"

  // Refrigerated containers
  if (type.includes("20ft refrigerated container") || type.includes("20' refrigerated container")) return "20RC"
  if (type.includes("40ft refrigerated container") || type.includes("40' refrigerated container")) return "40RC"

  // Open Top containers
  if (type.includes("20ft open top container") || type.includes("20' open top container")) return "20OTC"
  if (type.includes("40ft open top container") || type.includes("40' open top container")) return "40OTC"

  // Flat Rack containers
  if (type.includes("20ft flat rack container") || type.includes("20' flat rack container")) return "20FRC"
  if (type.includes("40ft flat rack container") || type.includes("40' flat rack container")) return "40FRC"

  // Tank containers
  if (type.includes("20ft tank container") || type.includes("20' tank container")) return "20TC"
  if (type.includes("40ft tank container") || type.includes("40' tank container")) return "40TC"

  // Special containers
  if (type.includes("platform container")) return "PC"
  if (type.includes("bulk container")) return "BC"
  if (type.includes("ventilated container")) return "VC"
  if (type.includes("insulated container")) return "IC"
  if (type.includes("hard top container")) return "HTC"
  if (type.includes("side door container")) return "SDC"
  if (type.includes("double door container")) return "DDC"
  if (type.includes("thermal container")) return "TC"

  // Generic 20ft containers (fallback)
  if (type.includes("20ft") || type.includes("20'")) {
    if (type.includes("dry")) return "20SC"
    if (type.includes("reefer")) return "20RC"
    return "20SC" // Default 20ft to Standard Container
  }

  // Generic 40ft containers (fallback)
  if (type.includes("40ft") || type.includes("40'")) {
    if (type.includes("dry")) return "40SC"
    if (type.includes("reefer")) return "40RC"
    if (type.includes("high cube") || type.includes("hc")) return "40HCC"
    return "40SC" // Default 40ft to Standard Container
  }

  // Generic 45ft containers (fallback)
  if (type.includes("45ft") || type.includes("45'")) {
    return "45HCC" // Default 45ft to High Cube Container
  }

  // Special equipment (fallback)
  if (type.includes("lcl")) return "LCL"
  if (type.includes("break bulk")) return "BB"
  if (type.includes("roro")) return "RORO"

  // Ultimate fallback - use first 3-5 characters, uppercase, alphanumeric only
  return equipmentType
    .substring(0, 5)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .padEnd(3, "X")
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request)

    // Only allow SHIPMENT_PLAN_TEAM and ADMIN
    if (user.role.name !== "SHIPMENT_PLAN_TEAM" && user.role.name !== "ADMIN" && user.role.name !== "MD") {
      return redirect("/dashboard")
    }

    const planId = params.id
    if (!planId) {
      return redirect("/shipment-plans")
    }

    // Check if the plan exists and user has permission
    const existingPlan = await prisma.shipmentPlan.findUnique({
      where: { id: planId },
    })

    if (!existingPlan) {
      return { error: "Shipment plan not found" }
    }

    if (user.role.name !== "ADMIN" && user.role.name !== "MD" && existingPlan.userId !== user.id) {
      return { error: "You don't have permission to edit this shipment plan" }
    }
    const formData = await request.formData()

    // Check if unmapping approval or rejection was requested
    const approveUnmapping = formData.get("approve_unmapping") === "true"
    const rejectUnmapping = formData.get("reject_unmapping") === "true"

    if (approveUnmapping) {
      const currentPlan = await prisma.shipmentPlan.findUnique({
        where: { id: planId },
        include: { linerBooking: true, shipmentAssignment: true },
      })

      if (!currentPlan) {
        return redirect("/shipment-plans")
      }

      const planData = currentPlan.data as any
      const linkedType = currentPlan.linerBooking
        ? "linerBooking"
        : currentPlan.shipmentAssignment
          ? "shipmentAssignment"
          : null

      console.log("[v0] approve_unmapping", {
        planId,
        linkedType,
        hasEquipments: Array.isArray(planData?.equipment_details) ? planData.equipment_details.length : 0,
      })

      if (!linkedType) {
        return redirect("/shipment-plans")
      }

      const original = linkedType === "linerBooking" ? currentPlan.linerBooking! : currentPlan.shipmentAssignment!
      const originalData = (original.data as any) || {}

      if (planData.equipment_details && Array.isArray(planData.equipment_details)) {
        for (let i = 0; i < planData.equipment_details.length; i++) {
          const equipment = planData.equipment_details[i]

          // Find the corresponding liner booking detail for this equipment
          let correspondingLinerBookingDetail = null
          if (originalData.liner_booking_details && Array.isArray(originalData.liner_booking_details)) {
            correspondingLinerBookingDetail =
              originalData.liner_booking_details.find(
                (detail: any) => detail.trackingNumber === equipment.trackingNumber,
              ) ||
              originalData.liner_booking_details[i] ||
              originalData.liner_booking_details[0]
          }

          // Ensure the liner booking detail has all necessary fields from shipment plan
          const enrichedLinerBookingDetail = {
            ...correspondingLinerBookingDetail,
            // Populate missing fields from shipment plan data
            carrier: correspondingLinerBookingDetail?.carrier || planData.container_movement?.carrier_and_vessel_preference?.carrier || "",
            original_planned_vessel: correspondingLinerBookingDetail?.original_planned_vessel || planData.container_movement?.carrier_and_vessel_preference?.vessel || "",
            etd: correspondingLinerBookingDetail?.etd || planData.container_movement?.carrier_and_vessel_preference?.preferred_etd || "",
            e_t_d_of_original_planned_vessel: correspondingLinerBookingDetail?.e_t_d_of_original_planned_vessel || planData.container_movement?.carrier_and_vessel_preference?.preferred_etd || "",
            trackingNumber: equipment.trackingNumber,
            temporaryBookingNumber: correspondingLinerBookingDetail?.temporaryBookingNumber || `TEMP-${equipment.trackingNumber}`,
            mbl_number: correspondingLinerBookingDetail?.mbl_number || "",
            contact: correspondingLinerBookingDetail?.contact || "",
            equipment_type: correspondingLinerBookingDetail?.equipment_type || equipment.equipment_type || "",
            equipment_quantity: correspondingLinerBookingDetail?.equipment_quantity || 1,
            liner_booking_number: correspondingLinerBookingDetail?.liner_booking_number || "",
          }

          // Create an individual AVAILABLE liner booking per equipment
          await prisma.linerBooking.create({
            data: {
              data: {
                ...originalData,
                carrier_booking_status: "Ready for Re-linking",
                equipment_details: [equipment],
                liner_booking_details: [enrichedLinerBookingDetail],
                unmapping_request: false,
                unmapping_reason: "",
                // Preserve shipment plan reference data
                reference_number: planData.reference_number,
                bussiness_branch: planData.bussiness_branch,
                shipment_type: planData.shipment_type,
              },
              userId: original.userId,
              assignBookingId: original.assignBookingId || null,
              shipmentPlanId: null, // available, not linked to any plan
            },
          })
        }
      }

      // Delete the original linked bookings since we've created individual ones
      if (linkedType === "linerBooking") {
        // Find and delete ALL liner bookings linked to this shipment plan
        // This includes the main booking and any others created during "All Booking Assigned"
        const allLinkedBookings = await prisma.linerBooking.findMany({
          where: { shipmentPlanId: currentPlan.id },
          select: { id: true }
        })

        console.log("[v0] approve_unmapping: found all linked bookings to delete", {
          count: allLinkedBookings.length,
          bookingIds: allLinkedBookings.map(b => b.id)
        })

        // Delete all linked bookings since we've created individual ones above
        if (allLinkedBookings.length > 0) {
          await prisma.linerBooking.deleteMany({
            where: { shipmentPlanId: currentPlan.id },
          })

          console.log("[v0] approve_unmapping: deleted all linked bookings")
        }
      } else {
        const clearedAssignmentData = {
          ...originalData,
          carrier_booking_status: "Awaiting Booking",
          unmapping_request: false,
          unmapping_reason: "",
          equipment_details: [], // clear linked equipments
          liner_booking_details: [], // clear booking detail groupings, they'll exist on split records
        }

        await prisma.shipmentAssignment.update({
          where: { id: currentPlan.shipmentAssignment!.id },
          data: {
            data: clearedAssignmentData,
            // keep relation as-is; plan will be marked unlinked for UI
            shipmentPlanId: currentPlan.id,
          },
        })

        console.log("[v0] approve_unmapping: cleared assignment equipment_details/liner_booking_details", {
          assignmentId: currentPlan.shipmentAssignment!.id,
          planId,
        })

        // Delete any liner bookings that were linked to this shipment plan during assignment
        // since we've already created individual ones above
        const linkedBookings = await prisma.linerBooking.findMany({
          where: { shipmentPlanId: currentPlan.id },
          select: { id: true }
        })

        console.log("[v0] approve_unmapping: found linked bookings for assignment to delete", {
          count: linkedBookings.length,
          bookingIds: linkedBookings.map(b => b.id)
        })

        // Delete all linked bookings since we've created individual ones above
        if (linkedBookings.length > 0) {
          await prisma.linerBooking.deleteMany({
            where: { shipmentPlanId: currentPlan.id },
          })

          console.log("[v0] approve_unmapping: deleted linked bookings for assignment")
        }
      }

      // Revert equipment tracking numbers back to original temporary numbers
      console.log("[DEBUG] approve_unmapping - Starting equipment tracking number reversion")
      const revertedPlanData = { ...planData }

      if (revertedPlanData.equipment_details && Array.isArray(revertedPlanData.equipment_details)) {
        console.log("[DEBUG] approve_unmapping - Equipment details count:", revertedPlanData.equipment_details.length)

        revertedPlanData.equipment_details = revertedPlanData.equipment_details.map((equipment: any, idx: number) => {
          const currentTracking = equipment.trackingNumber
          const originalTracking = equipment.originalTrackingNumber || currentTracking

          console.log(`[DEBUG] approve_unmapping - Equipment ${idx}: reverting "${currentTracking}" -> "${originalTracking}"`)

          return {
            ...equipment,
            trackingNumber: originalTracking,
            // Clear the originalTrackingNumber since we've reverted
            originalTrackingNumber: undefined
          }
        })

        console.log("[DEBUG] approve_unmapping - ✅ Equipment tracking numbers reverted to original temporary numbers")
      } else {
        console.log("[DEBUG] approve_unmapping - ❌ No equipment_details found to revert")
      }

      // Update shipment plan status and unlink marker with reverted equipment tracking numbers
      await prisma.shipmentPlan.update({
        where: { id: planId },
        data: {
          data: {
            ...revertedPlanData,
            booking_status: "Awaiting Booking",
          },
          linkedStatus: 0,
        },
      })

      return redirect("/shipment-plans")
    }

    if (rejectUnmapping) {
      const currentPlan = await prisma.shipmentPlan.findUnique({
        where: { id: planId },
        include: { linerBooking: true, shipmentAssignment: true },
      })

      if (!currentPlan) {
        return redirect("/shipment-plans")
      }

      const linkedType = currentPlan.linerBooking
        ? "linerBooking"
        : currentPlan.shipmentAssignment
          ? "shipmentAssignment"
          : null

      console.log("[v0] reject_unmapping", { planId, linkedType })

      if (!linkedType) {
        return redirect("/shipment-plans")
      }

      const originalData =
        linkedType === "linerBooking"
          ? (currentPlan.linerBooking!.data as any) || {}
          : (currentPlan.shipmentAssignment!.data as any) || {}

      if (linkedType === "linerBooking") {
        await prisma.linerBooking.update({
          where: { id: currentPlan.linerBooking!.id },
          data: {
            data: {
              ...originalData,
              carrier_booking_status: "Booked",
              unmapping_request: false,
              unmapping_reason: "",
            },
          },
        })
      } else {
        await prisma.shipmentAssignment.update({
          where: { id: currentPlan.shipmentAssignment!.id },
          data: {
            data: {
              ...originalData,
              carrier_booking_status: "Booked",
              unmapping_request: false,
              unmapping_reason: "",
            },
          },
        })
      }

      return redirect("/shipment-plans")
    }

    // Handle individual equipment unmapping approval/rejection
    const approveIndividualUnmapping = formData.get("approve_individual_unmapping") === "true"
    const rejectIndividualUnmapping = formData.get("reject_individual_unmapping") === "true"
    const unmappingRequestId = formData.get("unmapping_request_id") as string

    if (approveIndividualUnmapping && unmappingRequestId) {
      console.log("[v0] approve_individual_unmapping action started", {
        unmappingRequestId,
        planId
      })

      // Get the unmapping request
      const unmappingRequest = await prisma.individualEquipmentUnmappingRequest.findUnique({
        where: { id: unmappingRequestId },
        include: { shipmentPlan: true }
      })

      if (!unmappingRequest || unmappingRequest.shipmentPlanId !== planId) {
        return Response.json({ error: "Unmapping request not found or does not belong to this shipment plan" }, { status: 404 })
      }

      // Update the unmapping request status
      await prisma.individualEquipmentUnmappingRequest.update({
        where: { id: unmappingRequestId },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedBy: user.id,
        }
      })

      // Check if there are any other pending unmapping requests for this shipment plan
      const remainingPendingRequests = await prisma.individualEquipmentUnmappingRequest.count({
        where: {
          shipmentPlanId: planId,
          status: "PENDING"
        }
      });

      console.log("[v0] Remaining pending unmapping requests:", remainingPendingRequests);

      // Update the shipment plan to remove the specific equipment
      const currentPlan = await prisma.shipmentPlan.findUnique({
        where: { id: planId },
        include: { linerBooking: true, shipmentAssignment: true },
      })

      if (currentPlan) {
        const planData = currentPlan.data as any

        // Mark the specific equipment as unmapped and revert tracking number to original temporary number
        if (planData.equipment_details && Array.isArray(planData.equipment_details)) {
          const updatedEquipmentDetails = planData.equipment_details.map((equipment: any, index: number) => {
            if (index === unmappingRequest.equipmentIndex) {
              // Revert tracking number to original temporary number
              const originalTrackingNumber = equipment.originalTrackingNumber || equipment.trackingNumber

              console.log(`[DEBUG] Individual unmapping approval - Equipment ${index}: reverting "${equipment.trackingNumber}" -> "${originalTrackingNumber}"`)

              return {
                ...equipment,
                trackingNumber: originalTrackingNumber, // Revert to original temporary number
                originalTrackingNumber: undefined, // Clear the reference since we've reverted
                unmapped: true,
                unmappedAt: new Date().toISOString(),
                unmappedReason: unmappingRequest.unmappingReason
              }
            }
            return equipment
          })

          // Check how many equipment are still available (not unmapped)
          const availableEquipmentCount = updatedEquipmentDetails.filter((eq: any) => !eq.unmapped).length

          // If there are still available equipment, update the plan and mark as awaiting booking
          // (since unmapping equipment means allocation is incomplete)
          if (availableEquipmentCount > 0) {
            await prisma.shipmentPlan.update({
              where: { id: planId },
              data: {
                data: {
                  ...planData,
                  equipment_details: updatedEquipmentDetails,
                  booking_status: "Awaiting Booking" // Always set to awaiting booking when equipment is unmapped
                }
              }
            })

            // Keep ALL liner booking details intact during individual unmapping
            // Only the equipment should be marked as unmapped, booking details should remain
            if (currentPlan.linerBooking) {
              const bookingData = currentPlan.linerBooking.data as any

              console.log(`[DEBUG] Individual unmapping - Preserving all ${bookingData.liner_booking_details?.length || 0} liner booking details`);

              await prisma.linerBooking.update({
                where: { id: currentPlan.linerBooking.id },
                data: {
                  data: {
                    ...bookingData,
                    // Keep all liner_booking_details intact - DO NOT remove any during individual unmapping
                    carrier_booking_status: availableEquipmentCount > 0 ? "Partially Unmapped" : "Ready for Re-linking"
                  }
                }
              })

              console.log(`[DEBUG] Individual unmapping - All liner booking details preserved, status: ${availableEquipmentCount > 0 ? "Partially Unmapped" : "Ready for Re-linking"}`);
            }

            if (currentPlan.shipmentAssignment) {
              const assignmentData = currentPlan.shipmentAssignment.data as any
              if (assignmentData.liner_booking_details && Array.isArray(assignmentData.liner_booking_details)) {
                // Instead of filtering by liner booking number (which removes ALL equipment with same booking number),
                // check if there are any remaining equipment that still use this liner booking number
                const remainingEquipmentWithSameBooking = updatedEquipmentDetails.filter((eq: any, idx: number) =>
                  !eq.unmapped && // Not unmapped
                  eq.trackingNumber === unmappingRequest.linerBookingNumber // Still using this liner booking number
                );

                console.log(`[DEBUG] Individual unmapping - Remaining equipment with booking ${unmappingRequest.linerBookingNumber}: ${remainingEquipmentWithSameBooking.length}`);

                let updatedLinerBookingDetails = assignmentData.liner_booking_details;

                // Only remove the liner booking detail if NO equipment is using this booking number anymore
                if (remainingEquipmentWithSameBooking.length === 0) {
                  console.log(`[DEBUG] Individual unmapping - No remaining equipment with booking ${unmappingRequest.linerBookingNumber}, removing booking details`);
                  updatedLinerBookingDetails = assignmentData.liner_booking_details.filter(
                    (detail: any) => detail.liner_booking_number !== unmappingRequest.linerBookingNumber
                  );
                } else {
                  console.log(`[DEBUG] Individual unmapping - ${remainingEquipmentWithSameBooking.length} equipment still using booking ${unmappingRequest.linerBookingNumber}, keeping all booking details`);
                }

                await prisma.shipmentAssignment.update({
                  where: { id: currentPlan.shipmentAssignment.id },
                  data: {
                    data: {
                      ...assignmentData,
                      liner_booking_details: updatedLinerBookingDetails,
                      carrier_booking_status: "Awaiting Booking" // Update status since equipment was unmapped
                    }
                  }
                })
              }
            }

            // Create new available liner booking for the unmapped equipment
            const unmappedEquipment = updatedEquipmentDetails[unmappingRequest.equipmentIndex];
            if (unmappedEquipment) {
              // Find the original liner booking detail for this equipment to preserve all allocated details
              let originalLinerBookingDetail = null;

              if (currentPlan.linerBooking) {
                const bookingData = currentPlan.linerBooking.data as any;
                if (bookingData.liner_booking_details && Array.isArray(bookingData.liner_booking_details)) {
                  originalLinerBookingDetail = bookingData.liner_booking_details.find(
                    (detail: any) => detail.liner_booking_number === unmappingRequest.linerBookingNumber
                  );
                }
              }

              if (currentPlan.shipmentAssignment) {
                const assignmentData = currentPlan.shipmentAssignment.data as any;
                if (assignmentData.liner_booking_details && Array.isArray(assignmentData.liner_booking_details)) {
                  originalLinerBookingDetail = assignmentData.liner_booking_details.find(
                    (detail: any) => detail.liner_booking_number === unmappingRequest.linerBookingNumber
                  );
                }
              }

              const newBookingData = {
                carrier_booking_status: "Ready for Re-linking",
                liner_booking_details: [{
                  // Preserve all original liner booking details
                  temporary_booking_number: originalLinerBookingDetail?.temporary_booking_number || `TEMP-${unmappedEquipment.trackingNumber}`,
                  liner_booking_number: unmappingRequest.linerBookingNumber,
                  suffix_for_anticipatory_temporary_booking_number: originalLinerBookingDetail?.suffix_for_anticipatory_temporary_booking_number || "",
                  mbl_number: originalLinerBookingDetail?.mbl_number || "",
                  carrier: originalLinerBookingDetail?.carrier || "",
                  contract: originalLinerBookingDetail?.contract || "",
                  original_planned_vessel: originalLinerBookingDetail?.original_planned_vessel || "",
                  revised_vessel: originalLinerBookingDetail?.revised_vessel || "",
                  e_t_d_of_original_planned_vessel: originalLinerBookingDetail?.e_t_d_of_original_planned_vessel || "",
                  etd_of_revised_vessel: originalLinerBookingDetail?.etd_of_revised_vessel || "",
                  empty_pickup_validity_from: originalLinerBookingDetail?.empty_pickup_validity_from || "",
                  empty_pickup_validity_till: originalLinerBookingDetail?.empty_pickup_validity_till || "",
                  estimate_gate_opening_date: originalLinerBookingDetail?.estimate_gate_opening_date || "",
                  estimated_gate_cutoff_date: originalLinerBookingDetail?.estimated_gate_cutoff_date || "",
                  s_i_cut_off_date: originalLinerBookingDetail?.s_i_cut_off_date || "",
                  booking_received_from_carrier_on: originalLinerBookingDetail?.booking_received_from_carrier_on || "",
                  loading_port: originalLinerBookingDetail?.loading_port || "",
                  destination_country: originalLinerBookingDetail?.destination_country || "",
                  port_of_discharge: originalLinerBookingDetail?.port_of_discharge || "",
                  additional_remarks: originalLinerBookingDetail?.additional_remarks || "",
                  // Equipment specific details
                  equipment_type: unmappedEquipment.equipment_type,
                  equipment_quantity: originalLinerBookingDetail?.equipment_quantity || 1,
                  trackingNumber: unmappedEquipment.trackingNumber,
                  container_number: unmappedEquipment.container_number || "",
                  stuffing_point: unmappedEquipment.stuffing_point || "",
                  empty_container_pick_up_from: unmappedEquipment.empty_container_pick_up_from || "",
                  container_handover_location: unmappedEquipment.container_handover_location || "",
                  empty_container_pick_up_location: unmappedEquipment.empty_container_pick_up_location || "",
                  container_handover_at: unmappedEquipment.container_handover_at || "",
                  // Unmapping metadata
                  unmapped_from_plan: planId,
                  unmapped_reason: unmappingRequest.unmappingReason
                }]
              };

              // Preserve original booking ownership for access control
              let originalUserId = user.id; // Default to current user (admin/shipment planner)
              let originalAssignBookingId = null;

              // Try to preserve original ownership from the current plan's booking/assignment
              if (currentPlan.linerBooking) {
                originalUserId = currentPlan.linerBooking.userId;
                originalAssignBookingId = currentPlan.linerBooking.assignBookingId;
              } else if (currentPlan.shipmentAssignment) {
                originalUserId = currentPlan.shipmentAssignment.userId;
                originalAssignBookingId = currentPlan.shipmentAssignment.assignBookingId;
              }

              await prisma.linerBooking.create({
                data: {
                  data: newBookingData,
                  userId: originalUserId, // Preserve original user
                  assignBookingId: originalAssignBookingId, // Preserve original assignment
                  shipmentPlanId: null // This makes it available for linking
                }
              });

              console.log("[v0] Created new available liner booking with preserved ownership", {
                userId: originalUserId,
                assignBookingId: originalAssignBookingId,
                linerBookingNumber: unmappingRequest.linerBookingNumber
              });

              console.log("[v0] Created new available liner booking for unmapped equipment", {
                linerBookingNumber: unmappingRequest.linerBookingNumber,
                equipmentType: unmappedEquipment.equipment_type,
                planId
              });
            }

            // Note: Original liner booking details are already handled above and kept intact
            console.log("[v0] Individual unmapping - Liner booking details preserved in original booking");

            // Also handle shipment assignment if present
            if (currentPlan.shipmentAssignment) {
              const originalAssignmentData = currentPlan.shipmentAssignment.data as any;

              // Remove the liner booking detail that matches the unmapped equipment
              if (originalAssignmentData.liner_booking_details && Array.isArray(originalAssignmentData.liner_booking_details)) {
                const updatedLinerBookingDetails = originalAssignmentData.liner_booking_details.filter(
                  (detail: any) => detail.liner_booking_number !== unmappingRequest.linerBookingNumber
                );

                console.log("[v0] Individual unmapping - updating original assignment", {
                  originalDetailsCount: originalAssignmentData.liner_booking_details.length,
                  updatedDetailsCount: updatedLinerBookingDetails.length,
                  removedLinerBookingNumber: unmappingRequest.linerBookingNumber
                });

                // If no liner booking details remain, unlink the entire assignment
                if (updatedLinerBookingDetails.length === 0) {
                  await prisma.shipmentAssignment.update({
                    where: { id: currentPlan.shipmentAssignment.id },
                    data: {
                      data: {
                        ...originalAssignmentData,
                        liner_booking_details: [],
                        carrier_booking_status: "Ready for Re-linking"
                      },
                      shipmentPlanId: null // Unlink from shipment plan
                    }
                  });
                  console.log("[v0] Original assignment fully unlinked (no details remain)");
                } else {
                  // Update the assignment with remaining details
                  await prisma.shipmentAssignment.update({
                    where: { id: currentPlan.shipmentAssignment.id },
                    data: {
                      data: {
                        ...originalAssignmentData,
                        liner_booking_details: updatedLinerBookingDetails
                      }
                    }
                  });
                  console.log("[v0] Original assignment updated with remaining details");
                }
              }
            }
          } else {
            // If no available equipment left, mark shipment as awaiting booking
            await prisma.shipmentPlan.update({
              where: { id: planId },
              data: {
                data: {
                  ...planData,
                  equipment_details: updatedEquipmentDetails, // Keep the equipment with unmapped flags
                  booking_status: "Awaiting Booking"
                },
                linkedStatus: 0
              }
            })

            // Update related booking status
            if (currentPlan.linerBooking) {
              const bookingData = currentPlan.linerBooking.data as any
              await prisma.linerBooking.update({
                where: { id: currentPlan.linerBooking.id },
                data: {
                  data: {
                    ...bookingData,
                    carrier_booking_status: "Awaiting Booking"
                  },
                  shipmentPlanId: null
                }
              })
            }

            if (currentPlan.shipmentAssignment) {
              const assignmentData = currentPlan.shipmentAssignment.data as any
              await prisma.shipmentAssignment.update({
                where: { id: currentPlan.shipmentAssignment.id },
                data: {
                  data: {
                    ...assignmentData,
                    carrier_booking_status: "Awaiting Booking"
                  },
                  shipmentPlanId: null
                }
              })
            }
          }
        }
      }

      // If no more pending requests, revert status from "Partial Unmapping Requested"
      if (remainingPendingRequests === 0) {
        console.log("[v0] No more pending unmapping requests, checking status reversion");

        // Re-fetch the current plan to get the latest state after unlinking operations
        const latestPlan = await prisma.shipmentPlan.findUnique({
          where: { id: planId },
          include: { linerBooking: true, shipmentAssignment: true },
        });

        if (latestPlan) {
          const planData = latestPlan.data as any;

          // Only revert shipment plan status if it's still in "Partial Unmapping Requested"
          if (planData.booking_status === "Partial Unmapping Requested") {
            // Check if there are still linked bookings/assignments with equipment
            const hasLinkedBookings = latestPlan.linerBooking || latestPlan.shipmentAssignment;

            const updatedPlanData = {
              ...planData,
              booking_status: hasLinkedBookings ? "Booked" : "Awaiting Booking"
            };

            await prisma.shipmentPlan.update({
              where: { id: planId },
              data: { data: updatedPlanData }
            });

            console.log("[v0] Shipment plan status reverted to:", updatedPlanData.booking_status);
          }

          // Only revert liner booking status if it's still linked to the plan
          if (latestPlan.linerBooking && latestPlan.linerBooking.shipmentPlanId === planId) {
            const bookingData = latestPlan.linerBooking.data as any;
            if (bookingData.carrier_booking_status === "Partial Unmapping Requested") {
              const updatedBookingData = {
                ...bookingData,
                carrier_booking_status: "Booked" // Only revert if still linked
              };

              await prisma.linerBooking.update({
                where: { id: latestPlan.linerBooking.id },
                data: { data: updatedBookingData }
              });
              console.log("[v0] Linked liner booking status reverted to 'Booked'");
            }
          }

          // Only revert assignment status if it's still linked to the plan
          if (latestPlan.shipmentAssignment && latestPlan.shipmentAssignment.shipmentPlanId === planId) {
            const assignmentData = latestPlan.shipmentAssignment.data as any;
            if (assignmentData.carrier_booking_status === "Partial Unmapping Requested") {
              const updatedAssignmentData = {
                ...assignmentData,
                carrier_booking_status: "Booked" // Only revert if still linked
              };

              await prisma.shipmentAssignment.update({
                where: { id: latestPlan.shipmentAssignment.id },
                data: { data: updatedAssignmentData }
              });
              console.log("[v0] Linked assignment status reverted to 'Booked'");
            }
          }
        }
      }

      console.log("[v0] Individual equipment unmapping approved successfully")
      return redirect(`/shipment-plans/${planId}/edit`)
    }

    if (rejectIndividualUnmapping && unmappingRequestId) {
      console.log("[v0] reject_individual_unmapping action started", {
        unmappingRequestId,
        planId
      })

      const rejectionReason = formData.get("rejection_reason") as string

      // Update the unmapping request status
      await prisma.individualEquipmentUnmappingRequest.update({
        where: { id: unmappingRequestId },
        data: {
          status: "REJECTED",
          rejectedAt: new Date(),
          rejectedBy: user.id,
          rejectionReason: rejectionReason || "No reason provided"
        }
      })

      // Check if there are any other pending unmapping requests for this shipment plan
      const remainingPendingRequests = await prisma.individualEquipmentUnmappingRequest.count({
        where: {
          shipmentPlanId: planId,
          status: "PENDING"
        }
      });

      // If no more pending requests, revert status from "Partial Unmapping Requested"
      if (remainingPendingRequests === 0) {
        console.log("[v0] No more pending unmapping requests after rejection, checking status reversion");

        const currentPlan = await prisma.shipmentPlan.findUnique({
          where: { id: planId },
          include: { linerBooking: true, shipmentAssignment: true },
        });

        if (currentPlan) {
          const planData = currentPlan.data as any;

          // Only revert shipment plan status if it's still in "Partial Unmapping Requested"
          if (planData.booking_status === "Partial Unmapping Requested") {
            // For rejection, we should revert to "Booked" since no unmapping occurred
            const updatedPlanData = {
              ...planData,
              booking_status: "Booked" // Revert to Booked after rejection
            };

            await prisma.shipmentPlan.update({
              where: { id: planId },
              data: { data: updatedPlanData }
            });
            console.log("[v0] Shipment plan status reverted to 'Booked' after rejection");
          }

          // Only revert liner booking status if it's still linked to the plan
          if (currentPlan.linerBooking && currentPlan.linerBooking.shipmentPlanId === planId) {
            const bookingData = currentPlan.linerBooking.data as any;
            if (bookingData.carrier_booking_status === "Partial Unmapping Requested") {
              const updatedBookingData = {
                ...bookingData,
                carrier_booking_status: "Booked" // Revert to Booked after rejection
              };

              await prisma.linerBooking.update({
                where: { id: currentPlan.linerBooking.id },
                data: { data: updatedBookingData }
              });
              console.log("[v0] Liner booking status reverted to 'Booked' after rejection");
            }
          }

          // Only revert assignment status if it's still linked to the plan
          if (currentPlan.shipmentAssignment && currentPlan.shipmentAssignment.shipmentPlanId === planId) {
            const assignmentData = currentPlan.shipmentAssignment.data as any;
            if (assignmentData.carrier_booking_status === "Partial Unmapping Requested") {
              const updatedAssignmentData = {
                ...assignmentData,
                carrier_booking_status: "Booked" // Revert to Booked after rejection
              };

              await prisma.shipmentAssignment.update({
                where: { id: currentPlan.shipmentAssignment.id },
                data: { data: updatedAssignmentData }
              });
              console.log("[v0] Assignment status reverted to 'Booked' after rejection");
            }
          }
        }
      }

      console.log("[v0] Individual equipment unmapping rejected successfully")
      return redirect(`/shipment-plans/${planId}/edit`)
    }

    // Get form values and preserve existing values if form fields are empty
    const bussiness_branch = (formData.get("bussiness_branch") as string) || (existingPlan.data as any).bussiness_branch
    const shipment_type = (formData.get("shipment_type") as string) || (existingPlan.data as any).shipment_type
    const booking_status = formData.get("booking_status") as string
    const loading_port = formData.get("loading_port") as string
    const destination_country = formData.get("destination_country") as string
    const customer = formData.get("customer") as string

    // Parse package details from form data
    const packageDetails: any[] = []
    let packageIndex = 0
    while (formData.get(`package_details[${packageIndex}][shipper]`) !== null) {
      packageDetails.push({
        shipper: formData.get(`package_details[${packageIndex}][shipper]`) as string,
        invoice_number: formData.get(`package_details[${packageIndex}][invoice_number]`) as string,
        volume: Number.parseFloat(formData.get(`package_details[${packageIndex}][volume]`) as string) || 0,
        gross_weight: Number.parseFloat(formData.get(`package_details[${packageIndex}][gross_weight]`) as string) || 0,
        number_of_packages:
          Number.parseInt(formData.get(`package_details[${packageIndex}][number_of_packages]`) as string) || 0,
        projected_cargo_ready_date: formData.get(
          `package_details[${packageIndex}][projected_cargo_ready_date]`,
        ) as string,
        commodity: formData.get(`package_details[${packageIndex}][commodity]`) as string,
        is_haz: formData.get(`package_details[${packageIndex}][is_haz]`) === "true",
        p_o_number: formData.get(`package_details[${packageIndex}][p_o_number]`) as string,
        C_H_A: formData.get(`package_details[${packageIndex}][C_H_A]`) === "true",
      })
      packageIndex++
    }

    // Parse equipment details from form data with new structure and TEMP replacement
    const equipmentDetails: any[] = []
    let equipmentIndex = 0
    const existingPlanData = existingPlan.data as any
    const reference_number = existingPlanData.reference_number

    while (formData.get(`equipment_details[${equipmentIndex}][equipment_type]`) !== null) {
      const equipmentType = formData.get(`equipment_details[${equipmentIndex}][equipment_type]`) as string
      const trackingNumber = formData.get(`equipment_details[${equipmentIndex}][trackingNumber]`) as string
      const equipmentSequence =
        Number.parseInt(formData.get(`equipment_details[${equipmentIndex}][equipmentSequence]`) as string) ||
        equipmentIndex + 1

      // Generate proper tracking number with actual reference number (replace TEMP if needed)
      const equipmentCode = generateEquipmentCode(equipmentType)
      const finalTrackingNumber =
        trackingNumber && trackingNumber.startsWith("TEMP-")
          ? trackingNumber.replace("TEMP", reference_number)
          : trackingNumber || `${reference_number}-${equipmentCode}-${String(equipmentSequence).padStart(3, "0")}`

      // Get and validate container number
      const containerNumber = formData.get(`equipment_details[${equipmentIndex}][container_number]`) as string
      let validatedContainerNumber = ""
      
      if (containerNumber && containerNumber.trim()) {
        const cleanedContainerNumber = containerNumber.trim().toUpperCase()
        // Validate container number format: 4 letters + 7 digits
        const containerPattern = /^[A-Z]{4}[0-9]{7}$/
        if (containerPattern.test(cleanedContainerNumber)) {
          validatedContainerNumber = cleanedContainerNumber
        } else {
          console.warn(`Invalid container number format: ${cleanedContainerNumber}. Expected format: 4 letters + 7 digits (e.g., ABCD1234567)`)
        }
      }

      equipmentDetails.push({
        equipment_type: equipmentType,
        trackingNumber: finalTrackingNumber,
        equipmentSequence: equipmentSequence,
        number_of_equipment: 1, // Always 1 in new structure
        container_number: validatedContainerNumber,
        stuffing_point: formData.get(`equipment_details[${equipmentIndex}][stuffing_point]`) as string,
        empty_container_pick_up_from: formData.get(
          `equipment_details[${equipmentIndex}][empty_container_pick_up_from]`,
        ) as string,
        container_handover_location: formData.get(
          `equipment_details[${equipmentIndex}][container_handover_location]`,
        ) as string,
        empty_container_pick_up_location: formData.get(
          `equipment_details[${equipmentIndex}][empty_container_pick_up_location]`,
        ) as string,
        container_handover_at: formData.get(`equipment_details[${equipmentIndex}][container_handover_at]`) as string,
        // Individual status fields
        status: (formData.get(`equipment_details[${equipmentIndex}][status]`) as string) || "Pending",
        emptyPickupStatus: formData.get(`equipment_details[${equipmentIndex}][emptyPickupStatus]`) === "true",
        stuffingStatus: formData.get(`equipment_details[${equipmentIndex}][stuffingStatus]`) === "true",
        gateInStatus: formData.get(`equipment_details[${equipmentIndex}][gateInStatus]`) === "true",
        loadedStatus: formData.get(`equipment_details[${equipmentIndex}][loadedStatus]`) === "true",
        emptyPickupDate: (formData.get(`equipment_details[${equipmentIndex}][emptyPickupDate]`) as string) || "",
        stuffingDate: (formData.get(`equipment_details[${equipmentIndex}][stuffingDate]`) as string) || "",
        gateInDate: (formData.get(`equipment_details[${equipmentIndex}][gateInDate]`) as string) || "",
        loadedDate: (formData.get(`equipment_details[${equipmentIndex}][loadedDate]`) as string) || "",
      })
      equipmentIndex++
    }

    // Get container tracking fields
    const container_stuffing_completed_date = formData.get("container_stuffing_completed_date") as string
    const empty_container_picked_up_date = formData.get("empty_container_picked_up_date") as string
    const gated_in_date = formData.get("gated_in_date") as string
    const loaded_on_board_date = formData.get("loaded_on_board_date") as string
    const md_approval_status = formData.get("md_approval") as string
    const md_approval_rejection = (formData.get("md_approval_rejection") as string) || ""

    let bookingStatus
    let shouldCreateShipmentAssignment = false
    let linerBrokerId = null

    //If already booked
    if (existingPlan?.data?.booking_status === "Booked") {
      bookingStatus = "Booked"
    } else {
      //update booking status
      if (md_approval_status === "approved" && md_approval_rejection === "") {
        bookingStatus = "Awaiting Booking"
        shouldCreateShipmentAssignment = true
        linerBrokerId = formData.get("liner_broker_approval") as string

        // Check if the plan is in "Awaiting MD Approval" status
        const planData = existingPlan.data as any
        if (planData.booking_status !== "Awaiting MD Approval") {
          return {
            error: "Only plans with 'Awaiting MD Approval' status can be approved",
          }
        }
      } else if (md_approval_status === "rejected" && md_approval_rejection === "") {
        bookingStatus = "MD Approval Rejected"
      } else if (md_approval_rejection != "") {
        bookingStatus = "Awaiting MD Approval"
      } else {
        bookingStatus = booking_status
      }
    }

    const shipmentData = {
      reference_number: (existingPlan.data as any).reference_number, // Keep existing reference number
      bussiness_branch,
      shipment_type,
      booking_status: bookingStatus,
      package_details: packageDetails,
      equipment_details: equipmentDetails,
      md_approval_status: md_approval_status || null,
      liner_broker_approval: linerBrokerId || null,
      rejection_comment: (formData.get("rejection_comment") as string) || null,
      remarks: (formData.get("remarks") as string) || null,
      container_movement: {
        loading_port,
        destination_country,
        delivery_till: formData.get("delivery_till") as string,
        port_of_discharge: formData.get("port_of_discharge") as string,
        final_place_of_delivery: formData.get("final_place_of_delivery") as string,
        required_free_time_at_destination: formData.get("required_free_time_at_destination") as string,
        carrier_and_vessel_preference: {
          carrier: formData.get("carrier") as string,
          vessel: formData.get("vessel") as string,
          preferred_etd: formData.get("preferred_etd") as string,
        },
        customer,
        consignee: formData.get("consignee") as string,
        selling_price: formData.get("selling_price") as string,
        rebate: formData.get("rebate") as string,
        credit_period: Number.parseInt(formData.get("credit_period") as string) || 0,
        buying_price: Number.parseFloat(formData.get("buying_price") as string) || 0,
        specific_stuffing_requirement: formData.get("specific_stuffing_requirement") === "true",
        stuffing_instructions: formData.get("stuffing_instructions") as string,
        specific_instructions: formData.get("specific_instructions") as string,
        liner_booking_details: formData.get("liner_booking_details") as string,
      },
      container_tracking: {
        container_current_status: (formData.get("container_current_status") as string) || "Pending",
        container_stuffing_completed: formData.get("container_stuffing_completed") === "true",
        container_stuffing_completed_date: container_stuffing_completed_date
          ? new Date(container_stuffing_completed_date).toISOString()
          : null,
        empty_container_picked_up_status: formData.get("empty_container_picked_up_status") === "true",
        empty_container_picked_up_date: empty_container_picked_up_date
          ? new Date(empty_container_picked_up_date).toISOString()
          : null,
        gated_in_status: formData.get("gated_in_status") === "true",
        gated_in_date: gated_in_date ? new Date(gated_in_date).toISOString() : null,
        loaded_on_board_status: formData.get("loaded_on_board_status") === "true",
        loaded_on_board_date: loaded_on_board_date ? new Date(loaded_on_board_date).toISOString() : null,
      },
    }

    try {
      if (shouldCreateShipmentAssignment) {
        await prisma.$transaction(async (tx) => {
          // Create a new shipment assignment with shipment plan data
          const assignmentData = {
            carrier_booking_status: "Awaiting Booking",
            reference_number: shipmentData.reference_number,
            bussiness_branch: shipmentData.bussiness_branch,
            shipment_type: shipmentData.shipment_type,
            container_movement: shipmentData.container_movement,
            equipment_details: shipmentData.equipment_details,
            package_details: shipmentData.package_details,
          }

          const assignment = await tx.shipmentAssignment.create({
            data: {
              data: assignmentData,
              userId: user.id,
              assignBookingId: (linerBrokerId as string) || null,
            },
          })

          await tx.shipmentPlan.update({
            where: { id: planId },
            data: {
              data: shipmentData,
              shipmentAssignmentId: assignment.id,
              linkedStatus: 1, // Set linked status
            },
          })
        })
      } else {
        await prisma.shipmentPlan.update({
          where: { id: planId },
          data: {
            data: shipmentData,
          },
        })
      }

      console.log("Shipment plan updated successfully")
    } catch (error) {
      console.error("Failed to update shipment plan:", error)
      return {
        error: "Failed to update shipment plan. Please try again.",
      }
    }

    return redirect("/shipment-plans")
  } catch (error) {
    console.error("Edit shipment plan action error:", error)
    return { error: "An error occurred while processing your request" }
  }
}

export default function EditShipmentPlan() {
  const { user, shipmentPlan, dataPoints, individualUnmappingRequests } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()

  const planData = shipmentPlan.data as any
  const isSubmitting = navigation.state === "submitting"

  const unmappingRequested =
    Boolean((shipmentPlan.linerBooking?.data as any)?.unmapping_request) ||
    Boolean((shipmentPlan.shipmentAssignment?.data as any)?.unmapping_request)

  // Get unmapping reason from either liner booking or shipment assignment
  const unmappingReason =
    (shipmentPlan.linerBooking?.data as any)?.unmapping_reason ||
    (shipmentPlan.shipmentAssignment?.data as any)?.unmapping_reason ||
    ''

  return (
    <AdminLayout user={user}>
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-sm">✏️</span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Edit Shipment Plan</h1>
                <p className="text-sm text-gray-600 mt-1">Modify shipment plan details - {planData.reference_number}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                to={`/shipment-plans/${shipmentPlan.id}`}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-500 hover:bg-gray-50 rounded-lg transition-all duration-200"
              >
                👁️ View Details
              </Link>
              <Link
                to="/shipment-plans"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all duration-200"
              >
                <span className="mr-1">←</span>
                Back to List
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        {actionData?.error && (
          <div className="mb-8 bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">Error updating shipment plan</p>
                <p className="text-sm text-red-600 mt-1">{actionData.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {actionData?.success && (
          <div className="mb-8 bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-green-400 text-xl">✅</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700 font-medium">Shipment plan updated successfully</p>
                <p className="text-sm text-green-600 mt-1">{actionData.success}</p>
              </div>
            </div>
          </div>
        )}

        {unmappingRequested && (
          <div className="max-w-5xl mx-auto mb-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-amber-800">
                      Unmapping Request Pending
                    </h3>
                  </div>
                  <p className="text-amber-800 text-sm mb-3">
                    The liner booking team has requested to unmap this shipment plan.
                  </p>

                  <div className="bg-white/60 border border-amber-300 rounded-md p-3 mb-3">
                    <h4 className="text-sm font-medium text-amber-800 mb-2">What happens when approved:</h4>
                    <ul className="text-amber-700 text-sm space-y-1">
                      <li>• Equipment tracking numbers will be reverted to original temporary numbers</li>
                      <li>• Shipment plan status will change to "Awaiting Booking"</li>
                      <li>• Linked bookings will be split into individual available liner bookings</li>
                      <li>• Plan will be unlinked and available for new bookings</li>
                    </ul>
                  </div>

                  {unmappingReason && (
                    <div className="bg-white/60 border border-amber-300 rounded-md p-3">
                      <h4 className="text-sm font-medium text-amber-800 mb-2">Unmapping Reason:</h4>
                      <p className="text-amber-700 text-sm italic">
                        "{unmappingReason}"
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-amber-200">
                <form method="post" className="inline">
                  <input type="hidden" name="reject_unmapping" value="true" />
                  <Button type="submit" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 bg-white">
                    Reject Unmapping
                  </Button>
                </form>
                <form method="post" className="inline">
                  <input type="hidden" name="approve_unmapping" value="true" />
                  <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
                    Approve Unmapping
                  </Button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Individual Equipment Unmapping Requests */}
        {individualUnmappingRequests.length > 0 && (
          <div className="max-w-5xl mx-auto mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-blue-800">
                      Individual Equipment Unmapping Requests ({individualUnmappingRequests.length})
                    </h3>
                  </div>
                  <p className="text-blue-800 text-sm mb-4">
                    Liner booking team has requested to unmap specific equipment from this shipment plan.
                  </p>

                  <div className="space-y-4">
                    {individualUnmappingRequests.map((request: any) => (
                      <div key={request.id} className="bg-white border border-blue-200 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <Label className="text-xs font-medium text-gray-500">Equipment Type</Label>
                            <p className="mt-1 text-gray-900 font-medium">{request.equipmentType}</p>
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-gray-500">Liner Booking Number</Label>
                            <p className="mt-1 text-blue-600 font-medium">{request.linerBookingNumber}</p>
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-gray-500">Requested By</Label>
                            <p className="mt-1 text-gray-900">{request.requestedByUser.name}</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <Label className="text-xs font-medium text-gray-500">Requested At</Label>
                          <p className="mt-1 text-gray-900 text-sm">
                            {new Date(request.requestedAt).toLocaleDateString()} at {new Date(request.requestedAt).toLocaleTimeString()}
                          </p>
                        </div>

                        {request.unmappingReason && (
                          <div className="mb-4">
                            <Label className="text-xs font-medium text-gray-500">Unmapping Reason</Label>
                            <div className="mt-1 bg-gray-50 border border-gray-200 rounded-md p-3">
                              <p className="text-gray-900 text-sm italic">
                                "{request.unmappingReason}"
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-blue-200">
                          <form method="post" className="inline">
                            <input type="hidden" name="reject_individual_unmapping" value="true" />
                            <input type="hidden" name="unmapping_request_id" value={request.id} />
                            <Button
                              type="submit"
                              variant="outline"
                              className="border-red-300 text-red-700 hover:bg-red-50 bg-white"
                              onClick={(e) => {
                                const reason = prompt("Please provide a reason for rejecting this unmapping request:");
                                if (!reason) {
                                  e.preventDefault();
                                  return;
                                }
                                const form = e.currentTarget.closest('form');
                                if (form) {
                                  const input = document.createElement('input');
                                  input.type = 'hidden';
                                  input.name = 'rejection_reason';
                                  input.value = reason;
                                  form.appendChild(input);
                                }
                              }}
                            >
                              Reject Request
                            </Button>
                          </form>
                          <form method="post" className="inline">
                            <input type="hidden" name="approve_individual_unmapping" value="true" />
                            <input type="hidden" name="unmapping_request_id" value={request.id} />
                            <Button
                              type="submit"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={(e) => {
                                if (!confirm(
                                  `Are you sure you want to approve unmapping of ${request.equipmentType} (${request.linerBookingNumber})? This equipment will be removed from this shipment plan.`
                                )) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              Approve Request
                            </Button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto">
          <ShipmentPlanForm
            mode="edit"
            dataPoints={dataPoints}
            actionData={actionData}
            isSubmitting={isSubmitting}
            planData={planData}
            shipmentPlan={shipmentPlan}
            user={user}
          />
        </div>
      </div>
    </AdminLayout>
  )
}
