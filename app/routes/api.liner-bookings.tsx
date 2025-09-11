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
    }    // Search functionality - search within JSONB data
    if (search) {
      whereCondition.OR = [
        {
          shipmentPlan: {
            data: {
              path: ["reference_number"],
              string_contains: search,
            },
          },
        },
        {
          data: {
            path: ["carrier_booking_status"],
            string_contains: search,
          },
        },
        {
          data: {
            path: ["booking_released_to"],
            string_contains: search,
          },
        },
        {
          data: {
            path: ["liner_booking_details"],
            array_contains: [{
              temporary_booking_number: { contains: search }
            }]
          },
        },
        {
          data: {
            path: ["liner_booking_details"],
            array_contains: [{
              carrier: { contains: search }
            }]
          },
        },
        {
          data: {
            path: ["liner_booking_details"],
            array_contains: [{
              liner_booking_number: { contains: search }
            }]
          },
        },
      ];
    }

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
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.linerBooking.count({ where: whereCondition }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return json({
      linerBookings,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
      },
    });
  } catch (error) {
    console.error("Error in liner bookings API:", error);
    return json({ error: "Failed to fetch liner bookings" }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    // Only allow LINER_BOOKING_TEAM and ADMIN
    if (user.role.name !== "LINER_BOOKING_TEAM" && user.role.name !== "ADMIN") {
      return json({ error: "Unauthorized" }, { status: 403 });
    }

    const method = request.method;

    if (method === "POST") {
      // Create new liner booking
      const body = await request.json();
      const { data: linerBookingData } = body;

      if (!linerBookingData) {
        return json({ error: "Booking data is required" }, { status: 400 });
      }

      const linerBooking = await prisma.linerBooking.create({
        data: {
          data: linerBookingData,
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

      return json({ 
        success: true,
        linerBooking,
        message: "Liner booking created successfully"
      });
    }

    if (method === "PUT") {
      // Update existing liner booking
      const body = await request.json();
      const { id, data: linerBookingData } = body;

      if (!id || !linerBookingData) {
        return json({ error: "ID and booking data are required" }, { status: 400 });
      }

      // Check if booking exists and user can edit it
      const existingBooking = await prisma.linerBooking.findUnique({
        where: { id },
      });

      if (!existingBooking) {
        return json({ error: "Liner booking not found" }, { status: 404 });
      }

      if (user.role.name !== "ADMIN" && existingBooking.userId !== user.id) {
        return json({ error: "Unauthorized to edit this booking" }, { status: 403 });
      }

      const updatedBooking = await prisma.linerBooking.update({
        where: { id },
        data: {
          data: linerBookingData,
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

      return json({
        success: true,
        linerBooking: updatedBooking,
        message: "Liner booking updated successfully"
      });
    }

    if (method === "DELETE") {
      // Delete liner booking(s)
      const body = await request.json();
      const { ids } = body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return json({ error: "IDs array is required" }, { status: 400 });
      }

      let whereCondition: any = {
        id: { in: ids },
      };

      // Non-admin users can only delete their own bookings
      if (user.role.name !== "ADMIN") {
        whereCondition.userId = user.id;
      }

      const deletedCount = await prisma.linerBooking.deleteMany({
        where: whereCondition,
      });

      return json({
        success: true,
        deletedCount: deletedCount.count,
        message: `${deletedCount.count} liner booking(s) deleted successfully`
      });
    }

    return json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {    console.error("Error in liner bookings API action:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}
