import type { ActionFunctionArgs } from "react-router";
import { Workbook } from "exceljs";
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

function formatDate(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US");
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request);
    if (user.role.name !== "ADMIN" && user.role.name !== "MD") {
      return json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const shipmentPlans = await prisma.shipmentPlan.findMany({
      include: {
        user: { select: { name: true, email: true } },
        linerBooking: true,
        shipmentAssignment: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Group ID (for merged cells in Excel)",
      "Reference Number",
      "Shipment Type",
      "Booking Status",
      "Business Branch",
      "Created Date",
      "Created By",
      "Created By Email",
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
      "MD Approval Status",
      "Liner Broker Approval",
      "Rejection Comment",
      "Container Number",
      "Equipment Type",
      "Tracking Number",
      "Shipper",
      "Commodity",
      "Number of Packages",
      "Gross Weight",
      "Volume",
      "Invoice Number",
      "PO Number",
      "Projected Cargo Ready Date",
      "Is Hazardous",
      "C_H_A",
      "Gated In Status",
      "Gated In Date",
      "Empty Container Picked Up Status",
      "Empty Container Picked Up Date",
      "Container Stuffing Completed",
      "Container Stuffing Completed Date",
      "Loaded On Board Status",
      "Loaded On Board Date",
      "MBL Number",
      "Liner Booking Number",
      "Booking Carrier",
      "Booking Contract",
      "Remarks",
      "Unmapping Request",
      "Carrier Booking Status",
    ];

    // Build data rows - one row per CONTAINER × SHIPPER combination
    const rows: any[][] = [];

    shipmentPlans.forEach((plan, planIndex) => {
      const data = plan.data as any;
      const containerMovement = data.container_movement || {};
      const carrierPreference = containerMovement.carrier_and_vessel_preference || {};
      const containerTracking = data.container_tracking || {};
      const equipmentDetails = data.equipment_details || [];
      
      // Get liner booking details from linked booking or assignment (matching webpage logic)
      const linkedBookingData = plan.linerBooking?.data || plan.shipmentAssignment?.data;
      const linerBookingDetails = (linkedBookingData as any)?.liner_booking_details || data.liner_booking_details || [];
      
      const packageDetails = data.package_details || [];

      const groupId = `${data.reference_number}-${planIndex}`;
      const isConsolidated = data.shipment_type?.toLowerCase() === "consolidation";

      if (equipmentDetails.length === 0 && packageDetails.length === 0) {
        // No containers, no shippers - one summary row
        const packageDetail = packageDetails[0] || {};
        const booking = linerBookingDetails[0];
        rows.push([
          groupId,
          data.reference_number,
          data.shipment_type,
          data.booking_status,
          data.bussiness_branch,
          formatDate(plan.createdAt.toISOString()),
          plan.user.name,
          plan.user.email,
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
          data.md_approval_status,
          data.liner_broker_approval,
          data.rejection_comment,
          "",
          "",
          "",
          packageDetail.shipper || "",
          packageDetail.commodity || "",
          packageDetail.number_of_packages || "",
          packageDetail.gross_weight || "",
          packageDetail.volume || "",
          packageDetail.invoice_number || "",
          packageDetail.p_o_number || "",
          formatDate(packageDetail.projected_cargo_ready_date),
          packageDetail.is_haz ? "Yes" : "No",
          packageDetail.C_H_A ? "Yes" : "No",
          containerTracking.gated_in_status ? "Yes" : "No",
          formatDate(containerTracking.gated_in_date),
          containerTracking.empty_container_picked_up_status ? "Yes" : "No",
          formatDate(containerTracking.empty_container_picked_up_date),
          containerTracking.container_stuffing_completed ? "Yes" : "No",
          formatDate(containerTracking.container_stuffing_completed_date),
          containerTracking.loaded_on_board_status ? "Yes" : "No",
          formatDate(containerTracking.loaded_on_board_date),
          booking?.mbl_number || "",
          booking?.liner_booking_number || "",
          booking?.carrier || "",
          booking?.contract || "",
          data.remarks,
          data.unmapping_request ? "Yes" : "No",
          data.carrier_booking_status,
        ]);
      } else if (equipmentDetails.length === 0) {
        // No containers but have shippers - one row per shipper
        packageDetails.forEach((pkg: any) => {
          const booking = linerBookingDetails.find((lb: any) => lb.shipper === pkg.shipper) || linerBookingDetails[0];
          rows.push([
            groupId,
            data.reference_number,
            data.shipment_type,
            data.booking_status,
            data.bussiness_branch,
            formatDate(plan.createdAt.toISOString()),
            plan.user.name,
            plan.user.email,
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
            data.md_approval_status,
            data.liner_broker_approval,
            data.rejection_comment,
            "", "", "",
            pkg.shipper || "",
            pkg.commodity || "",
            pkg.number_of_packages || "",
            pkg.gross_weight || "",
            pkg.volume || "",
            pkg.invoice_number || "",
            pkg.p_o_number || "",
            formatDate(pkg.projected_cargo_ready_date),
            pkg.is_haz ? "Yes" : "No",
            pkg.C_H_A ? "Yes" : "No",
            containerTracking.gated_in_status ? "Yes" : "No",
            formatDate(containerTracking.gated_in_date),
            containerTracking.empty_container_picked_up_status ? "Yes" : "No",
            formatDate(containerTracking.empty_container_picked_up_date),
            containerTracking.container_stuffing_completed ? "Yes" : "No",
            formatDate(containerTracking.container_stuffing_completed_date),
            containerTracking.loaded_on_board_status ? "Yes" : "No",
            formatDate(containerTracking.loaded_on_board_date),
            booking?.mbl_number || "",
            booking?.liner_booking_number || "",
            booking?.carrier || "",
            booking?.contract || "",
            data.remarks,
            data.unmapping_request ? "Yes" : "No",
            data.carrier_booking_status,
          ]);
        });
      } else if (isConsolidated && packageDetails.length > 0) {
        // CONSOLIDATED: Create one row per CONTAINER × SHIPPER combination
        equipmentDetails.forEach((equipment: any) => {
          packageDetails.forEach((pkg: any) => {
            // Find booking linking this container (matching webpage logic)
            let matchingBooking = linerBookingDetails.find(
              (detail: any) => detail.trackingNumber === equipment.trackingNumber
            );
            if (!matchingBooking) {
              matchingBooking = linerBookingDetails.find(
                (detail: any) => detail.liner_booking_number === equipment.trackingNumber
              );
            }
            if (!matchingBooking) {
              matchingBooking = linerBookingDetails.find((detail: any) => {
                const equipmentTypeMatches = detail.equipment_type && detail.equipment_type.includes(equipment.trackingNumber);
                const bookingForMatches = detail.booking_for && detail.booking_for.includes(equipment.trackingNumber);
                return equipmentTypeMatches || bookingForMatches;
              });
            }
            if (!matchingBooking) {
              matchingBooking = linerBookingDetails.find(
                (detail: any) => detail.equipment_type === equipment.equipment_type || detail.booking_for === equipment.equipment_type
              );
            }

            rows.push([
              groupId,
              data.reference_number,
              data.shipment_type,
              data.booking_status,
              data.bussiness_branch,
              formatDate(plan.createdAt.toISOString()),
              plan.user.name,
              plan.user.email,
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
              data.md_approval_status,
              data.liner_broker_approval,
              data.rejection_comment,
              equipment.container_number || "",
              equipment.equipment_type || "",
              equipment.trackingNumber || "",
              pkg.shipper || "",
              pkg.commodity || "",
              pkg.number_of_packages || "",
              pkg.gross_weight || "",
              pkg.volume || "",
              pkg.invoice_number || "",
              pkg.p_o_number || "",
              formatDate(pkg.projected_cargo_ready_date),
              pkg.is_haz ? "Yes" : "No",
              pkg.C_H_A ? "Yes" : "No",
              equipment.gateInStatus ? "Yes" : "No",
              formatDate(equipment.gateInDate),
              equipment.emptyPickupStatus ? "Yes" : "No",
              formatDate(equipment.emptyPickupDate),
              equipment.stuffingStatus ? "Yes" : "No",
              formatDate(equipment.stuffingDate),
              equipment.loadedStatus ? "Yes" : "No",
              formatDate(equipment.loadedDate),
              matchingBooking?.mbl_number || "",
              matchingBooking?.liner_booking_number || "",
              matchingBooking?.carrier || "",
              matchingBooking?.contract || "",
              data.remarks,
              data.unmapping_request ? "Yes" : "No",
              data.carrier_booking_status,
            ]);
          });
        });
      } else {
        // DIRECT (non-consolidated): One row per container
        const singlePackage = packageDetails[0] || {};
        equipmentDetails.forEach((equipment: any) => {
          // Find booking for this container (matching webpage logic)
          let matchingBooking = linerBookingDetails.find(
            (detail: any) => detail.trackingNumber === equipment.trackingNumber
          );
          if (!matchingBooking) {
            matchingBooking = linerBookingDetails.find(
              (detail: any) => detail.liner_booking_number === equipment.trackingNumber
            );
          }
          if (!matchingBooking) {
            matchingBooking = linerBookingDetails.find((detail: any) => {
              const equipmentTypeMatches = detail.equipment_type && detail.equipment_type.includes(equipment.trackingNumber);
              const bookingForMatches = detail.booking_for && detail.booking_for.includes(equipment.trackingNumber);
              return equipmentTypeMatches || bookingForMatches;
            });
          }
          if (!matchingBooking) {
            matchingBooking = linerBookingDetails.find(
              (detail: any) => detail.equipment_type === equipment.equipment_type || detail.booking_for === equipment.equipment_type
            );
          }

          rows.push([
            groupId,
            data.reference_number,
            data.shipment_type,
            data.booking_status,
            data.bussiness_branch,
            formatDate(plan.createdAt.toISOString()),
            plan.user.name,
            plan.user.email,
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
            data.md_approval_status,
            data.liner_broker_approval,
            data.rejection_comment,
            equipment.container_number || "",
            equipment.equipment_type || "",
            equipment.trackingNumber || "",
            singlePackage.shipper || "",
            singlePackage.commodity || "",
            singlePackage.number_of_packages || "",
            singlePackage.gross_weight || "",
            singlePackage.volume || "",
            singlePackage.invoice_number || "",
            singlePackage.p_o_number || "",
            formatDate(singlePackage.projected_cargo_ready_date),
            singlePackage.is_haz ? "Yes" : "No",
            singlePackage.C_H_A ? "Yes" : "No",
            equipment.gateInStatus ? "Yes" : "No",
            formatDate(equipment.gateInDate),
            equipment.emptyPickupStatus ? "Yes" : "No",
            formatDate(equipment.emptyPickupDate),
            equipment.stuffingStatus ? "Yes" : "No",
            formatDate(equipment.stuffingDate),
            equipment.loadedStatus ? "Yes" : "No",
            formatDate(equipment.loadedDate),
            matchingBooking?.mbl_number || "",
            matchingBooking?.liner_booking_number || "",
            matchingBooking?.carrier || "",
            matchingBooking?.contract || "",
            data.remarks,
            data.unmapping_request ? "Yes" : "No",
            data.carrier_booking_status,
          ]);
        });
      }
    });

    // Optionally sort rows by Reference Number for contiguous merges
    rows.sort((a, b) => String(a[1] || "").localeCompare(String(b[1] || "")));

    // Build workbook
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet("Shipment Export");
    
    // Company header rows
    const currentDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    sheet.addRow([`CARGOCARE LOGISTICS - SHIPMENT EXPORT REPORT`]);
    sheet.addRow([`Generated on: ${currentDate}`]);
    sheet.addRow([`Total Records: ${rows.length}`]);
    sheet.addRow([``]);

    // Header row
    sheet.addRow(headers);
    const headerRowIndex = sheet.rowCount; // index of header row
    const headerRow = sheet.getRow(headerRowIndex);
    headerRow.font = { bold: true };

    // Add data rows (or a friendly empty message)
    if (rows.length === 0) {
      sheet.addRow(["No records found"]);
    } else {
      rows.forEach((row) => sheet.addRow(row));
    }

    // Freeze header
    // Freeze at header (accounting for extra company header rows)
    sheet.views = [{ state: "frozen", ySplit: headerRowIndex }];

    // Auto filter
    const toCol = (n: number) => {
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let s = "";
      while (n > 0) {
        n--; s = letters[n % 26] + s; n = Math.floor(n / 26);
      }
      return s;
    };
    // Auto filter on the header row location
    sheet.autoFilter = `A${headerRowIndex}:${toCol(headers.length)}${headerRowIndex}`;

    // Auto width for columns based on content
    const startDataRow = headerRowIndex + 1;
    for (let col = 1; col <= headers.length; col++) {
      let maxLen = headers[col - 1].length;
      for (let r = startDataRow; r <= sheet.rowCount; r++) {
        const val = sheet.getCell(r, col).value;
        const text = typeof val === "string" ? val : (val?.toString?.() ?? "");
        if (text.length > maxLen) maxLen = text.length;
      }
      const width = Math.min(Math.max(maxLen + 2, 12), 50);
      sheet.getColumn(col).width = width;
    }

    // Merge group-level columns for contiguous rows with same Reference Number
    const groupCols = 8; // first 8 columns (Group ID through Created By Email)
    let startIdx = 0;
    // merged regions must consider the offset introduced by company header rows
    const dataStartExcelRow = headerRowIndex + 1; // first data row number
    while (startIdx < rows.length) {
      const startRef = rows[startIdx][1]; // column 2 = Reference Number
      let endIdx = startIdx;
      while (endIdx + 1 < rows.length && rows[endIdx + 1][1] === startRef) endIdx++;
      if (endIdx > startIdx) {
        const startRowNumber = dataStartExcelRow + startIdx;
        const endRowNumber = dataStartExcelRow + endIdx;
        for (let col = 1; col <= groupCols; col++) {
          sheet.mergeCells(startRowNumber, col, endRowNumber, col);
          const cell = sheet.getCell(startRowNumber, col);
          cell.alignment = { vertical: "middle" };
        }
      }
      startIdx = endIdx + 1;
    }

    // Write buffer and return
    const raw = await workbook.xlsx.writeBuffer();
    const uint8 = raw instanceof ArrayBuffer ? new Uint8Array(raw) : (raw as Uint8Array);
    const ab = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer;
    const blob = new Blob([ab], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const filename = `shipment-plans-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new Response(blob, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Length": String(uint8.byteLength),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("XLSX export error:", error);
    return json({ error: "Failed to export XLSX" }, { status: 500 });
  }
}

export async function loader() {
  return json({ message: "Use POST to export XLSX data" });
}
