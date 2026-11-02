import assert from "node:assert/strict"
import { test } from "node:test"
import {
  BRANCH_NOT_ALLOWED_ERROR,
  BRANCH_REQUIRED_ERROR,
  checkBranchAllowed,
  resolveEditPlanBranch,
  resolveNewPlanBranch,
} from "../app/lib/business-branch-rules.ts"

const planner = { role: { name: "SHIPMENT_PLAN_TEAM" }, businessBranch: { name: "Mumbai" } }
const plannerWithoutBranch = { role: { name: "SHIPMENT_PLAN_TEAM" }, businessBranch: null }
const admin = { role: { name: "ADMIN" }, businessBranch: null }

test("new plan without a branch is rejected, drafts included", () => {
  assert.deepEqual(resolveNewPlanBranch(planner, null), { error: BRANCH_REQUIRED_ERROR })
  assert.deepEqual(resolveNewPlanBranch(planner, ""), { error: BRANCH_REQUIRED_ERROR })
  assert.deepEqual(resolveNewPlanBranch(planner, "   "), { error: BRANCH_REQUIRED_ERROR })
})

test("planner can only create plans for their own branch", () => {
  assert.deepEqual(resolveNewPlanBranch(planner, "Mumbai"), { branch: "Mumbai", isNewlyAssigned: true })
  assert.deepEqual(resolveNewPlanBranch(planner, "Kolkata"), { error: BRANCH_NOT_ALLOWED_ERROR })
  assert.equal(checkBranchAllowed(plannerWithoutBranch, "Mumbai"), BRANCH_NOT_ALLOWED_ERROR)
})

test("admin can create plans for any branch", () => {
  assert.deepEqual(resolveNewPlanBranch(admin, "Kolkata"), { branch: "Kolkata", isNewlyAssigned: true })
})

test("edit keeps the existing branch and ignores any posted branch", () => {
  assert.deepEqual(resolveEditPlanBranch(planner, "Mumbai", "Kolkata"), { branch: "Mumbai", isNewlyAssigned: false })
  assert.deepEqual(resolveEditPlanBranch(admin, "Mumbai", ""), { branch: "Mumbai", isNewlyAssigned: false })
})

test("edit of a branchless plan requires an allowed branch", () => {
  assert.deepEqual(resolveEditPlanBranch(planner, null, ""), { error: BRANCH_REQUIRED_ERROR })
  assert.deepEqual(resolveEditPlanBranch(planner, "", "Kolkata"), { error: BRANCH_NOT_ALLOWED_ERROR })
  assert.deepEqual(resolveEditPlanBranch(planner, null, "Mumbai"), { branch: "Mumbai", isNewlyAssigned: true })
})
