import { prisma } from "~/lib/prisma.server"
import { buildPlanCancelledEmail, formatEquipmentSummary } from "~/lib/emails/plan-cancelled-email"

// Emails the liner broker whose MD-approved (still unbooked) assignment was
// withdrawn when the shipment plan was cancelled. Never throws: the
// cancellation has already been saved, so a mail problem is only logged.
export async function notifyAssignmentWithdrawn(
  assigneeId: string,
  planData: any,
  cancelledBy: string,
  cancellationRemark: string,
): Promise<void> {
  try {
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { email: true, isActive: true },
    })
    if (!assignee?.email || !assignee.isActive) {
      console.log("[SOFT_CANCEL] No active liner broker email to notify for assignee:", assigneeId)
      return
    }

    const containerMovement = planData?.container_movement || {}
    const baseUrl = process.env.BASE_URL || "http://localhost:5173"
    const email = buildPlanCancelledEmail({
      referenceNumber: planData?.reference_number || "N/A",
      customer: containerMovement.customer || "N/A",
      businessBranch: planData?.bussiness_branch || "N/A",
      cancelledBy,
      cancellationRemark,
      equipmentSummary: formatEquipmentSummary(planData?.equipment_details),
      portOfLoading: containerMovement.loading_port || "N/A",
      portOfDischarge: containerMovement.port_of_discharge || "N/A",
      linerBookingsUrl: `${baseUrl}/liner-bookings`,
    })

    // Dynamic import, as elsewhere, to avoid loading the mail transport eagerly
    const { emailService } = await import("~/lib/email.server")
    const sent = await emailService.sendEmail({ to: assignee.email, ...email })
    console.log(`[SOFT_CANCEL] Assignment withdrawn notification ${sent ? "sent" : "FAILED"} to ${assignee.email}`)
  } catch (error) {
    console.error("[SOFT_CANCEL] Failed to notify liner broker of withdrawn assignment:", error)
  }
}
