// Column catalogs for the CSV export modal - one per exportable dataset.
// Mirrors the "Customize Columns" definitions on each list page (shipment-plans.tsx,
// liner-bookings.tsx) so the export modal offers exactly the same fields as the table view.
// Shared between the client (ExportCsvModal) and the server (api.export-csv.tsx) so both
// stay in sync on ids/labels/order; value extraction for each id lives server-side only.

export type ExportReportType = "shipment-plans" | "liner-bookings" | "shipment-assignments"

export interface ExportColumnDef {
  id: string
  label: string
  /** Always included in the export; not shown as a toggleable checkbox. */
  locked?: boolean
}

export const SHIPMENT_PLAN_EXPORT_COLUMNS: ExportColumnDef[] = [
  { id: "reference_number", label: "Reference No.", locked: true },
  { id: "business_branch", label: "Business Branch" },
  { id: "shipment_type", label: "Type" },
  { id: "customer", label: "Customer" },
  { id: "loading_port", label: "Loading Port" },
  { id: "destination_country", label: "Destination" },
  { id: "booking_status", label: "Booking Status" },
  { id: "milestone_status", label: "Container Status" },
  { id: "port_of_discharge", label: "Port of Discharge" },
  { id: "final_place_of_delivery", label: "Final Place of Delivery" },
  { id: "consignee", label: "Consignee" },
  { id: "selling_price", label: "Selling Price" },
  { id: "buying_price", label: "Buying Price" },
  { id: "carrier", label: "Carrier" },
  { id: "vessel", label: "Vessel" },
  { id: "created_date", label: "Created" },
  { id: "created_by", label: "Sales Person" },
  { id: "assigned_to", label: "Assigned To" },
  { id: "updated_date", label: "Last Updated" },
  { id: "incoterm", label: "Incoterm" },
  { id: "freight_terms", label: "Freight Terms" },
  { id: "free_time", label: "Free Time (Days)" },
  { id: "delivery_till", label: "Delivery Till" },
  { id: "preferred_etd", label: "Preferred ETD" },
  { id: "rebate", label: "Rebate" },
  { id: "credit_period", label: "Credit Period" },
  { id: "shipper", label: "Shipper" },
  { id: "invoice_number", label: "Invoice No." },
  { id: "commodity", label: "Commodity" },
  { id: "volume", label: "Volume" },
  { id: "gross_weight", label: "Gross Weight" },
  { id: "num_packages", label: "No. of Packages" },
  { id: "cargo_ready_date", label: "Cargo Ready Date" },
  { id: "hs_code", label: "HS Code" },
  { id: "po_number", label: "P.O. Number" },
  { id: "container_no", label: "Container No." },
  { id: "equipment_details", label: "Equipment Details" },
  { id: "stuffing_point", label: "Stuffing Point" },
  { id: "remarks", label: "Remarks" },
]

export const LINER_BOOKING_EXPORT_COLUMNS: ExportColumnDef[] = [
  { id: "temp_booking_number", label: "Temp. Booking #", locked: true },
  { id: "carrier", label: "Carrier" },
  { id: "vessel", label: "Vessel" },
  { id: "etd", label: "ETD" },
  { id: "liner_booking_number", label: "Liner Booking #" },
  { id: "mbl_number", label: "MBL Number" },
  { id: "contract", label: "Contract" },
  { id: "loading_port", label: "Loading Port" },
  { id: "port_of_discharge", label: "Port of Discharge" },
  { id: "equipment_type", label: "Equipment Type" },
  { id: "created_date", label: "Created" },
  { id: "created_by", label: "Created By" },
  { id: "assigned_to", label: "Assigned To" },
  { id: "updated_date", label: "Last Updated" },
  { id: "empty_pickup_from", label: "Empty Pickup From" },
  { id: "empty_pickup_till", label: "Empty Pickup Till" },
  { id: "gate_opening_date", label: "Gate Opening Date" },
  { id: "gate_cutoff_date", label: "Gate Cutoff Date" },
  { id: "si_cutoff_date", label: "SI Cut Off Date" },
  { id: "booking_received_date", label: "Booking Received On" },
  { id: "additional_remarks", label: "Additional Remarks" },
]

