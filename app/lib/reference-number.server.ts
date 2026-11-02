import type { Prisma } from "@prisma/client"
import { prisma } from "~/lib/prisma.server"
import { applyReferenceNumber, buildNextReferenceNumber, isPlaceholderReference } from "~/lib/reference-number"

type Db = Prisma.TransactionClient

type ReferenceResult = { referenceNumber: string } | { error: string }

// Interactive transactions that take the reference lock may queue behind each
// other; allow longer than Prisma's 5s default before giving up.
export const REFERENCE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const

async function computeNextReference(db: Db, branchCode: string, year: number): Promise<string> {
  // Only the reference strings are needed, not each plan's full JSON payload
  const rows = await db.$queryRaw<{ ref: string }[]>`
    SELECT data->>'reference_number' AS ref
    FROM shipment_plans
    WHERE data->>'reference_number' LIKE ${`${branchCode}${year}%`}`
  return buildNextReferenceNumber(branchCode, year, rows.map((row) => row.ref))
}

// Serialises reference allocation per {BusinessCode}{Year} until the
// surrounding transaction ends, so two concurrent saves cannot both take the
// same next number.
export async function lockReferenceSequence(tx: Db, branchCode: string, year: number | string): Promise<void> {
  const lockKey = `shipment_plan_reference:${branchCode.toUpperCase()}${year}`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`
}

// Previews the next {BusinessCode}{Year}{4-digit sequence} reference for a
// business branch (looked up by name). Not reserved: use reserveReferenceNumber
// inside the transaction that saves the plan.
export async function generateReferenceNumber(branchName: string, db: Db = prisma): Promise<ReferenceResult> {
  const businessBranch = await db.businessBranch.findFirst({ where: { name: branchName } })
  if (!businessBranch) {
    return { error: "Invalid business branch selected" }
  }
  const branchCode = businessBranch.code.toUpperCase()
  return { referenceNumber: await computeNextReference(db, branchCode, new Date().getFullYear()) }
}

// Locks the branch/year sequence and returns the next free reference. The
// caller must write the plan with it in the same transaction `tx`.
export async function reserveReferenceNumber(tx: Db, branchName: string): Promise<ReferenceResult> {
  const businessBranch = await tx.businessBranch.findFirst({ where: { name: branchName } })
  if (!businessBranch) {
    return { error: "Invalid business branch selected" }
  }
  const branchCode = businessBranch.code.toUpperCase()
  const year = new Date().getFullYear()
  await lockReferenceSequence(tx, branchCode, year)
  return { referenceNumber: await computeNextReference(tx, branchCode, year) }
}

// Replaces a plan's placeholder (DRAFT...) reference with a real one for its
// business branch, atomically: the plan gets the branch and new reference, and
// every shipment assignment / liner booking still carrying the old reference
// (including unlinked history used for assignee lookups) is rewritten too.
// Safe to call twice (e.g. a double-submit): a plan that already has a real
// reference just returns it.
export async function assignReferenceToPlan(planId: string, branchName: string): Promise<ReferenceResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      // Row lock so concurrent saves of the same plan run one after the other
      await tx.$executeRaw`SELECT id FROM shipment_plans WHERE id = ${planId} FOR UPDATE`
      const plan = await tx.shipmentPlan.findUnique({ where: { id: planId }, select: { data: true } })
      const oldReference = (plan?.data as any)?.reference_number
      if (!plan || typeof oldReference !== "string") {
        return { error: "Shipment plan not found" }
      }
      if (!isPlaceholderReference(oldReference)) {
        return { referenceNumber: oldReference }
      }

      const reserved = await reserveReferenceNumber(tx, branchName)
      if ("error" in reserved) return reserved
      const { referenceNumber } = reserved

      const planData = applyReferenceNumber({ ...(plan.data as any), bussiness_branch: branchName }, referenceNumber)
      await tx.shipmentPlan.update({ where: { id: planId }, data: { data: planData } })

      const byOldReference = { data: { path: ["reference_number"], equals: oldReference } }
      const [assignments, bookings] = await Promise.all([
        tx.shipmentAssignment.findMany({ where: byOldReference, select: { id: true, data: true } }),
        tx.linerBooking.findMany({ where: byOldReference, select: { id: true, data: true } }),
      ])
      for (const assignment of assignments) {
        await tx.shipmentAssignment.update({
          where: { id: assignment.id },
          data: { data: applyReferenceNumber(assignment.data as any, referenceNumber) },
        })
      }
      for (const booking of bookings) {
        await tx.linerBooking.update({
          where: { id: booking.id },
          data: { data: applyReferenceNumber(booking.data as any, referenceNumber) },
        })
      }

      return { referenceNumber }
    }, REFERENCE_TRANSACTION_OPTIONS)
  } catch (error) {
    console.error("Failed to assign reference number to shipment plan:", planId, error)
    return { error: "Could not assign a reference number. Please try again." }
  }
}
