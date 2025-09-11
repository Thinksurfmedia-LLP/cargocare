// Test script to verify Prisma client includes LinerBooking model
import { prisma } from "../app/lib/prisma.server.js";

async function testLinerBookingModel() {
  try {
    console.log("Testing LinerBooking model...");
    
    // Test if the model exists
    const count = await prisma.linerBooking.count();
    console.log(`LinerBooking table exists! Current count: ${count}`);
    
    // Test creating a sample record (we'll delete it immediately)
    console.log("Testing create operation...");
    
    // First get a user ID to test with
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log("No users found in database");
      return;
    }
    
    const testBooking = await prisma.linerBooking.create({
      data: {
        userId: user.id,
        data: {
          carrier_booking_status: "confirmed",
          unmapping_request: false,
          unmapping_reason: "",
          booking_released_to: "Test Customer",
          liner_booking_details: [{
            temporary_booking_number: "TEST123"
          }]
        }
      }
    });
    
    console.log("Test booking created:", testBooking.id);
    
    // Clean up - delete the test record
    await prisma.linerBooking.delete({
      where: { id: testBooking.id }
    });
    
    console.log("Test booking deleted successfully");
    console.log("✅ LinerBooking model is working correctly!");
    
  } catch (error) {
    console.error("❌ Error testing LinerBooking model:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testLinerBookingModel();
