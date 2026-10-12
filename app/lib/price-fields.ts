/**
 * Price handling for shipment plans.
 *
 * Buying and selling price are free text ("USD 1000", "AIC Origin charge INR 5518.35"),
 * because the liner booking team types them that way. They must never be parsed as numbers:
 * that turned any text into NaN and then 0 and silently wiped prices on every plan save.
 */

export type PriceField = "buying_price" | "selling_price"

export interface PriceChange {
  field: PriceField
  from: string | number | null
  to: string | number | null
  at: string
  by: string
}

interface PriceHolder {
  container_movement?: { buying_price?: unknown; selling_price?: unknown } | null
  price_history?: PriceChange[] | null
}

const PRICE_FIELDS: PriceField[] = ["buying_price", "selling_price"]

/**
 * Buying price from a plan form submission.
 *
 * - untouched (equals the value the form was loaded with) -> keep what is stored NOW, so a
 *   stale form can never overwrite a price the liner team entered after the page was opened
 * - edited                -> the typed text, exactly as entered
 * - blank                 -> 0 ("no price")
 * - field not submitted   -> keep the stored value
 */
export function readBuyingPrice(formData: FormData, existing?: string | number | null): string | number {
  const raw = formData.get("buying_price")
  if (typeof raw !== "string") return existing ?? 0

  const submitted = raw.trim()
  const original = formData.get("buying_price_original")
  if (typeof original === "string" && original.trim() === submitted) return existing ?? 0

  return submitted === "" ? 0 : submitted
}

/** Selling price: free text kept as typed; if the field was not submitted, keep the stored value. */
export function readSellingPrice(formData: FormData, existing?: string | number | null): string | number | null {
  const raw = formData.get("selling_price")
  if (typeof raw !== "string") return existing ?? null
  return raw
}

function normalise(value: unknown): string {
  if (value === null || value === undefined || value === "") return "0"
  return String(value).trim()
}

/**
 * Full price history after a save: everything recorded before, plus one entry per price
 * that changed. Stored on the plan so a lost or overwritten price can always be recovered.
 * Returns the previous history unchanged when nothing changed.
 */
export function recordPriceChanges(existing: PriceHolder, next: PriceHolder, userId: string): PriceChange[] {
  const history = [...(existing.price_history ?? [])]
  const at = new Date().toISOString()

  for (const field of PRICE_FIELDS) {
    const from = (existing.container_movement?.[field] ?? null) as PriceChange["from"]
    const to = (next.container_movement?.[field] ?? null) as PriceChange["to"]
    if (normalise(from) !== normalise(to)) {
      history.push({ field, from, to, at, by: userId })
    }
  }
  return history
}

/**
 * Sets the buying price on loaded plan data (in place, like the surrounding save code) and
 * records the change in price_history. Used when the liner booking team enters the price.
 */
export function setBuyingPriceWithHistory(planData: any, value: string, userId: string): void {
  const before = { container_movement: { ...(planData.container_movement ?? {}) }, price_history: planData.price_history }
  planData.container_movement = { ...(planData.container_movement ?? {}), buying_price: value }
  const history = recordPriceChanges(before, planData, userId)
  if (history.length > 0) planData.price_history = history
}
