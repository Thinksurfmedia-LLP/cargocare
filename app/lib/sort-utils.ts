// Shared column-sort helpers for admin list tables (shipment plans, liner bookings, assignments).

export type SortOrder = "asc" | "desc";

export function toSortNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(num) ? num : null;
}

export function toSortDate(value: unknown): number | null {
  if (!value) return null;
  const time = new Date(value as string).getTime();
  return Number.isFinite(time) ? time : null;
}

export function compareSortValues(a: unknown, b: unknown, order: SortOrder): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // empty values always sort last, regardless of direction
  if (bEmpty) return -1;

  let result: number;
  if (typeof a === "number" && typeof b === "number") {
    result = a - b;
  } else {
    result = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  }

  return order === "asc" ? result : -result;
}

export function sortByColumn<T>(
  items: T[],
  getValue: (item: T) => unknown,
  order: SortOrder
): T[] {
  return [...items].sort((a, b) => compareSortValues(getValue(a), getValue(b), order));
}
