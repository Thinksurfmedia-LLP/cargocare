import assert from "node:assert/strict"
import { test } from "node:test"
import { getEffectiveCarrierVessel } from "../app/lib/carrier-vessel.ts"

const plan = { container_movement: { carrier_and_vessel_preference: { carrier: "Hapag-Lloyd", vessel: "ARAYA BHUM" } } }

test("before booking, the plan's preference is shown", () => {
  assert.deepEqual(getEffectiveCarrierVessel(plan, null), { carrier: "Hapag-Lloyd", vessel: "ARAYA BHUM" })
  assert.deepEqual(getEffectiveCarrierVessel(plan, { liner_booking_details: [] }), { carrier: "Hapag-Lloyd", vessel: "ARAYA BHUM" })
})

test("after booking, a changed vessel and carrier win over the preference", () => {
  const booking = { liner_booking_details: [{ carrier: "ONE (Ocean Network Express)", original_planned_vessel: "USSAMA BHUM " }] }
  assert.deepEqual(getEffectiveCarrierVessel(plan, booking), { carrier: "ONE (Ocean Network Express)", vessel: "USSAMA BHUM" })
})

test("each field falls back on its own when the booking only has one of them", () => {
  const booking = { liner_booking_details: [{ carrier: "", original_planned_vessel: "W KAMPALA" }] }
  assert.deepEqual(getEffectiveCarrierVessel(plan, booking), { carrier: "Hapag-Lloyd", vessel: "W KAMPALA" })
})

test("uses the first booking detail that has a value", () => {
  const booking = { liner_booking_details: [{ carrier: "" }, { carrier: "CMA CGM", original_planned_vessel: "CMA CGM RIMBAUD" }] }
  assert.deepEqual(getEffectiveCarrierVessel(plan, booking), { carrier: "CMA CGM", vessel: "CMA CGM RIMBAUD" })
})

test("returns empty strings when there is neither a preference nor a booking", () => {
  assert.deepEqual(getEffectiveCarrierVessel(null, undefined), { carrier: "", vessel: "" })
})
