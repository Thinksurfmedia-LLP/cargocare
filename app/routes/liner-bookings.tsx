"use client"

import React from "react"
import { Form } from "react-router"
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router"
import {
  useLoaderData,
  useNavigate,
  useNavigation,
  redirect,
  useActionData,
  useSearchParams,
  Link,
} from "react-router"
import { requireAuth } from "~/lib/auth.server"
import { prisma } from "~/lib/prisma.server"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { Checkbox } from "~/components/ui/checkbox"
import { Badge } from "~/components/ui/badge"
import { AdminLayout } from "~/components/AdminLayout"
import { ColumnSelectorModal } from "~/components/ui/column-selector-modal"
import { useColumnPreferences } from "~/hooks/useColumnPreferences"
import { useState } from "react"
import { json } from "@remix-run/node"

export const meta: MetaFunction = () => {
  return [
    { title: "Liner Bookings - Cargo Care" },
    {
      name: "description",
      content: "Manage liner bookings and carrier details",
    },
  ]
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request)

    // Only allow LINER_BOOKING_TEAM and ADMIN
    if (user.role.name !== "LINER_BOOKING_TEAM" && user.role.name !== "ADMIN" && user.role.name !== "MD") {
      return redirect("/dashboard")
    }

    const url = new URL(request.url)
    const search = url.searchParams.get("search") || ""
    const page = Number.parseInt(url.searchParams.get("page") || "1")
    const limit = Number.parseInt(url.searchParams.get("limit") || "10")
    const offset = (page - 1) * limit
    const tab = url.searchParams.get("tab") || "bookings"

    const whereCondition: any = {}

    if (tab !== "assignments") {
      // For the bookings tab, we want to show only available bookings
      // These should NOT be linked to any shipment plan AND have appropriate status
      whereCondition.AND = [
        // First condition: Must not be linked to any shipment plan
        {
          shipmentPlanId: null,
        },
        // Second condition: Must have appropriate carrier booking status
        {
          OR: [
            {
              data: {
                path: ["carrier_booking_status"],
                equals: null,
              },
            },
            {
              data: {
                path: ["carrier_booking_status"],
                equals: "Confirmed",
              },
            },
            {
              data: {
                path: ["carrier_booking_status"],
                equals: "Completed",
              },
            },
            {
              data: {
                path: ["carrier_booking_status"],
                equals: "Cancelled",
              },
            },
            {
              data: {
                path: ["carrier_booking_status"],
                equals: "Ready for Re-linking",
              },
            },
          ]
        }
      ]
    }

    // Role-based access control
    console.log("User data:", user.id, "Role:", user.role.name)
    if (user.role.name === "LINER_BOOKING_TEAM") {
      // LINER_BOOKING_TEAM members can see bookings/assignments they:
      // 1. Are assigned to (assignBookingId = user.id)
      // 2. Created themselves (userId = user.id)

      // If we already have AND conditions (from tab filtering), we need to combine properly
      if (whereCondition.AND) {
        // Add access control as another AND condition
        whereCondition.AND.push({
          OR: [
            { assignBookingId: user.id },  // Assigned to them
            { userId: user.id }           // Created by them
          ]
        });
      } else {
        // No existing AND conditions, just set OR for access control
        whereCondition.OR = [
          { assignBookingId: user.id },  // Assigned to them
          { userId: user.id }           // Created by them
        ]
      }
      console.log("LINER_BOOKING_TEAM access control applied: assignBookingId OR userId =", user.id)
    }
    // ADMIN and MD can see all bookings/assignments (no filter applied) // Search functionality
    if (search) {
      const searchConditions = []

      // Use raw SQL with ILIKE for case-insensitive JSON field searches
      try {
        // Dynamically target the correct table for array-field raw SQL searches
        const table = tab === "assignments" ? "shipment_assignments" : "liner_bookings"

        // Search in carrier booking status (case-insensitive)
        const statusMatches = await prisma.$queryRawUnsafe(
          `SELECT id FROM "${table}" WHERE data->>'carrier_booking_status' ILIKE $1`,
          `%${search}%`,
        )
        if ((statusMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (statusMatches as any[]).map((row: any) => row.id) } })
        }

        // Search in booking released to (case-insensitive)
        const releasedToMatches = await prisma.$queryRawUnsafe(
          `SELECT id FROM "${table}" WHERE data->>'booking_released_to' ILIKE $1`,
          `%${search}%`,
        )
        if ((releasedToMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (releasedToMatches as any[]).map((row: any) => row.id) } })
        }

        // Search in unmapping reason (case-insensitive)
        const unmappingMatches = await prisma.$queryRawUnsafe(
          `SELECT id FROM "${table}" WHERE data->>'unmapping_reason' ILIKE $1`,
          `%${search}%`,
        )
        if ((unmappingMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (unmappingMatches as any[]).map((row: any) => row.id) } })
        }

        // temporary_booking_number (case-insensitive)
        const tempBookingMatches = await prisma.$queryRawUnsafe(
          `SELECT id FROM "${table}" WHERE data->'liner_booking_details'->0->>'temporary_booking_number' ILIKE $1`,
          `%${search}%`,
        )
        if ((tempBookingMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (tempBookingMatches as any[]).map((row: any) => row.id) } })
        }

        // liner_booking_number (case-insensitive)
        const linerBookingMatches = await prisma.$queryRawUnsafe(
          `SELECT id FROM "${table}" WHERE data->'liner_booking_details'->0->>'liner_booking_number' ILIKE $1`,
          `%${search}%`,
        )
        if ((linerBookingMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (linerBookingMatches as any[]).map((row: any) => row.id) } })
        }

        // carrier (case-insensitive)
        const carrierMatches = await prisma.$queryRawUnsafe(
          `SELECT id FROM "${table}" WHERE data->'liner_booking_details'->0->>'carrier' ILIKE $1`,
          `%${search}%`,
        )
        if ((carrierMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (carrierMatches as any[]).map((row: any) => row.id) } })
        }

        // original_planned_vessel (case-insensitive)
        const vesselMatches = await prisma.$queryRawUnsafe(
          `SELECT id FROM "${table}" WHERE data->'liner_booking_details'->0->>'original_planned_vessel' ILIKE $1`,
          `%${search}%`,
        )
        if ((vesselMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (vesselMatches as any[]).map((row: any) => row.id) } })
        }

        // revised_vessel (case-insensitive)
        const revisedVesselMatches = await prisma.$queryRawUnsafe(
          `SELECT id FROM "${table}" WHERE data->'liner_booking_details'->0->>'revised_vessel' ILIKE $1`,
          `%${search}%`,
        )
        if ((revisedVesselMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (revisedVesselMatches as any[]).map((row: any) => row.id) } })
        }

        // mbl_number (case-insensitive)
        const mblMatches = await prisma.$queryRawUnsafe(
          `SELECT id FROM "${table}" WHERE data->'liner_booking_details'->0->>'mbl_number' ILIKE $1`,
          `%${search}%`,
        )
        if ((mblMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (mblMatches as any[]).map((row: any) => row.id) } })
        }

        // contract (case-insensitive)
        const contractMatches = await prisma.$queryRawUnsafe(
          `SELECT id FROM "${table}" WHERE data->'liner_booking_details'->0->>'contract' ILIKE $1`,
          `%${search}%`,
        )
        if ((contractMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (contractMatches as any[]).map((row: any) => row.id) } })
        }

        // equipment_type (case-insensitive)
        const equipmentTypeMatches = await prisma.$queryRawUnsafe(
          `SELECT id FROM "${table}" WHERE data->'liner_booking_details'->0->>'equipment_type' ILIKE $1`,
          `%${search}%`,
        )
        if ((equipmentTypeMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (equipmentTypeMatches as any[]).map((row: any) => row.id) } })
        }

        // equipment_quantity (case-insensitive)
        const equipmentQtyMatches = await prisma.$queryRawUnsafe(
          `SELECT id FROM "${table}" WHERE data->'liner_booking_details'->0->>'equipment_quantity' ILIKE $1`,
          `%${search}%`,
        )
        if ((equipmentQtyMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (equipmentQtyMatches as any[]).map((row: any) => row.id) } })
        }

        // additional_remarks
        const remarksMatches = await prisma.$queryRawUnsafe(
          `SELECT id FROM "${table}" WHERE data->'liner_booking_details'->0->>'additional_remarks' ILIKE $1`,
          `%${search}%`,
        )
        if ((remarksMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (remarksMatches as any[]).map((row: any) => row.id) } })
        }

        // Search in shipment plan reference number (case-insensitive via join)
        // Use appropriate table based on tab
        if (tab === "assignments") {
          const refMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->>'reference_number' ILIKE ${`%${search}%`}
          `;
          if ((refMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (refMatches as any[]).map((row: any) => row.id) } })
          }
        } else {
          const refMatches = await prisma.$queryRaw`
            SELECT lb.id FROM "liner_bookings" lb
            JOIN "shipment_plans" sp ON lb."shipmentPlanId" = sp.id
            WHERE sp.data->>'reference_number' ILIKE ${`%${search}%`}
          `;
          if ((refMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (refMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in shipment plan business branch (case-insensitive via join)
        if (tab === "assignments") {
          const branchMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->>'bussiness_branch' ILIKE ${`%${search}%`}
          `;
          if ((branchMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (branchMatches as any[]).map((row: any) => row.id) } })
          }
        } else {
          const branchMatches = await prisma.$queryRaw`
            SELECT lb.id FROM "liner_bookings" lb
            JOIN "shipment_plans" sp ON lb."shipmentPlanId" = sp.id
            WHERE sp.data->>'bussiness_branch' ILIKE ${`%${search}%`}
          `;
          if ((branchMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (branchMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in shipment plan customer (case-insensitive via join)
        if (tab === "assignments") {
          const customerMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->'container_movement'->>'customer' ILIKE ${`%${search}%`}
          `;
          if ((customerMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (customerMatches as any[]).map((row: any) => row.id) } })
          }
        } else {
          const customerMatches = await prisma.$queryRaw`
            SELECT lb.id FROM "liner_bookings" lb
            JOIN "shipment_plans" sp ON lb."shipmentPlanId" = sp.id
            WHERE sp.data->'container_movement'->>'customer' ILIKE ${`%${search}%`}
          `;
          if ((customerMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (customerMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in shipment plan consignee (case-insensitive via join)
        if (tab === "assignments") {
          const consigneeMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->'container_movement'->>'consignee' ILIKE ${`%${search}%`}
          `;
          if ((consigneeMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (consigneeMatches as any[]).map((row: any) => row.id) } })
          }
        } else {
          const consigneeMatches = await prisma.$queryRaw`
            SELECT lb.id FROM "liner_bookings" lb
            JOIN "shipment_plans" sp ON lb."shipmentPlanId" = sp.id
            WHERE sp.data->'container_movement'->>'consignee' ILIKE ${`%${search}%`}
          `;
          if ((consigneeMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (consigneeMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in shipment plan loading port (case-insensitive via join)
        if (tab === "assignments") {
          const loadingPortMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->'container_movement'->>'loading_port' ILIKE ${`%${search}%`}
          `;
          if ((loadingPortMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (loadingPortMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in shipment plan port of discharge (case-insensitive via join)
        if (tab === "assignments") {
          const podMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->'container_movement'->>'port_of_discharge' ILIKE ${`%${search}%`}
          `;
          if ((podMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (podMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in shipment plan destination country (case-insensitive via join)
        if (tab === "assignments") {
          const destinationMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->'container_movement'->>'destination_country' ILIKE ${`%${search}%`}
          `;
          if ((destinationMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (destinationMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in shipment plan selling price (case-insensitive via join)
        if (tab === "assignments") {
          const sellingPriceMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->'container_movement'->>'selling_price' ILIKE ${`%${search}%`}
          `;
          if ((sellingPriceMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (sellingPriceMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in shipment plan buying price (case-insensitive via join)
        if (tab === "assignments") {
          const buyingPriceMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->'container_movement'->>'buying_price' ILIKE ${`%${search}%`}
          `;
          if ((buyingPriceMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (buyingPriceMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in shipment plan carrier (case-insensitive via join)
        if (tab === "assignments") {
          const carrierPlanMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->'container_movement'->'carrier_and_vessel_preference'->>'carrier' ILIKE ${`%${search}%`}
          `;
          if ((carrierPlanMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (carrierPlanMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in shipment plan vessel (case-insensitive via join)
        if (tab === "assignments") {
          const vesselPlanMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->'container_movement'->'carrier_and_vessel_preference'->>'vessel' ILIKE ${`%${search}%`}
          `;
          if ((vesselPlanMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (vesselPlanMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in shipment plan container status (case-insensitive via join)
        if (tab === "assignments") {
          const containerStatusMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->'container_tracking'->>'container_current_status' ILIKE ${`%${search}%`}
          `;
          if ((containerStatusMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (containerStatusMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in shipment plan type (case-insensitive via join)
        if (tab === "assignments") {
          const shipmentTypeMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->>'shipment_type' ILIKE ${`%${search}%`}
          `;
          if ((shipmentTypeMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (shipmentTypeMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in shipment plan booking status (case-insensitive via join)
        if (tab === "assignments") {
          const bookingStatusMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "shipment_plans" sp ON sp."shipmentAssignmentId" = sa.id
            WHERE sp.data->>'booking_status' ILIKE ${`%${search}%`}
          `;
          if ((bookingStatusMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (bookingStatusMatches as any[]).map((row: any) => row.id) } })
          }
        }

        // Search in assigned liner broker name (case-insensitive via join)
        if (tab === "assignments") {
          const assignedBrokerMatches = await prisma.$queryRaw`
            SELECT sa.id FROM "shipment_assignments" sa
            JOIN "users" u ON sa."assignBookingId" = u.id
            WHERE u.name ILIKE ${`%${search}%`}
          `;
          if ((assignedBrokerMatches as any[]).length > 0) {
            searchConditions.push({ id: { in: (assignedBrokerMatches as any[]).map((row: any) => row.id) } })
          }
        }
      } catch (error) {
        console.error("Error in raw SQL search:", error)
      }

      // Search in created user name (case-insensitive - Prisma native)
      searchConditions.push({
        user: {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
      });

      // Combine tab filtering, access control filtering, and search conditions
      const existingOrConditions = whereCondition.OR || [];
      const existingAndConditions = whereCondition.AND || [];

      // Check if OR conditions contain access control (contains assignBookingId or userId)
      const hasAccessControl = existingOrConditions.some(
        (condition: any) => condition.assignBookingId !== undefined || condition.userId !== undefined
      );

      // Build final query conditions
      const andConditions = [];

      // If we already have AND conditions (from tab filtering), preserve them
      if (existingAndConditions.length > 0) {
        andConditions.push(...existingAndConditions);
      }

      // Separate OR conditions for tab filtering from access control
      const tabFilteringConditions = existingOrConditions.filter(
        (condition: any) => condition.assignBookingId === undefined && condition.userId === undefined
      );
      const accessControlConditions = existingOrConditions.filter(
        (condition: any) => condition.assignBookingId !== undefined || condition.userId !== undefined
      );

      // Add tab filtering if exists (for assignments tab which still uses OR)
      if (tabFilteringConditions.length > 0) {
        andConditions.push({ OR: tabFilteringConditions });
      }

      // Add access control if exists
      if (accessControlConditions.length > 0) {
        andConditions.push({ OR: accessControlConditions });
      }

      // Add search filtering if exists
      if (searchConditions.length > 0) {
        andConditions.push({ OR: searchConditions });
      }

      // Apply combined conditions
      if (andConditions.length > 1) {
        whereCondition.AND = andConditions;
        delete whereCondition.OR;
        console.log("Combined tab, access control, and search filtering applied");
      } else if (andConditions.length === 1) {
        // If we only have one AND condition, it might be our tab filtering
        whereCondition.AND = andConditions;
        delete whereCondition.OR;
      } else if (searchConditions.length > 0 && !hasAccessControl) {
        whereCondition.OR = searchConditions;
      }

      console.log("Final whereCondition:", JSON.stringify(whereCondition, null, 2));
    }

    // Assignments branch: query prisma.shipmentAssignment and return same payload shape
    if (tab === "assignments") {
      const [rows, totalCount] = await Promise.all([
        prisma.shipmentAssignment.findMany({
          where: whereCondition,
          include: {
            user: { select: { id: true, name: true, email: true } },
            shipmentPlan: { 
              select: { 
                id: true, 
                data: true, 
                shipmentAssignmentId: true,
                user: { select: { id: true, name: true, email: true } }
              } 
            },
          },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.shipmentAssignment.count({ where: whereCondition }),
      ])

      // Fetch assigned liner broker details for each assignment
      const assignmentsWithBroker = await Promise.all(
        rows.map(async (assignment: any) => {
          let assignedLinerBroker = null
          if (assignment.assignBookingId) {
            assignedLinerBroker = await prisma.user.findUnique({
              where: { id: assignment.assignBookingId },
              select: { id: true, name: true, email: true }
            })
          }
          return {
            ...assignment,
            assignedLinerBroker
          }
        })
      )

      return json({
        linerBookings: assignmentsWithBroker, // keep same key consumed by UI
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        user,
        search,
        tab,
      })
    }

    // Debug: Log whereCondition before query
    console.log("[DEBUG] Liner Bookings Query - Tab:", tab)
    console.log("[DEBUG] Liner Bookings Query - whereCondition:", JSON.stringify(whereCondition, null, 2))

    // Debug: First check what's in the database without filters
    const allBookings = await prisma.linerBooking.findMany({
      select: {
        id: true,
        shipmentPlanId: true,
        data: true,
      },
      take: 10,
    })
    console.log("[DEBUG] All liner bookings in DB (first 10):", allBookings.map(b => ({
      id: b.id,
      shipmentPlanId: b.shipmentPlanId,
      carrier_booking_status: (b.data as any)?.carrier_booking_status,
    })))

    const [linerBookings, totalCount] = await Promise.all([
      prisma.linerBooking.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          shipmentPlan: {
            select: {
              id: true,
              data: true,
              linerBookingId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.linerBooking.count({ where: whereCondition }),
    ])

    console.log("Liner Bookings - Retrieved count:", totalCount)
    console.log("Liner Bookings - First 5 records (if any):", JSON.stringify(linerBookings.slice(0, 5), null, 2))

    const totalPages = Math.ceil(totalCount / limit)

    return json({
      linerBookings,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      user,
      search,
      tab,
    })
  } catch (error) {
    console.error("Error in loader:", error)
    throw new Response("Internal Server Error", { status: 500 })
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request)

    // Only allow LINER_BOOKING_TEAM and ADMIN
    if (user.role.name !== "LINER_BOOKING_TEAM" && user.role.name !== "ADMIN") {
      return redirect("/dashboard")
    }

    const formData = await request.formData()
    const action = formData.get("action")

    if (action === "delete") {
      const bookingId = formData.get("bookingId") as string

      // Check if user owns this booking or is admin
      const booking = await prisma.linerBooking.findUnique({
        where: { id: bookingId },
      })

      if (!booking) {
        return { error: "Liner booking not found" }
      }

      if (user.role.name !== "ADMIN" && booking.userId !== user.id) {
        return { error: "Unauthorized to delete this liner booking" }
      }

      await prisma.linerBooking.delete({
        where: { id: bookingId },
      })

      return { success: "Liner booking deleted successfully" }
    }

    if (action === "bulkDelete") {
      const selectedIds = formData.getAll("selectedIds") as string[]

      if (selectedIds.length === 0) {
        return { error: "No bookings selected" }
      }

      const whereCondition: any = {
        id: { in: selectedIds },
      }

      // Non-admin users can only delete their own bookings
      if (user.role.name !== "ADMIN") {
        whereCondition.userId = user.id
      }

      const deletedCount = await prisma.linerBooking.deleteMany({
        where: whereCondition,
      })

      return {
        success: `${deletedCount.count} liner booking(s) deleted successfully`,
      }
    }

    // New: support bulk delete for shipment assignments tab
    if (action === "bulkDeleteAssignments") {
      const selectedIds = formData.getAll("selectedIds") as string[]
      if (selectedIds.length === 0) {
        return { error: "No assignments selected" }
      }

      // Non-admin users cannot delete others' assignments if you enforce ownership (optional).
      // Since assignments don't store userId in this file's context, we only gate by role at top.

      const result = await prisma.$transaction(async (tx) => {
        // Unlink assignments from shipment plans before deletion (avoid FK issues)
        await tx.shipmentPlan.updateMany({
          where: { shipmentAssignmentId: { in: selectedIds } },
          data: { shipmentAssignmentId: null },
        })
        const deleted = await tx.shipmentAssignment.deleteMany({
          where: { id: { in: selectedIds } },
        })
        return deleted.count
      })

      return { success: `${result} shipment assignment(s) deleted successfully` }
    }

    return { error: "Invalid action" }
  } catch (error) {
    console.error("Error in liner bookings action:", error)
    return { error: "Failed to perform action" }
  }
}

export default function LinerBookings() {
  const { linerBookings, currentPage, totalPages, totalCount, user, search, tab } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const actionData = useActionData<typeof action>()
  const [searchParams] = useSearchParams()
  const [selectedBookings, setSelectedBookings] = useState<string[]>([])
  const [isTabSwitching, setIsTabSwitching] = useState(false)

  const isAssignments = tab === "assignments"
  const isLoading = navigation.state === "loading" || navigation.state === "submitting"
  
  // Force complete page refresh when tab changes
  React.useEffect(() => {
    const currentTab = searchParams.get("tab") || "bookings"
    const storedTab = sessionStorage.getItem("liner-bookings-current-tab")
    const hasRefreshed = sessionStorage.getItem("liner-bookings-just-refreshed")
    
    if (storedTab && storedTab !== currentTab && !hasRefreshed) {
      // Tab changed, show loading immediately
      setIsTabSwitching(true)
      
      // Delay refresh slightly to show loading spinner
      setTimeout(() => {
        sessionStorage.setItem("liner-bookings-just-refreshed", "true")
        window.location.reload()
      }, 300) // 300ms delay to show loading
    } else {
      // Store current tab and clear refresh flag
      sessionStorage.setItem("liner-bookings-current-tab", currentTab)
      sessionStorage.removeItem("liner-bookings-just-refreshed")
      setIsTabSwitching(false)
    }
  }, [searchParams])
  
  // Clear selected bookings when switching tabs to avoid state conflicts
  React.useEffect(() => {
    setSelectedBookings([])
  }, [tab, isAssignments])
  
  // Debug logging for data consistency issues
  console.log("[DEBUG] Liner bookings component render:", {
    tab,
    isAssignments,
    linerBookingsCount: linerBookings?.length,
    firstBooking: linerBookings?.[0],
    hasShipmentPlan: !!linerBookings?.[0]?.shipmentPlan,
    shipmentPlanData: linerBookings?.[0]?.shipmentPlan?.data
  })

  // Column definitions for the table - different for assignments vs bookings
  const baseAssignmentColumns = [
    { id: "checkbox", label: "Select", defaultVisible: true, locked: true },
    { id: "reference_number", label: "Reference No.", defaultVisible: true },
    { id: "customer", label: "Customer", defaultVisible: true },
    { id: "business_branch", label: "Business Branch", defaultVisible: true },
    { id: "loading_port", label: "Loading Port", defaultVisible: true },
    { id: "destination", label: "Destination", defaultVisible: true },
    { id: "status", label: "Status", defaultVisible: true },
    { id: "port_of_discharge", label: "Port of Discharge", defaultVisible: true },
    { id: "consignee", label: "Consignee", defaultVisible: true },
  ];

  // Price columns (only for ADMIN and MD)
  const priceColumns = [
    { id: "selling_price", label: "Selling Price", defaultVisible: true },
    { id: "buying_price", label: "Buying Price", defaultVisible: true },
  ];

  const remainingAssignmentColumns = [
    { id: "carrier", label: "Carrier", defaultVisible: true },
    { id: "vessel", label: "Vessel", defaultVisible: true },
    { id: "container_status", label: "Container Status", defaultVisible: true },
    { id: "assigned_liner_broker", label: "Assigned Liner Broker", defaultVisible: true },
    { id: "created_date", label: "Created", defaultVisible: true },
    { id: "created_by", label: "Created By", defaultVisible: true },
    { id: "type", label: "Type", defaultVisible: true },
  ];

  const assignmentColumns = [
    ...baseAssignmentColumns,
    // Only show price columns to ADMIN and MD
    ...((user as any).role.name === "ADMIN" || (user as any).role.name === "MD" ? priceColumns : []),
    ...remainingAssignmentColumns,
  ];

  const availableColumns = isAssignments ? assignmentColumns : [
    { id: "checkbox", label: "Select", defaultVisible: true, locked: true },
    {
      id: "temp_booking_number",
      label: "Temp. Booking #",
      defaultVisible: true,
    },
    { id: "carrier", label: "Carrier", defaultVisible: true },
    { id: "vessel", label: "Vessel", defaultVisible: true },
    { id: "etd", label: "ETD", defaultVisible: true },
    {
      id: "liner_booking_number",
      label: "Liner Booking #",
      defaultVisible: true,
    },
    { id: "mbl_number", label: "MBL Number", defaultVisible: true },
    { id: "contract", label: "Contract", defaultVisible: true },
    { id: "loading_port", label: "Loading Port", defaultVisible: true },
    { id: "port_of_discharge", label: "Port of Discharge", defaultVisible: true },
    { id: "equipment_type", label: "Equipment Type", defaultVisible: true },
    { id: "created_date", label: "Created", defaultVisible: true },
    { id: "created_by", label: "Created By", defaultVisible: true },
  ]

  // Use column preferences hook
  const {
    visibleColumns,
    isColumnModalOpen,
    setIsColumnModalOpen,
    updateColumnPreferences,
    resetColumnPreferences,
    isColumnVisible,
    getOrderedColumns,
  } = useColumnPreferences({
    storageKey: isAssignments ? "shipment-assignments-columns" : "liner-bookings-columns",
    columns: availableColumns,
  })
  
  // Determine if we should show loading
  const shouldShowLoading = isLoading || !linerBookings || isTabSwitching

  const rows = React.useMemo(() => {
    console.log("[DEBUG] Rows processing - tab:", tab, "isAssignments:", isAssignments, "linerBookings count:", linerBookings?.length)
    
    if (availableColumns.length === 0 || !linerBookings) {
      return []
    }
    
    if (isAssignments) {
      // For assignments, use data directly without transformation
      console.log("[DEBUG] Processing assignments data, first item:", linerBookings[0])
      return [...linerBookings] // Create a new array to avoid mutation
    } else {
      // For regular liner bookings, apply the expansion logic
      console.log("[DEBUG] Processing regular bookings data, first item:", linerBookings[0])
      console.log("[DEBUG] First booking structure check:", {
        hasLinerBookingDetails: !!linerBookings[0]?.data?.liner_booking_details,
        linerBookingDetailsLength: linerBookings[0]?.data?.liner_booking_details?.length,
        firstDetail: linerBookings[0]?.data?.liner_booking_details?.[0],
        hasShipmentPlan: !!linerBookings[0]?.shipmentPlan
      })
      const processedRows = (linerBookings as any[])?.flatMap((booking: any) => {
        const details = booking?.data?.liner_booking_details || []
        if (!Array.isArray(details) || details.length === 0) {
          return {
            ...booking,
            // Ensure we preserve the original structure
            __isRegularBooking: true
          }
        }
        return details.flatMap((d: any, i: number) => {
          // Expand quantity into individual rows if provided, default to 1
          const qty = Number.parseInt(d?.equipment_quantity || "1") || 1
          return Array.from({ length: qty }, (_, k) => ({
            // clone booking but ensure the UI reads this single detail via [0]
            ...booking,
            id: `${booking.id}#${i}-${k}`, // unique row key while still navigating to original booking
            data: {
              ...booking.data,
              liner_booking_details: [d],
            },
            // preserve a pointer to original id for row click navigation if needed
            __originalId: booking.id,
            __isRegularBooking: true
          }))
        })
      }) || []
      
      console.log("[DEBUG] Processed regular booking rows:", processedRows.length, "first processed:", processedRows[0])
      return processedRows
    }
  }, [linerBookings, isAssignments, availableColumns.length, tab])

  const handleRowClick = (id: string, event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    const isInteractiveElement = target.closest('button, a, input, [role="checkbox"]')
    if (!isInteractiveElement) {
      const originalId =
        typeof id === "string" && id.includes("#")
          ? (rows.find((r: any) => r.id === id)?.__originalId ?? id.split("#")[0])
          : id
      const dest = isAssignments
        ? `/liner-bookings/${originalId}/edit?assignmentId=${originalId}`
        : `/liner-bookings/${originalId}/edit`
      console.log("[v0] handleRowClick:", {
        id,
        originalId,
        isAssignments,
        dest,
        pathname: window.location.pathname,
        search: window.location.search,
      })
      navigate(dest)
    }
  }

  const handleSelectBooking = (bookingId: string, checked: boolean) => {
    if (checked) {
      setSelectedBookings([...selectedBookings, bookingId])
    } else {
      setSelectedBookings(selectedBookings.filter((id) => id !== bookingId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBookings(rows.map((booking: any) => booking.id))
    } else {
      setSelectedBookings([])
    }
  }
  const formatCarrierBookingStatus = (status: string) => {
    return status?.replace(/_/g, " ").toUpperCase() || "N/A"
  }

  const getStatusBadge = (status: string) => {
    const normalized = (status || "").replace(/_/g, " ").trim()

    const config: Record<string, { color: string; bg: string; border: string; icon: string }> = {
      "Awaiting Booking": {
        color: "text-blue-800",
        bg: "bg-gradient-to-r from-blue-100 to-blue-50",
        border: "border-blue-200",
        icon: "📝",
      },
      "Booked": {
        color: "text-gray-800",
        bg: "bg-gradient-to-r from-gray-100 to-gray-50",
        border: "border-gray-200",
        icon: "📄",
      },
      "Awaiting MD Approval": {
        color: "text-orange-800",
        bg: "bg-gradient-to-r from-orange-100 to-orange-50",
        border: "border-orange-200",
        icon: "⏳",
      },
      "Partially Unmapped": {
        color: "text-yellow-800",
        bg: "bg-gradient-to-r from-yellow-100 to-yellow-50",
        border: "border-yellow-200",
        icon: "🔧",
      },
      "Ready for Re-linking": {
        color: "text-purple-800",
        bg: "bg-gradient-to-r from-purple-100 to-purple-50",
        border: "border-purple-200",
        icon: "🔄",
      },
      "Unmapping Requested": {
        color: "text-purple-800",
        bg: "bg-gradient-to-r from-purple-100 to-purple-50",
        border: "border-purple-200",
        icon: "🔁",
      },
      Completed: {
        color: "text-green-800",
        bg: "bg-gradient-to-r from-green-100 to-green-50",
        border: "border-green-200",
        icon: "✅",
      },
      Cancelled: {
        color: "text-red-800",
        bg: "bg-gradient-to-r from-red-100 to-red-50",
        border: "border-red-200",
        icon: "❌",
      },
    }

    const c = config[normalized] || {
      color: "text-gray-800",
      bg: "bg-gradient-to-r from-gray-100 to-gray-50",
      border: "border-gray-200",
      icon: "📋",
    }

    return (
      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold ${c.color} ${c.bg} border ${c.border}`}>
        <span>{c.icon}</span>
        <span>{normalized || "N/A"}</span>
      </span>
    )
  }

  const getBookingDetails = (data: any) => {
    const details = data?.liner_booking_details?.[0]
    return {
      temporaryBookingNumber: details?.temporary_booking_number || "N/A",
      carrier: details?.carrier || "N/A",
      vessel: details?.original_planned_vessel || "N/A",
      etd: details?.e_t_d_of_original_planned_vessel || null,
    }
  }

  // Function to get data for a specific column
  const getColumnData = (booking: any, columnId: string, isOrphaned = false, isViewOnly = false) => {
    const details = getBookingDetails(booking.data)
    
    // Debug logging for data issues
    if (isAssignments && columnId === "reference_number" && !booking.shipmentPlan?.data?.reference_number) {
      console.log("[DEBUG] Missing shipmentPlan data for assignment:", {
        bookingId: booking.id,
        hasShipmentPlan: !!booking.shipmentPlan,
        shipmentPlanData: booking.shipmentPlan?.data,
        fullBooking: booking
      })
    }
    
    // Debug logging for regular bookings
    if (!isAssignments && columnId === "carrier") {
      console.log("[DEBUG] Regular booking details:", {
        bookingId: booking.id,
        details: details,
        rawData: booking.data,
        linerBookingDetails: booking.data?.liner_booking_details?.[0]
      })
    }

    switch (columnId) {
      case "checkbox":
        return (
          <TableCell key={columnId} className="pl-6">
            <div onClick={(event) => event.stopPropagation()}>
              <Checkbox
                checked={selectedBookings.includes(booking.id)}
                onChange={(e) => handleSelectBooking(booking.id, e.target.checked)}
              />
            </div>
          </TableCell>
        )
      case "reference_number":
        const referenceNumber = isAssignments 
          ? (isOrphaned 
              ? (booking.data as any)?._originalShipmentPlan?.reference_number
              : booking.shipmentPlan?.data?.reference_number)
          : booking.data?.reference_number || booking.shipmentPlan?.data?.reference_number
        return (
          <TableCell key={columnId} className={`font-semibold ${isOrphaned ? 'text-gray-600' : 'text-gray-900'}`}>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${isOrphaned ? 'bg-gray-400' : 'bg-green-500'}`}></span>
              <span>{referenceNumber || "N/A"}</span>
              {isOrphaned && (
                <div className="flex items-center space-x-1">
                  <div 
                    className="relative group"
                    title={booking.orphanedReason || (booking.data as any)?._orphanedReason || "Shipment plan was deleted"}
                  >
                    {/* <Badge className="bg-gray-200 text-gray-600 text-xs px-2 py-1 cursor-help">
                      👻 Orphaned
                    </Badge> */}
                  {isViewOnly && (
                    <Badge className="bg-white text-lg">
                      ℹ️
                    </Badge>
                  )}
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-0 hidden group-hover:block z-99 w-64 p-2 text-xs text-white bg-black rounded shadow-lg">
                      {/* <div className="font-medium mb-1">Deletion Reason:</div> */}
                      <div className="text-gray-200">
                        {booking.orphanedReason || (booking.data as any)?._orphanedReason || "Shipment plan was deleted"}
                      </div>
                      <div className="absolute top-full left-2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        )
      case "temp_booking_number":
        return (
          <TableCell key={columnId} className="font-semibold text-gray-900">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span>{details.temporaryBookingNumber}</span>
            </div>
          </TableCell>
        )
      case "carrier":
        const carrierValue = isAssignments 
          ? (isOrphaned 
              ? (booking.data as any)?._originalShipmentPlan?.container_movement?.carrier_and_vessel_preference?.carrier || details.carrier
              : booking?.shipmentPlan?.data?.container_movement?.carrier_and_vessel_preference?.carrier || details.carrier)
          : details.carrier
        return (
          <TableCell key={columnId} className="text-gray-700 font-medium">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">🚛</span>
              <span>{carrierValue}</span>
            </div>
          </TableCell>
        )
      case "status":
        const statusValue = isAssignments
          ? (isOrphaned 
              ? (booking.data as any)?._originalShipmentPlan?.booking_status || booking.data?.carrier_booking_status
              : booking?.shipmentPlan?.data?.booking_status || booking.data?.carrier_booking_status)
          : booking.data?.carrier_booking_status
        return <TableCell key={columnId}>{getStatusBadge(statusValue)}</TableCell>
      case "vessel":
        const vesselValue = isAssignments
          ? (isOrphaned 
              ? (booking.data as any)?._originalShipmentPlan?.container_movement?.carrier_and_vessel_preference?.vessel || details.vessel
              : booking?.shipmentPlan?.data?.container_movement?.carrier_and_vessel_preference?.vessel || details.vessel)
          : details.vessel
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">🚢</span>
              <span>{vesselValue}</span>
            </div>
          </TableCell>
        )
      case "etd":
        return (
          <TableCell key={columnId} className="text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">📅</span>
              <span>{formatDate(details.etd)}</span>
            </div>
          </TableCell>
        )
      case "released_to":
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">👤</span>
              <span>{booking.data?.booking_released_to || "N/A"}</span>
            </div>
          </TableCell>
        )
      case "liner_booking_number":
        const linerBookingNumber = booking.data?.liner_booking_details?.[0]?.liner_booking_number
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">📋</span>
              <span>{linerBookingNumber || "N/A"}</span>
            </div>
          </TableCell>
        )
      case "mbl_number":
        const mblNumber = booking.data?.liner_booking_details?.[0]?.mbl_number
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">📄</span>
              <span>{mblNumber || "N/A"}</span>
            </div>
          </TableCell>
        )
      case "contract":
        const contract = booking.data?.liner_booking_details?.[0]?.contract
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">📝</span>
              <span>{contract || "N/A"}</span>
            </div>
          </TableCell>
        )
      case "equipment_type":
        const equipmentType = booking.data?.liner_booking_details?.[0]?.equipment_type
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">📦</span>
              <span>{equipmentType || "N/A"}</span>
            </div>
          </TableCell>
        )
      case "equipment_quantity":
        const equipmentQuantity = booking.data?.liner_booking_details?.[0]?.equipment_quantity
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">#</span>
              <span>{equipmentQuantity || "N/A"}</span>
            </div>
          </TableCell>
        )
      case "created_date":
        return (
          <TableCell key={columnId} className="text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">📅</span>
              <span>{formatDate(booking.createdAt)}</span>
            </div>
          </TableCell>
        )
      case "created_by":
        // For assignments, show the original shipment plan creator
        // For liner bookings, show the person who created the booking
        const createdByUser = isAssignments && booking?.shipmentPlan?.user
          ? booking.shipmentPlan.user
          : booking.user
        
        return (
          <TableCell key={columnId} className="text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600">{createdByUser?.name?.charAt(0).toUpperCase()}</span>
              </div>
              <span>{createdByUser?.name}</span>
            </div>
          </TableCell>
        )
      case "assigned_liner_broker":
        if (!isAssignments) return <TableCell key={columnId}>N/A</TableCell>
        const assignedBroker = booking?.assignedLinerBroker
        return (
          <TableCell key={columnId} className="text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-blue-600">{assignedBroker?.name?.charAt(0).toUpperCase()}</span>
              </div>
              <span>{assignedBroker?.name || "N/A"}</span>
            </div>
          </TableCell>
        )
      case "actions":
        return (
          <TableCell key={columnId} className="pr-6">
            <div className="flex items-center space-x-2">
              {isViewOnly ? (
                <div className="flex items-center space-x-2">
                  <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                    👁️ View Only
                  </Badge>
                  <span className="text-gray-400 text-xs italic">Read-only</span>
                </div>
              ) : (
                <span className="text-gray-400 text-xs italic">Click row to edit</span>
              )}
            </div>
          </TableCell>
        )
      // Assignment-specific columns (only show for assignments tab)
      case "customer":
        if (!isAssignments) return <TableCell key={columnId}>N/A</TableCell>
        // For orphaned assignments, use preserved data; otherwise use shipmentPlan data
        const customer = isOrphaned 
          ? (booking.data as any)?._originalShipmentPlan?.container_movement?.customer
          : booking?.shipmentPlan?.data?.container_movement?.customer
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">👤</span>
              <span>{customer || "N/A"}</span>
            </div>
          </TableCell>
        )
      case "business_branch":
        if (!isAssignments) return <TableCell key={columnId}>N/A</TableCell>
        const businessBranch = isOrphaned
          ? (booking.data as any)?._originalShipmentPlan?.bussiness_branch
          : booking?.shipmentPlan?.data?.bussiness_branch
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">🏢</span>
              <span>{businessBranch || "N/A"}</span>
            </div>
          </TableCell>
        )
      case "loading_port":
        const loadingPort = isAssignments
          ? (isOrphaned
              ? (booking.data as any)?._originalShipmentPlan?.container_movement?.loading_port
              : booking?.shipmentPlan?.data?.container_movement?.loading_port)
          : (booking.data as any)?.liner_booking_details?.[0]?.loading_port
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-1">
              <span className="text-gray-400">🚢</span>
              <span>{loadingPort || "N/A"}</span>
            </div>
          </TableCell>
        )
      case "destination":
        if (!isAssignments) return <TableCell key={columnId}>N/A</TableCell>
        const destination = isOrphaned
          ? (booking.data as any)?._originalShipmentPlan?.container_movement?.destination_country
          : booking?.shipmentPlan?.data?.container_movement?.destination_country
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">🌍</span>
              <span>{destination || "N/A"}</span>
            </div>
          </TableCell>
        )
      case "port_of_discharge":
        const portOfDischarge = isAssignments
          ? (isOrphaned
              ? (booking.data as any)?._originalShipmentPlan?.container_movement?.port_of_discharge
              : booking?.shipmentPlan?.data?.container_movement?.port_of_discharge)
          : (booking.data as any)?.liner_booking_details?.[0]?.port_of_discharge
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-1">
              <span className="text-gray-400">🏢</span>
              <span>{portOfDischarge || "N/A"}</span>
            </div>
          </TableCell>
        )
      case "consignee":
        if (!isAssignments) return <TableCell key={columnId}>N/A</TableCell>
        const consignee = isOrphaned
          ? (booking.data as any)?._originalShipmentPlan?.container_movement?.consignee
          : booking?.shipmentPlan?.data?.container_movement?.consignee
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">👤</span>
              <span>{consignee || "N/A"}</span>
            </div>
          </TableCell>
        )
      case "selling_price":
        if (!isAssignments) return <TableCell key={columnId}>N/A</TableCell>
        // Only show selling price to ADMIN and MD
        if ((user as any).role.name !== "ADMIN" && (user as any).role.name !== "MD") {
          return <TableCell key={columnId}>-</TableCell>;
        }
        const sellingPrice = isOrphaned
          ? (booking.data as any)?._originalShipmentPlan?.container_movement?.selling_price
          : booking?.shipmentPlan?.data?.container_movement?.selling_price
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">💰</span>
              <span>{sellingPrice ?? "N/A"}</span>
            </div>
          </TableCell>
        )
      case "buying_price":
        if (!isAssignments) return <TableCell key={columnId}>N/A</TableCell>
        // Only show buying price to ADMIN and MD
        if ((user as any).role.name !== "ADMIN" && (user as any).role.name !== "MD") {
          return <TableCell key={columnId}>-</TableCell>;
        }
        const buyingPrice = isOrphaned
          ? (booking.data as any)?._originalShipmentPlan?.container_movement?.buying_price
          : booking?.shipmentPlan?.data?.container_movement?.buying_price
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">💰</span>
              <span>{buyingPrice ?? "N/A"}</span>
            </div>
          </TableCell>
        )
      case "container_status":
        if (!isAssignments) return <TableCell key={columnId}>N/A</TableCell>
        const containerStatus = isOrphaned
          ? (booking.data as any)?._originalShipmentPlan?.container_tracking?.container_current_status
          : booking?.shipmentPlan?.data?.container_tracking?.container_current_status
        return (
          <TableCell key={columnId}>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                containerStatus === "Booked"
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              } border border-gray-200`}
            >
              {containerStatus || "N/A"}
            </span>
          </TableCell>
        )
      case "type":
        if (!isAssignments) return <TableCell key={columnId}>N/A</TableCell>
        const shipmentType = isOrphaned
          ? (booking.data as any)?._originalShipmentPlan?.shipment_type
          : booking?.shipmentPlan?.data?.shipment_type
        return (
          <TableCell key={columnId}>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-100 to-blue-50 text-blue-800 border border-blue-200">
              {shipmentType || "N/A"}
            </span>
          </TableCell>
        )
      default:
        return <TableCell key={columnId}>N/A</TableCell>
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A"
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return "N/A"
    }
  }

  const renderCellContent = (booking: any, columnId: string) => {
    const details = getBookingDetails(booking.data)

    switch (columnId) {
      case "reference_number":
        return booking.shipmentPlan?.data?.reference_number || "N/A"
      case "temp_booking_number":
        return details.temporaryBookingNumber
      case "carrier":
        return details.carrier
      case "status":
        return getStatusBadge(booking.data?.carrier_booking_status)
      case "vessel":
        return details.vessel
      case "etd":
        return formatDate(details.etd)
      case "released_to":
        return booking.data?.booking_released_to || "N/A"
      case "liner_booking_number":
        return booking.data?.liner_booking_details?.[0]?.liner_booking_number || "N/A"
      case "mbl_number":
        return booking.data?.liner_booking_details?.[0]?.mbl_number || "N/A"
      case "contract":
        return booking.data?.liner_booking_details?.[0]?.contract || "N/A"
      case "equipment_type":
        return booking.data?.liner_booking_details?.[0]?.equipment_type || "N/A"
      case "equipment_quantity":
        return booking.data?.liner_booking_details?.[0]?.equipment_quantity || "N/A"
      case "created_date":
        return formatDate(booking.createdAt)
      case "created_by":
        return booking.user.name
      default:
        return "N/A"
    }
  }

  const isSubmitting = navigation.state === "submitting"
  const idsForDelete = Array.from(
    new Set(selectedBookings.map((id) => (typeof id === "string" && id.includes("#") ? id.split("#")[0] : id))),
  )

  return (
    <AdminLayout user={user}>
      {shouldShowLoading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {/* {isTabSwitching ? "Switching tabs..." : "Loading..."} */}
              Loading
            </h3>
            {/* <p className="text-gray-600">
              {isTabSwitching 
                ? "Please wait while we prepare the new tab..." 
                : isAssignments 
                  ? "Loading shipment assignments..." 
                  : "Loading liner bookings..."
              }
            </p> */}
          </div>
        </div>
      ) : (
        <>
          {/* Page Header */}
          <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {isAssignments ? "Shipment Assignments" : "Available Liner Bookings"}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {isAssignments ? "Manage shipment assignments" : "Manage available liner bookings"}
              </p>
            </div>
            {!isAssignments && (
              <Link to="/liner-bookings/new">
                <Button className="bg-red-500 hover:bg-red-600 text-white">Add New Liner Booking</Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
              <div className="flex-1 max-w-2xl">
                <Form method="get" className="relative">
                  <div className="relative flex gap-3">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 text-sm">🔍</span>
                      </div>
                      <input
                        type="hidden"
                        name="tab"
                        value={tab}
                      />
                      <input
                        name="search"
                        placeholder={
                          isAssignments
                            ? "Search by reference, customer, business branch, carrier, vessel, status, or any assignment details..."
                            : "Search by booking number, carrier, vessel, MBL, contract, equipment, or any booking details..."
                        }
                        defaultValue={search}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg"
                    >
                      Search
                    </Button>
                    {search && (
                      <Link to={`/liner-bookings?tab=${tab}`}>
                        <Button
                          variant="outline"
                          className="px-6 py-3 border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
                        >
                          Clear
                        </Button>
                      </Link>
                    )}
                  </div>
                </Form>
                {search && (
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-medium">{totalCount}</span> results found for "{search}"
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                  <span className="font-medium">{totalCount}</span> total {isAssignments ? "assignments" : "bookings"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {actionData?.success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {actionData.success}
          </div>
        )}
        {actionData?.error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{actionData.error}</div>
        )}

        {/* Enhanced Table */}
        <div key={`${tab}-${isAssignments}`} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-blue-600 text-2xl">🚢</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {isAssignments ? "Shipment Assignments" : "Available Liner Bookings"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {totalCount} {isAssignments ? "shipment assignments" : "available liner bookings"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsColumnModalOpen(true)}
                  className="px-4 py-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 bg-transparent flex items-center gap-2"
                >
                  <span className="text-sm">⚙️</span>
                  Customize Columns
                </Button>
                <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                  <span className="font-medium">{totalCount}</span> {isAssignments ? "assignments" : "available"}
                </div>
                {idsForDelete.length > 0 && (
                  <Form method="post">
                    <input type="hidden" name="action" value={isAssignments ? "bulkDeleteAssignments" : "bulkDelete"} />
                    {idsForDelete.map((id) => (
                      <input key={id} type="hidden" name="selectedIds" value={id} />
                    ))}
                    <Button
                      type="submit"
                      className="bg-red-500 hover:bg-red-600 text-white"
                      disabled={isSubmitting}
                      size="sm"
                    >
                      {isSubmitting ? "Deleting..." : "Delete Selected"}
                    </Button>
                  </Form>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-spin">
                <span className="text-blue-600 text-2xl">⏳</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading...</h3>
              <p className="text-gray-500">Please wait while we fetch the data.</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 text-2xl">🚢</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {isAssignments ? "No Shipment Assignments" : "No Available Liner Bookings"}
              </h3>
              <p className="text-gray-500">
                {search
                  ? isAssignments
                    ? `No shipment assignments found matching "${search}"`
                    : `No liner bookings found matching "${search}"`
                  : isAssignments
                    ? "No shipment assignments are currently available."
                    : "No liner bookings are currently available."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gradient-to-r from-slate-50 to-white">
                  <TableRow className="border-gray-200">
                    {visibleColumns.map((columnId) => {
                      const column = availableColumns.find((col) => col.id === columnId)
                      if (!column) return null

                      if (columnId === "checkbox") {
                        return (
                          <TableHead key={columnId} className="w-12 pl-6">
                            <div onClick={(event) => event.stopPropagation()}>
                              <Checkbox
                                checked={selectedBookings.length === rows.length && rows.length > 0}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                              />
                            </div>
                          </TableHead>
                        )
                      }

                      // Set specific widths for each column to fit without horizontal scroll
                      const getColumnWidth = (colId: string) => {
                        if (isAssignments) {
                          switch (colId) {
                            case "reference_number":
                              return "w-32"
                            case "customer":
                              return "w-36"
                            case "business_branch":
                              return "w-36"
                            case "loading_port":
                              return "w-32"
                            case "destination":
                              return "w-32"
                            case "status":
                              return "w-28"
                            case "port_of_discharge":
                              return "w-36"
                            case "consignee":
                              return "w-32"
                            case "selling_price":
                              return "w-28"
                            case "buying_price":
                              return "w-28"
                            case "carrier":
                              return "w-28"
                            case "vessel":
                              return "w-28"
                            case "container_status":
                              return "w-32"
                            case "created_date":
                              return "w-24"
                            case "created_by":
                              return "w-28"
                            case "type":
                              return "w-24"
                            default:
                              return "w-24"
                          }
                        } else {
                          switch (colId) {
                            case "temp_booking_number":
                              return "w-32"
                            case "carrier":
                              return "w-28"
                            case "vessel":
                              return "w-28"
                            case "etd":
                              return "w-24"
                            case "liner_booking_number":
                              return "w-32"
                            case "mbl_number":
                              return "w-28"
                            case "contract":
                              return "w-24"
                            case "equipment_type":
                              return "w-36"
                            case "created_date":
                              return "w-24"
                            case "created_by":
                              return "w-28"
                            default:
                              return "w-24"
                          }
                        }
                      }

                      return (
                        <TableHead key={columnId} className={`font-semibold text-gray-900 text-sm ${getColumnWidth(columnId)}`}>
                          {column.label}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((booking: any) => {
                    // Check if this is an orphaned assignment (try both new fields and fallback)
                    const isOrphaned = booking.isOrphaned === true || (booking.data as any)?._orphaned === true;
                    const isViewOnly = booking.isViewOnly === true || (booking.data as any)?._viewOnly === true;
                    
                    return (
                      <TableRow
                        key={booking.id}
                        className={`
                          transition-colors duration-150
                          ${isOrphaned 
                            ? 'opacity-60 bg-gray-100/70 hover:bg-gray-150/70' 
                            : 'hover:bg-gray-50 cursor-pointer'
                          }
                          ${isViewOnly ? 'cursor-not-allowed' : ''}
                        `}
                        onClick={(event) => !isViewOnly ? handleRowClick(booking.id, event) : undefined}
                      >
                        {visibleColumns.map((columnId) => getColumnData(booking, columnId, isOrphaned, isViewOnly))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, totalCount)} of {totalCount}{" "}
                  results
                </div>
                <div className="flex items-center space-x-2">
                  {currentPage > 1 && (
                    <Link
                      to={`/liner-bookings?page=${currentPage - 1}&search=${search}&tab=${tab}`}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Previous
                    </Link>
                  )}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + Math.max(1, currentPage - 2)
                    if (page > totalPages) return null
                    return (
                      <Link
                        key={page}
                        to={`/liner-bookings?page=${page}&search=${search}&tab=${tab}`}
                        className={`px-3 py-2 text-sm font-medium rounded-md ${
                          page === currentPage
                            ? "text-blue-600 bg-blue-50 border border-blue-300"
                            : "text-gray-500 bg-white border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </Link>
                    )
                  })}
                  {currentPage < totalPages && (
                    <Link
                      to={`/liner-bookings?page=${currentPage + 1}&search=${search}&tab=${tab}`}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

          {/* Column Selector Modal */}
          <ColumnSelectorModal
            isOpen={isColumnModalOpen}
            onClose={() => setIsColumnModalOpen(false)}
            columns={availableColumns}
            visibleColumns={visibleColumns}
            onColumnChange={updateColumnPreferences}
            onReset={resetColumnPreferences}
            title={isAssignments ? "Customize Shipment Assignments Columns" : "Customize Liner Bookings Columns"}
          />
        </>
      )}
    </AdminLayout>
  )
}
