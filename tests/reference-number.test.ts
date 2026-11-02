import assert from "node:assert/strict"
import { test } from "node:test"
import {
  applyReferenceNumber,
  buildNextReferenceNumber,
  isPlaceholderReference,
  replacePlaceholderInTrackingNumber,
  replaceReferenceInTrackingNumber,
} from "../app/lib/reference-number.ts"

test("detects legacy DRAFT placeholder references", () => {
  assert.equal(isPlaceholderReference("DRAFT2026563722"), true)
  assert.equal(isPlaceholderReference("MUM20260741"), false)
  assert.equal(isPlaceholderReference(undefined), false)
})

test("next reference respects the branch floor", () => {
  assert.equal(buildNextReferenceNumber("MUM", 2026, []), "MUM20260740")
  assert.equal(buildNextReferenceNumber("MUM", 2026, ["MUM20260012"]), "MUM20260740")
})

test("next reference follows the highest existing sequence", () => {
  assert.equal(buildNextReferenceNumber("mum", 2026, ["MUM20260741", "MUM20260799", "MUM2026abc", null]), "MUM20260800")
  assert.equal(buildNextReferenceNumber("XYZ", 2026, ["XYZ20260003", "ABC20260900"]), "XYZ20260004")
})

test("tracking numbers move from the placeholder to the real reference", () => {
  assert.equal(
    replaceReferenceInTrackingNumber("DRAFT2026563722-20SC-001", "DRAFT2026563722", "MUM20260741"),
    "MUM20260741-20SC-001",
  )
  assert.equal(replaceReferenceInTrackingNumber("TEMP-20SC-001", "DRAFT2026563722", "MUM20260741"), "TEMP-20SC-001")
  assert.equal(replaceReferenceInTrackingNumber("", "DRAFT2026563722", "MUM20260741"), "")
})

test("leftover placeholder tracking numbers are pointed at the real reference", () => {
  assert.equal(replacePlaceholderInTrackingNumber("DRAFT2026563722-20SC-001", "MUM20260741"), "MUM20260741-20SC-001")
  assert.equal(replacePlaceholderInTrackingNumber("MUM20260741-20SC-001", "MUM20260741"), "MUM20260741-20SC-001")
  assert.equal(replacePlaceholderInTrackingNumber("DRAFTED-20SC-001", "MUM20260741"), "DRAFTED-20SC-001")
  // Never rewrite while the plan itself still has a placeholder reference
  assert.equal(replacePlaceholderInTrackingNumber("DRAFT2026563722-20SC-001", "DRAFT2026999999"), "DRAFT2026563722-20SC-001")
})

test("applyReferenceNumber moves the reference and its tracking numbers without mutating input", () => {
  const original = {
    reference_number: "DRAFT2026105120",
    booking_status: "Awaiting Booking",
    equipment_details: [
      { trackingNumber: "DRAFT2026105120-20S-001", container_number: "" },
      { trackingNumber: "OTHER-20S-002" },
    ],
  }

  const updated = applyReferenceNumber(original, "MUM20260741")

  assert.deepEqual(updated, {
    reference_number: "MUM20260741",
    booking_status: "Awaiting Booking",
    equipment_details: [
      { trackingNumber: "MUM20260741-20S-001", container_number: "" },
      { trackingNumber: "OTHER-20S-002" },
    ],
  })
  assert.equal(original.reference_number, "DRAFT2026105120")
  assert.equal(original.equipment_details[0].trackingNumber, "DRAFT2026105120-20S-001")
})

test("applyReferenceNumber rewrites nested copies of the reference only", () => {
  const booking = {
    reference_number: "DRAFT2026105120",
    _originalShipmentPlan: { reference_number: "DRAFT2026105120", note: "see DRAFT2026105120 docs" },
    cancelled_from_plan: "DRAFT2026105120",
    equipment_details: [{ trackingNumber: "DRAFT2026105120-20S-001" }],
    count: 3,
    missing: null,
  }

  assert.deepEqual(applyReferenceNumber(booking, "MUM20260741"), {
    reference_number: "MUM20260741",
    _originalShipmentPlan: { reference_number: "MUM20260741", note: "see DRAFT2026105120 docs" },
    cancelled_from_plan: "MUM20260741",
    equipment_details: [{ trackingNumber: "MUM20260741-20S-001" }],
    count: 3,
    missing: null,
  })
})

test("applyReferenceNumber leaves payloads without equipment alone", () => {
  assert.deepEqual(applyReferenceNumber({ reference_number: "DRAFT1" }, "MUM20260741"), {
    reference_number: "MUM20260741",
  })
})
