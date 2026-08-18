import type { ActionFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { getMilestoneStatus, getShippers } from "~/lib/container-status";
import {
  getExportColumnIds,
  getExportColumnsForType,
  getLockedExportColumnIds,
  type ExportReportType,
} from "~/lib/export-columns";
import type { ExportFilters } from "~/lib/export-filters";

const EXPORT_TYPES = ["shipment-plans", "liner-bookings", "shipment-assignments"] as const;

function isExportType(value: unknown): value is ExportReportType {
  return typeof value === "string" && (EXPORT_TYPES as readonly string[]).includes(value);
}

interface CreatedAtRange {
  gte?: Date;
  lte?: Date;
}

function buildCreatedAtRange(fromDate?: string | null, toDate?: string | null): CreatedAtRange | undefined {
  const range: CreatedAtRange = {};

  if (fromDate) {
    const start = new Date(fromDate);
    if (!isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      range.gte = start;
    }
  }

  if (toDate) {
    const end = new Date(toDate);
    if (!isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
  }

  return range.gte || range.lte ? range : undefined;
}

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

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const parsed = date instanceof Date ? date : new Date(date);
  if (isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US");
}

// Resolve the requested + locked column ids for a report type, in the type's canonical display order.
// `requested` omitted/not an array (e.g. an older caller) means "no preference" -> export every column.
// An explicit array - including an empty one - is honored as-is, with locked columns always forced in.
function resolveSelectedColumnIds(type: ExportReportType, requested: unknown): string[] {
  const validIds = new Set(getExportColumnIds(type));
  const lockedIds = getLockedExportColumnIds(type);

  if (!Array.isArray(requested)) {
    return getExportColumnIds(type);
  }

  const requestedIds = requested.filter((id): id is string => typeof id === "string" && validIds.has(id));
  const selected = new Set([...lockedIds, ...requestedIds]);
  return getExportColumnsForType(type)
    .map((col) => col.id)
    .filter((id) => selected.has(id));
}

function summarizeEquipment(equipmentDetails: any[]): string {
  if (!Array.isArray(equipmentDetails) || equipmentDetails.length === 0) return "";
  const counts: Record<string, number> = {};
  equipmentDetails.forEach((eq) => {
    const type = eq?.equipment_type;
    if (type) counts[type] = (counts[type] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([type, count]) => `${count} x ${String(type).replace(/\s*container$/i, "").trim()}`)
    .join(", ");
}

// ---- Filters --------------------------------------------------------------

function normalizeFilters(raw: unknown): ExportFilters {
  if (!raw || typeof raw !== "object") return {};
  const toStringArray = (v: unknown): string[] | undefined =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : undefined;
  const source = raw as Record<string, unknown>;
  return {
    businessBranches: toStringArray(source.businessBranches),
    statuses: toStringArray(source.statuses),
    destinationCountries: toStringArray(source.destinationCountries),
    customers: toStringArray(source.customers),
    shippers: toStringArray(source.shippers),
    salesPersonIds: toStringArray(source.salesPersonIds),
    shipmentTypes: toStringArray(source.shipmentTypes),
  };
}

// A facet with no selected values always matches (filter not applied).
function matchesFacet(value: string | null | undefined, selected: string[] | undefined): boolean {
  if (!selected || selected.length === 0) return true;
  return !!value && selected.includes(value);
}

function matchesAnyFacet(values: string[], selected: string[] | undefined): boolean {
  if (!selected || selected.length === 0) return true;
  return values.some((v) => selected.includes(v));
}

function shipmentPlanMatchesFilters(plan: any, filters: ExportFilters): boolean {
  const data = plan.data as any;
  const cm = data?.container_movement || {};
  if (!matchesFacet(data?.bussiness_branch, filters.businessBranches)) return false;
  if (!matchesFacet(data?.booking_status, filters.statuses)) return false;
  if (!matchesFacet(cm.destination_country, filters.destinationCountries)) return false;
  if (!matchesFacet(cm.customer, filters.customers)) return false;
  if (!matchesAnyFacet(getShippers(data?.package_details), filters.shippers)) return false;
  if (!matchesFacet(data?.shipment_type, filters.shipmentTypes)) return false;
  // "Sales Person" mirrors the list page's "Sales Person" column, which shows the creator.
  if (filters.salesPersonIds?.length && !filters.salesPersonIds.includes(plan.userId)) return false;
  return true;
}

function linerBookingMatchesFilters(booking: any, filters: ExportFilters): boolean {
  const spData = booking.shipmentPlan?.data as any;
  const cm = spData?.container_movement || {};
  if (!matchesFacet(spData?.bussiness_branch, filters.businessBranches)) return false;
  if (!matchesFacet(booking.data?.carrier_booking_status, filters.statuses)) return false;
  if (!matchesFacet(cm.destination_country, filters.destinationCountries)) return false;
  if (!matchesFacet(cm.customer, filters.customers)) return false;
  if (!matchesAnyFacet(getShippers(spData?.package_details), filters.shippers)) return false;
  if (!matchesFacet(spData?.shipment_type, filters.shipmentTypes)) return false;
  if (filters.salesPersonIds?.length && !filters.salesPersonIds.includes(booking.userId)) return false;
  return true;
}

function shipmentAssignmentMatchesFilters(assignment: any, filters: ExportFilters): boolean {
  const data = assignment.data as any;
  const spData = assignment.isOrphaned ? data?._originalShipmentPlan : assignment.shipmentPlan?.data;
  const cm = spData?.container_movement || {};
  if (!matchesFacet(spData?.bussiness_branch, filters.businessBranches)) return false;
  if (!matchesFacet(spData?.booking_status || data?.carrier_booking_status, filters.statuses)) return false;
  if (!matchesFacet(cm.destination_country, filters.destinationCountries)) return false;
  if (!matchesFacet(cm.customer, filters.customers)) return false;
  if (!matchesAnyFacet(getShippers(spData?.package_details), filters.shippers)) return false;
  if (!matchesFacet(spData?.shipment_type, filters.shipmentTypes)) return false;
  const salesPersonId = assignment.shipmentPlan?.userId || assignment.userId;
  if (filters.salesPersonIds?.length && !filters.salesPersonIds.includes(salesPersonId)) return false;
  return true;
}

// ---- Shipment Plans -----------------------------------------------------

function shipmentPlanColumnValue(plan: any, columnId: string): any {
  const data = plan.data as any;
  const cm = data?.container_movement || {};
  const cvp = cm.carrier_and_vessel_preference || {};
  const pkg0 = (data?.package_details || [])[0] || {};
  const eq = data?.equipment_details || [];

  switch (columnId) {
    case "reference_number": return data?.reference_number;
    case "business_branch": return data?.bussiness_branch;
    case "shipment_type": return data?.shipment_type;
    case "customer": return cm.customer;
    case "loading_port": return cm.loading_port;
    case "destination_country": return cm.destination_country;
    case "booking_status": return data?.booking_status;
    case "milestone_status": return getMilestoneStatus(plan);
    case "port_of_discharge": return cm.port_of_discharge;
    case "final_place_of_delivery":
      return cm.delivery_till?.toLowerCase() === "port" ? "" : cm.final_place_of_delivery;
    case "consignee": return cm.consignee;
    case "selling_price": return cm.selling_price;
    case "buying_price": return cm.buying_price;
    case "carrier": return cvp.carrier;
    case "vessel": return cvp.vessel;
    case "created_date": return formatDate(plan.createdAt);
    case "created_by": return plan.user?.name;
    case "updated_date": return formatDate(plan.updatedAt);
    case "incoterm": return cm.incoterm;
    case "freight_terms": return cm.freight_terms;
    case "free_time": return cm.free_time_in_days;
    case "delivery_till": return cm.delivery_till;
    case "preferred_etd": return formatDate(cvp.preferred_etd);
    case "rebate": return cm.rebate;
    case "credit_period": return cm.credit_period;
    case "shipper": return getShippers(data?.package_details).join("; ");
    case "invoice_number": return pkg0.invoice_number;
    case "commodity": return pkg0.commodity;
    case "volume": return pkg0.volume;
    case "gross_weight": return pkg0.gross_weight;
    case "num_packages": return pkg0.number_of_packages;
    case "cargo_ready_date": return formatDate(pkg0.projected_cargo_ready_date);
    case "hs_code": return pkg0.hs_code;
    case "po_number": return pkg0.p_o_number;
    case "container_no": return eq.map((e: any) => e.container_number).filter(Boolean).join(", ");
    case "equipment_details": return summarizeEquipment(eq);
    case "stuffing_point": return eq[0]?.stuffing_point;
    case "remarks": return data?.remarks;
    default: return "";
  }
}

// ---- Liner Bookings -------------------------------------------------------

function linerBookingColumnValue(booking: any, columnId: string): any {
  const data = booking.data as any;
  const d0 = (data?.liner_booking_details || [])[0] || {};

  switch (columnId) {
    case "temp_booking_number": return d0.temporary_booking_number;
    case "carrier": return d0.carrier;
    case "vessel": return d0.original_planned_vessel;
    case "etd": return formatDate(d0.e_t_d_of_original_planned_vessel);
    case "liner_booking_number": return d0.liner_booking_number;
    case "mbl_number": return d0.mbl_number;
    case "contract": return d0.contract;
    case "loading_port": return d0.loading_port;
    case "port_of_discharge": return d0.port_of_discharge;
    case "equipment_type": return d0.equipment_type;
    case "created_date": return formatDate(booking.createdAt);
    case "created_by": return booking.user?.name;
    case "updated_date": return formatDate(booking.updatedAt);
    case "empty_pickup_from": return formatDate(d0.empty_pickup_validity_from);
    case "empty_pickup_till": return formatDate(d0.empty_pickup_validity_till);
    case "gate_opening_date": return formatDate(d0.estimate_gate_opening_date);
    case "gate_cutoff_date": return formatDate(d0.estimated_gate_cutoff_date);
    case "si_cutoff_date": return formatDate(d0.s_i_cut_off_date);
    case "booking_received_date": return formatDate(d0.booking_received_from_carrier_on);
    case "additional_remarks": return d0.additional_remarks;
    default: return "";
  }
}

// ---- Shipment Assignments ---------------------------------------------------

function shipmentAssignmentColumnValue(assignment: any, columnId: string): any {
  const data = assignment.data as any;
  const spData = assignment.isOrphaned ? data?._originalShipmentPlan : assignment.shipmentPlan?.data;
  const cm = spData?.container_movement || {};
  const cvp = cm.carrier_and_vessel_preference || {};
  const d0 = (data?.liner_booking_details || [])[0] || {};
  const pkg0 = (spData?.package_details || [])[0] || {};
  const eq = spData?.equipment_details || [];

  switch (columnId) {
    case "reference_number": return spData?.reference_number;
    case "customer": return cm.customer;
    case "business_branch": return spData?.bussiness_branch;
    case "loading_port": return cm.loading_port;
    case "destination": return cm.destination_country;
    case "status": return spData?.booking_status || data?.carrier_booking_status;
    case "port_of_discharge": return cm.port_of_discharge;
    case "final_place_of_delivery":
      return cm.delivery_till?.toLowerCase() === "port" ? "" : cm.final_place_of_delivery;
    case "consignee": return cm.consignee;
    case "selling_price": return cm.selling_price;
    case "buying_price": return cm.buying_price;
    case "carrier": return cvp.carrier || d0.carrier;
    case "vessel": return cvp.vessel || d0.original_planned_vessel;
    case "container_status": return getMilestoneStatus({ data: spData });
    case "assigned_liner_broker": return assignment.assignedLinerBroker?.name;
    case "created_date": return formatDate(assignment.shipmentPlan?.createdAt || assignment.createdAt);
    case "created_by": return assignment.shipmentPlan?.user?.name || assignment.user?.name;
    case "updated_date": return formatDate(assignment.updatedAt);
    case "type": return spData?.shipment_type;
    case "incoterm": return cm.incoterm;
    case "freight_terms": return cm.freight_terms;
    case "free_time": return cm.free_time_in_days;
    case "delivery_till": return cm.delivery_till;
    case "preferred_etd": return formatDate(cvp.preferred_etd);
    case "rebate": return cm.rebate;
    case "credit_period": return cm.credit_period;
    case "shipper": return getShippers(spData?.package_details).join("; ");
    case "invoice_number": return pkg0.invoice_number;
    case "commodity": return pkg0.commodity;
    case "volume": return pkg0.volume;
    case "gross_weight": return pkg0.gross_weight;
    case "num_packages": return pkg0.number_of_packages;
    case "cargo_ready_date": return formatDate(pkg0.projected_cargo_ready_date);
    case "hs_code": return pkg0.hs_code;
    case "po_number": return pkg0.p_o_number;
    case "equipment_details": return summarizeEquipment(eq);
    case "stuffing_point": return eq[0]?.stuffing_point;
    case "sp_remarks": return spData?.remarks;
    case "liner_booking_number": return d0.liner_booking_number;
    case "mbl_number": return d0.mbl_number;
    case "contract": return d0.contract;
    case "temp_booking_number": return d0.temporary_booking_number;
    case "etd": return formatDate(d0.e_t_d_of_original_planned_vessel);
    case "container_no": return eq.map((e: any) => e.container_number).filter(Boolean).join(", ");
    case "empty_pickup_from": return formatDate(d0.empty_pickup_validity_from);
    case "empty_pickup_till": return formatDate(d0.empty_pickup_validity_till);
    case "gate_opening_date": return formatDate(d0.estimate_gate_opening_date);
    case "gate_cutoff_date": return formatDate(d0.estimated_gate_cutoff_date);
    case "si_cutoff_date": return formatDate(d0.s_i_cut_off_date);
    case "booking_received_date": return formatDate(d0.booking_received_from_carrier_on);
    case "additional_remarks": return d0.additional_remarks;
    default: return "";
  }
}

// ---- CSV assembly -----------------------------------------------------------

function buildCsv(reportTitle: string, headers: string[], rows: any[][]): string {
  const currentDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const companyHeader = [
    `CARGOCARE LOGISTICS - ${reportTitle}`,
    `Generated on: ${currentDate}`,
    `Total Records: ${rows.length}`,
    ``,
    ``,
  ];

  return [
    ...companyHeader,
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");
}

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request);

    // Only allow ADMIN users to export data
    if (user.role.name !== "ADMIN") {
      return json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    // Export options sent as a JSON body from the export modal:
    // which dataset, which columns, an optional created-date range, and facet filters.
    let body: { type?: string; fromDate?: string; toDate?: string; columns?: unknown; filters?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      // No/invalid JSON body - use defaults
    }

    const exportType: ExportReportType = isExportType(body.type) ? body.type : "shipment-plans";
    const createdAt = buildCreatedAtRange(body.fromDate, body.toDate);
    const filters = normalizeFilters(body.filters);
    const selectedColumnIds = resolveSelectedColumnIds(exportType, body.columns);
    const columnDefs = getExportColumnsForType(exportType).filter((col) => selectedColumnIds.includes(col.id));
    const headers = columnDefs.map((col) => col.label);
    const timestamp = new Date().toISOString().slice(0, 10);

    if (exportType === "liner-bookings") {
      const linerBookings = await prisma.linerBooking.findMany({
        where: createdAt ? { createdAt } : undefined,
        include: {
          user: { select: { name: true, email: true } },
          shipmentPlan: { select: { data: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const filtered = linerBookings.filter((booking) => linerBookingMatchesFilters(booking, filters));
      const rows = filtered.map((booking) => columnDefs.map((col) => linerBookingColumnValue(booking, col.id)));
      return csvResponse(buildCsv("LINER BOOKINGS EXPORT REPORT", headers, rows), `liner-bookings-export-${timestamp}.csv`);
    }

    if (exportType === "shipment-assignments") {
      const assignments = await prisma.shipmentAssignment.findMany({
        where: createdAt ? { createdAt } : undefined,
        include: {
          user: { select: { name: true, email: true } },
          shipmentPlan: { include: { user: { select: { name: true, email: true } } } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Batch-fetch assigned liner brokers instead of N+1 lookups per assignment
      const brokerIds = [...new Set(assignments.map((a) => a.assignBookingId).filter(Boolean))] as string[];
      const brokers = brokerIds.length > 0
        ? await prisma.user.findMany({ where: { id: { in: brokerIds } }, select: { id: true, name: true } })
        : [];
      const brokersById = new Map(brokers.map((b) => [b.id, b]));
      const assignmentsWithBroker = assignments.map((a) => ({
        ...a,
        assignedLinerBroker: a.assignBookingId ? brokersById.get(a.assignBookingId) ?? null : null,
      }));

      const filtered = assignmentsWithBroker.filter((a) => shipmentAssignmentMatchesFilters(a, filters));
      const rows = filtered.map((a) => columnDefs.map((col) => shipmentAssignmentColumnValue(a, col.id)));
      return csvResponse(buildCsv("SHIPMENT ASSIGNMENTS EXPORT REPORT", headers, rows), `shipment-assignments-export-${timestamp}.csv`);
    }

    // Default: shipment-plans
    const shipmentPlans = await prisma.shipmentPlan.findMany({
      where: createdAt ? { createdAt } : undefined,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    const filtered = shipmentPlans.filter((plan) => shipmentPlanMatchesFilters(plan, filters));
    const rows = filtered.map((plan) => columnDefs.map((col) => shipmentPlanColumnValue(plan, col.id)));
    return csvResponse(buildCsv("SHIPMENT PLANS EXPORT REPORT", headers, rows), `shipment-plans-export-${timestamp}.csv`);
  } catch (error) {
    console.error("CSV export error:", error);
    return json({ error: "Failed to export data" }, { status: 500 });
  }
}

export async function loader() {
  return json({ message: "Use POST to export CSV data" });
}
