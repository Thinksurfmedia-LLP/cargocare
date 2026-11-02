// Minimum sequence for newly generated shipment plan reference numbers,
// keyed by `${branchCode}${year}`. Numbers below the floor are skipped, so
// e.g. the next Mumbai 2026 plan is MUM20260740 even if the highest existing
// one is lower. Has no effect once existing numbers pass the floor.
const REFERENCE_SEQUENCE_FLOOR: Readonly<Record<string, number>> = {
  MUM2026: 740,
  TUT2026: 320,
  CHE2026: 50,
  KOL2026: 210,
  KOC2026: 100,
}

export function getReferenceSequenceFloor(branchCode: string, year: number | string): number {
  return REFERENCE_SEQUENCE_FLOOR[`${branchCode.toUpperCase()}${year}`] ?? 1
}

// Legacy plans saved as drafts without a business branch got a placeholder
// reference like DRAFT2026563722 instead of {BusinessCode}{Year}{sequence}.
const PLACEHOLDER_REFERENCE_PREFIX = "DRAFT"

export function isPlaceholderReference(referenceNumber: unknown): boolean {
  return typeof referenceNumber === "string" && referenceNumber.startsWith(PLACEHOLDER_REFERENCE_PREFIX)
}

// Builds the next {BusinessCode}{Year}{4-digit sequence} reference from the
// references that already exist for that branch and year.
export function buildNextReferenceNumber(
  branchCode: string,
  year: number | string,
  existingReferences: readonly unknown[],
): string {
  const prefix = `${branchCode.toUpperCase()}${year}`
  const sequences = existingReferences
    .filter((ref): ref is string => typeof ref === "string" && ref.startsWith(prefix))
    .map((ref) => Number.parseInt(ref.slice(prefix.length), 10))
    .filter((num) => !Number.isNaN(num) && num > 0)

  const highest = sequences.length > 0 ? Math.max(...sequences) : 0
  const nextSequence = Math.max(getReferenceSequenceFloor(branchCode, year), highest + 1)
  return `${prefix}${nextSequence.toString().padStart(4, "0")}`
}

// Equipment tracking numbers embed the plan reference ({ref}-{equip}-{seq});
// carry them over when a placeholder reference is replaced.
export function replaceReferenceInTrackingNumber(
  trackingNumber: string,
  oldReference: string,
  newReference: string,
): string {
  if (!oldReference || !trackingNumber.startsWith(`${oldReference}-`)) return trackingNumber
  return `${newReference}${trackingNumber.slice(oldReference.length)}`
}

const PLACEHOLDER_TRACKING_PREFIX = new RegExp(`^${PLACEHOLDER_REFERENCE_PREFIX}\\d+-`)

// A form loaded before its plan got a real reference still posts tracking
// numbers built from the old DRAFT placeholder; point them at the real one.
export function replacePlaceholderInTrackingNumber(trackingNumber: string, referenceNumber: string): string {
  if (isPlaceholderReference(referenceNumber)) return trackingNumber
  return trackingNumber.replace(PLACEHOLDER_TRACKING_PREFIX, `${referenceNumber}-`)
}

function replaceReferenceDeep(value: unknown, oldReference: string, newReference: string): unknown {
  if (typeof value === "string") {
    return value === oldReference ? newReference : replaceReferenceInTrackingNumber(value, oldReference, newReference)
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceReferenceDeep(item, oldReference, newReference))
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceReferenceDeep(item, oldReference, newReference)]),
    )
  }
  return value
}

// Returns a copy of a shipment plan / assignment / booking payload pointed at a
// new reference: every value equal to the old reference_number, or built from
// it like tracking numbers ({ref}-{equip}-{seq}), at any depth.
export function applyReferenceNumber<T extends { reference_number?: unknown }>(data: T, newReference: string): T {
  const oldReference = typeof data.reference_number === "string" ? data.reference_number : ""
  const updated = oldReference ? (replaceReferenceDeep(data, oldReference, newReference) as T) : data
  return { ...updated, reference_number: newReference }
}

// For refs parsed as prefix + full numeric part (e.g. "MUM" + "20260715"),
// returns the floor expressed as that full number (e.g. 20260740), or 0 if none.
export function getReferenceNumberFloor(prefix: string, numberPart: string): number {
  const match = `${prefix}${numberPart}`.match(/^([A-Z]+)(\d{4})(\d{4})$/)
  if (!match) return 0
  const [, branchCode, year] = match
  const floor = REFERENCE_SEQUENCE_FLOOR[`${branchCode}${year}`]
  if (!floor) return 0
  return Number.parseInt(`${year}${floor.toString().padStart(4, "0")}`, 10)
}
