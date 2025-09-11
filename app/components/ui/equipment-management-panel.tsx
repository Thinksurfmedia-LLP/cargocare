"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Card } from "~/components/ui/card"
import { EquipmentCodePreview } from "~/components/ui/equipment-code-preview"

interface EquipmentManagementPanelProps {
  equipmentData: any[]
  onUpdateEquipment: (equipmentId: string, updates: any) => void
  onAddEquipment: (newEquipment: any) => void
}

export function EquipmentManagementPanel({ 
  equipmentData, 
  onUpdateEquipment, 
  onAddEquipment 
}: EquipmentManagementPanelProps) {
  const [newEquipment, setNewEquipment] = useState({
    name: "",
    code: "",
    description: ""
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  // Auto-generate code from name with conflict resolution
  const generateCodeFromName = (name: string, existingCodes: string[] = []) => {
    if (!name) return ""
    
    const type = name.toLowerCase().trim()
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

  const handleNameChange = (name: string) => {
    const existingCodes = equipmentData.map(eq => eq.code).filter(Boolean)
    setNewEquipment(prev => ({
      ...prev,
      name,
      code: generateCodeFromName(name, existingCodes)
    }))
  }

  const handleAddEquipment = () => {
    if (newEquipment.name.trim()) {
      onAddEquipment({
        ...newEquipment,
        code: newEquipment.code || generateCodeFromName(newEquipment.name)
      })
      setNewEquipment({ name: "", code: "", description: "" })
    }
  }

  const handleUpdateEquipment = (id: string, field: string, value: string) => {
    const updates: any = { [field]: value }
    
    // If updating name, also update code
    if (field === 'name') {
      updates.code = generateCodeFromName(value)
    }
    
    onUpdateEquipment(id, updates)
  }

  return (
    <div className="space-y-6">
      <EquipmentCodePreview 
        existingEquipment={equipmentData}
        onCodeGenerated={(name, code) => {
          if (newEquipment.name === name) {
            setNewEquipment(prev => ({ ...prev, code }))
          }
        }}
      />
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Add New Equipment Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="new_equipment_name">Equipment Name</Label>
            <Input
              id="new_equipment_name"
              value={newEquipment.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., 20ft Standard Container"
            />
          </div>
          <div>
            <Label htmlFor="new_equipment_code">Generated Code</Label>
            <Input
              id="new_equipment_code"
              value={newEquipment.code}
              onChange={(e) => setNewEquipment(prev => ({ ...prev, code: e.target.value }))}
              placeholder="Auto-generated code"
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1">Code is auto-generated from name</p>
          </div>
          <div>
            <Label htmlFor="new_equipment_description">Description (Optional)</Label>
            <Input
              id="new_equipment_description"
              value={newEquipment.description}
              onChange={(e) => setNewEquipment(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Equipment description"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={handleAddEquipment} disabled={!newEquipment.name.trim()}>
            Add Equipment Type
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Existing Equipment Types</h3>
        <div className="space-y-4">
          {equipmentData.map((equipment) => (
            <div key={equipment.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
              <div>
                <Label>Equipment Name</Label>
                {editingId === equipment.id ? (
                  <Input
                    value={equipment.name}
                    onChange={(e) => handleUpdateEquipment(equipment.id, 'name', e.target.value)}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                  />
                ) : (
                  <div 
                    className="p-2 border rounded cursor-pointer hover:bg-gray-50"
                    onClick={() => setEditingId(equipment.id)}
                  >
                    {equipment.name}
                  </div>
                )}
              </div>
              <div>
                <Label>Equipment Code</Label>
                <div className="p-2 border rounded bg-gray-50">
                  <span className="font-mono font-bold text-blue-600">
                    {equipment.code || generateCodeFromName(equipment.name)}
                  </span>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                {editingId === equipment.id ? (
                  <Input
                    value={equipment.description || ''}
                    onChange={(e) => handleUpdateEquipment(equipment.id, 'description', e.target.value)}
                    placeholder="Equipment description"
                  />
                ) : (
                  <div 
                    className="p-2 border rounded cursor-pointer hover:bg-gray-50"
                    onClick={() => setEditingId(equipment.id)}
                  >
                    {equipment.description || 'No description'}
                  </div>
                )}
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingId(editingId === equipment.id ? null : equipment.id)}
                >
                  {editingId === equipment.id ? 'Save' : 'Edit'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
