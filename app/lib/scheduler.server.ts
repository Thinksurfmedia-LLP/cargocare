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

    // Schedule daily reminder at 12:00 PM IST (noon)
    // Cron format: minute hour day month dayOfWeek
    // Using local server time, not UTC
    cron.schedule('0 12 * * *', async () => {
      console.log('⏰ Cron job triggered at:', new Date().toLocaleString());
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
        const containerMovement = planData.container_movement || {};
        const equipmentDetails = planData.equipment_details || [];

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

        return {
          referenceNumber: planData.reference_number || "N/A",
          customer: containerMovement.customer || "N/A",
          businessBranch: planData.bussiness_branch || "N/A",
          equipmentType: formattedEquipment,
          numberOfEquipments: equipmentDetails.length || 0,
          portOfLoading: containerMovement.loading_port || "N/A",
          portOfDischarge: containerMovement.port_of_discharge || "N/A",
          finalPlaceOfDelivery: containerMovement.final_place_of_delivery ?? "N/A",
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