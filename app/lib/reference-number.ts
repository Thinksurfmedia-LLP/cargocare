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
