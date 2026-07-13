"use client"

import type React from "react"
import { useState, useRef, useEffect, useContext } from "react"
import { FormReadOnlyContext } from "~/lib/form-readonly-context"

interface Option {
  value: string
  label: string
  icon?: string
}

interface SearchableSelectProps {
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  options: Option[]
  placeholder?: string
  className?: string
  disabled?: boolean
  onChange?: (value: string) => void
  onBlur?: () => void
}

export function SearchableSelect({
  id,
  name,
  value,
  defaultValue,
  options,
  placeholder = "Search and select...",
  className = "",
  disabled = false,
  onChange,
  onBlur,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedValue, setSelectedValue] = useState(value || defaultValue || "")
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fall back to the surrounding read-only context (e.g. a cancelled shipment plan)
  // when no explicit `disabled` prop is passed.
  const isReadOnlyContext = useContext(FormReadOnlyContext)
  const isDisabled = disabled || isReadOnlyContext

  // Function to update dropdown position (placeholder, not strictly needed for this fix)
  const updateDropdownPosition = () => {
    // This function was a placeholder in the previous response and is not directly related to the z-index fix.
    // It can be removed or kept as a no-op if no specific positioning logic is required.
  }

  // Filter options based on search term
  const filteredOptions = options.filter(
    (option) =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.value.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Get selected option for display
  const selectedOption = options.find((option) => option.value === selectedValue)

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value)
    } else if (defaultValue !== undefined) {
      setSelectedValue(defaultValue || "")
    }
  }, [value, defaultValue])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm("")
        setHighlightedIndex(-1)
        onBlur?.()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onBlur])

  const handleInputClick = () => {
    if (!isDisabled) {
      setIsOpen(true)
      setSearchTerm("")
    }
  }
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setHighlightedIndex(-1)
    if (!isOpen) {
      updateDropdownPosition()
      setIsOpen(true)
    }
  }

  const handleOptionClick = (option: Option) => {
    setSelectedValue(option.value)
    setIsOpen(false)
    setSearchTerm("")
    setHighlightedIndex(-1)
    onChange?.(option.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDisabled) return

    switch (e.key) {
      case "Enter":
        e.preventDefault()
        if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleOptionClick(filteredOptions[highlightedIndex])
        } else if (!isOpen) {
          setIsOpen(true)
        }
        break
      case "Escape":
        setIsOpen(false)
        setSearchTerm("")
        setHighlightedIndex(-1)
        inputRef.current?.blur()
        break
      case "ArrowDown":
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        } else {
          setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
        }
        break
      case "ArrowUp":
        e.preventDefault()
        if (isOpen) {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1))
        }
        break
    }
  }

  const displayValue = isOpen ? searchTerm : selectedOption ? selectedOption.label : ""

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={selectedValue} />

      {/* Main input */}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={displayValue}
          placeholder={placeholder}
          className={`w-full px-2 py-1 h-8 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 pr-10 ${
            isDisabled ? "bg-gray-100 cursor-not-allowed" : "bg-white cursor-text"
          } ${className}`}
          disabled={isDisabled}
          onClick={handleInputClick}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />

        {/* Dropdown arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? "transform rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-gray-500 text-sm">No options found</div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={option.value}
                className={`px-2 py-1.5 cursor-pointer flex items-center space-x-2 text-xs ${
                  index === highlightedIndex
                    ? "bg-blue-100 text-blue-900"
                    : selectedValue === option.value
                      ? "bg-blue-50 text-blue-800"
                      : "text-gray-900 hover:bg-gray-100"
                }`}
                onClick={() => handleOptionClick(option)}
              >
                {option.icon && <span>{option.icon}</span>}
                <span>{option.label}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
