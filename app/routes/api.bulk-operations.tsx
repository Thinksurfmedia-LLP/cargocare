import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { objectsToCsv } from "~/lib/csv-export.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    // Only allow ADMIN users for bulk operations
    if (user.role.name !== "ADMIN") {
      return new Response("Unauthorized", { status: 403 });
    }

    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    if (!type) {
      return new Response("Type parameter is required", { status: 400 });
    }

    let data: any[] = [];
    let filename = "";

    switch (type) {
      case "shipment-plans":
        data = await prisma.shipmentPlan.findMany({
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        });
        filename = "shipment-plans-export.csv";
        break;
        
      case "liner-bookings":
        data = await prisma.linerBooking.findMany({
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        });
        filename = "liner-bookings-export.csv";
        break;
        
      case "business-branches":
        data = await prisma.businessBranch.findMany();
        filename = "business-branches-export.csv";
        break;
        
      case "carriers":
        data = await prisma.carrier.findMany();
        filename = "carriers-export.csv";
        break;
        
      case "commodities":
        data = await prisma.commodity.findMany();
        filename = "commodities-export.csv";
        break;
        
      case "destination-countries":
        data = await prisma.destinationCountry.findMany();
        filename = "destination-countries-export.csv";
        break;
        
      case "equipment":
        data = await prisma.equipment.findMany();
        filename = "equipment-export.csv";
        break;
        
      case "loading-ports":
        data = await prisma.loadingPort.findMany();
        filename = "loading-ports-export.csv";
        break;
        
      case "organizations":
        data = await prisma.organization.findMany();
        filename = "organizations-export.csv";
        break;
        
      case "ports-of-discharge":
        data = await prisma.portOfDischarge.findMany();
        filename = "ports-of-discharge-export.csv";
        break;
        
      case "vessels":
        data = await prisma.vessel.findMany();
        filename = "vessels-export.csv";
        break;
        
      default:
        return new Response("Invalid type", { status: 400 });
    }

    // Convert data to CSV
    const csv = objectsToCsv(data);
    
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
    
  } catch (error) {
    console.error("Bulk export error:", error);
    return new Response("Export failed", { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    // Only allow ADMIN users for bulk operations
    if (user.role.name !== "ADMIN") {
      return new Response("Unauthorized", { status: 403 });
    }

    const formData = await request.formData();
    const type = formData.get("type") as string;
    const file = formData.get("file") as File;

    if (!type || !file) {
      return { error: "Type and file are required" };
    }

    const csvText = await file.text();
    const records = parseCSV(csvText);

    let result: any = { success: 0, errors: [] };

    switch (type) {
      case "business-branches":
        result = await importBusinessBranches(records);
        break;
        
      case "carriers":
        result = await importCarriers(records);
        break;
        
      case "commodities":
        result = await importCommodities(records);
        break;
        
      case "destination-countries":
        result = await importDestinationCountries(records);
        break;
        
      case "equipment":
        result = await importEquipment(records);
        break;
        
      case "loading-ports":
        result = await importLoadingPorts(records);
        break;
        
      case "organizations":
        result = await importOrganizations(records);
        break;
        
      case "ports-of-discharge":
        result = await importPortsOfDischarge(records);
        break;
        
      case "vessels":
        result = await importVessels(records);
        break;
        
      default:
        return { error: "Invalid type for import" };
    }

    return { 
      success: `Successfully imported ${result.success} records`,
      errors: result.errors.length > 0 ? result.errors : undefined
    };
    
  } catch (error) {
    console.error("Bulk import error:", error);
    return { error: "Import failed" };
  }
}

// CSV flattening (nested objects, JSON `data` blobs, arrays) lives in ~/lib/csv-export.server (objectsToCsv).

function parseCSV(csvText: string): any[] {
  const lines = csvText.split("\n").filter(line => line.trim());
  if (lines.length < 2) return [];

  // More robust CSV parsing that handles quoted fields with commas
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last field
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]);
  const rawRecords = [];

  // Parse all rows first
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: any = {};
    
    headers.forEach((header, index) => {
      let value: any = values[index] || "";
      
      // Try to convert back to appropriate types
      if (value.toLowerCase() === "yes" || value.toLowerCase() === "true") {
        value = true;
      } else if (value.toLowerCase() === "no" || value.toLowerCase() === "false") {
        value = false;
      } else if (value && !isNaN(Number(value)) && value.trim() !== "") {
        // Convert to number if it's numeric
        const numValue = Number(value);
        if (Number.isFinite(numValue)) {
          value = numValue;
        }
      } else if (value && value.includes(";")) {
        // Convert semicolon-separated values back to arrays
        value = value.split(";").map((v: string) => v.trim()).filter((v: string) => v);
      }
      
      record[header] = value;
    });
    
    rawRecords.push(record);
  }

  // For data points (simple structures), use original logic
  if (rawRecords.length > 0 && !hasMultiRowStructure(rawRecords)) {
    return rawRecords.map(record => {
      const result: any = {};
      Object.entries(record).forEach(([header, value]) => {
        // Handle nested object notation (e.g., "data.reference_number")
        if (header.includes(".")) {
          const parts = header.split(".");
          let current = result;
          
          for (let j = 0; j < parts.length - 1; j++) {
            if (!current[parts[j]]) {
              current[parts[j]] = {};
            }
            current = current[parts[j]];
          }
          
          current[parts[parts.length - 1]] = value;
        } else {
          result[header] = value;
        }
      });
      return result;
    });
  }

  // For complex structures with arrays, reconstruct from multi-row format
  return reconstructFromMultiRow(rawRecords);
}