export const SHIPMENT_ASSIGNMENT_EXPORT_COLUMNS: ExportColumnDef[] = [
  { id: "reference_number", label: "Reference No.", locked: true },
  { id: "customer", label: "Customer" },
  { id: "business_branch", label: "Business Branch" },
  { id: "loading_port", label: "Loading Port" },
  { id: "destination", label: "Destination" },
  { id: "status", label: "Status" },
  { id: "port_of_discharge", label: "Port of Discharge" },
  { id: "final_place_of_delivery", label: "Final Place of Delivery" },
  { id: "consignee", label: "Consignee" },
  { id: "selling_price", label: "Selling Price" },
  { id: "buying_price", label: "Buying Price" },
  { id: "carrier", label: "Carrier" },
  { id: "vessel", label: "Vessel" },
  { id: "container_status", label: "Container Status" },
  { id: "assigned_to", label: "Assigned To" },
  { id: "created_date", label: "Created" },
  { id: "created_by", label: "Sales Person" },
  { id: "updated_date", label: "Last Updated" },
  { id: "type", label: "Type" },
  { id: "incoterm", label: "Incoterm" },
  { id: "freight_terms", label: "Freight Terms" },
  { id: "free_time", label: "Free Time (Days)" },
  { id: "delivery_till", label: "Delivery Till" },
  { id: "preferred_etd", label: "Preferred ETD" },
  { id: "rebate", label: "Rebate" },
  { id: "credit_period", label: "Credit Period" },
  { id: "shipper", label: "Shipper" },
  { id: "invoice_number", label: "Invoice No." },
  { id: "commodity", label: "Commodity" },
  { id: "volume", label: "Volume" },
  { id: "gross_weight", label: "Gross Weight" },
  { id: "num_packages", label: "No. of Packages" },
  { id: "cargo_ready_date", label: "Cargo Ready Date" },
  { id: "hs_code", label: "HS Code" },
  { id: "po_number", label: "P.O. Number" },
  { id: "equipment_details", label: "Equipment Details" },
  { id: "stuffing_point", label: "Stuffing Point" },
  { id: "sp_remarks", label: "SP Remarks" },
  { id: "liner_booking_number", label: "Liner Booking No." },
  { id: "mbl_number", label: "MBL Number" },
  { id: "contract", label: "Contract" },
  { id: "temp_booking_number", label: "Temp. Booking No." },
  { id: "etd", label: "ETD" },
  { id: "container_no", label: "Container No." },
  { id: "empty_pickup_from", label: "Empty Pickup From" },
  { id: "empty_pickup_till", label: "Empty Pickup Till" },
  { id: "gate_opening_date", label: "Gate Opening Date" },
  { id: "gate_cutoff_date", label: "Gate Cutoff Date" },
  { id: "si_cutoff_date", label: "SI Cut Off Date" },
  { id: "booking_received_date", label: "Booking Received On" },
  { id: "additional_remarks", label: "Additional Remarks" },
]

export function getExportColumnsForType(type: ExportReportType): ExportColumnDef[] {
  switch (type) {
    case "liner-bookings":
      return LINER_BOOKING_EXPORT_COLUMNS
    case "shipment-assignments":
      return SHIPMENT_ASSIGNMENT_EXPORT_COLUMNS
    case "shipment-plans":
    default:
      return SHIPMENT_PLAN_EXPORT_COLUMNS
  }
}

/** Ids of every column for a type, in canonical (display) order. */
export function getExportColumnIds(type: ExportReportType): string[] {
  return getExportColumnsForType(type).map((col) => col.id)
}

/** Ids of the locked (always-included) columns for a type. */
export function getLockedExportColumnIds(type: ExportReportType): string[] {
  return getExportColumnsForType(type)
    .filter((col) => col.locked)
    .map((col) => col.id)
}
