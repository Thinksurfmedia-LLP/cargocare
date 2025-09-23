import cron from 'node-cron';
import { prisma } from './prisma.server';
import { emailService } from './email.server';

class SchedulerService {
  private isInitialized = false;

  init() {
    if (this.isInitialized) {
      console.log('Scheduler already initialized');
      return;
    }

    console.log('Initializing email scheduler...');

    // Schedule daily reminder at 12:00 PM IST (6:30 AM UTC)
    // Cron format: minute hour day month dayOfWeek
    cron.schedule('30 6 * * *', async () => {
      await this.sendDailyReminderEmails();
    });

    this.isInitialized = true;
    console.log('Email scheduler initialized - Daily reminders scheduled for 12:00 PM IST');
  }

  async sendDailyReminderEmails() {
    try {
      console.log('Running daily reminder email job...');

      // Get all pending approvals
      const pendingApprovals = await prisma.shipmentPlan.findMany({
        where: {
          data: {
            path: ["booking_status"],
            equals: "Awaiting MD Approval",
          },
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (pendingApprovals.length === 0) {
        console.log('No pending approvals found - skipping daily reminder');
        return;
      }

      // Get all active MD users
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

      if (mdEmails.length === 0) {
        console.log('No active MD users found - skipping daily reminder');
        return;
      }

      // Prepare shipment data for email
      const shipments = pendingApprovals.map((plan: any) => {
        const planData = plan.data as any;
        return {
          referenceNumber: planData.reference_number || "N/A",
          customer: planData.container_movement?.customer || "N/A",
          businessBranch: planData.bussiness_branch || "N/A",
          createdAt: plan.createdAt.toISOString(),
        };
      });

      const baseUrl = process.env.BASE_URL || "http://localhost:5173";

      // Send reminder email
      const success = await emailService.sendDailyReminderNotification(
        mdEmails,
        pendingApprovals.length,
        shipments,
        `${baseUrl}/pending-approvals`
      );

      if (success) {
        console.log(`Daily reminder sent successfully to ${mdEmails.length} MD(s) for ${pendingApprovals.length} pending approval(s)`);
      } else {
        console.error('Failed to send daily reminder email');
      }
    } catch (error) {
      console.error('Error in daily reminder job:', error);
    }
  }

  // Method to manually trigger reminder (for testing)
  async triggerReminderNow() {
    console.log('Manually triggering daily reminder...');
    await this.sendDailyReminderEmails();
  }

  // Method to check if scheduler is working
  getSchedulerStatus() {
    const tasks = cron.getTasks();
    console.log(`📋 Scheduler Status:`);
    console.log(`- Initialized: ${this.isInitialized}`);
    console.log(`- Active cron tasks: ${tasks.size}`);
    tasks.forEach((task, index) => {
      console.log(`- Task ${index + 1}: Running = ${task.running}, Destroyed = ${task.destroyed}`);
    });
    return {
      initialized: this.isInitialized,
      taskCount: tasks.size,
      tasks: Array.from(tasks).map(task => ({
        running: task.running,
        destroyed: task.destroyed
      }))
    };
  }

  stop() {
    cron.getTasks().forEach(task => task.stop());
    this.isInitialized = false;
    console.log('Email scheduler stopped');
  }
}

export const schedulerService = new SchedulerService();