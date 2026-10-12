import { prisma } from "~/lib/prisma.server"

export const LINER_BROKER_REQUIRED_ERROR =
  "Please assign a Liner Broker before approving this shipment plan."

/**
 * Finds who a shipment was previously assigned to, by reference number.
 *
 * Approving an unmapping detaches a plan from its shipment assignment; the next
 * save creates a fresh assignment. Without this lookup the fresh assignment has
 * no assignee, because the broker field is not part of that form.
 * Returns null when there is no previous assignee or that user no longer exists.
 */
export async function findPreviousAssigneeId(referenceNumber: string | null | undefined): Promise<string | null> {
  if (!referenceNumber) return null

  const previous = await prisma.shipmentAssignment.findFirst({
    where: {
      assignBookingId: { not: null },
      data: { path: ["reference_number"], equals: referenceNumber },
    },
    orderBy: { createdAt: "desc" },
    select: { assignBookingId: true },
  })
  if (!previous?.assignBookingId) return null

  const assignee = await prisma.user.findUnique({
    where: { id: previous.assignBookingId },
    select: { id: true },
  })
  return assignee?.id ?? null
}
