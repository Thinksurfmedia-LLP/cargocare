import { useEffect, useState } from "react"
import { Button } from "~/components/ui/button"
import { Label } from "~/components/ui/label"
import { Checkbox } from "~/components/ui/checkbox"
import { MultiSelect, type MultiSelectOption } from "~/components/ui/multi-select"
import {
  getExportColumnsForType,
  getExportColumnIds,
  getLockedExportColumnIds,
  type ExportReportType,
} from "~/lib/export-columns"
import type { ExportFilterOptions, ExportFilters } from "~/lib/export-filters"

export type ExportCsvType = ExportReportType

interface ExportOption {
  type: ExportCsvType
  label: string
  icon: string
}

const EXPORT_OPTIONS: ExportOption[] = [
  { type: "shipment-plans", label: "Shipment Plans", icon: "📦" },
  { type: "liner-bookings", label: "Available Liner Bookings", icon: "🚢" },
  { type: "shipment-assignments", label: "Shipment Assignments", icon: "📝" },
]

const EMPTY_FILTERS: ExportFilters = {}

interface ExportCsvModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (
    type: ExportCsvType,
    fromDate: string,
    toDate: string,
    columns: string[],
    filters: ExportFilters
  ) => Promise<void> | void
  isExporting: boolean
}

export function ExportCsvModal({ isOpen, onClose, onExport, isExporting }: ExportCsvModalProps) {
  const [type, setType] = useState<ExportCsvType>("shipment-plans")
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => getExportColumnIds("shipment-plans"))
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [dateError, setDateError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ExportFilters>(EMPTY_FILTERS)
  const [filterOptions, setFilterOptions] = useState<ExportFilterOptions | null>(null)
  const [filterOptionsError, setFilterOptionsError] = useState(false)

  // Default to "all columns selected" whenever the dataset changes.
  useEffect(() => {
    setSelectedColumns(getExportColumnIds(type))
  }, [type])

  // Load filter facet options (business branches, customers, etc.) once, when the modal first opens.
  useEffect(() => {
    if (!isOpen || filterOptions || filterOptionsError) return
    let cancelled = false
    fetch("/api/export-filter-options")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load filter options"))))
      .then((data: ExportFilterOptions) => {
        if (!cancelled) setFilterOptions(data)
      })
      .catch(() => {
        if (!cancelled) setFilterOptionsError(true)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, filterOptions, filterOptionsError])

  if (!isOpen) return null

  const columns = getExportColumnsForType(type)
  const lockedIds = getLockedExportColumnIds(type)
  const selectedToggleableCount = selectedColumns.filter((id) => !lockedIds.includes(id)).length

  const toOptions = (values: string[]): MultiSelectOption[] => values.map((v) => ({ value: v, label: v }))
  const salesPersonOptions: MultiSelectOption[] =
    filterOptions?.salesPersons.map((sp) => ({ value: sp.id, label: sp.name })) ?? []

  const activeFilterCount = Object.values(filters).filter((v) => Array.isArray(v) && v.length > 0).length

  const handleClose = () => {
    if (isExporting) return
    onClose()
  }

  const handleColumnToggle = (columnId: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnId) ? prev.filter((id) => id !== columnId) : [...prev, columnId]
    )
  }

  const handleSelectAll = () => setSelectedColumns(getExportColumnIds(type))
  const handleSelectNone = () => setSelectedColumns(lockedIds)

  const updateFilter = (key: keyof ExportFilters, values: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: values }))
  }

  const handleClearFilters = () => setFilters(EMPTY_FILTERS)

  const handleExport = async () => {
    if (fromDate && toDate && fromDate > toDate) {
      setDateError("From date cannot be after to date.")
      return
    }
    setDateError(null)
    // Preserve canonical column order regardless of toggle order.
    const orderedColumns = columns.filter((col) => selectedColumns.includes(col.id)).map((col) => col.id)
    await onExport(type, fromDate, toDate, orderedColumns, filters)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Export CSV Report</h3>
              <p className="text-sm text-gray-500 mt-1">Choose a dataset, filters, and columns</p>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors" disabled={isExporting}>
              <span className="text-xl">×</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-5 overflow-y-auto">
          {/* Dataset selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">What do you want to export?</Label>
            <div className="space-y-2">
              {EXPORT_OPTIONS.map((option) => (
                <label
                  key={option.type}
                  className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                    type === option.type
                      ? "bg-blue-50 border-blue-300 ring-1 ring-blue-300"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="export-type"
                    value={option.type}
                    checked={type === option.type}
                    onChange={() => setType(option.type)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-lg">{option.icon}</span>
                  <span className="flex-1 font-medium text-gray-800">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Date range (optional)</Label>
            <p className="text-xs text-gray-500">Filters by created date. Leave blank to export all records.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="export-from-date" className="text-xs text-gray-500">From</Label>
                <input
                  id="export-from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  max={toDate || undefined}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <Label htmlFor="export-to-date" className="text-xs text-gray-500">To</Label>
                <input
                  id="export-to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  min={fromDate || undefined}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            {dateError && <p className="text-xs text-red-600">{dateError}</p>}
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Filters (optional)</Label>
              {activeFilterCount > 0 && (
                <button type="button" onClick={handleClearFilters} className="text-xs text-blue-600 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
            {filterOptionsError ? (
              <p className="text-xs text-red-600">Couldn't load filter options. You can still export without filters.</p>
            ) : !filterOptions ? (
              <p className="text-xs text-gray-500">Loading filter options...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Business Branch</Label>
                  <div className="mt-1">
                    <MultiSelect
                      options={toOptions(filterOptions.businessBranches)}
                      selected={filters.businessBranches ?? []}
                      onChange={(v) => updateFilter("businessBranches", v)}
                      placeholder="All branches"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Status</Label>
                  <div className="mt-1">
                    <MultiSelect
                      options={toOptions(filterOptions.statuses)}
                      selected={filters.statuses ?? []}
                      onChange={(v) => updateFilter("statuses", v)}
                      placeholder="All statuses"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Destination Country</Label>
                  <div className="mt-1">
                    <MultiSelect
                      options={toOptions(filterOptions.destinationCountries)}
                      selected={filters.destinationCountries ?? []}
                      onChange={(v) => updateFilter("destinationCountries", v)}
                      placeholder="All countries"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Customer</Label>
                  <div className="mt-1">
                    <MultiSelect
                      options={toOptions(filterOptions.customers)}
                      selected={filters.customers ?? []}
                      onChange={(v) => updateFilter("customers", v)}
                      placeholder="All customers"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Shipper</Label>
                  <div className="mt-1">
                    <MultiSelect
                      options={toOptions(filterOptions.shippers)}
                      selected={filters.shippers ?? []}
                      onChange={(v) => updateFilter("shippers", v)}
                      placeholder="All shippers"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Sales Person</Label>
                  <div className="mt-1">
                    <MultiSelect
                      options={salesPersonOptions}
                      selected={filters.salesPersonIds ?? []}
                      onChange={(v) => updateFilter("salesPersonIds", v)}
                      placeholder="All sales persons"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Shipment Type</Label>
                  <div className="mt-1">
                    <MultiSelect
                      options={toOptions(filterOptions.shipmentTypes)}
                      selected={filters.shipmentTypes ?? []}
                      onChange={(v) => updateFilter("shipmentTypes", v)}
                      placeholder="All types"
                    />
                  </div>
                </div>
              </div>
            )}
            {type === "liner-bookings" && (
              <p className="text-xs text-amber-600">
                Note: Business Branch, Customer, Shipper, and Shipment Type only match liner bookings linked to a shipment plan.
              </p>
            )}
          </div>

          {/* Column selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Columns to include</Label>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {selectedToggleableCount + lockedIds.length}/{columns.length} selected
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:underline"
              >
                Select all
              </button>
              <span className="text-xs text-gray-300">|</span>
              <button
                type="button"
                onClick={handleSelectNone}
                className="text-xs text-blue-600 hover:underline"
              >
                Select none
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {columns.map((col) => (
                <label
                  key={col.id}
                  className={`flex items-center space-x-3 px-3 py-2 text-sm ${
                    col.locked ? "bg-gray-50" : "hover:bg-gray-50 cursor-pointer"
                  }`}
                >
                  <Checkbox
                    checked={col.locked || selectedColumns.includes(col.id)}
                    disabled={col.locked}
                    onChange={() => !col.locked && handleColumnToggle(col.id)}
                  />
                  <span className={col.locked ? "text-gray-500" : "text-gray-800"}>{col.label}</span>
                  {col.locked && <span className="text-xs text-gray-400 ml-auto">Always included</span>}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isExporting} className="text-sm">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="text-sm bg-green-600 hover:bg-green-700 text-white"
            >
              {isExporting ? "Exporting..." : "Export"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
