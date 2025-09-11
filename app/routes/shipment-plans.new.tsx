import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData, useNavigation, redirect, useActionData, Link } from "react-router"
import { requireAuth } from "~/lib/auth.server"
import { prisma } from "~/lib/prisma.server"
import { AdminLayout } from "~/components/AdminLayout"
import { ShipmentPlanForm } from "~/components/ShipmentPlanForm"

export const meta: MetaFunction = () => {
  return [{ title: "New Shipment Plan - Cargo Care" }, { name: "description", content: "Create a new shipment plan" }]
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request)

    // Only allow SHIPMENT_PLAN_TEAM and ADMIN
    if (user.role.name !== "SHIPMENT_PLAN_TEAM" && user.role.name !== "ADMIN") {
      return redirect("/dashboard")
    }

    // Fetch data points for dropdowns
    const [
      businessBranches,
      commodities,
      equipment,
      loadingPorts,
      portsOfDischarge,
      destinationCountries,
      vessels,
      carriers,
      organizations,
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
    ])

    return {
      user,
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

export async function action({ request }: ActionFunctionArgs) {
  console.log("New shipment plan action called")
  try {
    const user = await requireAuth(request)

    // Only allow SHIPMENT_PLAN_TEAM and ADMIN
    if (user.role.name !== "SHIPMENT_PLAN_TEAM" && user.role.name !== "ADMIN") {
      return redirect("/dashboard")
    }

    const formData = await request.formData()
    console.log("Creating new shipment plan")

    // Get form values
    const bussiness_branch = formData.get("bussiness_branch") as string
    const shipment_type = formData.get("shipment_type") as string
    const booking_status = "Awaiting MD Approval" // Always set to default value for new plans
    const loading_port = formData.get("loading_port") as string
    const destination_country = formData.get("destination_country") as string
    const customer = formData.get("customer") as string

    // Validate required fields
    if (!bussiness_branch) {
      return {
        error: "Business branch is required to generate reference number",
        formData: Object.fromEntries(formData),
      }
    }

    // Get business branch details to extract code
    const businessBranch = await prisma.businessBranch.findFirst({
      where: { name: bussiness_branch },
    })

    if (!businessBranch) {
      return { error: "Invalid business branch selected", formData: Object.fromEntries(formData) }
    }

    // Generate reference number: {BusinessCode}{Year}{4-digit sequence}
    const currentYear = new Date().getFullYear()
    const branchCode = businessBranch.code.toUpperCase()

    // Find the highest sequence number for this branch and year
    const existingPlans = await prisma.shipmentPlan.findMany({
      where: {
        data: {
          path: ["reference_number"],
          string_starts_with: `${branchCode}${currentYear}`,
        },
      },
      orderBy: { createdAt: "desc" },
    })

    let nextSequence = 1
    if (existingPlans.length > 0) {
      // Extract sequence numbers from existing reference numbers
      const sequences = existingPlans
        .map((plan: any) => {
          const refNum = plan.data?.reference_number
          if (refNum && typeof refNum === "string") {
            const sequencePart = refNum.slice(`${branchCode}${currentYear}`.length)
            const num = Number.parseInt(sequencePart, 10)
            return isNaN(num) ? 0 : num
          }
          return 0
        })
        .filter((num) => num > 0)

      if (sequences.length > 0) {
        nextSequence = Math.max(...sequences) + 1
      }
    }

    // Format sequence as 4-digit number
    const sequenceString = nextSequence.toString().padStart(4, "0")
    const reference_number = `${branchCode}${currentYear}${sequenceString}`

    console.log(`Generated reference number: ${reference_number}`)

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

    // Parse equipment details from form data with new structure
    const equipmentDetails: any[] = []
    let equipmentIndex = 0
    while (formData.get(`equipment_details[${equipmentIndex}][equipment_type]`) !== null) {
      const equipmentType = formData.get(`equipment_details[${equipmentIndex}][equipment_type]`) as string
      const trackingNumber = formData.get(`equipment_details[${equipmentIndex}][trackingNumber]`) as string
      const equipmentSequence =
        Number.parseInt(formData.get(`equipment_details[${equipmentIndex}][equipmentSequence]`) as string) ||
        equipmentIndex + 1

      // Generate proper tracking number with actual reference number
      const equipmentCode = generateEquipmentCode(equipmentType)
      const finalTrackingNumber = trackingNumber && trackingNumber.startsWith("TEMP-") 
        ? trackingNumber.replace("TEMP", reference_number)
        : `${reference_number}-${equipmentCode}-${String(equipmentSequence).padStart(3, "0")}`

      equipmentDetails.push({
        equipment_type: equipmentType,
        trackingNumber: finalTrackingNumber,
        equipmentSequence: equipmentSequence,
        number_of_equipment: 1, // Always 1 in new structure
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

    // Get container tracking fields (initialize with default values for new plans)
    const container_stuffing_completed_date = formData.get("container_stuffing_completed_date") as string
    const empty_container_picked_up_date = formData.get("empty_container_picked_up_date") as string
    const gated_in_date = formData.get("gated_in_date") as string
    const loaded_on_board_date = formData.get("loaded_on_board_date") as string

    const shipmentData = {
      reference_number,
      bussiness_branch,
      shipment_type,
      booking_status,
      package_details: packageDetails,
      equipment_details: equipmentDetails,
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
      console.log("Attempting to create shipment plan in database")
      const shipmentPlan = await prisma.shipmentPlan.create({
        data: {
          data: shipmentData,
          userId: user.id,
          linkedStatus: 0,
        },
      })
      console.log("Shipment plan created successfully:", shipmentPlan.id)

      return redirect("/shipment-plans")
    } catch (error) {
      console.error("Failed to create shipment plan:", error)
      return {
        error: "Failed to create shipment plan. Please try again.",
        formData: Object.fromEntries(formData),
      }
    }
  } catch (error) {
    console.error("New shipment plan action error:", error)
    return { error: "An error occurred while processing your request" }
  }
}

export default function NewShipmentPlan() {
  const { user, dataPoints } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()

  const isSubmitting = navigation.state === "submitting"

  return (
    <AdminLayout user={user}>
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-sm">📦</span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">New Shipment Plan</h1>
                <p className="text-sm text-gray-600 mt-1">Create a new shipment plan with detailed information</p>
              </div>
            </div>
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

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        {actionData?.error && (
          <div className="mb-8 bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">Error creating shipment plan</p>
                <p className="text-sm text-red-600 mt-1">{actionData.error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto">
          <ShipmentPlanForm
            mode="create"
            dataPoints={dataPoints}
            actionData={actionData}
            isSubmitting={isSubmitting}
            user={user}
          />
        </div>
      </div>
    </AdminLayout>
  )
}
