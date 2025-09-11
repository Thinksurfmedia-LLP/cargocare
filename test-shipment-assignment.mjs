import { prisma } from "../app/lib/prisma.server.js";

async function testShipmentAssignmentModel() {
  try {
    console.log("Testing ShipmentAssignment model...");

    const count = await prisma.shipmentAssignment.count();
    console.log(`ShipmentAssignment table exists! Current count: ${count}`);

    const user = await prisma.user.findFirst();
    if (!user) {
      console.log("No users found in database");
      return;
    }

    const testAssignment = await prisma.shipmentAssignment.create({
      data: {
        userId: user.id,
        data: {
          carrier_booking_status: "confirmed",
          unmapping_request: false,
          unmapping_reason: "",
          booking_released_to: "Test Customer",
          liner_booking_details: [{ temporary_booking_number: "ASSIGN123" }],
        },
      },
    });

    console.log("Test assignment created:", testAssignment.id);

    await prisma.shipmentAssignment.delete({ where: { id: testAssignment.id } });
    console.log("Test assignment deleted successfully");
    console.log("✅ ShipmentAssignment model is working correctly!");
  } catch (error) {
    console.error("❌ Error testing ShipmentAssignment model:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testShipmentAssignmentModel();
