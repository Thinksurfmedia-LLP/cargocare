// Business branch rules for saving shipment plans. Pure functions so they can
// be enforced server-side and unit tested without a database.

export const BRANCH_REQUIRED_ERROR = "Business branch is required"
export const BRANCH_NOT_ALLOWED_ERROR = "You can only save shipment plans for your assigned business branch"

interface BranchUser {
  role: { name: string }
  businessBranch?: { name: string } | null
}

type BranchResult = { branch: string; isNewlyAssigned: boolean } | { error: string }

function normalize(branch: unknown): string {
  return typeof branch === "string" ? branch.trim() : ""
}

// SHIPMENT_PLAN_TEAM users are limited to their own branch; other roles may
// use any branch.
export function checkBranchAllowed(user: BranchUser, branch: string): string | null {
  if (user.role.name !== "SHIPMENT_PLAN_TEAM") return null
  if (!user.businessBranch?.name || user.businessBranch.name !== branch) return BRANCH_NOT_ALLOWED_ERROR
  return null
}

// Create: a branch is always required, drafts included.
export function resolveNewPlanBranch(user: BranchUser, postedBranch: unknown): BranchResult {
  const branch = normalize(postedBranch)
  if (!branch) return { error: BRANCH_REQUIRED_ERROR }
  const notAllowed = checkBranchAllowed(user, branch)
  if (notAllowed) return { error: notAllowed }
  return { branch, isNewlyAssigned: true }
}

// Edit: once a plan has a branch it can never change, whatever is posted.
// A plan without one (legacy branchless draft) may have it set once.
export function resolveEditPlanBranch(
  user: BranchUser,
  existingBranch: unknown,
  postedBranch: unknown,
): BranchResult {
  const existing = normalize(existingBranch)
  if (existing) return { branch: existing, isNewlyAssigned: false }
  return resolveNewPlanBranch(user, postedBranch)
}
