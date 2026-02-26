import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from "react-router";
import {
  Form,
  useLoaderData,
  useNavigate,
  useNavigation,
  redirect,
  useActionData,
  useSearchParams,
  Link,
} from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
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
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { AdminLayout } from "~/components/AdminLayout";
import { ColumnSelectorModal } from "~/components/ui/column-selector-modal";
import { BulkEditModal } from "~/components/ui/bulk-edit-modal";
import { ShipmentDeletionConfirmationModal } from "~/components/ui/shipment-deletion-confirmation-modal";
import { useColumnPreferences } from "~/hooks/useColumnPreferences";
import { useToast } from "~/components/ui/toast";
import { useState, useEffect } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Shipment Plans - Cargo Care" },
    { name: "description", content: "Manage shipment plans and logistics" },
  ];
};

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

    const [
      shipmentPlans,
      totalCount,
      businessBranches,
      loadingPorts,
      portsOfDischarge,
      destinationCountries,
      carriers,
      vessels,
      organizations,
    ] = await Promise.all([
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
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: offset,
        take: limit,
      }),
      prisma.shipmentPlan.count({
        where: whereCondition,
      }),
      prisma.businessBranch.findMany({ orderBy: { name: "asc" } }),
      prisma.loadingPort.findMany({ orderBy: { name: "asc" } }),
      prisma.portOfDischarge.findMany({ orderBy: { name: "asc" } }),
      prisma.destinationCountry.findMany({ orderBy: { name: "asc" } }),
      prisma.carrier.findMany({ orderBy: { name: "asc" } }),
      prisma.vessel.findMany({ orderBy: { name: "asc" } }),
      prisma.organization.findMany({ orderBy: { name: "asc" } }),
    ]);
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
      dataPoints: {
        businessBranches,
        loadingPorts,
        portsOfDischarge,
        destinationCountries,
        carriers,
        vessels,
        organizations,
      },
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
    if (action === "delete") {
      const ids = formData.getAll("selectedIds") as string[];
      const deleteChoice = formData.get("deleteChoice") as string; // 'delete_both' or 'orphan_assignments'
      const deletionReason = formData.get("deletionReason") as string;

      // First check for linked assignments
      const plansWithAssignments = await prisma.shipmentPlan.findMany({
        where: { 
          id: { in: ids },
          shipmentAssignmentId: { not: null }
        },
        include: { 
          shipmentAssignment: true 
        }
      });

      // If assignments found and no choice made yet, ask for confirmation
      if (plansWithAssignments.length > 0 && !deleteChoice) {
        return { 
          needsConfirmation: true,
          linkedAssignments: plansWithAssignments.map(plan => ({
            planId: plan.id,
            referenceNumber: (plan.data as any).reference_number || "Unknown",
            assignmentId: plan.shipmentAssignmentId!
          }))
        };
      }

      // Process deletion based on user choice
      let deletedCount = 0;
      let orphanedCount = 0;

      await prisma.$transaction(async (tx) => {
        for (const id of ids) {
          const existingPlan = await tx.shipmentPlan.findUnique({
            where: { id },
            include: { shipmentAssignment: true }
          });

          if (
            existingPlan &&
            (user.role.name === "ADMIN" || existingPlan.userId === user.id)
          ) {
            // Handle linked shipment assignment if exists
            if (existingPlan.shipmentAssignmentId) {
              if (deleteChoice === 'delete_both') {
                // Delete both plan and assignment
                await tx.shipmentAssignment.delete({
                  where: { id: existingPlan.shipmentAssignmentId }
                });
              } else if (deleteChoice === 'orphan_assignments') {
                // Mark assignment as orphaned and view-only
                const planData = existingPlan.data as any;
                console.log("Attempting to update shipment assignment with orphaned fields:", {
                  assignmentId: existingPlan.shipmentAssignmentId,
                  planReference: planData.reference_number
                });
                
                try {
                  // Get current assignment data to preserve it
                  const currentAssignment = await tx.shipmentAssignment.findUnique({
                    where: { id: existingPlan.shipmentAssignmentId }
                  });
                  
                  // Merge shipment plan data into assignment data for preservation
                  const preservedData = {
                    ...(currentAssignment?.data as any),
                    // Preserve original shipment plan data
                    _originalShipmentPlan: planData,
                    // Mark as orphaned
                    _orphaned: true,
                    _orphanedAt: new Date().toISOString(),
                    _orphanedReason: `Shipment plan "${planData.reference_number || 'Unknown'}" was deleted by ${user.name}. Reason: ${deletionReason || 'No reason provided'}`,
                    _viewOnly: true
                  };

                  // First try with all fields
                  await tx.shipmentAssignment.update({
                    where: { id: existingPlan.shipmentAssignmentId },
                    data: {
                      data: preservedData, // Always update data with preserved info
                      isOrphaned: true,
                      orphanedAt: new Date(),
                      orphanedReason: `Shipment plan "${planData.reference_number || 'Unknown'}" was deleted by ${user.name}. Reason: ${deletionReason || 'No reason provided'}`,
                      isViewOnly: true
                    }
                  });
                  console.log("Successfully updated shipment assignment with orphaned fields");
                  orphanedCount++;
                } catch (updateError) {
                  console.error("Failed to update shipment assignment:", updateError);
                  console.error("Attempting fallback approach...");
                  
                  // Fallback: Try updating just the data field with orphaned info
                  try {
                    const currentAssignment = await tx.shipmentAssignment.findUnique({
                      where: { id: existingPlan.shipmentAssignmentId }
                    });
                    
                    if (currentAssignment) {
                      const updatedData = {
                        ...(currentAssignment.data as any),
                        // Preserve original shipment plan data
                        _originalShipmentPlan: planData,
                        _orphaned: true,
                        _orphanedAt: new Date().toISOString(),
                        _orphanedReason: `Shipment plan "${planData.reference_number || 'Unknown'}" was deleted by ${user.name}. Reason: ${deletionReason || 'No reason provided'}`,
                        _viewOnly: true
                      };
                      
                      await tx.shipmentAssignment.update({
                        where: { id: existingPlan.shipmentAssignmentId },
                        data: {
                          data: updatedData
                        }
                      });
                      console.log("Successfully updated using fallback approach");
                      orphanedCount++;
                    }
                  } catch (fallbackError) {
                    console.error("Fallback approach also failed:", fallbackError);
                    throw new Error(`Failed to mark assignment as orphaned: ${updateError instanceof Error ? updateError.message : String(updateError)}`);
                  }
                }
              }
            }

            // Delete the shipment plan
            await tx.shipmentPlan.delete({
              where: { id },
            });
            deletedCount++;
          }
        }
      });

      // Return appropriate success message
      let successMessage = `${deletedCount} shipment plan(s) deleted successfully`;
      if (orphanedCount > 0) {
        successMessage += `. ${orphanedCount} shipment assignment(s) kept as view-only`;
      }

      return { success: successMessage };
    }
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
      const planData = existingPlan.data as any;
      if (planData.booking_status !== "Awaiting MD Approval") {
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

    if (action === "bulkEdit") {
      const ids = formData.getAll("selectedIds") as string[];
      const fieldsToUpdate: any = {};

      // Get all the fields to update from form data
      const businessBranch = formData.get("bulk_business_branch") as string;
      const shipmentType = formData.get("bulk_shipment_type") as string;
      const bookingStatus = formData.get("bulk_booking_status") as string;
      const loadingPort = formData.get("bulk_loading_port") as string;
      const destinationCountry = formData.get(
        "bulk_destination_country"
      ) as string;
      const portOfDischarge = formData.get("bulk_port_of_discharge") as string;
      const deliveryTill = formData.get("bulk_delivery_till") as string;
      const customer = formData.get("bulk_customer") as string;
      const consignee = formData.get("bulk_consignee") as string;
      const sellingPrice = formData.get("bulk_selling_price") as string;
      const buyingPrice = formData.get("bulk_buying_price") as string;
      const commodity = formData.get("bulk_commodity") as string;
      const equipmentType = formData.get("bulk_equipment_type") as string;
      const carrier = formData.get("bulk_carrier") as string;
      const vessel = formData.get("bulk_vessel") as string;

      // Only update fields that have values
      if (businessBranch) fieldsToUpdate.bussiness_branch = businessBranch;
      if (shipmentType) fieldsToUpdate.shipment_type = shipmentType;
      if (bookingStatus) fieldsToUpdate.booking_status = bookingStatus;
      if (sellingPrice)
        fieldsToUpdate.selling_price = parseFloat(sellingPrice) || 0;
      if (buyingPrice)
        fieldsToUpdate.buying_price = parseFloat(buyingPrice) || 0;

      // Container movement fields
      const containerFields: any = {};
      if (loadingPort) containerFields.loading_port = loadingPort;
      if (destinationCountry)
        containerFields.destination_country = destinationCountry;
      if (portOfDischarge) containerFields.port_of_discharge = portOfDischarge;
      if (deliveryTill) containerFields.delivery_till = deliveryTill;
      if (customer) containerFields.customer = customer;
      if (consignee) containerFields.consignee = consignee;
      if (carrier) containerFields.carrier = carrier;
      if (vessel) containerFields.vessel = vessel;

      // Package details fields
      const packageFields: any = {};
      if (commodity) packageFields.commodity = commodity;

      // Equipment details fields
      const equipmentFields: any = {};
      if (equipmentType) equipmentFields.equipment_type = equipmentType;

      if (
        Object.keys(fieldsToUpdate).length === 0 &&
        Object.keys(containerFields).length === 0 &&
        Object.keys(packageFields).length === 0 &&
        Object.keys(equipmentFields).length === 0
      ) {
        return { error: "No fields selected for bulk update" };
      }

      let updatedCount = 0;

      for (const id of ids) {
        const existingPlan = await prisma.shipmentPlan.findUnique({
          where: { id },
        });

        if (
          existingPlan &&
          (user.role.name === "ADMIN" || existingPlan.userId === user.id)
        ) {
          const currentData = existingPlan.data as any;
          const updatedData = { ...currentData };

          // Update root level fields
          Object.keys(fieldsToUpdate).forEach((key) => {
            updatedData[key] = fieldsToUpdate[key];
          });

          // Update container movement fields
          if (Object.keys(containerFields).length > 0) {
            if (!updatedData.container_movement)
              updatedData.container_movement = {};
            Object.keys(containerFields).forEach((key) => {
              updatedData.container_movement[key] = containerFields[key];
            });
          }

          // Update package details fields
          if (Object.keys(packageFields).length > 0) {
            if (!updatedData.package_details)
              updatedData.package_details = [{}];
            if (!updatedData.package_details[0])
              updatedData.package_details[0] = {};
            Object.keys(packageFields).forEach((key) => {
              updatedData.package_details[0][key] = packageFields[key];
            });
          }

          // Update equipment details fields
          if (Object.keys(equipmentFields).length > 0) {
            if (!updatedData.equipment_details)
              updatedData.equipment_details = [{}];
            if (!updatedData.equipment_details[0])
              updatedData.equipment_details[0] = {};
            Object.keys(equipmentFields).forEach((key) => {
              updatedData.equipment_details[0][key] = equipmentFields[key];
            });
          }

          await prisma.shipmentPlan.update({
            where: { id },
            data: { data: updatedData },
          });

          updatedCount++;
        }
      }

      return {
        success: `${updatedCount} shipment plan(s) updated successfully`,
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
  const { user, shipmentPlans, pagination, search, dataPoints } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [pendingDeletionIds, setPendingDeletionIds] = useState<string[]>([]);
  const isSubmitting = navigation.state === "submitting";
  const { addToast } = useToast();

  // Handle confirmation modal opening when action returns needsConfirmation
  useEffect(() => {
    if (actionData?.needsConfirmation) {
      setIsConfirmationModalOpen(true);
      setPendingDeletionIds(selectedIds);
    }
  }, [actionData, selectedIds]);

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

  // Handle confirmation choice
  const handleDeletionConfirmation = (choice: 'delete_both' | 'orphan_assignments', reason?: string) => {
    const form = document.createElement('form');
    form.method = 'post';
    form.style.display = 'none';
    
    // Add action and choice
    form.appendChild(createHiddenInput('action', 'delete'));
    form.appendChild(createHiddenInput('deleteChoice', choice));
    if (reason) {
      form.appendChild(createHiddenInput('deletionReason', reason));
    }
    
    // Add selected IDs
    pendingDeletionIds.forEach(id => {
      form.appendChild(createHiddenInput('selectedIds', id));
    });
    
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
    
    setIsConfirmationModalOpen(false);
    setPendingDeletionIds([]);
  };

  // Helper function to create hidden inputs
  const createHiddenInput = (name: string, value: string) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    return input;
  };

  // Column definitions for the table
  // Define base columns available to all users
  const baseColumns = [
    { id: "checkbox", label: "Select", defaultVisible: true, locked: true },
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
    { id: "container_status", label: "Container Status", defaultVisible: true },
    { id: "created_date", label: "Created", defaultVisible: true },
    { id: "created_by", label: "Created By", defaultVisible: true },
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

  // Handle select all checkbox
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(shipmentPlans.map((plan: any) => plan.id));
    } else {
      setSelectedIds([]);
    }
  };

  // Handle individual checkbox
  const handleSelectPlan = (planId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, planId]);
    } else {
      setSelectedIds(selectedIds.filter((id) => id !== planId));
    }
  };

  // Function to determine milestone status based on equipment details
  const getMilestoneStatus = (plan: any) => {
    const equipmentDetails = plan.data?.equipment_details || [];
    if (equipmentDetails.length === 0) return "No Equipment";

    // Count equipments with each milestone completed
    let emptyPickupCompleted = 0;
    let stuffingCompleted = 0;
    let gateInCompleted = 0;
    let loadedCompleted = 0;
    const totalEquipments = equipmentDetails.length;

    equipmentDetails.forEach((equipment: any) => {
      if (equipment.emptyPickupStatus && equipment.emptyPickupDate) emptyPickupCompleted++;
      if (equipment.stuffingStatus && equipment.stuffingDate) stuffingCompleted++;
      if (equipment.gateInStatus && equipment.gateInDate) gateInCompleted++;
      if (equipment.loadedStatus && equipment.loadedDate) loadedCompleted++;
    });

    // Determine current milestone status
    if (loadedCompleted === totalEquipments) {
      return "Loaded on Vessel";
    } else if (gateInCompleted === totalEquipments) {
      return "Gate In Completed";
    } else if (stuffingCompleted === totalEquipments) {
      return "Container Stuffing Completed";
    } else if (emptyPickupCompleted === totalEquipments) {
      return "Empty Container Picked Up";
    } else if (emptyPickupCompleted > 0) {
      return `Empty Pickup: ${emptyPickupCompleted}/${totalEquipments}`;
    } else if (stuffingCompleted > 0) {
      return `Stuffing: ${stuffingCompleted}/${totalEquipments}`;
    } else if (gateInCompleted > 0) {
      return `Gate In: ${gateInCompleted}/${totalEquipments}`;
    } else if (loadedCompleted > 0) {
      return `Loaded: ${loadedCompleted}/${totalEquipments}`;
    } else {
      return "Pending";
    }
  };

  const getMilestoneStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; bg: string; border: string; icon: string }> = {
      "Loaded on Vessel": {
        color: "text-green-800",
        bg: "bg-green-100",
        border: "border-green-300",
        icon: "🚢"
      },
      "Gate In Completed": {
        color: "text-blue-800",
        bg: "bg-blue-100",
        border: "border-blue-300",
        icon: "🚪"
      },
      "Container Stuffing Completed": {
        color: "text-purple-800",
        bg: "bg-purple-100",
        border: "border-purple-300",
        icon: "📦"
      },
      "Empty Container Picked Up": {
        color: "text-yellow-800",
        bg: "bg-yellow-100",
        border: "border-yellow-300",
        icon: "🚛"
      },
      "Pending": {
        color: "text-gray-600",
        bg: "bg-gray-100",
        border: "border-gray-300",
        icon: "⏳"
      },
      "No Equipment": {
        color: "text-gray-500",
        bg: "bg-gray-50",
        border: "border-gray-200",
        icon: "❌"
      }
    };

    // Handle partial statuses (e.g., "Empty Pickup: 2/3")
    let config = statusConfig[status];
    if (!config) {
      if (status.includes("Empty Pickup:")) {
        config = {
          color: "text-orange-800",
          bg: "bg-orange-100",
          border: "border-orange-300",
          icon: "🚛"
        };
      } else if (status.includes("Stuffing:")) {
        config = {
          color: "text-purple-800",
          bg: "bg-purple-100",
          border: "border-purple-300",
          icon: "📦"
        };
      } else if (status.includes("Gate In:")) {
        config = {
          color: "text-blue-800",
          bg: "bg-blue-100",
          border: "border-blue-300",
          icon: "🚪"
        };
      } else if (status.includes("Loaded:")) {
        config = {
          color: "text-green-800",
          bg: "bg-green-100",
          border: "border-green-300",
          icon: "🚢"
        };
      } else {
        config = statusConfig["Pending"];
      }
    }

    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
          config.bg
        } ${config.color} border ${config.border}`}
      >
        <span className="mr-1">{config.icon}</span>
        {status}
      </span>
    );
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
      case "checkbox":
        return (
          <TableCell key={columnId} className="pl-6 sticky left-0 z-20 bg-white">
            <div onClick={(event) => event.stopPropagation()}>
              <Checkbox
                checked={selectedIds.includes(plan.id)}
                onChange={(e) => handleSelectPlan(plan.id, e.target.checked)}
              />
            </div>
          </TableCell>
        );
      case "reference_number":
        return (
          <TableCell key={columnId} className="font-semibold text-gray-900 sticky left-12 z-20 bg-white shadow-[2px_0_5px_-1px_rgba(0,0,0,0.08)]">
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
      case "container_status":
        return (
          <TableCell key={columnId}>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                plan.data.container_status === "Booked"
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              } border border-gray-200`}
            >
              {plan.data.container_status || "N/A"}
            </span>
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
          <TableCell key={columnId}>
            {getMilestoneStatusBadge(getMilestoneStatus(plan))}
          </TableCell>
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
            {(plan.data as any).package_details?.[0]?.shipper || "N/A"}
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
        <div className="px-6 py-6">
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
      <div className="flex-1 overflow-hidden p-6 bg-gray-50 flex flex-col">
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
        {/* Enhanced Search and Actions */}
        <div className="mb-4 shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
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
                        className="pl-10 pr-4 py-3 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg"
                    >
                      Search
                    </Button>
                    {search && (
                      <Link to="/shipment-plans">
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
        </div>
        {/* Enhanced Shipment Plans Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col flex-1 min-h-0">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white shrink-0">
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
                {selectedIds.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {selectedIds.length} selected
                    </span>
                    <Button
                      size="sm"
                      onClick={() => setIsBulkEditModalOpen(true)}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                      disabled={isSubmitting}
                    >
                      ✏️ Bulk Edit
                    </Button>
                    <Form method="post">
                      <input type="hidden" name="action" value="delete" />
                      {selectedIds.map((id) => (
                        <input
                          key={id}
                          type="hidden"
                          name="selectedIds"
                          value={id}
                        />
                      ))}
                      <Button
                        type="submit"
                        size="sm"
                        className="bg-red-500 hover:bg-red-600 text-white"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Deleting..." : "Delete Selected"}
                      </Button>
                    </Form>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="overflow-auto flex-1 min-h-0">
            <Table>
              <TableHeader className="bg-gradient-to-r from-slate-50 to-gray-50 sticky top-0 z-10">
                <TableRow className="border-gray-200">
                  {visibleColumns.map((columnId) => {
                    const column = availableColumns.find(
                      (col) => col.id === columnId
                    );
                    if (!column) return null;

                    if (columnId === "checkbox") {
                      return (
                        <TableHead key={columnId} className="w-12 pl-6 sticky left-0 z-30 bg-slate-50">
                          <Checkbox
                            checked={
                              selectedIds.length === shipmentPlans.length &&
                              shipmentPlans.length > 0
                            }
                            onChange={(e) => handleSelectAll(e.target.checked)}
                          />
                        </TableHead>
                      );
                    }

                    if (columnId === "reference_number") {
                      return (
                        <TableHead
                          key={columnId}
                          className="font-semibold text-gray-900 text-sm sticky left-12 z-30 bg-slate-50 shadow-[2px_0_5px_-1px_rgba(0,0,0,0.1)]"
                        >
                          {column.label}
                        </TableHead>
                      );
                    }

                    return (
                      <TableHead
                        key={columnId}
                        className="font-semibold text-gray-900 text-sm"
                      >
                        {column.label}
                      </TableHead>
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
          </div>
        </div>{" "}
        {/* Enhanced Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-4 shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4">
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
          </div>
        )}
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

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        selectedIds={selectedIds}
        isSubmitting={isSubmitting}
        dataPoints={dataPoints}
      />

      {/* Shipment Deletion Confirmation Modal */}
      <ShipmentDeletionConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={() => {
          setIsConfirmationModalOpen(false);
          setPendingDeletionIds([]);
        }}
        linkedAssignments={actionData?.linkedAssignments || []}
        onConfirm={handleDeletionConfirmation}
        isSubmitting={isSubmitting}
      />
    </AdminLayout>
  );
}
