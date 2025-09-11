# Shipment Plan Copy Feature

## Overview
The **Copy Shipment Plan** feature allows users to duplicate an existing shipment plan with all its details, creating a new independent shipment plan that is not linked to any liner booking.

## How It Works

### 🔄 Copy Process
1. **Access**: Click the "📋 Copy" button in the Actions column of any shipment plan in the list
2. **Processing**: The system creates a duplicate with a new reference number
3. **Result**: A new shipment plan is created with all details preserved

### ✅ What Gets Copied
- **Party Information**: All shipper, customer, and consignee details
- **Equipment Details**: Container types, quantities, and specifications
- **Container Movement**: Ports, destinations, and routing information
- **Package Details**: Commodities, weights, volumes, and quantities
- **Commercial Details**: Pricing, payment terms, and commercial information
- **Special Instructions**: All custom instructions and requirements

### ❌ What Gets Reset
- **Reference Number**: New unique reference with "-COPY-[timestamp]" suffix
- **Booking Status**: Reset to "Awaiting MD Approval"
- **Container Tracking**: All tracking statuses reset to initial state
- **Liner Booking Link**: **NOT linked to any liner booking** ⚠️
- **Creation Date**: Set to current date/time
- **Created By**: Set to current user

### 📋 Reference Number Format
```
Original: SP-2024-001
Copied:   SP-2024-001-COPY-1704067200000
```

## Use Cases

### 1. **Similar Shipments** 🚢
Copy existing plans for similar routes, customers, or cargo types to save time on data entry.

### 2. **Template Creation** 📝
Use frequently shipped routes as templates by copying and modifying as needed.

### 3. **Seasonal Shipments** 📅
Duplicate annual or seasonal shipment patterns with minor modifications.

### 4. **Customer Preferences** 👥
Copy shipment plans that match specific customer preferences and requirements.

## Benefits

- ⏱️ **Time Saving**: Avoid re-entering complex shipment details
- 🎯 **Accuracy**: Reduce data entry errors by copying proven configurations
- 🔄 **Consistency**: Maintain standardized processes for similar shipments
- 🚀 **Efficiency**: Quick setup for recurring shipment patterns
- 🔒 **Independence**: Copied plans are completely independent of the original

## Security & Permissions

- Users can only copy shipment plans they have access to (own plans or admin access)
- Copied plans are owned by the user who performed the copy action
- All role-based access controls apply to copied plans

## Technical Notes

- The copy operation is atomic - either succeeds completely or fails without creating partial data
- Container tracking is completely reset to prevent confusion with original plan status
- No liner booking association ensures the copied plan can follow its own booking workflow
- Unique reference numbers prevent conflicts and aid in tracking

## UI/UX Features

- **Loading State**: Button shows "Copying..." during operation
- **Success Message**: Confirmation with link to view the copied plan
- **Error Handling**: Clear error messages if copy operation fails
- **Tooltip**: Helpful explanation on hover over Copy button
