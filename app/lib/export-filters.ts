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
}

export interface ExportFilterOptions {
  businessBranches: string[]
  destinationCountries: string[]
  customers: string[]
  shippers: string[]
  salesPersons: { id: string; name: string }[]
  shipmentTypes: string[]
  statuses: string[]
}

export const EMPTY_EXPORT_FILTERS: ExportFilters = {}
