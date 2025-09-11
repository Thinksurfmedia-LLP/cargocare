import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";

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

    // Search functionality - search within JSONB data
    if (search) {
      whereCondition.OR = [
        {
          data: {
            path: ["loadingPort"],
            string_contains: search,
          },
        },
        {
          data: {
            path: ["destinationCountry"],
            string_contains: search,
          },
        },
        {
          data: {
            path: ["customer"],
            string_contains: search,
          },
        },
        {
          data: {
            path: ["portOfDischarge"],
            string_contains: search,
          },
        },
        {
          data: {
            path: ["carrierName"],
            string_contains: search,
          },
        },
        {
          data: {
            path: ["vesselName"],
            string_contains: search,
          },
        },
      ];
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
              error: "Invalid container number format. Must be 4 letters followed by 7 digits (e.g., ABCD1234567)" 
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
