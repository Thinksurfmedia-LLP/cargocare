"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select } from "~/components/ui/select"
import { SearchableSelect } from "~/components/ui/searchable-select"

interface BulkEquipmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (equipmentData: any) => void
  equipmentOptions: any[]
  existingEquipment: any[] // Add this to check for conflicts
}

export function BulkEquipmentModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  equipmentOptions,
  existingEquipment = [] 
}: BulkEquipmentModalProps) {
  const [formData, setFormData] = useState({
    equipment_type: "",
    quantity: 1,
    stuffing_point: "",
    empty_container_pick_up_from: "",
    container_handover_location: "",
    empty_container_pick_up_location: "",
    container_handover_at: "",
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  // Use the SAME code generation logic as the main form
  const generateEquipmentCode = (equipmentType: string, existingCodes: string[] = []) => {
    if (!equipmentType) return "EQP"
    
    // First, try to find the equipment in master data with a predefined code
    const equipmentMaster = equipmentOptions.find(
      (equipment: any) => equipment.name.toLowerCase() === equipmentType.toLowerCase()
    )
    
    if (equipmentMaster && equipmentMaster.code) {
      return equipmentMaster.code
    }
    
    // Fallback to intelligent code generation with conflict resolution
    return generateCodeFromName(equipmentType, existingCodes)
  }

  // SAME logic as main form - intelligent code generation with conflict resolution
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

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }))
    }
  }

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow empty string for user to clear and retype
    if (value === "") {
      setFormData(prev => ({ ...prev, quantity: 0 }))
    } else {
      const numValue = parseInt(value, 10)
      if (!isNaN(numValue) && numValue >= 0) {
        setFormData(prev => ({ ...prev, quantity: numValue }))
      }
    }
    
    // Clear error when user starts typing
    if (errors.quantity) {
      setErrors((prev) => ({
        ...prev,
        quantity: "",
      }))
    }
  }

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.equipment_type) {
      newErrors.equipment_type = "Equipment type is required"
    }

    if (!formData.quantity || formData.quantity < 1) {
      newErrors.quantity = "Quantity must be at least 1"
    }

    if (formData.quantity > 50) {
      newErrors.quantity = "Maximum 50 equipment can be created at once"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault()
  
  console.log("=== MODAL SUBMIT CLICKED ===")
  console.log("Form data:", formData)
  console.log("onSubmit function:", onSubmit)
  console.log("onSubmit type:", typeof onSubmit)

  if (validateForm()) {
    // Get existing equipment codes to avoid conflicts
    const existingCodes = existingEquipment
      .map(eq => {
        console.log("Processing existing equipment:", eq)
        return eq.trackingNumber?.split('-')[1]
      })
      .filter(Boolean)
    
    console.log("Existing codes from modal:", existingCodes)
    
    // Add equipment code to form data using SAME logic as main form
    const equipmentCode = generateEquipmentCode(formData.equipment_type, existingCodes)
    console.log("Generated equipment code in modal:", equipmentCode)
    
    const dataToSubmit = {
      ...formData,
      equipmentCode,
    }
    
    console.log("Data to submit from modal:", dataToSubmit)
    console.log("Calling onSubmit with data...")
    onSubmit(dataToSubmit)
    console.log("onSubmit called")
    
    // Reset form
    setFormData({
      equipment_type: "",
      quantity: 1,
      stuffing_point: "",
      empty_container_pick_up_from: "",
      container_handover_location: "",
      empty_container_pick_up_location: "",
      container_handover_at: "",
    })
    setErrors({})
    console.log("=== BULK MODAL SUBMIT END ===")
  } else {
    console.log("Form validation failed")
  }
}

  const handleClose = () => {
    setFormData({
      equipment_type: "",
      quantity: 1,
      stuffing_point: "",
      empty_container_pick_up_from: "",
      container_handover_location: "",
      empty_container_pick_up_location: "",
      container_handover_at: "",
    })
    setErrors({})
    onClose()
  }

  if (!isOpen) return null

  // Get existing codes for preview
  const existingCodes = existingEquipment
    .map(eq => eq.trackingNumber?.split('-')[1])
    .filter(Boolean)
  
  const previewCode = formData.equipment_type ? generateEquipmentCode(formData.equipment_type, existingCodes) : ""

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bulk Create Equipment</h2>
              <p className="text-sm text-gray-600 mt-1">Create multiple equipment entries of the same type</p>
            </div>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <span className="sr-only">Close</span>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
  {/* Don't add method="post" or action="" */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Equipment Type */}
            <div className="md:col-span-2">
              <Label htmlFor="bulk_equipment_type">
                Equipment Type <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                id="bulk_equipment_type"
                value={formData.equipment_type}
                onChange={(value) => handleInputChange("equipment_type", value)}
                options={equipmentOptions.map((equipment: any) => ({
                  value: equipment.name,
                  label: `📋 ${equipment.name}${equipment.code ? ` (${equipment.code})` : ''}`,
                }))}
                placeholder="Select equipment type"
                className={errors.equipment_type ? "border-red-300" : ""}
              />
              {errors.equipment_type && <p className="text-red-500 text-xs mt-1">{errors.equipment_type}</p>}
              
              {/* Show generated code preview */}
              {formData.equipment_type && (
                <p className="text-xs text-blue-600 mt-1">
                  Equipment Code: <strong>TEMP-{previewCode}-XXX</strong>
                  <span className="text-gray-500 ml-1">(TEMP will be replaced with shipment reference)</span>
                </p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <Label htmlFor="bulk_quantity">
                Quantity <span className="text-red-500">*</span>
              </Label>
              <Input
                id="bulk_quantity"
                type="number"
                min="1"
                max="50"
                value={formData.quantity || ""}
                onChange={handleQuantityChange}
                placeholder="Enter quantity"
                className={errors.quantity ? "border-red-300" : ""}
              />
              {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
              <p className="text-xs text-gray-500 mt-1">Each equipment will get a unique tracking number</p>
            </div>

            {/* Stuffing Point */}
            <div>
              <Label htmlFor="bulk_stuffing_point">Stuffing Point</Label>
              <Select
                id="bulk_stuffing_point"
                value={formData.stuffing_point}
                onChange={(e) => handleInputChange("stuffing_point", e.target.value)}
              >
                <option value="">Select stuffing point</option>
                <option value="Factory Stuffing">🏭 Factory Stuffing</option>
                <option value="CCL CFS Stuffing">📦 CCL CFS Stuffing</option>
              </Select>
            </div>

            {/* Conditionally render Factory Stuffing fields */}
            {formData.stuffing_point === "Factory Stuffing" && (
              <>
                <div>
                  <Label htmlFor="bulk_empty_container_pick_up_from">Empty Container Pick Up From</Label>
                  <Select
                    id="bulk_empty_container_pick_up_from"
                    value={formData.empty_container_pick_up_from}
                    onChange={(e) => handleInputChange("empty_container_pick_up_from", e.target.value)}
                  >
                    <option value="">Select pickup location</option>
                    <option value="ICD">🏢 ICD</option>
                    <option value="Port">🚢 Port</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="bulk_container_handover_location">Container Handover Location</Label>
                  <Select
                    id="bulk_container_handover_location"
                    value={formData.container_handover_location}
                    onChange={(e) => handleInputChange("container_handover_location", e.target.value)}
                  >
                    <option value="">Select handover location</option>
                    <option value="ICD">🏢 ICD</option>
                    <option value="Port">🚢 Port</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="bulk_empty_container_pick_up_location">Empty Container Pick up Location</Label>
                  <Input
                    id="bulk_empty_container_pick_up_location"
                    value={formData.empty_container_pick_up_location}
                    onChange={(e) => handleInputChange("empty_container_pick_up_location", e.target.value)}
                    placeholder="Enter empty container pickup location"
                  />
                </div>

                <div>
                  <Label htmlFor="bulk_container_handover_at">Container Handover At</Label>
                  <Input
                    id="bulk_container_handover_at"
                    value={formData.container_handover_at}
                    onChange={(e) => handleInputChange("container_handover_at", e.target.value)}
                    placeholder="Enter container handover location"
                  />
                </div>
              </>
            )}
          </div>

          {/* Preview */}
          {formData.equipment_type && formData.quantity > 0 && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">Preview</h4>
              <p className="text-sm text-blue-700">
                This will create <strong>{formData.quantity}</strong> individual equipment entries of type{" "}
                <strong>{formData.equipment_type}</strong>
                {formData.stuffing_point && (
                  <span>
                    {" "}
                    with <strong>{formData.stuffing_point}</strong>
                  </span>
                )}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Equipment codes: <strong>TEMP-{previewCode}-001</strong> to{" "}
                <strong>TEMP-{previewCode}-{String(formData.quantity).padStart(3, "0")}</strong>
              </p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
  type="submit"
  className="bg-blue-600 hover:bg-blue-700 text-white"
  disabled={!formData.equipment_type || !formData.quantity || formData.quantity < 1}
  onClick={() => {
    console.log("🔴 Create button clicked!")
    console.log("🔴 Form data:", formData)
    console.log("🔴 Button disabled?", !formData.equipment_type || !formData.quantity || formData.quantity < 1)
  }}
>
  Create {formData.quantity} Equipment{formData.quantity > 1 ? "s" : ""}
</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
