"use client"

import type React from "react"
import { useState } from "react"
import { Card } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"

interface EquipmentCodePreviewProps {
  existingEquipment: any[]
  onCodeGenerated?: (name: string, code: string) => void
}

export function EquipmentCodePreview({ existingEquipment, onCodeGenerated }: EquipmentCodePreviewProps) {
  const [testName, setTestName] = useState("")

  // Same code generation logic as the main form
  const generateCodeFromName = (equipmentType: string, existingCodes: string[] = []) => {
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

  const handleTestNameChange = (name: string) => {
    setTestName(name)
    if (onCodeGenerated) {
      const existingCodes = existingEquipment.map(eq => eq.code).filter(Boolean)
      const generatedCode = generateCodeFromName(name, existingCodes)
      onCodeGenerated(name, generatedCode)
    }
  }

  const existingCodes = existingEquipment.map(eq => eq.code).filter(Boolean)
  const previewCode = testName ? generateCodeFromName(testName, existingCodes) : ""

  const examples = [
    { input: "20ft Standard Container", expected: "20SC" },
    { input: "25ft Special Container", expected: "25SC" },
    { input: "25ft Standard Container", expected: existingCodes.includes("25SC") ? "25STC" : "25SC" },
    { input: "40ft High Cube Container", expected: "40HCC" },
    { input: "30ft Refrigerated High Cube", expected: "30RHC" },
    { input: "Mobile Crane Equipment", expected: "MCE" },
  ]

  return (
    <Card className="p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Equipment Code Generator Preview</h3>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="test_equipment_name">Test Equipment Name</Label>
          <Input
            id="test_equipment_name"
            value={testName}
            onChange={(e) => handleTestNameChange(e.target.value)}
            placeholder="e.g., 25ft Special Container"
          />
          {previewCode && (
            <p className="text-sm text-blue-600 mt-1">
              Generated Code: <strong className="font-mono">{previewCode}</strong>
            </p>
          )}
        </div>

        <div>
          <h4 className="text-md font-semibold mb-2">Code Generation Examples</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {examples.map((example, index) => (
              <div key={index} className="flex justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-700">{example.input}</span>
                <span className="font-mono font-bold text-blue-600">
                  {generateCodeFromName(example.input, existingCodes)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-gray-500">
          <p><strong>Logic:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Extract size (20ft, 25ft, etc.) + Equipment type initials</li>
            <li>If conflict exists, extend initials (SC → STC → STAC)</li>
            <li>If still conflicting, add numbers (SC1, SC2, etc.)</li>
            <li>Examples: "25ft Special Container" → 25SC, but if 25SC exists → 25SPC</li>
          </ul>
        </div>
      </div>
    </Card>
  )
}