// Check if the data has multi-row structure (same IDs with different array data)
function hasMultiRowStructure(records: any[]): boolean {
  const idCounts = new Map<string, number>();
  records.forEach(record => {
    const id = record.id;
    if (id) {
      idCounts.set(id, (idCounts.get(id) || 0) + 1);
    }
  });
  return Array.from(idCounts.values()).some(count => count > 1);
}

// Reconstruct original data structure from multi-row CSV format
function reconstructFromMultiRow(rawRecords: any[]): any[] {
  const reconstructed = new Map<string, any>();
  
  rawRecords.forEach(record => {
    const id = record.id;
    if (!id) return;
    
    if (!reconstructed.has(id)) {
      // Initialize with base record
      const baseRecord: any = { id };
      
      // Copy non-array fields
      Object.entries(record).forEach(([key, value]) => {
        if (key !== 'id' && !isArrayField(key, rawRecords)) {
          setNestedValue(baseRecord, key, value);
        }
      });
      
      reconstructed.set(id, baseRecord);
    }
    
    // Handle array fields
    const existingRecord = reconstructed.get(id);
    Object.entries(record).forEach(([key, value]) => {
      if (key !== 'id' && isArrayField(key, rawRecords)) {
        addToArrayField(existingRecord, key, value, record);
      }
    });
  });
  
  return Array.from(reconstructed.values());
}

// Check if a field represents an array item based on the data pattern
function isArrayField(fieldKey: string, allRecords: any[]): boolean {
  // Find records with the same ID and see if this field varies
  const recordsGroupedById = new Map<string, any[]>();
  
  allRecords.forEach(record => {
    const id = record.id;
    if (!recordsGroupedById.has(id)) {
      recordsGroupedById.set(id, []);
    }
    recordsGroupedById.get(id)!.push(record);
  });
  
  // If any ID has multiple rows with different values for this field, it's an array field
  for (const [id, records] of recordsGroupedById) {
    if (records.length > 1) {
      const values = records.map(r => r[fieldKey]).filter(v => v !== null && v !== undefined && v !== '');
      const uniqueValues = new Set(values.map(v => JSON.stringify(v)));
      if (uniqueValues.size > 1) {
        return true;
      }
    }
  }
  
  return false;
}

// Add value to array field, reconstructing the object structure
function addToArrayField(record: any, fieldKey: string, value: any, sourceRecord: any): void {
  if (!value && value !== 0 && value !== false) return;
  
  const parts = fieldKey.split('.');
  let current = record;
  
  // Navigate to the array container
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  
  const arrayFieldName = parts[parts.length - 2]; // e.g., 'containers' from 'data.containers.number'
  const propertyName = parts[parts.length - 1]; // e.g., 'number' from 'data.containers.number'
  
  if (!current[arrayFieldName]) {
    current[arrayFieldName] = [];
  }
  
  // Find or create the array item for this row
  const arrayField = current[arrayFieldName] as any[];
  let arrayItem = arrayField[arrayField.length - 1];
  
  // Check if we need a new array item (different from previous row's values)
  const shouldCreateNewItem = !arrayItem || 
    (arrayItem[propertyName] !== undefined && arrayItem[propertyName] !== value);
  
  if (shouldCreateNewItem) {
    arrayItem = {};
    arrayField.push(arrayItem);
  }
  
  arrayItem[propertyName] = value;
}

// Set nested value using dot notation
function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  
  current[parts[parts.length - 1]] = value;
}

// Generic helper function for robust data imports
function cleanRecordForImport(record: any, requiredFields: string[] = []): { data: any; error?: string } {
  const cleanRecord: any = {};
  
  // Clean and filter the record
  Object.keys(record).forEach(key => {
    const value = record[key];
    if (value !== null && value !== undefined && value !== '') {
      cleanRecord[key] = value;
    }
  });
  
  // Check required fields
  for (const field of requiredFields) {
    if (!cleanRecord[field]) {
      return { data: {}, error: `Missing required field '${field}'` };
    }
  }
  
  return { data: cleanRecord };
}

