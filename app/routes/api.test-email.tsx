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

      const baseUrl = process.env.BASE_URL || "http://localhost:3000";

      const success = await emailService.sendNewApprovalNotification(mdEmails, {
        referenceNumber: "TEST-001",
        customer: "Test Customer Ltd",
        businessBranch: "Mumbai Branch",
        createdBy: user.name,
        pendingApprovalsUrl: `${baseUrl}/pending-approvals`,
      });

      return json({
        success,
        message: success
          ? `Test new approval notification sent to ${mdEmails.length} MD(s)`
          : "Failed to send test email",
        recipients: mdEmails,
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

      const testShipments = [
        {
          referenceNumber: "TEST-001",
          customer: "Test Customer 1",
          businessBranch: "Mumbai Branch",
          createdAt: new Date().toISOString(),
        },
        {
          referenceNumber: "TEST-002",
          customer: "Test Customer 2",
          businessBranch: "Delhi Branch",
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      const baseUrl = process.env.BASE_URL || "http://localhost:3000";

      const success = await emailService.sendDailyReminderNotification(
        mdEmails,
        testShipments.length,
        testShipments,
        `${baseUrl}/pending-approvals`
      );

      return json({
        success,
        message: success
          ? `Test daily reminder sent to ${mdEmails.length} MD(s)`
          : "Failed to send test email",
        recipients: mdEmails,
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