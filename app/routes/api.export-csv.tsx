import type { ActionFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString('en-US');
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request);

    // Only allow ADMIN users to export data
    if (user.role.name !== "ADMIN") {
      return json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    // Get all shipment plans with user information
    const shipmentPlans = await prisma.shipmentPlan.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Define CSV headers
    const headers = [
      "Reference Number",
      "Shipment Type",
      "Booking Status",
      "Business Branch",
      "Created Date",
      "Created By",
      "Created By Email",

      // Container Movement
      "Customer",
      "Consignee",
      "Loading Port",
      "Port of Discharge",
      "Destination Country",
      "Delivery Till",
      "Buying Price",
      "Selling Price",
      "Rebate",
      "Credit Period",
      "Final Place of Delivery",
      "Carrier",
      "Vessel",
      "Preferred ETD",
      "Specific Instructions",
      "Stuffing Instructions",
      "Required Free Time at Destination",

      // Package Details
      "Shipper",
      "Commodity",
      "Number of Packages",
      "Gross Weight",
      "Volume",
      "Invoice Number",
      "PO Number",
      "Projected Cargo Ready Date",
      "C_H_A",
      "Is Hazardous",

      // Equipment Summary
      "Total Equipment Count",
      "Equipment Types",
      "Container Numbers",
      "Tracking Numbers",

      // Container Tracking
      "Container Current Status",
      "Gated In Status",
      "Gated In Date",
      "Empty Container Picked Up Status",
      "Empty Container Picked Up Date",
      "Container Stuffing Completed",
      "Container Stuffing Completed Date",
      "Loaded On Board Status",
      "Loaded On Board Date",

      // Approvals
      "MD Approval Status",
      "Liner Broker Approval",
      "Rejection Comment",

      // Liner Booking Summary
      "Liner Booking Count",
      "MBL Numbers",
      "Booking Numbers",
      "Carriers",
      "Contracts",

      // Additional
      "Remarks",
      "Unmapping Request",
      "Carrier Booking Status"
    ];

    // Generate CSV rows
    const rows = shipmentPlans.map(plan => {
      const data = plan.data as any;
      const packageDetail = data.package_details?.[0] || {};
      const containerMovement = data.container_movement || {};
      const carrierPreference = containerMovement.carrier_and_vessel_preference || {};
      const containerTracking = data.container_tracking || {};
      const equipmentDetails = data.equipment_details || [];
      const linerBookingDetails = data.liner_booking_details || [];

      return [
        data.reference_number,
        data.shipment_type,
        data.booking_status,
        data.bussiness_branch,
        formatDate(plan.createdAt.toISOString()),
        plan.user.name,
        plan.user.email,

        // Container Movement
        containerMovement.customer,
        containerMovement.consignee,
        containerMovement.loading_port,
        containerMovement.port_of_discharge,
        containerMovement.destination_country,
        containerMovement.delivery_till,
        containerMovement.buying_price,
        containerMovement.selling_price,
        containerMovement.rebate,
        containerMovement.credit_period,
        containerMovement.final_place_of_delivery,
        carrierPreference.carrier,
        carrierPreference.vessel,
        formatDate(carrierPreference.preferred_etd),
        containerMovement.specific_instructions,
        containerMovement.stuffing_instructions,
        containerMovement.required_free_time_at_destination,

        // Package Details
        packageDetail.shipper,
        packageDetail.commodity,
        packageDetail.number_of_packages,
        packageDetail.gross_weight,
        packageDetail.volume,
        packageDetail.invoice_number,
        packageDetail.p_o_number,
        formatDate(packageDetail.projected_cargo_ready_date),
        packageDetail.C_H_A ? "Yes" : "No",
        packageDetail.is_haz ? "Yes" : "No",

        // Equipment Summary
        equipmentDetails.length,
        equipmentDetails.map((eq: any) => eq.equipment_type).join("; "),
        equipmentDetails.map((eq: any) => eq.container_number || "").filter(Boolean).join("; "),
        equipmentDetails.map((eq: any) => eq.trackingNumber).join("; "),

        // Container Tracking
        containerTracking.container_current_status,
        containerTracking.gated_in_status ? "Yes" : "No",
        formatDate(containerTracking.gated_in_date),
        containerTracking.empty_container_picked_up_status ? "Yes" : "No",
        formatDate(containerTracking.empty_container_picked_up_date),
        containerTracking.container_stuffing_completed ? "Yes" : "No",
        formatDate(containerTracking.container_stuffing_completed_date),
        containerTracking.loaded_on_board_status ? "Yes" : "No",
        formatDate(containerTracking.loaded_on_board_date),

        // Approvals
        data.md_approval_status,
        data.liner_broker_approval,
        data.rejection_comment,

        // Liner Booking Summary
        linerBookingDetails.length,
        linerBookingDetails.map((lb: any) => lb.mbl_number).join("; "),
        linerBookingDetails.map((lb: any) => lb.liner_booking_number).join("; "),
        linerBookingDetails.map((lb: any) => lb.carrier).join("; "),
        linerBookingDetails.map((lb: any) => lb.contract).join("; "),

        // Additional
        data.remarks,
        data.unmapping_request ? "Yes" : "No",
        data.carrier_booking_status
      ].map(escapeCSV);
    });

    // Add company header and title for official look
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const companyHeader = [
      `CARGOCARE LOGISTICS - SHIPMENT EXPORT REPORT`,
      `Generated on: ${currentDate}`,
      `Total Records: ${shipmentPlans.length}`,
      ``, // Empty row for spacing
      ``  // Another empty row
    ];

    // Combine all parts
    const csvContent = [
      ...companyHeader,
      headers.map(escapeCSV).join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // Generate filename with current date
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `shipment-plans-export-${timestamp}.csv`;

    // Return CSV file
    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error("CSV export error:", error);
    return json({ error: "Failed to export data" }, { status: 500 });
  }
}

export async function loader() {
  return json({ message: "Use POST to export CSV data" });
}