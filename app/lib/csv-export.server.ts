// Generic CSV flattening utilities shared by CSV export routes.
// Handles nested objects, JSON `data` blobs, and arrays (expanded into extra rows).

function formatCsvValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "object" && item !== null ? JSON.stringify(item) : String(item)))
        .join(";");
    }

    const objValue = value as any;
    if (objValue.name) return String(objValue.name);
    if (objValue.id) return String(objValue.id);
    if (objValue.email) return String(objValue.email);

    try {
      const jsonString = JSON.stringify(value);
      if (jsonString === "{}" || jsonString === "null") return "";
      return jsonString;
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function escapeCsvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// Check if an object is "simple" (should be flattened) vs "complex" (should be treated as array item)
function isSimpleObject(obj: any): boolean {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;

  return Object.values(obj).every((value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
    if (value instanceof Date) return true;
    if (Array.isArray(value)) return false;
    if (typeof value === "object") return Object.keys(value).length <= 3;
    return false;
  });
}

function flattenObject(obj: any, prefix = ""): Record<string, any> {
  const flattened: Record<string, any> = {};
  if (!obj || typeof obj !== "object") return flattened;

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      if (value.constructor === Object || value.constructor === undefined) {
        Object.assign(flattened, flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    } else {
      flattened[newKey] = value;
    }
  }

  return flattened;
}

// Expand a single record into multiple rows for array handling
function expandRecord(record: any, prefix = ""): any[] {
  const baseRecord: any = {};
  const arrayFields: { key: string; items: any[] }[] = [];

  Object.entries(record).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value) && value.length > 0) {
      arrayFields.push({ key: fullKey, items: value });
    } else if (value && typeof value === "object" && !(value instanceof Date)) {
      if (key === "data" && typeof value === "object") {
        // Flatten JSON data fields directly into the base record with data. prefix
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (Array.isArray(subValue) && subValue.length > 0) {
            arrayFields.push({ key: `${fullKey}.${subKey}`, items: subValue });
          } else if (subValue && typeof subValue === "object" && !(subValue instanceof Date)) {
            const flattened = flattenObject(subValue, `${fullKey}.${subKey}`);
            Object.assign(baseRecord, flattened);
          } else {
            baseRecord[`${fullKey}.${subKey}`] = subValue;
          }
        });
      } else if (isSimpleObject(value)) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          baseRecord[`${fullKey}.${subKey}`] = subValue;
        });
      } else {
        const objValue = value as any;
        if (objValue.name || objValue.id || objValue.email) {
          if (objValue.name) baseRecord[`${fullKey}.name`] = objValue.name;
          if (objValue.id) baseRecord[`${fullKey}.id`] = objValue.id;
          if (objValue.email) baseRecord[`${fullKey}.email`] = objValue.email;

          Object.entries(objValue).forEach(([subKey, subValue]) => {
            if (
              !["name", "id", "email"].includes(subKey) &&
              (typeof subValue === "string" || typeof subValue === "number" || typeof subValue === "boolean")
            ) {
              baseRecord[`${fullKey}.${subKey}`] = subValue;
            }
          });
        } else {
          arrayFields.push({ key: fullKey, items: [objValue] });
        }
      }
    } else {
      baseRecord[fullKey] = value;
    }
  });

  if (arrayFields.length === 0) return [baseRecord];

  const result: any[] = [];
  const maxArrayLength = Math.max(...arrayFields.map((field) => field.items.length));

  for (let i = 0; i < maxArrayLength; i++) {
    const rowRecord = { ...baseRecord };

    arrayFields.forEach(({ key, items }) => {
      const item = items[i % items.length];
      if (item && typeof item === "object" && !Array.isArray(item)) {
        Object.entries(item).forEach(([subKey, subValue]) => {
          rowRecord[`${key}.${subKey}`] = subValue;
        });
      } else {
        rowRecord[key] = item;
      }
    });

    result.push(rowRecord);
  }

  return result;
}

/**
 * Flattens an array of (possibly nested, Prisma-shaped) records into a CSV string.
 * Nested JSON `data` blobs and relation objects are flattened into `parent.child` columns;
 * arrays are expanded into extra rows.
 */
export function objectsToCsv(records: any[]): string {
  if (records.length === 0) return "";

  const allHeaders = new Set<string>();
  const expandedRows: any[] = [];

  records.forEach((record) => {
    const expanded = expandRecord(record);
    expanded.forEach((expandedRecord) => {
      Object.keys(expandedRecord).forEach((key) => allHeaders.add(key));
      expandedRows.push(expandedRecord);
    });
  });

  const headers = Array.from(allHeaders).sort();
  const rows = expandedRows.map((row) => headers.map((header) => escapeCsvField(formatCsvValue(row[header] ?? ""))));

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}
