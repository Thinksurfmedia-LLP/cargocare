import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { emailService } from "~/lib/email.server";
import { schedulerService } from "~/lib/scheduler.server";

// Initialize scheduler on first API call
let schedulerInitialized = false;
function ensureSchedulerInitialized() {
  if (!schedulerInitialized) {
    try {
      schedulerService.init();
      schedulerInitialized = true;
    } catch (error) {
      console.error("Failed to initialize scheduler:", error);
    }
  }
}

// Helper function to create JSON responses
function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    let whereCondition: any = {};
    
    // Role-based access control
    if (user.role.name !== "ADMIN") {
      whereCondition.userId = user.id;
    }

    // Search functionality - use raw SQL with ILIKE for case-insensitive search
    if (search) {
      try {
        const matchingIds = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->>'loadingPort' ILIKE ${`%${search}%`}
          OR data->>'destinationCountry' ILIKE ${`%${search}%`}
          OR data->>'customer' ILIKE ${`%${search}%`}
          OR data->>'portOfDischarge' ILIKE ${`%${search}%`}
          OR data->>'carrierName' ILIKE ${`%${search}%`}
          OR data->>'vesselName' ILIKE ${`%${search}%`}
        `;

        const ids = (matchingIds as any[]).map((row: any) => row.id);
        
        if (ids.length > 0) {
          if (whereCondition.userId) {
            // If we have user filtering, combine with search
            whereCondition.AND = [
              { userId: whereCondition.userId },
              { id: { in: ids } }
            ];
            delete whereCondition.userId;
          } else {
            whereCondition.id = { in: ids };
          }
        } else {
          // No matches found
          whereCondition.id = { in: [] };
        }
      } catch (error) {
        console.error("Error in search:", error);
      }
    }

    const [shipmentPlans, totalCount] = await Promise.all([
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
    ]);

    return json({
      shipmentPlans,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    ensureSchedulerInitialized();
    const user = await requireAuth(request);
    const method = request.method;

    if (method === "POST") {
      const contentType = request.headers.get("content-type") || "";
      
      // Handle JSON requests (for container number updates)
      if (contentType.includes("application/json")) {
        const body = await request.json();
        
        // Check if this is a container number update request
        if (body.action === "update_container_number") {
          // Only allow SHIPMENT_PLAN_TEAM and ADMIN
          if (user.role.name !== "SHIPMENT_PLAN_TEAM" && user.role.name !== "ADMIN") {
            return json({ error: "Unauthorized" }, { status: 403 });
          }

          const { shipmentPlanId, equipmentIndex, trackingNumber, containerNumber } = body;

          console.log("[API] shipment-plans container number update:", {
            shipmentPlanId,
            equipmentIndex,
            trackingNumber,
            containerNumber,
            userId: user.id,
          });

          // Validate required fields
          if (!shipmentPlanId || equipmentIndex === undefined || !trackingNumber || !containerNumber) {
            return json({ 
              error: "Missing required fields: shipmentPlanId, equipmentIndex, trackingNumber, containerNumber" 
            }, { status: 400 });
          }

          // Validate container number format
          const containerPattern = /^[A-Z]{4}[0-9]{7}$/;
          if (!containerPattern.test(containerNumber)) {
            return json({
              error: "Invalid container number format. Must be 4 letters followed by 7 digits (e.g., XXXX0000000)"
            }, { status: 400 });
          }

          // Get the current shipment plan
          const shipmentPlan = await prisma.shipmentPlan.findUnique({
            where: { id: shipmentPlanId },
          });

          if (!shipmentPlan) {
            return json({ error: "Shipment plan not found" }, { status: 404 });
          }

          const planData = shipmentPlan.data as any;

          // Validate that the equipment exists
          if (!planData.equipment_details || !Array.isArray(planData.equipment_details)) {
            return json({ error: "No equipment details found in shipment plan" }, { status: 400 });
          }

          if (equipmentIndex >= planData.equipment_details.length || equipmentIndex < 0) {
            return json({ error: "Invalid equipment index" }, { status: 400 });
          }

          const equipment = planData.equipment_details[equipmentIndex];

          // Verify the tracking number matches (additional safety check)
          if (equipment.trackingNumber !== trackingNumber) {
            return json({ 
              error: `Tracking number mismatch. Expected: ${equipment.trackingNumber}, received: ${trackingNumber}` 
            }, { status: 400 });
          }

          // Update the equipment with the container number
          const updatedEquipmentDetails = [...planData.equipment_details];
          updatedEquipmentDetails[equipmentIndex] = {
            ...equipment,
            container_number: containerNumber
          };

          const updatedPlanData = {
            ...planData,
            equipment_details: updatedEquipmentDetails
          };

          // Save to database
          await prisma.shipmentPlan.update({
            where: { id: shipmentPlanId },
            data: {
              data: updatedPlanData,
            },
          });

          console.log(`[API] Container number ${containerNumber} saved for equipment ${trackingNumber} in plan ${shipmentPlanId}`);

          return json({ 
            success: true, 
            message: `Container number ${containerNumber} saved successfully`,
            data: {
              equipmentIndex,
              trackingNumber,
              containerNumber,
              shipmentPlanId
            }
          });
        }
      }
      
      // Create new shipment plan
      const formData = await request.formData();
      const dataString = formData.get("data") as string;
      
      if (!dataString) {
        return json({ error: "Data is required" }, { status: 400 });
      }

      let data;
      try {
        data = JSON.parse(dataString);
      } catch {
        return json({ error: "Invalid JSON data" }, { status: 400 });
      }

      const shipmentPlan = await prisma.shipmentPlan.create({
        data: {
          data,
          userId: user.id,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Send email notification to MDs if this is a new approval request
      console.log("📧 Checking if email should be sent for booking_status:", data.booking_status);
      if (data.booking_status === "Awaiting MD Approval") {
        console.log("✅ Booking status matches 'Awaiting MD Approval' - proceeding with email");
        try {
          // Get all MD users
          const mdUsers = await prisma.user.findMany({
            where: {
              role: {
                name: "MD",
              },
              isActive: true,
            },
            select: {
              email: true,
            },
          });

          const mdEmails = mdUsers.map((user: any) => user.email);
          const adminUsers = await prisma.user.findMany({
            where: { role: { name: "ADMIN" }, isActive: true },
            select: { email: true },
          });
          const allRecipientEmails = [...new Set([...mdEmails, ...adminUsers.map((u: any) => u.email)])];
          console.log("📋 Found MD users:", mdUsers.length, "Admin users:", adminUsers.length, "All recipients:", allRecipientEmails);

          if (allRecipientEmails.length > 0) {
            const baseUrl = process.env.BASE_URL || "http://localhost:5173";

            console.log("📦 DEBUG - Data keys:", Object.keys(data));

            const containerMovement = data.container_movement || {};
            const equipmentDetails = data.equipment_details || [];

            console.log("📦 DEBUG - Container Movement:", containerMovement);
            console.log("📦 DEBUG - Equipment Details:", equipmentDetails);
            console.log("📦 DEBUG - Reference:", data.reference_number);
            console.log("📦 DEBUG - Branch:", data.bussiness_branch);

            // Group equipment by type and count
            const equipmentCounts = equipmentDetails.reduce((acc: any, eq: any) => {
              if (eq.equipment_type) {
                acc[eq.equipment_type] = (acc[eq.equipment_type] || 0) + 1;
              }
              return acc;
            }, {});

            // Format equipment as "Type (X units)" for each type
            const formattedEquipment = Object.entries(equipmentCounts)
              .map(([type, count]) => `${type} (${count} unit${count !== 1 ? 's' : ''})`)
              .join(", ") || "N/A";

            const emailData = {
              referenceNumber: data.reference_number || "N/A",
              customer: containerMovement.customer || "N/A",
              businessBranch: data.bussiness_branch || "N/A",
              createdBy: shipmentPlan.user.name,
              equipmentType: formattedEquipment,
              numberOfEquipments: equipmentDetails.length || 0,
              portOfLoading: containerMovement.loading_port || "N/A",
              portOfDischarge: containerMovement.port_of_discharge || "N/A",
              finalPlaceOfDelivery: containerMovement.delivery_till || "N/A",
              pendingApprovalsUrl: `${baseUrl}/pending-approvals`,
            };

            console.log("📧 Email Data:", emailData);

            await emailService.sendNewApprovalNotification(allRecipientEmails, emailData);

            console.log(`✅ New approval notification sent to ${allRecipientEmails.length} recipient(s) for shipment plan ${shipmentPlan.id}`);
          } else {
            console.log("⚠️  No MD or ADMIN users found - email not sent");
          }
        } catch (emailError) {
          console.error("❌ Failed to send new approval notification:", emailError);
          // Don't fail the entire request if email fails
        }
      }

      return json({ shipmentPlan }, { status: 201 });
    }

    if (method === "PUT") {
      // Update shipment plan
      const formData = await request.formData();
      const id = formData.get("id") as string;
      const dataString = formData.get("data") as string;

      if (!id || !dataString) {
        return json({ error: "ID and data are required" }, { status: 400 });
      }

      let data;
      try {
        data = JSON.parse(dataString);
      } catch {
        return json({ error: "Invalid JSON data" }, { status: 400 });
      }

      // Check if user owns the shipment plan or is admin
      const existingPlan = await prisma.shipmentPlan.findUnique({
        where: { id },
      });

      if (!existingPlan) {
        return json({ error: "Shipment plan not found" }, { status: 404 });
      }

      if (user.role.name !== "ADMIN" && existingPlan.userId !== user.id) {
        return json({ error: "Forbidden" }, { status: 403 });
      }

      const shipmentPlan = await prisma.shipmentPlan.update({
        where: { id },
        data: { data },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return json({ shipmentPlan });
    }

    if (method === "DELETE") {
      // Delete shipment plan
      const formData = await request.formData();
      const id = formData.get("id") as string;

      if (!id) {
        return json({ error: "ID is required" }, { status: 400 });
      }

      // Check if user owns the shipment plan or is admin
      const existingPlan = await prisma.shipmentPlan.findUnique({
        where: { id },
      });

      if (!existingPlan) {
        return json({ error: "Shipment plan not found" }, { status: 404 });
      }

      if (user.role.name !== "ADMIN" && existingPlan.userId !== user.id) {
        return json({ error: "Forbidden" }, { status: 403 });
      }

      await prisma.shipmentPlan.delete({
        where: { id },
      });

      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    console.error("Shipment plans API error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}
