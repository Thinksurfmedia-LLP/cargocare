import assert from "node:assert/strict"
import { test } from "node:test"
import {
  CANCEL_BLOCKED_BOOKED_ERROR,
  CANCELLATION_REMARK_MAX_LENGTH,
  CANCELLATION_REMARK_REQUIRED_ERROR,
  CANCELLATION_REMARK_TOO_LONG_ERROR,
  canCancelPlan,
  canDeletePlan,
  countLinerBookingDetails,
  getCancelBlocker,
  isPlanCancelled,
  validateCancellationRemark,
} from "../app/lib/plan-cancellation.ts"

const nothingLinked = { hasLinerBooking: false, assignment: null, pendingUnmappingRequests: 0 }
const approvedOnly = {
  hasLinerBooking: false,
  assignment: { status: "Awaiting Booking", linerBookingDetailsCount: 0 },
  pendingUnmappingRequests: 0,
}

test("admin and shipment planning team can cancel; only admin can delete", () => {
  assert.equal(canCancelPlan("ADMIN"), true)
  assert.equal(canCancelPlan("SHIPMENT_PLAN_TEAM"), true)
  assert.equal(canCancelPlan("MD"), false)
  assert.equal(canCancelPlan("LINER_BOOKING_TEAM"), false)
  assert.equal(canDeletePlan("ADMIN"), true)
  assert.equal(canDeletePlan("SHIPMENT_PLAN_TEAM"), false)
  assert.equal(canDeletePlan("MD"), false)
})

test("cancellation remark is required, trimmed and length-limited", () => {
  assert.deepEqual(validateCancellationRemark(null), { error: CANCELLATION_REMARK_REQUIRED_ERROR })
  assert.deepEqual(validateCancellationRemark("   "), { error: CANCELLATION_REMARK_REQUIRED_ERROR })
  assert.deepEqual(validateCancellationRemark("  Customer withdrew order "), { remark: "Customer withdrew order" })
  assert.deepEqual(validateCancellationRemark("x".repeat(CANCELLATION_REMARK_MAX_LENGTH + 1)), {
    error: CANCELLATION_REMARK_TOO_LONG_ERROR,
  })
})

test("unlinked plans and MD-approved-only plans can be cancelled", () => {
  assert.equal(getCancelBlocker(nothingLinked), null)
  assert.equal(getCancelBlocker(approvedOnly), null)
})

test("any booking activity blocks cancellation", () => {
  assert.equal(getCancelBlocker({ ...approvedOnly, hasLinerBooking: true }), CANCEL_BLOCKED_BOOKED_ERROR)
  assert.equal(getCancelBlocker({ ...approvedOnly, pendingUnmappingRequests: 1 }), CANCEL_BLOCKED_BOOKED_ERROR)
  assert.equal(
    getCancelBlocker({ ...approvedOnly, assignment: { status: "Booked", linerBookingDetailsCount: 1 } }),
    CANCEL_BLOCKED_BOOKED_ERROR,
  )
  assert.equal(
    getCancelBlocker({ ...approvedOnly, assignment: { status: "Awaiting Booking", linerBookingDetailsCount: 1 } }),
    CANCEL_BLOCKED_BOOKED_ERROR,
  )
  assert.equal(
    getCancelBlocker({ ...approvedOnly, assignment: { status: "Partial Unmapping Requested", linerBookingDetailsCount: 0 } }),
    CANCEL_BLOCKED_BOOKED_ERROR,
  )
})

test("counts liner booking details defensively", () => {
  assert.equal(countLinerBookingDetails(null), 0)
  assert.equal(countLinerBookingDetails({}), 0)
  assert.equal(countLinerBookingDetails({ liner_booking_details: "x" }), 0)
  assert.equal(countLinerBookingDetails({ liner_booking_details: [{}, {}] }), 2)
})

test("detects cancelled plan data", () => {
  assert.equal(isPlanCancelled({ booking_status: "Cancelled" }), true)
  assert.equal(isPlanCancelled({ booking_status: "Awaiting Booking" }), false)
  assert.equal(isPlanCancelled(null), false)
  assert.equal(isPlanCancelled(undefined), false)
})
