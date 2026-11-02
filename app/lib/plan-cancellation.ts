// Rules for cancelling (soft) and deleting (hard) shipment plans. Pure
// functions so the server can enforce them and they can be unit tested.

export const CANCELLATION_REMARK_MAX_LENGTH = 1000
export const CANCEL_PERMISSION_ERROR = "You don't have permission to cancel this shipment plan"
export const CANCELLATION_REMARK_REQUIRED_ERROR = "Please add a remark explaining why this shipment plan is being cancelled"
export const CANCELLATION_REMARK_TOO_LONG_ERROR = `Cancellation remark must be ${CANCELLATION_REMARK_MAX_LENGTH} characters or fewer`
export const CANCEL_BLOCKED_BOOKED_ERROR =
  "This shipment plan already has booking activity. Unmap every booked container (approve unmapping) before cancelling."

const UNBOOKED_ASSIGNMENT_STATUS = "Awaiting Booking"

// Admin and the Shipment Planning team can cancel; only Admin can delete.
export function canCancelPlan(roleName: string): boolean {
  return roleName === "ADMIN" || roleName === "SHIPMENT_PLAN_TEAM"
}

export function canDeletePlan(roleName: string): boolean {
  return roleName === "ADMIN"
}

export function validateCancellationRemark(remark: unknown): { remark: string } | { error: string } {
  const trimmed = typeof remark === "string" ? remark.trim() : ""
  if (!trimmed) return { error: CANCELLATION_REMARK_REQUIRED_ERROR }
  if (trimmed.length > CANCELLATION_REMARK_MAX_LENGTH) return { error: CANCELLATION_REMARK_TOO_LONG_ERROR }
  return { remark: trimmed }
}

export interface CancellationLinks {
  hasLinerBooking: boolean
  assignment: { status: unknown; linerBookingDetailsCount: number } | null
  pendingUnmappingRequests: number
}

// A plan the MD approved but nobody has booked yet only carries an untouched
// shipment assignment (status "Awaiting Booking", no liner booking details).
export function isUnbookedAssignment(assignment: CancellationLinks["assignment"]): boolean {
  return (
    assignment !== null &&
    assignment.status === UNBOOKED_ASSIGNMENT_STATUS &&
    assignment.linerBookingDetailsCount === 0
  )
}

// Returns why the plan cannot be cancelled yet, or null when it can. Plans
// with nothing linked, or only an unbooked assignment, can be cancelled; any
// booking activity must be unmapped first.
export function getCancelBlocker(links: CancellationLinks): string | null {
  if (links.hasLinerBooking || links.pendingUnmappingRequests > 0) return CANCEL_BLOCKED_BOOKED_ERROR
  if (links.assignment && !isUnbookedAssignment(links.assignment)) return CANCEL_BLOCKED_BOOKED_ERROR
  return null
}

export const CANCELLED_PLAN_ASSIGNMENT_ERROR =
  "The shipment plan for this assignment has been cancelled, so it can no longer be changed."

export function isPlanCancelled(planData: unknown): boolean {
  return (planData as { booking_status?: unknown } | null)?.booking_status === "Cancelled"
}

// Prisma `where` fragment for shipment assignments: hides any assignment whose
// shipment plan is cancelled (the Liner Booking team must never see those).
export const EXCLUDE_CANCELLED_PLAN_ASSIGNMENTS = {
  NOT: { shipmentPlan: { is: { data: { path: ["booking_status"], equals: "Cancelled" } } } },
}

export function countLinerBookingDetails(assignmentData: unknown): number {
  const details = (assignmentData as { liner_booking_details?: unknown } | null)?.liner_booking_details
  return Array.isArray(details) ? details.length : 0
}
