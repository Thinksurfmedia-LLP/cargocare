"use client"

import { Link, Form, useLocation } from "react-router"
import { Button } from "~/components/ui/button"
import { ExportCsvModal, type ExportCsvType } from "~/components/ExportCsvModal"
import type { ExportFilters } from "~/lib/export-filters"
import type React from "react"
import { useState } from "react"

interface AdminLayoutProps {
  user: {
    id: string
    name: string
    email: string
    role: {
      name: string
    }
  }
  children: React.ReactNode
}

export function AdminLayout({ user, children }: AdminLayoutProps) {
  const location = useLocation()
  const [dataPointsOpen, setDataPointsOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDownloadingFullReport, setIsDownloadingFullReport] = useState(false)

  const roleName = (user?.role?.name ?? "GUEST") as string

  const isActive = (path: string) => {
    // Handle paths with query parameters
    if (path.includes("?")) {
      const [pathname, searchParams] = path.split("?")
      const currentSearchParams = new URLSearchParams(location.search)
      const targetSearchParams = new URLSearchParams(searchParams)

      // Check if pathname matches and all target search params are present
      if (location.pathname === pathname) {
        for (const [key, value] of targetSearchParams.entries()) {
          if (currentSearchParams.get(key) !== value) {
            return false
          }
        }
        return true
      }
      return false
    }

    if (path === "/liner-bookings") {
      const currentSearchParams = new URLSearchParams(location.search)
      // Only active if we're on /liner-bookings AND there's no tab=assignments parameter
      return location.pathname === path && currentSearchParams.get("tab") !== "assignments"
    }

    // Original logic for other paths without query parameters
    return location.pathname === path || location.pathname.startsWith(path + "/")
  }

  const navItems = [
    {
      name: "Pending Approvals",
      path: "/pending-approvals",
      icon: "⏳",
      show: roleName === "MD",
    },
    {
      name: "Shipment Plans",
      path: "/shipment-plans",
      icon: "📦",
      show: roleName === "ADMIN" || roleName === "SHIPMENT_PLAN_TEAM" || roleName === "MD",
    },
    {
      name: "Available Liner Bookings",
      path: "/liner-bookings",
      icon: "🚢",
      show: roleName === "ADMIN" || roleName === "LINER_BOOKING_TEAM" || roleName === "MD",
    },
    {
      name: "Shipment Assignments",
      path: "/liner-bookings?tab=assignments",
      icon: "📝",
      show: roleName === "ADMIN" || roleName === "LINER_BOOKING_TEAM",
    },
    {
      name: "Bulk Operations",
      path: "/bulk-operations",
      icon: "📊",
      show: roleName === "ADMIN",
    },
    {
      name: "Manage Users",
      path: "/admin",
      icon: "👥",
      show: roleName === "ADMIN",
    },
  ]

  const dataPointItems = [
    { name: "Organizations", path: "/data-points/organizations", icon: "🏢" },
    { name: "Business Branches", path: "/data-points/business-branches", icon: "🏪" },
    { name: "Commodities", path: "/data-points/commodities", icon: "📦" },
    { name: "Equipment", path: "/data-points/equipment", icon: "🔧" },
    { name: "Loading Ports", path: "/data-points/loading-ports", icon: "⚓" },
    { name: "Ports of Discharge", path: "/data-points/ports-of-discharge", icon: "🚢" },
    { name: "Destination Countries", path: "/data-points/destination-countries", icon: "🌍" },
    { name: "Vessels", path: "/data-points/vessels", icon: "🛳️" },
    { name: "Carriers", path: "/data-points/carriers", icon: "🚛" },
  ]
  const downloadCsvBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const handleExportCsv = async (
    type: ExportCsvType,
    fromDate: string,
    toDate: string,
    columns: string[],
    filters: ExportFilters
  ) => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/export-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, fromDate, toDate, columns, filters }),
      })

      if (response.ok) {
        const blob = await response.blob()
        downloadCsvBlob(blob, `${type}-export-${new Date().toISOString().slice(0, 10)}.csv`)
        setExportModalOpen(false)
      } else {
        alert('Failed to export CSV. Please try again.')
      }
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export CSV. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadFullReport = async () => {
    setIsDownloadingFullReport(true)
    try {
      const response = await fetch('/api/export-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ full: true }),
      })

      if (response.ok) {
        const blob = await response.blob()
        downloadCsvBlob(blob, `shipment-plans-full-export-${new Date().toISOString().slice(0, 10)}.csv`)
      } else {
        alert('Failed to download the full report. Please try again.')
      }
    } catch (error) {
      console.error('Full report download error:', error)
      alert('Failed to download the full report. Please try again.')
    } finally {
      setIsDownloadingFullReport(false)
    }
  }

  const getRoleColor = (roleName: string) => {
    switch (roleName) {
      case "ADMIN":
        return "bg-red-500 text-white"
      case "LINER_BOOKING_TEAM":
        return "bg-blue-500 text-white"
      case "SHIPMENT_PLAN_TEAM":
        return "bg-emerald-500 text-white"
      case "MD":
        return "bg-yellow-500 text-white"
      default:
        return "bg-slate-500 text-white"
    }
  }
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Fixed Left Sidebar */}
      <div className="w-64 bg-slate-800 shadow-xl flex flex-col">
        {" "}
        {/* Enhanced Logo/Header */}
        <div className="h-24 flex items-center justify-center px-4 bg-slate-900 border-b border-slate-700">
          <div className="flex flex-col items-center space-y-2 w-full">
            <div className="bg-white px-3 py-2 rounded-lg w-full flex justify-center shadow-inner">
              <img 
                src="https://cargocarelogistics.in/wp-content/uploads/2022/08/New-ccl-logo-color-495x101px.png" 
                alt="Cargocare Logistics Logo" 
                className="h-7 w-auto object-contain" 
              />
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold text-center w-full">
              Booking Management System
            </p>
          </div>
        </div>{" "}
        {/* Enhanced Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0">
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`group w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                  isActive(item.path)
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                <span
                  className={`text-lg transition-transform duration-200 ${
                    isActive(item.path) ? "scale-110" : "group-hover:scale-105"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="font-medium">{item.name}</span>
                {isActive(item.path) && <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse"></div>}
              </Link>
            ))}

          {roleName === "ADMIN" && (
            <>
              {/* CSV Export Section */}
              <div className="space-y-2 pt-2 border-t border-slate-700">
                <button
                  onClick={() => setExportModalOpen(true)}
                  className="group w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 text-slate-300 hover:bg-green-600 hover:text-white"
                >
                  <span className="text-lg transition-transform duration-200 group-hover:scale-105">📊</span>
                  <span className="font-medium">Export CSV Report</span>
                  <span className="ml-auto text-xs bg-green-600 text-white px-2 py-1 rounded-full">Admin</span>
                </button>
              </div>

              {/* Data Points Section */}
              <div className="space-y-1">
                <button
                  onClick={() => setDataPointsOpen(!dataPointsOpen)}
                  className={`group w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                    location.pathname.startsWith("/data-points")
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <span
                    className={`text-lg transition-transform duration-200 ${
                      location.pathname.startsWith("/data-points") ? "scale-110" : "group-hover:scale-105"
                    }`}
                  >
                    📊
                  </span>
                  <span className="font-medium flex-1">Data Points</span>
                  <span className={`transition-transform duration-200 ${dataPointsOpen ? "rotate-180" : ""}`}>↓</span>
                </button>

                {/* Nested Data Points Items */}
                {dataPointsOpen && (
                  <div className="ml-4 space-y-1 border-l-2 border-slate-600 pl-2">
                    {dataPointItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`group w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-all duration-200 ${
                          isActive(item.path)
                            ? "bg-blue-500 text-white shadow-md"
                            : "text-slate-400 hover:bg-slate-700 hover:text-white"
                        }`}
                      >
                        <span className="text-sm">{item.icon}</span>
                        <span className="text-sm font-medium">{item.name}</span>
                        {isActive(item.path) && (
                          <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </nav>
        {/* Enhanced User Info */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center ring-2 ring-slate-600">
              <span className="text-white font-semibold text-base">
                {(user?.name ?? "?").charAt(0).toUpperCase() || "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name ?? "User"}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email ?? ""}</p>
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(roleName)}`}
            >
              <span className="w-1.5 h-1.5 bg-current rounded-full mr-2"></span>
              {roleName.replace(/_/g, " ")}
            </span>
          </div>
        </div>
        {/* Enhanced Logout */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/30">
          <Form method="post" action="/logout" className="w-full">
            <Button
              type="submit"
              className="w-full justify-start space-x-3 bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600 rounded-xl transition-all duration-200 hover:shadow-lg"
            >
              <span className="text-lg">🚪</span>
              <span className="font-medium">Logout</span>
            </Button>
          </Form>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#fffdf3] via-[#fff7d6] to-[#ffeeb8]">{children}</div>

      <ExportCsvModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExportCsv}
        isExporting={isExporting}
        onDownloadFullReport={handleDownloadFullReport}
        isDownloadingFullReport={isDownloadingFullReport}
      />
    </div>
  )
}
