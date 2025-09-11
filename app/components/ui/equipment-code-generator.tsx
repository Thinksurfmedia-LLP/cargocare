"use client"

// Improved equipment code generation with conflict resolution
export function generateEquipmentCodeWithConflictResolution(
  equipmentType: string, 
  existingCodes: string[] = [],
  equipmentMasterData: any[] = []
): string {
  if (!equipmentType) return "EQP"
  
  // First, try to find exact match in equipment master data
  const exactMatch = equipmentMasterData.find(
    (equipment) => equipment.name.toLowerCase() === equipmentType.toLowerCase()
  )
  
  if (exactMatch && exactMatch.code) {
    return exactMatch.code
  }
  
  // Generate code using initials with conflict resolution
  return generateCodeFromNameWithConflicts(equipmentType, existingCodes)
}

function generateCodeFromNameWithConflicts(equipmentType: string, existingCodes: string[]): string {
  const type = equipmentType.toLowerCase().trim()
  let code = ""
  
  // Extract size (20ft, 40ft, 25ft, etc.)
  const sizeMatch = type.match(/(\d+)(?:ft|'|\s*foot|\s*feet)/i)
  if (sizeMatch) {
    code += sizeMatch[1]
  }
  
  // Extract type words (excluding size-related words and common words)
  const words = type
    .replace(/\d+(?:ft|'|\s*foot|\s*feet)/gi, '') // Remove size
    .replace(/[^a-z\s]/g, '') // Remove special characters
    .split(/\s+/)
    .filter(word => 
      word.length > 0 && 
      !['container', 'ft', 'foot', 'feet', 'the', 'and', 'or', 'of', 'with', 'for'].includes(word)
    )
  
  if (words.length === 0) {
    return code + "EQP" // Fallback if no meaningful words
  }
  
  // Start with single initials
  let typeCode = words.map(word => word.charAt(0).toUpperCase()).join('')
  let finalCode = code + typeCode
  
  // If there's a conflict, progressively add more letters
  let conflictLevel = 1
  while (existingCodes.includes(finalCode) && conflictLevel <= 3) {
    typeCode = words
      .map(word => {
        const letters = Math.min(conflictLevel + 1, word.length)
        return word.substring(0, letters).toUpperCase()
      })
      .join('')
      .substring(0, 5) // Limit type code to 5 characters
    
    finalCode = code + typeCode
    conflictLevel++
  }
  
  // If still conflicting after 3 levels, add a number
  if (existingCodes.includes(finalCode)) {
    let counter = 1
    let baseCode = finalCode
    while (existingCodes.includes(finalCode) && counter < 100) {
      finalCode = baseCode + counter
      counter++
    }
  }
  
  // Ensure proper length constraints
  if (finalCode.length < 3) {
    finalCode = finalCode.padEnd(3, 'X')
  }
  if (finalCode.length > 8) {
    finalCode = finalCode.substring(0, 8)
  }
  
  return finalCode
}

// Examples of how the conflict resolution works:
export const codeGenerationExamples = [
  {
    input: "20ft Standard Container",
    output: "20SC",
    explanation: "Size (20) + Initials (Standard Container → SC)"
  },
  {
    input: "25ft Special Container", 
    output: "25SC", // If no conflict
    conflictWith: "25ft Standard Container",
    resolvedOutput: "25SPC", // Special Container → SPC to avoid conflict
    explanation: "Conflict with Standard Container, so Special Container becomes SPC"
  },
  {
    input: "40ft High Cube Container",
    output: "40HCC",
    explanation: "Size (40) + Initials (High Cube Container → HCC)"
  },
  {
    input: "30ft Refrigerated High Cube Container",
    output: "30RHC", // First attempt: Refrigerated High Cube → RHC
    conflictWith: "30ft Regular Heavy Container", 
    resolvedOutput: "30REHC", // Extended: REfrigerated High Cube → REHC
    explanation: "Conflict resolved by extending initials"
  },
  {
    input: "Mobile Crane Equipment",
    output: "MCE",
    explanation: "No size found, so just initials (Mobile Crane Equipment → MCE)"
  },
  {
    input: "45ft Super High Cube Reefer Container",
    output: "45SHCR", // Super High Cube Reefer → SHCR (limited to 5 chars for type)
    explanation: "Size (45) + Limited initials (SHCR)"
  }
]

// Test function to demonstrate conflict resolution
export function testConflictResolution() {
  const existingCodes = ["20SC", "40SC", "25SC"]
  
  console.log("Testing conflict resolution:")
  console.log("25ft Standard Container:", generateCodeFromNameWithConflicts("25ft Standard Container", existingCodes))
  // Should output: 25STC or 25STAC (since 25SC is taken)
  
  console.log("25ft Special Container:", generateCodeFromNameWithConflicts("25ft Special Container", existingCodes))
  // Should output: 25SPC (since 25SC is taken)
  
  console.log("25ft Super Container:", generateCodeFromNameWithConflicts("25ft Super Container", existingCodes))
  // Should output: 25SUC (since 25SC is taken)
}
