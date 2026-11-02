import assert from "node:assert/strict"
import { test } from "node:test"
import { buildPlanCancelledEmail, formatEquipmentSummary } from "../app/lib/emails/plan-cancelled-email.ts"

const details = {
  referenceNumber: "BEN20260010",
  customer: "Acme Exports",
  businessBranch: "Bengaluru",
  cancelledBy: "Avnish",
  cancellationRemark: "Customer withdrew the order",
  equipmentSummary: "20ft Standard Container (1 unit)",
  portOfLoading: "Chennai",
  portOfDischarge: "Jebel Ali",
  linerBookingsUrl: "https://cargocarelogistics.com/liner-bookings",
}

test("summarises equipment by type", () => {
  assert.equal(
    formatEquipmentSummary([{ equipment_type: "20ft" }, { equipment_type: "20ft" }, { equipment_type: "40ft" }, {}]),
    "20ft (2 units), 40ft (1 unit)",
  )
  assert.equal(formatEquipmentSummary(undefined), "N/A")
})

test("email names the plan, who cancelled it and why", () => {
  const email = buildPlanCancelledEmail(details)

  assert.match(email.subject, /BEN20260010/)
  assert.match(email.subject, /Cancelled/)
  for (const part of [email.html, email.text]) {
    assert.match(part, /BEN20260010/)
    assert.match(part, /Avnish/)
    assert.match(part, /Customer withdrew the order/)
    assert.match(part, /no longer need to book/i)
  }
  assert.match(email.html, /href="https:\/\/cargocarelogistics\.com\/liner-bookings"/)
})

test("user-entered text is HTML-escaped in the email body", () => {
  const email = buildPlanCancelledEmail({
    ...details,
    cancellationRemark: '<script>alert("x")</script> & more',
    customer: "A <b>bold</b> customer",
  })

  assert.doesNotMatch(email.html, /<script>/)
  assert.match(email.html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; more/)
  assert.match(email.html, /A &lt;b&gt;bold&lt;\/b&gt; customer/)
  assert.match(email.text, /<script>alert\("x"\)<\/script> & more/)
})
