import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from "react-router";
import {
  Form,
  useLoaderData,
  useNavigate,
  redirect,
  useActionData,
  useSearchParams,
  Link,
} from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import {
  renderContainerStatusCell,
  renderShipperCell,
  getMilestoneStatus,
  getShippers,
} from "~/lib/container-status";
import { sortByColumn, toSortNumber, type SortOrder } from "~/lib/sort-utils";
import { SortableHeader } from "~/components/ui/sortable-table-head";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { AdminLayout } from "~/components/AdminLayout";
import { ColumnSelectorModal } from "~/components/ui/column-selector-modal";
import { useColumnPreferences } from "~/hooks/useColumnPreferences";
import { useToast } from "~/components/ui/toast";
import { useState, useEffect } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Shipment Plans - Cargo Care" },
    { name: "description", content: "Manage shipment plans and logistics" },
  ];
};

// Raw (non-JSX) value per column, used to sort the full result set server-side.
function getShipmentPlanSortValue(plan: any, columnId: string): string | number | null {
  const cm = plan.data?.container_movement || {};
  const pkg = plan.data?.package_details?.[0] || {};
  switch (columnId) {
    case "reference_number":
      return plan.data?.reference_number ?? null;
    case "business_branch":
      return plan.data?.bussiness_branch ?? null;
    case "shipment_type":
      return plan.data?.shipment_type ?? null;
    case "customer":
      return cm.customer ?? null;
    case "loading_port":
      return cm.loading_port ?? null;
    case "destination_country":
      return cm.destination_country ?? null;
    case "booking_status":
      return plan.data?.booking_status ?? null;
    case "milestone_status":
      return getMilestoneStatus(plan);
    case "port_of_discharge":
      return cm.port_of_discharge ?? null;
    case "final_place_of_delivery":
      return cm.delivery_till?.toLowerCase() === "port" ? null : (cm.final_place_of_delivery ?? null);
    case "consignee":
      return cm.consignee ?? null;
    case "selling_price":
      return toSortNumber(cm.selling_price);
    case "buying_price":
      return toSortNumber(cm.buying_price);
    case "carrier":
      return cm.carrier_and_vessel_preference?.carrier ?? null;
    case "vessel":
      return cm.carrier_and_vessel_preference?.vessel ?? null;
    case "created_date":
      return toSortNumber(new Date(plan.createdAt).getTime());
    case "created_by":
      return plan.user?.name ?? null;
    case "updated_date":
      return toSortNumber(new Date(plan.updatedAt).getTime());
    case "incoterm":
      return cm.incoterm ?? null;
    case "freight_terms":
      return cm.freight_terms ?? null;
    case "free_time":
      return toSortNumber(cm.free_time_in_days);
    case "delivery_till":
      return cm.delivery_till ?? null;
    case "preferred_etd":
      return cm.carrier_and_vessel_preference?.preferred_etd ?? null;
    case "rebate":
      return toSortNumber(cm.rebate);
    case "credit_period":
      return toSortNumber(cm.credit_period);
    case "shipper":
      return getShippers(plan.data?.package_details)[0] ?? null;
    case "invoice_number":
      return pkg.invoice_number ?? null;
    case "commodity":
      return pkg.commodity ?? null;
    case "volume":
      return toSortNumber(pkg.volume);
    case "gross_weight":
      return toSortNumber(pkg.gross_weight);
    case "num_packages":
      return toSortNumber(pkg.number_of_packages);
    case "cargo_ready_date":
      return pkg.projected_cargo_ready_date
        ? toSortNumber(new Date(pkg.projected_cargo_ready_date).getTime())
        : null;
    case "hs_code":
      return pkg.hs_code ?? null;
    case "po_number":
      return pkg.p_o_number ?? null;
    case "container_no": {
      const containers = (plan.data?.equipment_details || [])
        .map((eq: any) => eq.container_number)
        .filter(Boolean);
      return containers[0] ?? null;
    }
    case "equipment_details":
      return (plan.data?.equipment_details || []).length;
    case "stuffing_point":
      return plan.data?.equipment_details?.[0]?.stuffing_point ?? null;
    case "remarks":
      return plan.data?.remarks ?? null;
    default:
      return null;
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);

    // Only allow SHIPMENT_PLAN_TEAM and ADMIN
    if (
      user.role.name !== "SHIPMENT_PLAN_TEAM" &&
      user.role.name !== "ADMIN" &&
      user.role.name !== "MD"
    ) {
      return redirect("/dashboard");
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    const sortBy = url.searchParams.get("sortBy") || "created_date";
    const sortOrder: SortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    let whereCondition: any = {};

    // Role-based access control
    console.log("User data:", user.id, "Role:", user.role.name, "Branch:", user.businessBranch?.name);
    if (user?.role.name !== "ADMIN" && user?.role.name !== "MD") {
      // For SHIPMENT_PLAN_TEAM, filter by both userId and business branch
      if (user.role.name === "SHIPMENT_PLAN_TEAM") {
        const conditions: any[] = [
          { userId: user.id } // User can see their own shipment plans
        ];

        // If user has a business branch, also filter by business branch
        if (user.businessBranch?.name) {
          conditions.push({
            data: {
              path: ["bussiness_branch"],
              equals: user.businessBranch.name,
            },
          });
        }

        // User can see shipment plans they created OR shipment plans from their business branch
        whereCondition.OR = conditions;
        console.log("SHIPMENT_PLAN_TEAM branch filtering applied:", JSON.stringify(whereCondition, null, 2));
      } else {
        // For other roles, use the existing logic
        whereCondition.userId = user.id;
      }
    }

    // Search functionality

    if (search) {
      const searchConditions = [];

      // Use raw SQL with ILIKE for case-insensitive JSON field searches
      try {
        // Search in reference number (case-insensitive)
        const refMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->>'reference_number' ILIKE ${`%${search}%`}
        `;
        if ((refMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (refMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in business branch (case-insensitive)
        const branchMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->>'bussiness_branch' ILIKE ${`%${search}%`}
        `;
        if ((branchMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (branchMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in shipment type (case-insensitive)
        const typeMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->>'shipment_type' ILIKE ${`%${search}%`}
        `;
        if ((typeMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (typeMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in booking status (case-insensitive)
        const statusMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->>'booking_status' ILIKE ${`%${search}%`}
        `;
        if ((statusMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (statusMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in container movement - loading port (case-insensitive)
        const loadingPortMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'container_movement'->>'loading_port' ILIKE ${`%${search}%`}
        `;
        if ((loadingPortMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (loadingPortMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in container movement - destination country (case-insensitive)
        const destCountryMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'container_movement'->>'destination_country' ILIKE ${`%${search}%`}
        `;
        if ((destCountryMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (destCountryMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in container movement - customer (case-insensitive)
        const customerMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'container_movement'->>'customer' ILIKE ${`%${search}%`}
        `;
        if ((customerMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (customerMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in container movement - consignee (case-insensitive)
        const consigneeMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'container_movement'->>'consignee' ILIKE ${`%${search}%`}
        `;
        if ((consigneeMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (consigneeMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in container movement - port of discharge (case-insensitive)
        const podMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'container_movement'->>'port_of_discharge' ILIKE ${`%${search}%`}
        `;
        if ((podMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (podMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in container movement - final place of delivery (case-insensitive)
        const fpdMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'container_movement'->>'final_place_of_delivery' ILIKE ${`%${search}%`}
        `;
        if ((fpdMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (fpdMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in carrier and vessel preference - carrier (case-insensitive)
        const carrierMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'container_movement'->'carrier_and_vessel_preference'->>'carrier' ILIKE ${`%${search}%`}
        `;
        if ((carrierMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (carrierMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in carrier and vessel preference - vessel (case-insensitive)
        const vesselMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'container_movement'->'carrier_and_vessel_preference'->>'vessel' ILIKE ${`%${search}%`}
        `;
        if ((vesselMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (vesselMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in package details - shipper (case-insensitive)
        const shipperMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'package_details'->0->>'shipper' ILIKE ${`%${search}%`}
        `;
        if ((shipperMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (shipperMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in package details - commodity (case-insensitive)
        const commodityMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'package_details'->0->>'commodity' ILIKE ${`%${search}%`}
        `;
        if ((commodityMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (commodityMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in package details - invoice number (case-insensitive)
        const invoiceMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'package_details'->0->>'invoice_number' ILIKE ${`%${search}%`}
        `;
        if ((invoiceMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (invoiceMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in package details - PO number (case-insensitive)
        const poMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'package_details'->0->>'p_o_number' ILIKE ${`%${search}%`}
        `;
        if ((poMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (poMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in equipment details - equipment type (case-insensitive)
        const equipmentTypeMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'equipment_details'->0->>'equipment_type' ILIKE ${`%${search}%`}
        `;
        if ((equipmentTypeMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (equipmentTypeMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in equipment details - stuffing point (case-insensitive)
        const stuffingPointMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'equipment_details'->0->>'stuffing_point' ILIKE ${`%${search}%`}
        `;
        if ((stuffingPointMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (stuffingPointMatches as any[]).map((row: any) => row.id) } });
        }

        // Search in equipment details - empty container pick up from (case-insensitive)
        const emptyPickupMatches = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->'equipment_details'->0->>'empty_container_pick_up_from' ILIKE ${`%${search}%`}
        `;
        if ((emptyPickupMatches as any[]).length > 0) {
          searchConditions.push({ id: { in: (emptyPickupMatches as any[]).map((row: any) => row.id) } });
        }

      } catch (error) {
        console.error("Error in raw SQL search:", error);
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

      // Combine branch filtering with search conditions
      if (whereCondition.OR && searchConditions.length > 0) {
        // If we already have branch filtering (OR conditions), we need to apply search to each branch condition
        const existingConditions = whereCondition.OR;
        whereCondition.AND = [
          { OR: existingConditions }, // Branch filtering
          { OR: searchConditions }    // Search filtering
        ];
        delete whereCondition.OR;
      } else {
        // If no branch filtering, just apply search conditions
        whereCondition.OR = searchConditions;
      }
    }

    // Cancelled shipment plans are only visible to ADMIN and SHIPMENT_PLAN_TEAM, not MD
    if (user.role.name === "MD") {
      const notCancelledCondition = {
        NOT: {
          data: {
            path: ["booking_status"],
            equals: "Cancelled",
          },
        },
      };

      if (whereCondition.AND) {
        whereCondition.AND.push(notCancelledCondition);
      } else if (whereCondition.OR) {
        whereCondition.AND = [{ OR: whereCondition.OR }, notCancelledCondition];
        delete whereCondition.OR;
      } else {
        Object.assign(whereCondition, notCancelledCondition);
      }
    }

    const [allShipmentPlans] = await Promise.all([
      prisma.shipmentPlan.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          linerBooking: {
            select: { data: true },
          },
          shipmentAssignment: {
            select: { data: true },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.businessBranch.findMany({ orderBy: { name: "asc" } }),
      prisma.loadingPort.findMany({ orderBy: { name: "asc" } }),
      prisma.portOfDischarge.findMany({ orderBy: { name: "asc" } }),
      prisma.destinationCountry.findMany({ orderBy: { name: "asc" } }),
      prisma.carrier.findMany({ orderBy: { name: "asc" } }),
      prisma.vessel.findMany({ orderBy: { name: "asc" } }),
      prisma.organization.findMany({ orderBy: { name: "asc" } }),
    ]);

    // Sort the full matching set by the requested column, then paginate.
    const sortedShipmentPlans =
      sortBy === "created_date" && sortOrder === "desc"
        ? allShipmentPlans
        : sortByColumn(allShipmentPlans, (plan) => getShipmentPlanSortValue(plan, sortBy), sortOrder);
    const totalCount = sortedShipmentPlans.length;
    const shipmentPlans = sortedShipmentPlans.slice(offset, offset + limit);

    console.log("Shipment Plans - Retrieved count:", totalCount);
    console.log(
      "Shipment Plans - First 5 records (if any):",
      JSON.stringify(shipmentPlans.slice(0, 5), null, 2)
    );

    return {
      user,
      shipmentPlans,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      search,
      sortBy,
      sortOrder,
    };
  } catch (error) {
    return redirect("/login");
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request);

    // Only allow SHIPMENT_PLAN_TEAM and ADMIN
    if (user.role.name !== "SHIPMENT_PLAN_TEAM" && user.role.name !== "ADMIN") {
      return redirect("/dashboard");
    }

    const formData = await request.formData();
    const action = formData.get("action") as string;
    // Bulk "delete selected" / "bulk edit" from the list page were removed —
    // they let anyone select an unreviewed plan straight off the list and
    // delete/edit it without ever opening it. Per-plan actions (cancel,
    // approve, etc.) still go through shipment-plans.$id.edit.tsx, which
    // requires actually opening the plan first.
    if (action === "approve") {
      const id = formData.get("id") as string;

      const existingPlan = await prisma.shipmentPlan.findUnique({
        where: { id },
      });

      if (!existingPlan) {
        return { error: "Shipment plan not found" };
      }

      if (user.role.name !== "ADMIN" && existingPlan.userId !== user.id) {
        return {
          error: "You don't have permission to approve this shipment plan",
        };
      }

      // Check if the plan is in "Awaiting MD Approval" status
      // Also accept null booking_status (legacy plans created before status field was set)
      const planData = existingPlan.data as any;
      if (planData.booking_status !== "Awaiting MD Approval" && planData.booking_status !== null) {
        return {
          error:
            "Only plans with 'Awaiting MD Approval' status can be approved",
        };
      }

      // Update the status to "Awaiting Booking"
      const updatedData = {
        ...planData,
        booking_status: "Awaiting Booking",
      }; // Update shipment plan and create liner booking in a transaction
      await prisma.$transaction(async (tx) => {
        // Create a new liner booking with only the carrier booking status
        // Reference number will be pulled dynamically from linked shipment plan
        const linerBookingData = {
          carrier_booking_status: "Awaiting Booking",
        };

        const linerBooking = await tx.linerBooking.create({
          data: {
            data: linerBookingData,
            userId: user.id,
          },
        });

        // Update the shipment plan status and link it to the liner booking
        await tx.shipmentPlan.update({
          where: { id },
          data: {
            data: updatedData,
            linerBookingId: linerBooking.id, // Link to the created liner booking
          },
        });
      });

      return {
        success:
          "Shipment plan approved and liner booking created successfully",
      };
    }

    if (action === "copy") {
      const id = formData.get("id") as string;

      const existingPlan = await prisma.shipmentPlan.findUnique({
        where: { id },
      });

      if (!existingPlan) {
        return { error: "Shipment plan not found" };
      }

      if (user.role.name !== "ADMIN") {
        return {
          error: "You don't have permission to copy this shipment plan",
        };
      }

      const existingData = existingPlan.data as any;

      // Create a new reference number for the copied plan
      const originalReference = existingData.reference_number;

      // Extract the prefix and numeric suffix from the reference number
      const referenceMatch = originalReference.match(/^(.+?)(\d+)$/);

      if (!referenceMatch) {
        return { error: "Cannot parse reference number format for copying" };
      }

      const [, prefix, numberPart] = referenceMatch;
      const currentNumber = parseInt(numberPart, 10);
      const numberLength = numberPart.length;

      // Find all existing shipment plans with the same prefix
      const existingPlans = await prisma.shipmentPlan.findMany({
        where: {
          data: {
            path: ["reference_number"],
            string_starts_with: prefix,
          },
        },
        select: {
          data: true,
        },
      });

      // Extract all existing numbers with the same prefix
      const existingNumbers = new Set<number>();
      for (const plan of existingPlans) {
        const planData = plan.data as any;
        const refNumber = planData?.reference_number || "";
        const match = refNumber.match(
          new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`)
        );
        if (match) {
          const num = parseInt(match[1], 10);
          existingNumbers.add(num);
        }
      }

      // Find the next available number
      let nextNumber = currentNumber + 1;
      while (existingNumbers.has(nextNumber)) {
        nextNumber++;
      }

      const paddedNumber = nextNumber.toString().padStart(numberLength, "0");
      const newReferenceNumber = `${prefix}${paddedNumber}`;

      // Create copied data with selective copying - preserve party names and equipment details
      const copiedData = {
        ...existingData,
        reference_number: newReferenceNumber,
        booking_status: "Awaiting MD Approval", // Reset to initial status

        // Reset financial data
        selling_price: null,
        buying_price: null,

        // Reset container tracking to initial state
        container_tracking: {
          container_current_status: "Pending",
          container_stuffing_completed: false,
          container_stuffing_completed_date: null,
          empty_container_picked_up_status: false,
          empty_container_picked_up_date: null,
          gated_in_status: false,
          gated_in_date: null,
          loaded_on_board_status: false,
          loaded_on_board_date: null,
        },

        // Preserve party names, equipment details, and other operational data
        // These will be copied as-is:
        // - container_movement (includes customer, consignee, shipper details)
        // - package_details (includes shipper, commodity details)
        // - equipment_details (includes equipment type, stuffing point, etc.)
        // - carrier_and_vessel_preference
        // - bussiness_branch, shipment_type, etc.
      };

      // Create the new shipment plan (not linked to any liner booking)
      const newPlan = await prisma.shipmentPlan.create({
        data: {
          data: copiedData,
          userId: user.id,
          // Explicitly not setting linerBookingId
        },
      });

      return {
        success: `Shipment plan copied successfully with reference number: ${newReferenceNumber}. Party names and equipment details have been preserved.`,
        newPlanId: newPlan.id,
      };
    }

    return { error: "Invalid action" };
  } catch (error) {
    console.error("Shipment plans action error:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      action: formData?.get("action"),
      deleteChoice: formData?.get("deleteChoice")
    });
    return { error: `An error occurred while processing your request: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export default function ShipmentPlans() {
  const { user, shipmentPlans, pagination, search, sortBy, sortOrder } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  // Show toast when shipment plan is cancelled
  useEffect(() => {
    const cancelled = searchParams.get("cancelled");
    if (cancelled === "true") {
      addToast({
        type: "success",
        title: "Shipment Plan Deleted",
        description: "The shipment plan has been deleted and removed. Any linked liner bookings are now available for re-linking.",
        duration: 6000,
      });
      // Remove the query param from URL without refresh
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("cancelled");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [searchParams, addToast]);

  // Show toast when shipment plan is soft-cancelled (marked Cancelled, not deleted)
  useEffect(() => {
    const planCancelled = searchParams.get("plan_cancelled");
    if (planCancelled === "true") {
      addToast({
        type: "success",
        title: "Shipment Plan Cancelled",
        description: "The shipment plan has been marked as Cancelled and is now read-only. It remains visible to Admin and Shipment Planning team only.",
        duration: 6000,
      });
      // Remove the query param from URL without refresh
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("plan_cancelled");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [searchParams, addToast]);

  // Column definitions for the table
  // Define base columns available to all users
  const baseColumns = [
    { id: "reference_number", label: "Reference No.", defaultVisible: true, locked: true },
    { id: "business_branch", label: "Business Branch", defaultVisible: true },
    { id: "shipment_type", label: "Type", defaultVisible: true },
    { id: "customer", label: "Customer", defaultVisible: true },
    { id: "loading_port", label: "Loading Port", defaultVisible: true },
    { id: "destination_country", label: "Destination", defaultVisible: true },
    { id: "booking_status", label: "Booking Status", defaultVisible: true },
    { id: "milestone_status", label: "Container Status", defaultVisible: true },
    {
      id: "port_of_discharge",
      label: "Port of Discharge",
      defaultVisible: true,
    },
    {
      id: "final_place_of_delivery",
      label: "Final Place of Delivery",
      defaultVisible: true,
    },
    { id: "consignee", label: "Consignee", defaultVisible: true },
  ];

  // Define price columns (only for ADMIN and MD)
  const priceColumns = [
    { id: "selling_price", label: "Selling Price", defaultVisible: true },
    { id: "buying_price", label: "Buying Price", defaultVisible: true },
  ];

  // Build available columns based on user role
  const availableColumns = [
    ...baseColumns,
    // Only show price columns to ADMIN and MD
    ...(user.role.name === "ADMIN" || user.role.name === "MD" ? priceColumns : []),
    { id: "carrier", label: "Carrier", defaultVisible: true },
    { id: "vessel", label: "Vessel", defaultVisible: true },
    { id: "created_date", label: "Created", defaultVisible: true },
    { id: "created_by", label: "Sales Person", defaultVisible: true },
    // Only show Last Updated column to ADMIN and SHIPMENT_PLAN_TEAM
    ...(user.role.name === "ADMIN" || user.role.name === "SHIPMENT_PLAN_TEAM"
      ? [{ id: "updated_date", label: "Last Updated", defaultVisible: true }]
      : []),
    // Additional detail columns (hidden by default)
    { id: "incoterm", label: "Incoterm", defaultVisible: false },
    { id: "freight_terms", label: "Freight Terms", defaultVisible: false },
    { id: "free_time", label: "Free Time (Days)", defaultVisible: false },
    { id: "delivery_till", label: "Delivery Till", defaultVisible: false },
    { id: "preferred_etd", label: "Preferred ETD", defaultVisible: false },
    { id: "rebate", label: "Rebate", defaultVisible: false },
    { id: "credit_period", label: "Credit Period", defaultVisible: false },
    { id: "shipper", label: "Shipper", defaultVisible: true },
    { id: "invoice_number", label: "Invoice No.", defaultVisible: false },
    { id: "commodity", label: "Commodity", defaultVisible: false },
    { id: "volume", label: "Volume", defaultVisible: true },
    { id: "gross_weight", label: "Gross Weight", defaultVisible: false },
    { id: "num_packages", label: "No. of Packages", defaultVisible: true },
    { id: "cargo_ready_date", label: "Cargo Ready Date", defaultVisible: false },
    { id: "hs_code", label: "HS Code", defaultVisible: false },
    { id: "po_number", label: "P.O. Number", defaultVisible: true },
    { id: "container_no", label: "Container No.", defaultVisible: true },
    { id: "equipment_details", label: "Equipment Details", defaultVisible: true },
    { id: "stuffing_point", label: "Stuffing Point", defaultVisible: false },
    { id: "remarks", label: "Remarks", defaultVisible: false },
  ];

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
    storageKey: "shipment-plans-columns",
    columns: availableColumns,
  });

  const handleRowClick = (id: string, event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    const isInteractiveElement = target.closest(
      'button, a, input, [role="checkbox"]'
    );

    if (!isInteractiveElement) {
      navigate(`/shipment-plans/${id}/edit`);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { color: string; bg: string; border: string; icon: string }
    > = {
      "Draft": {
        color: "text-gray-700",
        bg: "bg-gradient-to-r from-gray-200 to-gray-100",
        border: "border-gray-300",
        icon: "📝",
      },
      "Awaiting MD Approval": {
        color: "text-orange-800",
        bg: "bg-gradient-to-r from-orange-100 to-orange-50",
        border: "border-orange-200",
        icon: "⏳",
      },
      "Awaiting Booking": {
        color: "text-blue-800",
        bg: "bg-gradient-to-r from-blue-100 to-blue-50",
        border: "border-blue-200",
        icon: "📝",
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
      "Unmapping Requested": {
        color: "text-purple-800",
        bg: "bg-gradient-to-r from-purple-100 to-purple-50",
        border: "border-purple-200",
        icon: "🔄",
      },
    };

    const config = statusConfig[status] || {
      color: "text-gray-800",
      bg: "bg-gradient-to-r from-gray-100 to-gray-50",
      border: "border-gray-200",
      icon: "📄",
    };

    return (
      <span
        className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold ${config.color} ${config.bg} border ${config.border}`}
      >
        <span>{config.icon}</span>
        <span>{status}</span>
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Function to get data for a specific column
  const getColumnData = (plan: any, columnId: string) => {
    switch (columnId) {
      case "reference_number":
        return (
          <TableCell key={columnId} className="font-semibold text-gray-900 pl-6 sticky left-0 z-20 bg-white shadow-[2px_0_5px_-1px_rgba(0,0,0,0.08)]">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <Link
                to={`/shipment-plans/${plan.id}/edit`}
                onClick={(e) => e.stopPropagation()}
                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              >
                {plan.data.reference_number || "N/A"}
              </Link>
            </div>
          </TableCell>
        );
      case "business_branch":
        return (
          <TableCell key={columnId} className="text-gray-700 font-medium">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">🏢</span>
              <span>{plan.data.bussiness_branch || "N/A"}</span>
            </div>
          </TableCell>
        );
      case "shipment_type":
        return (
          <TableCell key={columnId}>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-100 to-blue-50 text-blue-800 border border-blue-200">
              {plan.data.shipment_type || "N/A"}
            </span>
          </TableCell>
        );
      case "customer":
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">👤</span>
              <span>{plan.data.container_movement?.customer || "N/A"}</span>
            </div>
          </TableCell>
        );
      case "loading_port":
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">🚢</span>
              <span>{plan.data.container_movement?.loading_port || "N/A"}</span>
            </div>
          </TableCell>
        );
      case "destination_country":
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">🌍</span>
              <span>
                {plan.data.container_movement?.destination_country || "N/A"}
              </span>
            </div>
          </TableCell>
        );
      case "booking_status":
        return (
          <TableCell key={columnId}>
            {getStatusBadge(plan.data.booking_status || "Awaiting MD Approval")}
          </TableCell>
        );
      case "port_of_discharge":
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">🏢</span>
              <span>
                {plan.data.container_movement?.port_of_discharge || "N/A"}
              </span>
            </div>
          </TableCell>
        );
      case "final_place_of_delivery":
        const deliveryTill = plan.data.container_movement?.delivery_till;
        const finalPlaceOfDelivery = plan.data.container_movement?.final_place_of_delivery;
        const displayValue = deliveryTill?.toLowerCase() === "port" ? "N/A" : (finalPlaceOfDelivery || "N/A");
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">📍</span>
              <span>{displayValue}</span>
            </div>
          </TableCell>
        );
      case "consignee":
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">👤</span>
              <span>{plan.data.container_movement?.consignee || "N/A"}</span>
            </div>
          </TableCell>
        );
      case "selling_price":
        // Only show selling price to ADMIN and MD
        if (user.role.name !== "ADMIN" && user.role.name !== "MD") {
          return <TableCell key={columnId}>-</TableCell>;
        }
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">💰</span>
              <span>
                {plan.data.container_movement?.selling_price || "N/A"}
              </span>
            </div>
          </TableCell>
        );
      case "buying_price":
        // Only show buying price to ADMIN and MD
        if (user.role.name !== "ADMIN" && user.role.name !== "MD") {
          return <TableCell key={columnId}>-</TableCell>;
        }
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">💰</span>
              <span>{plan.data.container_movement?.buying_price || "N/A"}</span>
            </div>
          </TableCell>
        );
      case "carrier":
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">🚛</span>
              <span>
                {plan.data.container_movement?.carrier_and_vessel_preference
                  ?.carrier || "N/A"}
              </span>
            </div>
          </TableCell>
        );
      case "vessel":
        return (
          <TableCell key={columnId} className="text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">🚢</span>
              <span>
                {plan.data.container_movement?.carrier_and_vessel_preference
                  ?.vessel || "N/A"}
              </span>
            </div>
          </TableCell>
        );
      case "created_date":
        return (
          <TableCell key={columnId} className="text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">📅</span>
              <span>{formatDate(plan.createdAt)}</span>
            </div>
          </TableCell>
        );
      case "milestone_status":
        return (
          <TableCell key={columnId}>{renderContainerStatusCell(plan)}</TableCell>
        );
      case "created_by":
        return (
          <TableCell key={columnId} className="text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600">
                  {plan.user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span>{plan.user.name}</span>
            </div>
          </TableCell>
        );
      case "updated_date":
        return (
          <TableCell key={columnId} className="text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">🔄</span>
              <span>{formatDate(plan.updatedAt)}</span>
            </div>
          </TableCell>
        );
      case "incoterm":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).container_movement?.incoterm || "N/A"}
          </TableCell>
        );
      case "freight_terms":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).container_movement?.freight_terms || "N/A"}
          </TableCell>
        );
      case "free_time":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).container_movement?.free_time_in_days || "N/A"}
          </TableCell>
        );
      case "delivery_till":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).container_movement?.delivery_till || "N/A"}
          </TableCell>
        );
      case "preferred_etd":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).container_movement?.carrier_and_vessel_preference?.preferred_etd || "N/A"}
          </TableCell>
        );
      case "rebate":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).container_movement?.rebate || "N/A"}
          </TableCell>
        );
      case "credit_period":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).container_movement?.credit_period || "N/A"}
          </TableCell>
        );
      case "shipper":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {renderShipperCell((plan.data as any)?.package_details)}
          </TableCell>
        );
      case "invoice_number":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).package_details?.[0]?.invoice_number || "N/A"}
          </TableCell>
        );
      case "commodity":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).package_details?.[0]?.commodity || "N/A"}
          </TableCell>
        );
      case "volume":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).package_details?.[0]?.volume || "N/A"}
          </TableCell>
        );
      case "gross_weight":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).package_details?.[0]?.gross_weight || "N/A"}
          </TableCell>
        );
      case "num_packages":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).package_details?.[0]?.number_of_packages || "N/A"}
          </TableCell>
        );
      case "cargo_ready_date":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).package_details?.[0]?.projected_cargo_ready_date || "N/A"}
          </TableCell>
        );
      case "hs_code":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).package_details?.[0]?.hs_code || "N/A"}
          </TableCell>
        );
      case "po_number":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).package_details?.[0]?.p_o_number || "N/A"}
          </TableCell>
        );
      case "container_no": {
        const containers = ((plan.data as any).equipment_details || [])
          .map((eq: any) => eq.container_number)
          .filter(Boolean);
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {containers.length > 0 ? containers.join(", ") : "N/A"}
          </TableCell>
        );
      }
      case "equipment_details": {
        const eqDetails = (plan.data as any).equipment_details || [];
        if (eqDetails.length === 0) return <TableCell key={columnId}><span className="text-gray-500">N/A</span></TableCell>;
        const equipmentCounts = eqDetails.reduce((acc: any, eq: any) => {
          const type = eq.equipment_type;
          if (type) acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
        return (
          <TableCell key={columnId}>
            <div className="space-y-1 text-sm text-gray-700">
              {Object.entries(equipmentCounts).map(([type, count]: [string, any]) => {
                const cleanType = typeof type === "string" ? type.replace(/\s*container$/i, "").trim() : type;
                return (
                  <span key={type} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-gray-700 border border-slate-200 whitespace-nowrap">
                    <span className="text-xs">📦</span>
                    <span className="text-xs font-semibold whitespace-nowrap">{count} x</span>
                    <span className="whitespace-nowrap">{cleanType}</span>
                  </span>
                );
              })}
            </div>
          </TableCell>
        );
      }
      case "stuffing_point":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700">
            {(plan.data as any).equipment_details?.[0]?.stuffing_point || "N/A"}
          </TableCell>
        );
      case "remarks":
        return (
          <TableCell key={columnId} className="text-sm text-gray-700 max-w-xs">
            <span className="truncate block" title={(plan.data as any).remarks || ""}>
              {(plan.data as any).remarks || "N/A"}
            </span>
          </TableCell>
        );
      default:
        return <TableCell key={columnId}>N/A</TableCell>;
    }
  };
  return (
    <AdminLayout user={user}>
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-3">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Shipment Plans
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage and track your shipment plans
              </p>
            </div>
            <Link to="/shipment-plans/new">
              <Button className="bg-red-500 hover:bg-red-600 text-white">
                Add New Shipment Plan
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white">
        {/* Success/Error Messages */}
        {actionData?.success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            <div className="flex items-center justify-between">
              <span>{actionData.success}</span>
              {actionData?.newPlanId && (
                <Link
                  to={`/shipment-plans/${actionData.newPlanId}/edit`}
                  className="ml-4 text-green-600 hover:text-green-800 font-medium underline"
                >
                  View Copied Plan →
                </Link>
              )}
            </div>
          </div>
        )}
        {actionData?.error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {actionData.error}
          </div>
        )}{" "}
        {/* Unified Table Container */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
          {/* Enhanced Search and Actions */}
          <div className="p-3 border-b border-gray-200 shrink-0">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex-1 max-w-2xl">
                <Form method="get" className="relative">
                  <div className="relative flex gap-3">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-400 text-sm">🔍</span>
                      </div>
                      <Input
                        name="search"
                        placeholder="Search by reference, shipper, customer, carrier, vessel, commodity, ports, or any shipment details..."
                        defaultValue={search}
                        className="pl-10 pr-4 py-1.5 h-8 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="px-4 py-1.5 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg"
                    >
                      Search
                    </Button>
                    {search && (
                      <Link to="/shipment-plans">
                        <Button
                          variant="outline"
                          className="px-4 py-1.5 h-8 border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
                        >
                          Clear
                        </Button>
                      </Link>
                    )}
                  </div>
                </Form>
                {search && (
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-medium">{pagination.totalCount}</span>{" "}
                    results found for "{search}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                  <span className="font-medium">{pagination.totalCount}</span>{" "}
                  total plans
                </div>
              </div>
            </div>
          </div>
          <div className="px-4 py-2 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-sm">📦</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Shipment Plans
                  </h3>
                  <p className="text-sm text-gray-500">
                    {pagination.totalCount} total plans
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsColumnModalOpen(true)}
                  className="flex items-center space-x-2 border-gray-300 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
                  title="Customize which columns to display and their order"
                >
                  <span className="text-sm">⚙️</span>
                  <span>Customize Columns</span>
                </Button>
              </div>
            </div>
          </div>
          <Table wrapperClassName="overflow-x-scroll overflow-y-auto flex-1 min-h-0 pb-2">
              <TableHeader className="bg-gradient-to-r from-slate-50 to-gray-50 sticky top-0 z-40">
                <TableRow className="border-gray-200">
                  {visibleColumns.map((columnId) => {
                    const column = availableColumns.find(
                      (col) => col.id === columnId
                    );
                    if (!column) return null;

                    if (columnId === "reference_number") {
                      return (
                        <SortableHeader
                          key={columnId}
                          columnId={columnId}
                          label={column.label}
                          sortBy={sortBy}
                          sortOrder={sortOrder}
                          searchParams={searchParams}
                          className="font-semibold text-gray-900 text-sm pl-6 sticky left-0 z-30 bg-slate-50 shadow-[2px_0_5px_-1px_rgba(0,0,0,0.1)]"
                        />
                      );
                    }

                    return (
                      <SortableHeader
                        key={columnId}
                        columnId={columnId}
                        label={column.label}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        searchParams={searchParams}
                        className="font-semibold text-gray-900 text-sm"
                      />
                    );
                  })}
                </TableRow>
              </TableHeader>{" "}
              <TableBody>
                {shipmentPlans.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumns.length}
                      className="text-center py-16"
                    >
                      <div className="flex flex-col items-center space-y-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl flex items-center justify-center">
                          <span className="text-4xl">📦</span>
                        </div>
                        <div className="space-y-3 max-w-md">
                          <h3 className="text-xl font-semibold text-gray-900">
                            No shipment plans found
                          </h3>
                          <p className="text-gray-500 leading-relaxed">
                            {search
                              ? "Try adjusting your search criteria or clear the search to see all shipment plans"
                              : "Get started by creating your first shipment plan to track your cargo logistics"}
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Link to="/shipment-plans/new">
                            <Button className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 hover:shadow-lg">
                              <span className="mr-2">✨</span>
                              Create your first shipment plan
                            </Button>
                          </Link>
                          {search && (
                            <Link to="/shipment-plans">
                              <Button
                                variant="outline"
                                className="px-6 py-2 rounded-lg font-medium"
                              >
                                Clear search
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  shipmentPlans.map((plan: any, index: number) => (
                    <TableRow
                      key={plan.id}
                      className={`transition-all duration-200 ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                      }`}
                    >
                      {visibleColumns.map((columnId) => {
                        const columnData = getColumnData(plan, columnId);
                        return columnData;
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          {/* Enhanced Pagination */}
          {pagination.totalPages > 1 && (
            <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 shrink-0">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span className="font-medium">
                    Showing {(pagination.page - 1) * pagination.limit + 1}-
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.totalCount
                    )}
                  </span>
                  <span>of</span>
                  <span className="font-medium text-gray-900">
                    {pagination.totalCount}
                  </span>
                  <span>results</span>
                </div>

                <div className="flex items-center space-x-2">
                  {pagination.page > 1 && (
                    <Link
                      to={`?${new URLSearchParams({
                        ...Object.fromEntries(searchParams),
                        page: String(pagination.page - 1),
                      })}`}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="px-4 py-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
                      >
                        <span className="mr-1">←</span>
                        Previous
                      </Button>
                    </Link>
                  )}

                  <div className="flex items-center space-x-1">
                    {Array.from(
                      { length: Math.min(5, pagination.totalPages) },
                      (_, i) => {
                        const pageNumber =
                          Math.max(
                            1,
                            Math.min(
                              pagination.totalPages - 4,
                              pagination.page - 2
                            )
                          ) + i;
                        if (pageNumber > pagination.totalPages) return null;

                        return (
                          <Link
                            key={pageNumber}
                            to={`?${new URLSearchParams({
                              ...Object.fromEntries(searchParams),
                              page: String(pageNumber),
                            })}`}
                          >
                            <Button
                              variant={
                                pageNumber === pagination.page
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              className={`w-10 h-10 ${
                                pageNumber === pagination.page
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "border-gray-300 hover:bg-gray-50"
                              } transition-all duration-200`}
                            >
                              {pageNumber}
                            </Button>
                          </Link>
                        );
                      }
                    )}
                  </div>

                  {pagination.page < pagination.totalPages && (
                    <Link
                      to={`?${new URLSearchParams({
                        ...Object.fromEntries(searchParams),
                        page: String(pagination.page + 1),
                      })}`}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="px-4 py-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200"
                      >
                        Next
                        <span className="ml-1">→</span>
                      </Button>
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
        title="Customize Shipment Plans Columns"
      />
    </AdminLayout>
  );
}
