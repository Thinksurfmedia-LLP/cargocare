import type { ActionFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { emailService } from "~/lib/email.server";
import { schedulerService } from "~/lib/scheduler.server";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request);

    // Only allow ADMIN users to test emails
    if (user.role.name !== "ADMIN") {
      return json({ error: "Unauthorized - Admin access required" }, { status: 403 });
    }

    const formData = await request.formData();
    const testType = formData.get("testType") as string;

    if (testType === "new-approval") {
      // Test new approval notification
      const mdUsers = await prisma.user.findMany({
        where: {
          role: { name: "MD" },
          isActive: true,
        },
        select: { email: true },
      });

      const mdEmails = mdUsers.map((u: any) => u.email);

      if (mdEmails.length === 0) {
        return json({ error: "No active MD users found" }, { status: 400 });
      }

      const adminUsersForTest = await prisma.user.findMany({
        where: { role: { name: "ADMIN" }, isActive: true },
        select: { email: true },
      });
      const allRecipientEmails = [...new Set([...mdEmails, ...adminUsersForTest.map((u: any) => u.email)])];

      const baseUrl = process.env.BASE_URL || "http://localhost:3000";

      const success = await emailService.sendNewApprovalNotification(allRecipientEmails, {
        referenceNumber: "TEST-001",
        customer: "Test Customer Ltd",
        businessBranch: "Mumbai Branch",
        createdBy: user.name,
        salesPerson: "John Doe",
        equipmentType: "20' Standard",
        numberOfEquipments: 5,
        portOfLoading: "Nhava Sheva, India",
        portOfDischarge: "Singapore Port",
        finalPlaceOfDelivery: "Warehouse District, Singapore",
        pendingApprovalsUrl: `${baseUrl}/pending-approvals`,
        shipmentType: "Consolidated",
        shipperNames: "ABC Trading Co, XYZ Exports Ltd",
      });

      return json({
        success,
        message: success
          ? `Test new approval notification sent to ${allRecipientEmails.length} recipient(s)`
          : "Failed to send test email",
        recipients: allRecipientEmails,
      });
    }

    if (testType === "daily-reminder") {
      // Test daily reminder notification
      const mdUsers = await prisma.user.findMany({
        where: {
          role: { name: "MD" },
          isActive: true,
        },
        select: { email: true },
      });

      const mdEmails = mdUsers.map((u: any) => u.email);

      if (mdEmails.length === 0) {
        return json({ error: "No active MD users found" }, { status: 400 });
      }

      const adminUsersForReminderTest = await prisma.user.findMany({
        where: { role: { name: "ADMIN" }, isActive: true },
        select: { email: true },
      });
      const allReminderEmails = [...new Set([...mdEmails, ...adminUsersForReminderTest.map((u: any) => u.email)])];

      const testShipments = [
        {
          referenceNumber: "TEST-001",
          customer: "Test Customer 1",
          businessBranch: "Mumbai Branch",
          equipmentType: "20' Standard",
          numberOfEquipments: 5,
          portOfLoading: "Nhava Sheva, India",
          portOfDischarge: "Singapore Port",
          finalPlaceOfDelivery: "Warehouse District, Singapore",
          createdAt: new Date().toISOString(),
        },
        {
          referenceNumber: "TEST-002",
          customer: "Test Customer 2",
          businessBranch: "Delhi Branch",
          equipmentType: "40' High Cube",
          numberOfEquipments: 3,
          portOfLoading: "Mumbai Port",
          portOfDischarge: "Dubai Port",
          finalPlaceOfDelivery: "Dubai Industrial Area",
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      const baseUrl = process.env.BASE_URL || "http://localhost:3000";

      const success = await emailService.sendDailyReminderNotification(
        allReminderEmails,
        testShipments.length,
        testShipments,
        `${baseUrl}/pending-approvals`
      );

      return json({
        success,
        message: success
          ? `Test daily reminder sent to ${allReminderEmails.length} recipient(s)`
          : "Failed to send test email",
        recipients: allReminderEmails,
      });
    }

    if (testType === "trigger-reminder") {
      // Manually trigger the daily reminder job
      await schedulerService.triggerReminderNow();

      return json({
        success: true,
        message: "Daily reminder job triggered manually",
      });
    }

    return json({ error: "Invalid test type. Use: new-approval, daily-reminder, or trigger-reminder" }, { status: 400 });

  } catch (error) {
    console.error("Email test error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}