import assert from "node:assert/strict"
import { test } from "node:test"
import {
  readBuyingPrice,
  readSellingPrice,
  recordPriceChanges,
  setBuyingPriceWithHistory,
} from "../app/lib/price-fields.ts"

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

test("keeps buying price text exactly as typed instead of turning it into 0", () => {
  for (const text of ["USD 1000", "$1500", "1500$", "AIC Origin charge INR 5518.35"]) {
    assert.equal(readBuyingPrice(form({ buying_price: `  ${text}  ` })), text)
  }
})

test("a blank buying price becomes 0", () => {
  assert.equal(readBuyingPrice(form({ buying_price: "" }), "USD 9"), 0)
})

test("keeps the stored buying price when the field is not submitted", () => {
  assert.equal(readBuyingPrice(form({}), "USD 9"), "USD 9")
  assert.equal(readBuyingPrice(form({})), 0)
})

test("an untouched field keeps the CURRENT stored price, not the stale value the form was loaded with", () => {
  // planner opened the plan when price was 0; liner team then entered USD 1000; planner saves untouched
  const stale = form({ buying_price: "0", buying_price_original: "0" })
  assert.equal(readBuyingPrice(stale, "USD 1000"), "USD 1000")
})

test("an edited field wins over the stored price", () => {
  const edited = form({ buying_price: "USD 1200", buying_price_original: "USD 1000" })
  assert.equal(readBuyingPrice(edited, "USD 1000"), "USD 1200")
})

test("selling price is kept as typed and falls back to the stored value when missing", () => {
  assert.equal(readSellingPrice(form({ selling_price: "$ 95/20DV" })), "$ 95/20DV")
  assert.equal(readSellingPrice(form({}), "USD 288"), "USD 288")
  assert.equal(readSellingPrice(form({})), null)
})

test("records a history entry per changed price and keeps earlier entries", () => {
  const earlier = [{ field: "buying_price" as const, from: 0, to: "USD 1", at: "2026-01-01T00:00:00.000Z", by: "u0" }]
  const history = recordPriceChanges(
    { container_movement: { buying_price: "USD 1000", selling_price: "USD 1160" }, price_history: earlier },
    { container_movement: { buying_price: 0, selling_price: "USD 1160" } },
    "u1",
  )
  assert.equal(history.length, 2)
  assert.deepEqual(history[0], earlier[0])
  assert.equal(history[1].field, "buying_price")
  assert.equal(history[1].from, "USD 1000")
  assert.equal(history[1].to, 0)
  assert.equal(history[1].by, "u1")
})

test("no history entry when a price did not change (0, blank and missing count as the same)", () => {
  const history = recordPriceChanges(
    { container_movement: { buying_price: 0, selling_price: "" } },
    { container_movement: { buying_price: "0" } },
    "u1",
  )
  assert.equal(history.length, 0)
})

test("setBuyingPriceWithHistory sets the price and records who changed it", () => {
  const plan: any = { container_movement: { selling_price: "USD 50", buying_price: 0 } }
  setBuyingPriceWithHistory(plan, "USD 40", "liner-1")
  assert.equal(plan.container_movement.buying_price, "USD 40")
  assert.equal(plan.container_movement.selling_price, "USD 50")
  assert.equal(plan.price_history.length, 1)
  assert.equal(plan.price_history[0].by, "liner-1")
})