// Import functions for each data type
async function importBusinessBranches(records: any[]) {
  const result = { success: 0, errors: [] as string[] };
  
  for (const record of records) {
    try {
      const { data: cleanRecord, error } = cleanRecordForImport(record, ['name']);
      if (error) {
        result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error}`);
        continue;
      }
      
      await prisma.businessBranch.create({
        data: cleanRecord
      });
      result.success++;
    } catch (error: any) {
      result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error.message}`);
    }
  }
  
  return result;
}

async function importCarriers(records: any[]) {
  const result = { success: 0, errors: [] as string[] };
  
  for (const record of records) {
    try {
      const { data: cleanRecord, error } = cleanRecordForImport(record, ['name']);
      if (error) {
        result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error}`);
        continue;
      }
        await prisma.carrier.create({
        data: cleanRecord
      });
      result.success++;
    } catch (error: any) {
      result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error.message}`);
    }
  }
  
  return result;
}

async function importCommodities(records: any[]) {
  const result = { success: 0, errors: [] as string[] };
  
  for (const record of records) {
    try {
      const { data: cleanRecord, error } = cleanRecordForImport(record, ['name']);
      if (error) {
        result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error}`);
        continue;
      }
      
      await prisma.commodity.create({
        data: {
          name: cleanRecord.name,
        }
      });
      result.success++;
    } catch (error: any) {
      result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error.message}`);
    }
  }
  
  return result;
}

async function importDestinationCountries(records: any[]) {
  const result = { success: 0, errors: [] as string[] };
  
  for (const record of records) {
    try {
      const { data: cleanRecord, error } = cleanRecordForImport(record, ['name']);
      if (error) {
        result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error}`);
        continue;
      }
      
      await prisma.destinationCountry.create({
        data: {
          name: cleanRecord.name,
        }
      });
      result.success++;
    } catch (error: any) {
      result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error.message}`);
    }
  }
  
  return result;
}

async function importEquipment(records: any[]) {
  const result = { success: 0, errors: [] as string[] };
  
  for (const record of records) {
    try {
      const { data: cleanRecord, error } = cleanRecordForImport(record, ['name']);
      if (error) {
        result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error}`);
        continue;
      }
      
      await prisma.equipment.create({
        data: {
          name: cleanRecord.name,
        }
      });
      result.success++;
    } catch (error: any) {
      result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error.message}`);
    }
  }
  
  return result;
}

async function importLoadingPorts(records: any[]) {
  const result = { success: 0, errors: [] as string[] };
  
  for (const record of records) {
    try {
      const { data: cleanRecord, error } = cleanRecordForImport(record, ['name', 'country']);
      if (error) {
        result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error}`);
        continue;
      }
      
      await prisma.loadingPort.create({
        data: {
          name: cleanRecord.name,
          country: cleanRecord.country,
        }
      });
      result.success++;
    } catch (error: any) {
      result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error.message}`);
    }
  }
  
  return result;
}

async function importOrganizations(records: any[]) {
  const result = { success: 0, errors: [] as string[] };
  
  for (const record of records) {
    try {
      const { data: cleanRecord, error } = cleanRecordForImport(record, ['name']);
      if (error) {
        result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error}`);
        continue;
      }
      
      await prisma.organization.create({
        data: {
          name: cleanRecord.name,
          orgTypes: cleanRecord.orgTypes ? cleanRecord.orgTypes.split(";") : [],
        }
      });
      result.success++;
    } catch (error: any) {
      result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error.message}`);
    }
  }
  
  return result;
}

async function importPortsOfDischarge(records: any[]) {
  const result = { success: 0, errors: [] as string[] };
  
  for (const record of records) {
    try {
      const { data: cleanRecord, error } = cleanRecordForImport(record, ['name', 'country']);
      if (error) {
        result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error}`);
        continue;
      }
      
      await prisma.portOfDischarge.create({
        data: {
          name: cleanRecord.name,
          country: cleanRecord.country,
        }
      });
      result.success++;
    } catch (error: any) {
      result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error.message}`);
    }
  }
  
  return result;
}

async function importVessels(records: any[]) {
  const result = { success: 0, errors: [] as string[] };
  
  for (const record of records) {
    try {
      const { data: cleanRecord, error } = cleanRecordForImport(record, ['name']);
      if (error) {
        result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error}`);
        continue;
      }
      
      await prisma.vessel.create({
        data: cleanRecord
      });
      result.success++;
    } catch (error: any) {
      result.errors.push(`Row ${result.success + result.errors.length + 1}: ${error.message}`);
    }
  }
  
  return result;
}
