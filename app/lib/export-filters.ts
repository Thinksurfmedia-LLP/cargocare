// Shared shape for the CSV export modal's filter facets, applied on top of the
// from/to date range. Used by both the client (ExportCsvModal) and the server
// (api.export-csv.tsx) so the request body stays typed on both ends.

export interface ExportFilters {
  businessBranches?: string[]
  statuses?: string[]
  destinationCountries?: string[]
  customers?: string[]
  shippers?: string[]
  salesPersonIds?: string[]
  shipmentTypes?: string[]
  /** The LINER_BOOKING_TEAM member a booking/plan's work is assigned to (`assignBookingId`). */
  assignedToIds?: string[]
}

export interface ExportFilterOptions {
  businessBranches: string[]
  destinationCountries: string[]
  customers: string[]
  shippers: string[]
  // businessBranch is the user's own assigned branch - lets the modal narrow
  // Sales Person / Assigned To down to the branch(es) picked in Business Branch.
  salesPersons: { id: string; name: string; businessBranch: string | null }[]
  assignedToUsers: { id: string; name: string; businessBranch: string | null }[]
  shipmentTypes: string[]
  statuses: string[]
}

export const EMPTY_EXPORT_FILTERS: ExportFilters = {}
