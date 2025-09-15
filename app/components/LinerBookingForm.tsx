"use client";

import type React from "react";

import { Form, Link, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Select } from "~/components/ui/select";
import { SearchableSelect } from "~/components/ui/searchable-select";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/components/ui/toast";
import { useState, useEffect, useCallback } from "react";

export interface LinerBookingFormProps {
  mode: "new" | "edit";
  linerBooking?: any;
  availableShipmentPlans?: any[];
  dataPoints: {
    carriers: any[];
    vessels: any[];
    organizations: any[];
    equipment?: any[];
  };
  actionData?: any;
  user?: any;
  availableLinerBookings?: any[];
  isAssignment?: boolean;
  availableEquipment?: Array<{
    trackingNumber: string;
    equipmentType: string;
    displayName: string;
  }>;
}

export function LinerBookingForm({
  mode,
  linerBooking,
  availableShipmentPlans = [],
  dataPoints,
  actionData,
  user,
  availableLinerBookings = [],
  isAssignment = false,
  availableEquipment = [],
}: LinerBookingFormProps) {
  const navigation = useNavigation();
  const { addToast } = useToast();

  // Extract data from the JSON field for edit mode
  const data = mode === "edit" ? (linerBooking?.data as any) : null;

  // Initialize state for liner booking details - only show manually requested ones in Request Booking tab
  const [linerBookingDetails, setLinerBookingDetails] = useState(() => {
    if (mode === "edit" && data?.liner_booking_details && isAssignment) {
      // In assignment mode, filter out details that came from linked bookings
      // We'll identify linked details by checking if they match any available liner booking details
      const allDetails = data.liner_booking_details || [];

      // For now, start with empty array for Request Booking tab in assignment mode
      // Linked booking details will be shown separately in the Link Available tab
      return [];
    } else if (mode === "edit" && data?.liner_booking_details) {
      return data.liner_booking_details;
    }
    return [];
  });

  const [requestedBookingDetails, setRequestedBookingDetails] = useState(() => {
    if (mode === "edit" && data?.requested_booking_details) {
      return data.requested_booking_details;
    }
    return [];
  });

  // Track which booking details have been allocated
  const [allocatedBookingDetails, setAllocatedBookingDetails] = useState<
    Set<number>
  >(new Set());

  const [openSections, setOpenSections] = useState(() => {
    if (mode === "edit") {
      return {
        linkedPlan: true,
        linkToPlan: false,
        general: true,
        details: true, // Keep details open in edit mode
      };
    } else {
      return {
        linkToPlan: false,
        general: true,
        details: true, // Keep details open in new mode as well
      };
    }
  });

  const [currentStatus, setCurrentStatus] = useState(
    mode === "edit"
      ? data?.carrier_booking_status || "Awaiting MD Approval"
      : "Awaiting MD Approval"
  );

  const [unmappingRequested, setUnmappingRequested] = useState(
    mode === "edit" ? data?.unmapping_request || false : false
  );

  // Equipment validation for booking details
  const [equipmentValidation, setEquipmentValidation] = useState({
    isValid: false,
    message: "",
    remainingEquipment: {} as Record<string, number>,
  });

  const [bulkEquipmentType, setBulkEquipmentType] = useState<string>("");
  const [bulkQuantity, setBulkQuantity] = useState<string>(""); // allow empty while typing
  const [bulkMblNumber, setBulkMblNumber] = useState<string>("");
  const [bulkCarrier, setBulkCarrier] = useState<string>("");
  const [bulkTempBookingNumber, setBulkTempBookingNumber] =
    useState<string>("");
  const [bulkLinerBookingNumber, setBulkLinerBookingNumber] =
    useState<string>("");
  const [bulkSuffixTempBookingNumber, setBulkSuffixTempBookingNumber] =
    useState<string>("");

  const isSubmitting = navigation.state === "submitting";

  // Get equipment details from linked shipment plan
  const getShipmentPlanEquipment = () => {
    if (mode === "edit" && linerBooking?.shipmentPlan) {
      const planData = linerBooking.shipmentPlan.data as any;
      return planData?.equipment_details || [];
    }
    return [];
  };

  // Add this function after the getShipmentPlanEquipment function (around line 85)
  const getAvailableEquipmentForBookingDetail = (currentIndex: number) => {
    const allEquipment = getShipmentPlanEquipment();
    const selectedEquipment = linerBookingDetails
      .map((detail: any, index: number) => {
        // Don't filter out the current booking detail's selection
        if (index === currentIndex) return null;
        return detail.equipment_type
          ? detail.equipment_type.split("|")[1]
          : null; // Get tracking number
      })
      .filter(Boolean);

    return allEquipment.filter(
      (equipment: any) => !selectedEquipment.includes(equipment.trackingNumber)
    );
  };

  // Calculate total equipment required from shipment plan
  const calculateRequiredEquipment = () => {
    const equipment = getShipmentPlanEquipment();
    const required = {} as Record<string, number>;

    equipment.forEach((item: any) => {
      if (item.equipment_type && item.number_of_equipment) {
        const key = item.equipment_type;
        required[key] =
          (required[key] || 0) + Number.parseInt(item.number_of_equipment);
      }
    });

    return required;
  };

  const calculateAllocatedEquipment = () => {
    const allocated = {} as Record<string, number>;

    // Count from linked bookings (Link Available tab)
    linerBookingDetails.forEach((detail: any, index: number) => {
      if (detail.equipment_type) {
        // Handle both cases: "equipment_type|tracking" and just "equipment_type"
        const equipmentType = detail.equipment_type.includes("|")
          ? detail.equipment_type.split("|")[0]
          : detail.equipment_type;
        allocated[equipmentType] = (allocated[equipmentType] || 0) + 1;
      }
    });

    // Count from allocated requested bookings (Request Booking tab)
    requestedBookingDetails.forEach((detail: any, index: number) => {
      if (detail.equipment_type && allocatedBookingDetails.has(index)) {
        // Handle both cases: "equipment_type|tracking" and just "equipment_type"
        const equipmentType = detail.equipment_type.includes("|")
          ? detail.equipment_type.split("|")[0]
          : detail.equipment_type;
        allocated[equipmentType] = (allocated[equipmentType] || 0) + 1;
      }
    });

    return allocated;
  };

  const getUnallocatedEquipmentTypes = () => {
    if (mode !== "edit" || !linerBooking?.shipmentPlan) return [];

    const required = calculateRequiredEquipment();
    const allocated = calculateAllocatedEquipment();
    const allEquipment = getShipmentPlanEquipment();
    const unallocated: any[] = [];

    // Get already selected tracking numbers to exclude them
    const selectedTrackingNumbers = [
      // From linked bookings
      ...linerBookingDetails.map((detail: any) => {
        // Try to get tracking number from multiple sources
        if (detail.booking_for && detail.booking_for.includes("|")) {
          return detail.booking_for.split("|")[1]; // from booking_for field
        } else if (
          detail.equipment_type &&
          detail.equipment_type.includes("|")
        ) {
          return detail.equipment_type.split("|")[1]; // from equipment_type field
        } else if (detail.trackingNumber) {
          return detail.trackingNumber; // from direct trackingNumber field
        }
        return null;
      }),
      // From allocated requested bookings in assignment mode
      ...requestedBookingDetails
        .filter((detail: any, index: number) =>
          allocatedBookingDetails.has(index)
        )
        .map((detail: any) => {
          if (detail.trackingNumber) {
            return detail.trackingNumber;
          } else if (
            detail.equipment_type &&
            detail.equipment_type.includes("|")
          ) {
            return detail.equipment_type.split("|")[1];
          }
          return null;
        }),
    ].filter(Boolean);

    console.log(
      "[DEBUG] getUnallocatedEquipmentTypes - allocatedBookingDetails:",
      Array.from(allocatedBookingDetails)
    );
    console.log(
      "[DEBUG] getUnallocatedEquipmentTypes - requestedBookingDetails:",
      requestedBookingDetails.map((d, i) => ({
        index: i,
        trackingNumber: d.trackingNumber,
        allocated: allocatedBookingDetails.has(i),
      }))
    );
    console.log(
      "[DEBUG] getUnallocatedEquipmentTypes - selectedTrackingNumbers:",
      selectedTrackingNumbers
    );
    console.log(
      "[DEBUG] getUnallocatedEquipmentTypes - allEquipment count:",
      allEquipment.length
    );
    console.log(
      "[DEBUG] getUnallocatedEquipmentTypes - allEquipment:",
      allEquipment.map((eq) => `${eq.equipment_type}|${eq.trackingNumber}`)
    );

    for (const [equipmentType, requiredQty] of Object.entries(required)) {
      const allocatedQty = allocated[equipmentType] || 0;
      const remaining = requiredQty - allocatedQty;

      if (remaining > 0) {
        // Find available equipment of this type that hasn't been selected
        const availableEquipment = allEquipment.filter(
          (eq: any) =>
            eq.equipment_type === equipmentType &&
            !selectedTrackingNumbers.includes(eq.trackingNumber)
        );

        // Add up to the remaining quantity needed
        for (
          let i = 0;
          i < Math.min(remaining, availableEquipment.length);
          i++
        ) {
          unallocated.push(availableEquipment[i]);
        }
      }
    }

    console.log(
      "[DEBUG] getUnallocatedEquipmentTypes - final unallocated:",
      unallocated.map((eq) => `${eq.equipment_type}|${eq.trackingNumber}`)
    );
    return unallocated;
  };

  // Validate equipment allocation
  const validateEquipmentAllocation = useCallback(() => {
    if (mode !== "edit" || !linerBooking?.shipmentPlan) {
      setEquipmentValidation({
        isValid: true,
        message: "",
        remainingEquipment: {},
      });
      return;
    }

    const required = calculateRequiredEquipment();
    const allocated = calculateAllocatedEquipment();
    const remaining = {} as Record<string, number>;
    let isValid = true;
    let message = "";

    // Check if we have any equipment requirements
    if (Object.keys(required).length === 0) {
      setEquipmentValidation({
        isValid: true,
        message: "",
        remainingEquipment: {},
      });
      return;
    }

    // Calculate remaining equipment and check validation
    for (const [equipmentType, requiredQty] of Object.entries(required)) {
      const allocatedQty = allocated[equipmentType] || 0;
      remaining[equipmentType] = requiredQty - allocatedQty;

      if (remaining[equipmentType] > 0) {
        isValid = false;
      }
      if (remaining[equipmentType] < 0) {
        isValid = false;
        message = `Over-allocated ${equipmentType}: ${Math.abs(
          remaining[equipmentType]
        )} units excess`;
      }
    }

    if (!isValid && !message) {
      const remainingItems = Object.entries(remaining)
        .filter(([_, qty]) => qty > 0)
        .map(([type, qty]) => `${type}: ${qty} units`)
        .join(", ");
      message = `Remaining equipment to allocate: ${remainingItems}`;
    }

    if (isValid) {
      message = "All equipment properly allocated ✓";
    }

    setEquipmentValidation({ isValid, message, remainingEquipment: remaining });
  }, [
    mode,
    linerBooking?.shipmentPlan,
    linerBookingDetails,
    requestedBookingDetails,
    allocatedBookingDetails,
  ]);

  // Update state when data changes (after successful form submission)
  useEffect(() => {
    if (mode === "edit" && data) {
      setCurrentStatus(data?.carrier_booking_status || "Awaiting MD Approval");
      setUnmappingRequested(data?.unmapping_request || false);
    }
  }, [mode, data]);

  // Run validation when booking details change
  useEffect(() => {
    validateEquipmentAllocation();
  }, [
    linerBookingDetails,
    requestedBookingDetails,
    allocatedBookingDetails,
    mode,
    linerBooking?.shipmentPlan,
  ]);

  useEffect(() => {
    if (mode !== "edit") return;

    // Pull the latest details from the loader-provided data (assignment or liner booking mode)
    const nextDetails = Array.isArray(
      (linerBooking?.data as any)?.liner_booking_details
    )
      ? (linerBooking!.data as any).liner_booking_details
      : [];

    // Avoid unnecessary state churn if same length and same identity keys
    const sameLength = linerBookingDetails.length === nextDetails.length;
    const sameKeys =
      sameLength &&
      linerBookingDetails.every((d: any, i: number) => {
        const nd = nextDetails[i];
        const keyD = d?.temporary_booking_number || d?.liner_booking_number;
        const keyN = nd?.temporary_booking_number || nd?.liner_booking_number;
        return keyD === keyN;
      });

    if (!sameKeys) {
      setLinerBookingDetails(nextDetails);
    } else {
    }
  }, [
    mode,
    (linerBooking?.data as any)?.liner_booking_details, // depend on the actual captured data instead of linerBooking?.id
  ]);

  // Keep details section open after form submissions
  useEffect(() => {
    if (actionData && !actionData.error) {
      // If form was submitted successfully, keep details section open
      setOpenSections((prev) => ({ ...prev, details: true, general: true }));
    }
  }, [actionData]);

  // Handle navigation state changes to maintain form sections
  useEffect(() => {
    if (navigation.state === "loading" && navigation.formData) {
      // If "All Booking Assigned" was clicked, keep sections open
      const allBookingAssigned = navigation.formData.get(
        "all_booking_assigned"
      );
      if (allBookingAssigned) {
        setOpenSections((prev) => ({
          ...prev,
          details: true,
          general: true,
          linkedPlan:
            mode === "edit" && linerBooking?.shipmentPlan
              ? true
              : prev.linkedPlan,
        }));
      }
    }
  }, [navigation.state, navigation.formData, mode, linerBooking?.shipmentPlan]);

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Safely display data utility
  const renderData = (data: any, fallback = "N/A") => {
    if (data === null || data === undefined || data === "") return fallback;
    if (typeof data === "string") return data;
    if (typeof data === "number") return data.toString();
    if (typeof data === "boolean") return data ? "Yes" : "No";
    if (Array.isArray(data)) return data.length > 0 ? data : fallback;
    if (typeof data === "object") return JSON.stringify(data, null, 2);
    return fallback;
  };

  const renderArray = (array: any[], title: string) => {
    if (!Array.isArray(array) || array.length === 0) return null;

    return (
      <div className="mt-6">
        <h4 className="text-md font-semibold text-gray-800 mb-4">{title}</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                {Object.keys(array[0] || {}).map((key) => (
                  <th
                    key={key}
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b"
                  >
                    {key.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {array.map((item, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  {Object.entries(item).map(([key, value]) => (
                    <td
                      key={key}
                      className="px-4 py-2 text-sm text-gray-900 border-b"
                    >
                      {renderData(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const addLinerBookingDetail = () => {
    const newDetail = {
      original_planned_vessel: "",
      e_t_d_of_original_planned_vessel: "",
      change_in_original_vessel: false,
      revised_vessel: "",
      etd_of_revised_vessel: "",
      empty_pickup_validity_from: "",
      empty_pickup_validity_till: "",
      estimate_gate_opening_date: "",
      estimated_gate_cutoff_date: "",
      s_i_cut_off_date: "",
      booking_received_from_carrier_on: "",
      additional_remarks: "",
      line_booking_copy: "",
      equipment_type: "",
      booking_for: "",
    };

    if (isAssignment) {
      setRequestedBookingDetails([...requestedBookingDetails, newDetail]);
    } else {
      setLinerBookingDetails([...linerBookingDetails, newDetail]);
    }
  };

  function generateEquipmentCodeForBooking(equipmentType: string) {
    if (!equipmentType) return "EQP";
    const type = equipmentType.toLowerCase();

    if (
      type.includes("20ft standard container") ||
      type.includes("20' standard container")
    )
      return "20SC";
    if (
      type.includes("40ft standard container") ||
      type.includes("40' standard container")
    )
      return "40SC";

    if (
      type.includes("40ft high cube container") ||
      type.includes("40' high cube container")
    )
      return "40HCC";
    if (
      type.includes("45ft high cube container") ||
      type.includes("45' high cube container")
    )
      return "45HCC";

    if (
      type.includes("20ft refrigerated container") ||
      type.includes("20' refrigerated container")
    )
      return "20RC";
    if (
      type.includes("40ft refrigerated container") ||
      type.includes("40' refrigerated container")
    )
      return "40RC";

    if (
      type.includes("20ft open top container") ||
      type.includes("20' open top container")
    )
      return "20OTC";
    if (
      type.includes("40ft open top container") ||
      type.includes("40' open top container")
    )
      return "40OTC";

    if (
      type.includes("20ft flat rack container") ||
      type.includes("20' flat rack container")
    )
      return "20FRC";
    if (
      type.includes("40ft flat rack container") ||
      type.includes("40' flat rack container")
    )
      return "40FRC";

    if (
      type.includes("20ft tank container") ||
      type.includes("20' tank container")
    )
      return "20TC";
    if (
      type.includes("40ft tank container") ||
      type.includes("40' tank container")
    )
      return "40TC";

    if (type.includes("platform container")) return "PC";
    if (type.includes("bulk container")) return "BC";
    if (type.includes("ventilated container")) return "VC";
    if (type.includes("insulated container")) return "IC";
    if (type.includes("hard top container")) return "HTC";
    if (type.includes("side door container")) return "SDC";
    if (type.includes("double door container")) return "DDC";
    if (type.includes("thermal container")) return "TC";

    if (type.includes("20ft") || type.includes("20'")) {
      if (type.includes("dry")) return "20SC";
      if (type.includes("reefer")) return "20RC";
      return "20SC";
    }
    if (type.includes("40ft") || type.includes("40'")) {
      if (type.includes("dry")) return "40SC";
      if (type.includes("reefer")) return "40RC";
      if (type.includes("high cube") || type.includes("hc")) return "40HCC";
      return "40SC";
    }
    if (type.includes("45ft") || type.includes("45'")) return "45HCC";

    if (type.includes("lcl")) return "LCL";
    if (type.includes("break bulk")) return "BB";
    if (type.includes("roro")) return "RORO";

    return equipmentType
      .substring(0, 5)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .padEnd(3, "X");
  }

  const bulkAddLinerBookingDetails = () => {
    if (mode !== "new" && !isAssignment) return;
    const qty = Number.parseInt((bulkQuantity || "").trim(), 10);
    if (!bulkEquipmentType || !Number.isFinite(qty) || qty < 1) return;

    const code = generateEquipmentCodeForBooking(bulkEquipmentType);

    const currentDetails = isAssignment
      ? requestedBookingDetails
      : linerBookingDetails;
    // Avoid duplicates if user bulk-adds same type multiple times
    const existingCount = (currentDetails || []).filter(
      (d: any) =>
        typeof d?.temporary_booking_number === "string" &&
        d.temporary_booking_number.startsWith(`${code}-`)
    ).length;

    let newItems: any[] = [];

    if (isAssignment && availableEquipment.length > 0) {
      // In assignment mode, map to specific available equipment pieces
      const availableEquipmentOfType = availableEquipment.filter(
        (eq: any) => eq.equipmentType === bulkEquipmentType
      );

      const actualQty = Math.min(qty, availableEquipmentOfType.length);

      if (actualQty === 0) {
        console.warn(`No available equipment for type: ${bulkEquipmentType}`);
        return;
      }

      console.log(
        `[DEBUG] Assignment mode - Bulk adding ${actualQty} booking details for equipment type: ${bulkEquipmentType}`
      );
      console.log(
        `[DEBUG] Assignment mode - Available equipment:`,
        availableEquipmentOfType.map((eq: any) => eq.displayName)
      );

      newItems = availableEquipmentOfType
        .slice(0, actualQty)
        .map((equipment: any, i: number) => {
          const seq = String(existingCount + i + 1).padStart(3, "0");

          return {
            temporary_booking_number: `${code}-${seq}`,
            liner_booking_number: "",
            mbl_number: bulkMblNumber || "",
            carrier: bulkCarrier || "",
            contract: "",
            original_planned_vessel: "",
            e_t_d_of_original_planned_vessel: "",
            change_in_original_vessel: false,
            revised_vessel: "",
            etd_of_revised_vessel: "",
            empty_pickup_validity_from: "",
            empty_pickup_validity_till: "",
            estimate_gate_opening_date: "",
            estimated_gate_cutoff_date: "",
            s_i_cut_off_date: "",
            booking_received_from_carrier_on: "",
            additional_remarks: "",
            line_booking_copy: "",
            equipment_type: equipment.equipmentType, // Set the equipment type
            trackingNumber: equipment.trackingNumber, // Set the tracking number
            displayName: equipment.displayName, // Set the display name
            booking_for: equipment.displayName, // Set booking_for to display name
          };
        });
    } else {
      // For non-assignment mode or when no available equipment, use unallocated equipment
      const unallocatedEquipment = getUnallocatedEquipmentTypes();
      const availableEquipmentOfType = unallocatedEquipment.filter(
        (equipment: any) => equipment.equipment_type === bulkEquipmentType
      );

      const actualQty = Math.min(qty, availableEquipmentOfType.length);

      if (actualQty === 0) {
        console.warn(
          `No unallocated equipment available for type: ${bulkEquipmentType}`
        );
        return;
      }

      console.log(
        `[DEBUG] Bulk adding ${actualQty} booking details for equipment type: ${bulkEquipmentType}`
      );
      console.log(
        `[DEBUG] Available equipment:`,
        availableEquipmentOfType.map(
          (eq: any) => `${eq.equipment_type}|${eq.trackingNumber}`
        )
      );

      newItems = availableEquipmentOfType
        .slice(0, actualQty)
        .map((equipment: any, i: number) => {
          const seq = String(existingCount + i + 1).padStart(3, "0");
          const equipmentWithTracking = `${equipment.equipment_type}|${equipment.trackingNumber}`;

          return {
            temporary_booking_number: `${code}-${seq}`,
            liner_booking_number: "",
            mbl_number: bulkMblNumber || "",
            carrier: bulkCarrier || "",
            contract: "",
            original_planned_vessel: "",
            e_t_d_of_original_planned_vessel: "",
            change_in_original_vessel: false,
            revised_vessel: "",
            etd_of_revised_vessel: "",
            empty_pickup_validity_from: "",
            empty_pickup_validity_till: "",
            estimate_gate_opening_date: "",
            estimated_gate_cutoff_date: "",
            s_i_cut_off_date: "",
            booking_received_from_carrier_on: "",
            additional_remarks: "",
            line_booking_copy: "",
            equipment_type: equipmentWithTracking, // Include tracking number
            booking_for: equipmentWithTracking, // Mirror with tracking number
          };
        });
    }

    if (isAssignment) {
      setRequestedBookingDetails((prev: any[]) => [...prev, ...newItems]);
    } else {
      setLinerBookingDetails((prev: any[]) => [...prev, ...newItems]);
    }
  };

  const removeLinerBookingDetail = (index: number) => {
    if (isAssignment) {
      if (requestedBookingDetails.length > 1) {
        setRequestedBookingDetails(
          requestedBookingDetails.filter((_: any, i: number) => i !== index)
        );
      }
    } else {
      if (linerBookingDetails.length > 1) {
        setLinerBookingDetails(
          linerBookingDetails.filter((_: any, i: number) => i !== index)
        );
      }
    }
  };

  const updateLinerBookingDetail = (
    index: number,
    field: string,
    value: any
  ) => {
    if (isAssignment) {
      const updated = [...requestedBookingDetails];
      updated[index] = { ...updated[index], [field]: value };
      // Mirror behavior: in assignment mode keep booking_for in sync with selected equipment
      if (field === "equipment_type") {
        updated[index].booking_for = value || "";
      }
      // For assignment mode with available equipment, when displayName is set, update booking_for too
      if (field === "displayName" && availableEquipment.length > 0) {
        updated[index].booking_for = value || "";
      }
      setRequestedBookingDetails(updated);
    } else {
      const updated = [...linerBookingDetails];
      updated[index] = { ...updated[index], [field]: value };
      // Mirror behavior: in "new" mode keep booking_for in sync with selected equipment
      if (mode === "new" && field === "equipment_type") {
        updated[index].booking_for = value || "";
      }
      setLinerBookingDetails(updated);
    }
  };

  const handleUnmappingChange = (checked: boolean) => {
    setUnmappingRequested(checked);
    // Don't automatically change status - user will use the "Request Unmapping" button
  };

  const formatDateForInput = (dateValue: string | null | undefined) => {
    if (!dateValue) return "";
    try {
      const date = new Date(dateValue);
      return date.toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  // Handle form submission with validation
  const handleFormSubmit = (e: React.FormEvent) => {
    const formData = new FormData(e.target as HTMLFormElement);
    const allBookingAssigned = formData.get("all_booking_assigned");

    // If trying to mark as "All Booking Assigned" but validation fails
    if (allBookingAssigned && !equipmentValidation.isValid) {
      e.preventDefault();
      addToast({
        type: "error",
        title: "Equipment Allocation Error",
        description:
          equipmentValidation.message ||
          'Please allocate all required equipment before marking as "All Booking Assigned"',
        duration: 6000,
      });
      return;
    }

    // If validation passes, show success toast and keep sections open
    if (allBookingAssigned && equipmentValidation.isValid) {
      // Keep sections open for "All Booking Assigned"
      setOpenSections((prev) => ({
        ...prev,
        details: true,
        general: true,
        linkedPlan:
          mode === "edit" && linerBooking?.shipmentPlan
            ? true
            : prev.linkedPlan,
      }));

      addToast({
        type: "success",
        title: "Booking Status Updated",
        description:
          'All booking has been assigned successfully. Both liner booking and shipment plan are now marked as "Booked".',
        duration: 5000,
      });
    }
  };

  const [assignmentTab, setAssignmentTab] = useState<"request" | "link">(
    "request"
  );

  // State for accordion in booked view - expand first item by default
  const [expandedBookingDetail, setExpandedBookingDetail] = useState<
    number | null
  >(0);

  return (
    <>
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-sm">🚢</span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {mode === "edit" ? "Edit Liner Booking" : "New Liner Booking"}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {mode === "edit"
                    ? "Update liner booking record with carrier details"
                    : "Create a new liner booking record"}
                </p>
              </div>
            </div>
            <Link
              to="/liner-bookings"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all duration-200"
            >
              <span className="mr-1">←</span>
              Back to List
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        {actionData?.error && (
          <div className="mb-8 bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">
                  Error {mode === "edit" ? "updating" : "creating"} liner
                  booking
                </p>
                <p className="text-sm text-red-600 mt-1">{actionData.error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto">
          <Form
            method="post"
            className="space-y-8"
            onSubmit={handleFormSubmit}
            encType="multipart/form-data"
          >
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Liner Booking Details
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {mode === "edit"
                        ? "Update the details for your liner booking"
                        : "Enter the details for your new liner booking"}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-xs bg-amber-400 px-2 py-1 rounded-full">
                      {mode === "edit" ? "Editing" : "Creating"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {/* Linked Shipment Plan Information - Only in Edit Mode */}
                {mode === "edit" && linerBooking?.shipmentPlan && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => toggleSection("linkedPlan")}
                      className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                            openSections.linkedPlan
                              ? "bg-green-100 text-green-600"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <span className="text-sm">🔗</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            Linked Shipment Plan
                          </h3>
                          <p className="text-sm text-gray-500">
                            Details from the connected shipment plan (read-only)
                          </p>
                        </div>
                      </div>
                      <div
                        className={`transform transition-transform duration-200 ${
                          openSections.linkedPlan ? "rotate-180" : ""
                        }`}
                      >
                        <span className="text-gray-400">↓</span>
                      </div>
                    </button>

                    {openSections.linkedPlan && (
                      <div className="px-6 pb-6 bg-green-50/30">
                        <div className="pt-4">
                          {/* Basic Information Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">
                                Reference Number
                              </Label>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                                {renderData(
                                  (linerBooking.shipmentPlan?.data as any)
                                    ?.reference_number
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">
                                Business Branch
                              </Label>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                                {renderData(
                                  (linerBooking.shipmentPlan?.data as any)
                                    ?.bussiness_branch
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">
                                Shipment Type
                              </Label>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                                {renderData(
                                  (linerBooking.shipmentPlan?.data as any)
                                    ?.shipment_type
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">
                                Booking Status
                              </Label>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                                {renderData(
                                  (linerBooking.shipmentPlan?.data as any)
                                    ?.booking_status
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">
                                Customer
                              </Label>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                                {renderData(
                                  (linerBooking.shipmentPlan?.data as any)
                                    ?.container_movement?.customer
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">
                                Created By
                              </Label>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                                {renderData(
                                  linerBooking.shipmentPlan?.user?.name
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">
                                Loading Port
                              </Label>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                                {renderData(
                                  (linerBooking.shipmentPlan?.data as any)
                                    ?.container_movement?.loading_port
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">
                                Port of Discharge
                              </Label>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                                {renderData(
                                  (linerBooking.shipmentPlan?.data as any)
                                    ?.container_movement?.port_of_discharge
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">
                                Destination Country
                              </Label>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                                {renderData(
                                  (linerBooking.shipmentPlan?.data as any)
                                    ?.container_movement?.destination_country
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">
                                Final Place of Delivery
                              </Label>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                                {renderData(
                                  (linerBooking.shipmentPlan?.data as any)
                                    ?.container_movement
                                    ?.final_place_of_delivery
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">
                                Delivery Till
                              </Label>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                                {renderData(
                                  (linerBooking.shipmentPlan?.data as any)
                                    ?.container_movement?.delivery_till
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-semibold text-gray-700">
                                Created Date
                              </Label>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                                {linerBooking.shipmentPlan?.createdAt
                                  ? new Date(
                                      linerBooking.shipmentPlan.createdAt
                                    ).toLocaleDateString()
                                  : "N/A"}
                              </div>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label className="text-sm font-semibold text-gray-700">
                                Shipment Plan Remarks
                              </Label>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                                {renderData(
                                  (linerBooking.shipmentPlan?.data as any)
                                    ?.remarks
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Array Data as Tables */}
                          {renderArray(
                            (linerBooking.shipmentPlan?.data as any)
                              ?.package_details,
                            "Package Details"
                          )}
                          {renderArray(
                            (linerBooking.shipmentPlan?.data as any)
                              ?.equipment_details,
                            "Equipment Details"
                          )}

                          {renderArray(
                            [
                              (linerBooking.shipmentPlan?.data as any)
                                ?.container_movement,
                            ],
                            "Container Movement Details"
                          )}
                          {renderArray(
                            [
                              (linerBooking.shipmentPlan?.data as any)
                                ?.container_movement
                                ?.carrier_and_vessel_preference,
                            ],
                            "Carrier and Vessel Preferences"
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Shipment Plan Linking Section - For Edit Mode without linked plan or New Mode */}
                {/* {((mode === "edit" &&
                  (!linerBooking?.shipmentPlan ||
                    currentStatus === "Ready for Re-linking")) ||
                  mode === "new") && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => toggleSection("linkToPlan")}
                      className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                            openSections.linkToPlan
                              ? "bg-blue-100 text-blue-600"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <span className="text-sm">🔗</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            Link to Shipment Plan
                          </h3>
                          <p className="text-sm text-gray-500">
                            {mode === "new"
                              ? "Connect this liner booking to a shipment plan"
                              : "Re-link this liner booking to a different shipment plan"}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`transform transition-transform duration-200 ${
                          openSections.linkToPlan ? "rotate-180" : ""
                        }`}
                      >
                        <span className="text-gray-400">↓</span>
                      </div>
                    </button>

                    {openSections.linkToPlan && (
                      <div className="px-6 pb-6 bg-blue-50/30">
                        <div className="pt-4">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label
                                htmlFor="link_to_shipment_plan"
                                className="text-sm font-semibold text-gray-700"
                              >
                                Select Shipment Plan
                              </Label>
                              <Select
                                id="link_to_shipment_plan"
                                name="link_to_shipment_plan"
                                className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value="">
                                  -- Select a shipment plan --
                                </option>
                                {availableShipmentPlans.map((plan) => (
                                  <option key={plan.id} value={plan.id}>
                                    {(plan.data as any)?.reference_number ||
                                      plan.id}{" "}
                                    -
                                    {(plan.data as any)?.container_movement
                                      ?.customer || "No Customer"}{" "}
                                    -
                                    {new Date(
                                      plan.createdAt
                                    ).toLocaleDateString()}
                                  </option>
                                ))}
                              </Select>
                            </div>

                            <div className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                              <strong>Note:</strong> Linking will connect this
                              liner booking to the selected shipment plan. Both
                              records will be updated to reflect this
                              relationship.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )} */}

                {/* General Information Section - Show only for assignment mode (not new bookings, not regular edit) */}
                {mode !== "new" && isAssignment && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleSection("general")}
                    className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                          openSections.general
                            ? "bg-blue-100 text-blue-600"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <span className="text-sm">📋</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          General Information
                        </h3>
                        <p className="text-sm text-gray-500">
                          Basic liner booking settings and status
                        </p>
                      </div>
                    </div>
                    <div
                      className={`transform transition-transform duration-200 ${
                        openSections.general ? "rotate-180" : ""
                      }`}
                    >
                      <span className="text-gray-400">↓</span>
                    </div>
                  </button>

                  {openSections.general && (
                    <div className="px-6 pb-6 bg-blue-50/30">
                      <div className="space-y-6">
                        {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label
                              htmlFor="carrier_booking_status"
                              className="text-sm font-semibold text-gray-700"
                            >
                              Carrier Booking Status
                            </Label>
                            <Select
                              id="carrier_booking_status"
                              name="carrier_booking_status"
                              value={currentStatus}
                              disabled={true}
                              onChange={(e) => setCurrentStatus(e.target.value)}
                              className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="Awaiting MD Approval">
                                Awaiting MD Approval
                              </option>
                              <option value="Approved by MD for Booking">
                                Approved by MD for Booking
                              </option>
                              <option value="Booked">Booked</option>
                              <option value="Ready for Re-linking">
                                Ready for Re-linking
                              </option>
                              <option value="Unmapping Requested">
                                Unmapping Requested
                              </option>
                              <option value="Unmapping Approval">
                                Unmapping Approval
                              </option>
                            </Select>
                            
                            <input
                              type="hidden"
                              name="current_status"
                              value={currentStatus}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label
                              htmlFor="booking_released_to"
                              className="text-sm font-semibold text-gray-700"
                            >
                              Booking Released To
                            </Label>
                            <SearchableSelect
                              name="booking_released_to"
                              placeholder="Search organizations..."
                              className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              options={dataPoints.organizations.map((org) => ({
                                value: org.name,
                                label: org.name,
                              }))}
                              value={
                                mode === "edit"
                                  ? data?.booking_released_to || ""
                                  : ""
                              }
                            />
                          </div>
                        </div> */}

                        {/* Unmapping Section - Show for different states */}
                        {mode === "edit" &&
                          (currentStatus === "Booked" ||
                            currentStatus === "Unmapping Requested" ||
                            currentStatus === "Unmapping Approval") && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                              <div className="flex items-start space-x-3">
                                <Checkbox
                                  id="unmapping_request"
                                  name="unmapping_request"
                                  checked={unmappingRequested}
                                  onChange={(e) =>
                                    handleUnmappingChange(e.target.checked)
                                  }
                                  className="mt-1"
                                  disabled={
                                    currentStatus === "Unmapping Requested" ||
                                    currentStatus === "Unmapping Approval"
                                  }
                                  value="true"
                                />
                                <div className="flex-1">
                                  <Label
                                    htmlFor="unmapping_request"
                                    className="text-sm font-semibold text-gray-700"
                                  >
                                    {currentStatus === "Booked"
                                      ? "Request Unmapping"
                                      : currentStatus === "Unmapping Requested"
                                      ? "Unmapping Requested"
                                      : "Unmapping Under Review"}
                                  </Label>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {currentStatus === "Booked"
                                      ? "Check this to request unmapping from the linked shipment plan"
                                      : currentStatus === "Unmapping Requested"
                                      ? "Your unmapping request is pending approval"
                                      : "The unmapping request is being reviewed by administrators"}
                                  </p>
                                </div>
                              </div>

                              {(unmappingRequested ||
                                currentStatus === "Unmapping Requested" ||
                                currentStatus === "Unmapping Approval") && (
                                <div className="mt-4 space-y-4">
                                  <div className="space-y-2">
                                    <Label
                                      htmlFor="unmapping_reason"
                                      className="text-sm font-semibold text-gray-700"
                                    >
                                      Unmapping Reason{" "}
                                      <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                      id="unmapping_reason"
                                      name="unmapping_reason"
                                      defaultValue={
                                        mode === "edit"
                                          ? data?.unmapping_reason || ""
                                          : ""
                                      }
                                      placeholder="Please provide a reason for unmapping..."
                                      rows={3}
                                      className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      required={
                                        unmappingRequested ||
                                        currentStatus === "Unmapping Requested"
                                      }
                                      disabled={
                                        currentStatus === "Unmapping Approval"
                                      }
                                    />
                                  </div>

                                  {/* Request Unmapping Button - Only show when checkbox is checked and status is still Booked */}
                                  {unmappingRequested &&
                                    currentStatus === "Booked" && (
                                      <div className="flex justify-end">
                                        <Button
                                          type="submit"
                                          name="request_unmapping"
                                          value="true"
                                          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                                        >
                                          Request Unmapping
                                        </Button>
                                      </div>
                                    )}
                                </div>
                              )}

                              {/* Status Information for Pending Approval */}
                              {currentStatus === "Unmapping Requested" && (
                                <div className="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-300">
                                  <h5 className="text-sm font-semibold text-yellow-800 mb-1">
                                    Pending Approval
                                  </h5>
                                  <p className="text-sm text-yellow-700">
                                    Your unmapping request is pending approval.
                                    Please check the linked Shipment Plan for
                                    admin approval actions.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                        {/* Re-linking Section for Ready for Re-linking status */}
                        {/* {mode === "edit" &&
                          currentStatus === "Ready for Re-linking" && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                Ready for Re-linking
                              </h4>
                              <p className="text-sm text-gray-600 mb-4">
                                This liner booking has been unmapped and is
                                ready to be linked to a new shipment plan. Use
                                the "Link to Shipment Plan" section below to
                                connect it to a new plan.
                              </p>
                              <div className="flex items-center text-sm text-blue-700">
                                <span className="mr-2">💡</span>
                                Select a shipment plan from the linking section
                                to complete the re-linking process.
                              </div>
                            </div>
                          )} */}

                        {/* Equipment Validation Display - Only for Edit Mode with Shipment Plan */}
                        {mode === "edit" &&
                          linerBooking?.shipmentPlan &&
                          getShipmentPlanEquipment().length > 0 && (
                            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                              <h4 className="text-sm font-medium text-gray-900 mb-2">
                                Equipment Allocation Status
                              </h4>
                              <div className="text-xs text-gray-600 mb-2">
                                {equipmentValidation.message}
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-4">
                                <div>
                                  <h5 className="text-xs font-medium text-gray-600 mb-1">
                                    Required Equipment:
                                  </h5>
                                  {Object.entries(
                                    calculateRequiredEquipment()
                                  ).map(([type, qty]) => (
                                    <div
                                      key={type}
                                      className="text-xs text-gray-700"
                                    >
                                      {type}: {qty} units
                                    </div>
                                  ))}
                                </div>
                                <div>
                                  <h5 className="text-xs font-medium text-gray-600 mb-1">
                                    Allocated Equipment:
                                  </h5>
                                  {Object.entries(
                                    calculateAllocatedEquipment()
                                  ).map(([type, qty]) => (
                                    <div
                                      key={type}
                                      className="text-xs text-gray-700"
                                    >
                                      {type}: {qty} units
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                        {/* All Booking Assigned Button - Only for Edit Mode */}
                        {mode === "edit" &&
                          currentStatus !== "Booked" &&
                          linerBooking?.shipmentPlan && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700">
                                    All Booking Assigned
                                  </h4>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {equipmentValidation.isValid
                                      ? 'Click to mark both liner booking and linked shipment plan as "Booked"'
                                      : "Complete equipment allocation to enable this option"}
                                  </p>
                                </div>
                                <Button
                                  type="submit"
                                  name="all_booking_assigned"
                                  value="true"
                                  disabled={!equipmentValidation.isValid}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    equipmentValidation.isValid
                                      ? "bg-green-600 hover:bg-green-700 text-white"
                                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                  }`}
                                >
                                  All Booking Assigned
                                </Button>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* Liner Booking Details Section */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleSection("details")}
                    className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                          openSections.details
                            ? "bg-purple-100 text-purple-600"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <span className="text-sm">📦</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          Liner Booking Details ({linerBookingDetails.length})
                        </h3>
                        <p className="text-sm text-gray-500">
                          Detailed booking information and vessel schedules
                        </p>
                      </div>
                    </div>
                    <div
                      className={`transform transition-transform duration-200 ${
                        openSections.details ? "rotate-180" : ""
                      }`}
                    >
                      <span className="text-gray-400">↓</span>
                    </div>
                  </button>

                  {openSections.details && (
                    <div className="px-6 pb-6 bg-purple-50/30">
                      <div className="pt-4">
                        {isAssignment && currentStatus !== "Booked" && (
                          <div className="mb-6">
                            <div className="inline-flex rounded-md shadow-sm border border-purple-200 overflow-hidden">
                              <button
                                type="button"
                                className={`px-4 py-2 text-sm font-medium ${
                                  assignmentTab === "request"
                                    ? "bg-purple-600 text-white"
                                    : "bg-white text-purple-700 hover:bg-purple-50"
                                }`}
                                onClick={() => setAssignmentTab("request")}
                              >
                                Request Booking
                              </button>
                              <button
                                type="button"
                                className={`px-4 py-2 text-sm font-medium border-l border-purple-200 ${
                                  assignmentTab === "link"
                                    ? "bg-purple-600 text-white"
                                    : "bg-white text-purple-700 hover:bg-purple-50"
                                }`}
                                onClick={() => setAssignmentTab("link")}
                              >
                                Link Available
                              </button>
                            </div>
                            <p className="mt-2 text-xs text-gray-600">
                              Use Request Booking to allocate new bookings; use
                              Link Available to attach existing available liner
                              bookings to this assignment.
                            </p>
                          </div>
                        )}

                        {/* Show read-only booked details when status is "Booked" */}
                        {isAssignment && currentStatus === "Booked" && (
                          <div className="mb-6">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <h4 className="text-md font-semibold text-green-800">
                                  Assignment Booked
                                </h4>
                              </div>
                              <p className="mt-2 text-sm text-green-700">
                                This shipment assignment has been successfully
                                booked. All liner booking details are finalized
                                and displayed below.
                              </p>
                            </div>
                          </div>
                        )}

                        {isAssignment &&
                        assignmentTab === "link" &&
                        currentStatus !== "Booked" ? (
                          <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <h4 className="text-md font-semibold text-gray-800 mb-3">
                              Available Liner Bookings
                            </h4>

                            {availableLinerBookings.length === 0 ? (
                              <div className="text-sm text-gray-600">
                                No available liner bookings to link.
                              </div>
                            ) : (
                              <div className="max-h-80 overflow-auto border border-gray-100 rounded-md">
                                <div className="overflow-x-auto">
                                  <table className="min-w-full">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          Select
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          Temp Booking #
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          Equipment
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          Liner Booking #
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          MBL Number
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          Created
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          Actions
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                      {availableLinerBookings.map((b: any) => {
                                        const d = Array.isArray(
                                          b?.data?.liner_booking_details
                                        )
                                          ? b.data.liner_booking_details[0]
                                          : null;
                                        const temp =
                                          d?.temporary_booking_number || "N/A";
                                        const eqp = d?.equipment_type || "N/A";
                                        const linerBookingNumber =
                                          d?.liner_booking_number || "N/A";
                                        const mblNumber =
                                          d?.mbl_number || "N/A";
                                        const isLinked =
                                          b.shipmentPlanId ===
                                          linerBooking?.shipmentPlan?.id;
                                        const canUnlink =
                                          isLinked &&
                                          linerBooking?.data
                                            ?.carrier_booking_status !==
                                            "Booked";

                                        return (
                                          <tr
                                            key={b.id}
                                            className={`hover:bg-gray-50 ${
                                              isLinked ? "bg-blue-50" : ""
                                            }`}
                                          >
                                            <td className="px-3 py-2 whitespace-nowrap">
                                              <input
                                                type="checkbox"
                                                name="selectedAvailableIds"
                                                value={b.id}
                                                className="h-4 w-4"
                                                disabled={isLinked}
                                              />
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-800 whitespace-nowrap">
                                              <div className="flex items-center gap-2">
                                                {temp}
                                                {isLinked && (
                                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    Linked
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                                              {eqp}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                                              <span
                                                className={
                                                  linerBookingNumber !== "N/A"
                                                    ? "font-medium text-blue-600"
                                                    : "text-gray-500"
                                                }
                                              >
                                                {linerBookingNumber}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                                              {mblNumber}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
                                              {b.createdAt
                                                ? new Date(
                                                    b.createdAt
                                                  ).toLocaleDateString()
                                                : "N/A"}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                              {canUnlink && (
                                                <Button
                                                  type="submit"
                                                  name="_action"
                                                  value="unlink_booking"
                                                  className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1"
                                                  onClick={(e) => {
                                                    const form =
                                                      e.currentTarget.form;
                                                    if (form) {
                                                      const existingInputs =
                                                        form.querySelectorAll(
                                                          'input[name="bookingId"]'
                                                        );
                                                      existingInputs.forEach(
                                                        (input) =>
                                                          input.remove()
                                                      );

                                                      const input =
                                                        document.createElement(
                                                          "input"
                                                        );
                                                      input.type = "hidden";
                                                      input.name = "bookingId";
                                                      input.value = b.id;
                                                      form.appendChild(input);
                                                    }
                                                  }}
                                                >
                                                  Unlink
                                                </Button>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            <div className="mt-4 flex justify-end">
                              {/* Submit using the outer form, with a specific _action */}
                              <Button
                                type="submit"
                                name="_action"
                                value="link_available"
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                Link Selected
                              </Button>
                            </div>

                            <div className="mt-3 rounded-md bg-green-50 border border-green-200 p-3 text-xs text-green-800">
                              Tip: Linked bookings will be attached to this
                              shipment plan and show with a "Linked" badge. You
                              can unlink them before clicking "All Booking
                              Assigned". Once booked, unlinking is not allowed.
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Show read-only booked details when status is "Booked" */}
                            {isAssignment && currentStatus === "Booked" ? (
                              <div>
                                <h4 className="text-md font-semibold text-gray-800 mb-4">
                                  Booked Liner Booking Details
                                </h4>
                                <div className="space-y-2">
                                  {data?.liner_booking_details?.map(
                                    (detail: any, index: number) => {
                                      const isExpanded =
                                        expandedBookingDetail === index;

                                      return (
                                        <div
                                          key={index}
                                          className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                                        >
                                          {/* Accordion Header */}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedBookingDetail(
                                                isExpanded ? null : index
                                              )
                                            }
                                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:bg-gray-50"
                                          >
                                            <div className="flex items-center gap-3">
                                              <h5 className="text-sm font-semibold text-gray-700">
                                                Booking Detail #{index + 1}
                                              </h5>
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Booked
                                              </span>
                                              {detail.liner_booking_number && (
                                                <span className="text-xs font-medium text-blue-600">
                                                  {detail.liner_booking_number}
                                                </span>
                                              )}
                                            </div>
                                            <div
                                              className={`transition-transform duration-200 ${
                                                isExpanded ? "rotate-180" : ""
                                              }`}
                                            >
                                              <svg
                                                className="w-4 h-4 text-gray-500"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M19 9l-7 7-7-7"
                                                />
                                              </svg>
                                            </div>
                                          </button>

                                          {/* Accordion Content */}
                                          {isExpanded && (
                                            <div className="px-4 pb-4 border-t border-gray-100">
                                              <div className="pt-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Equipment Type
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.equipment_type ||
                                                        "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Temporary Booking Number
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.temporary_booking_number ||
                                                        "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Suffix for Anticipatory
                                                      Temp Booking Number
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.suffix_for_anticipatory_temporary_booking_number ||
                                                        "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Liner Booking Number
                                                    </Label>
                                                    <p className="mt-1 font-medium text-blue-600">
                                                      {detail.liner_booking_number ||
                                                        "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      MBL Number
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.mbl_number ||
                                                        "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Carrier
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.carrier || "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Contract
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.contract || "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Original Planned Vessel
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.original_planned_vessel ||
                                                        "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      ETD of Original Planned
                                                      Vessel
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.e_t_d_of_original_planned_vessel
                                                        ? new Date(
                                                            detail.e_t_d_of_original_planned_vessel
                                                          ).toLocaleDateString()
                                                        : "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Change in Original Vessel
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.change_in_original_vessel ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                          Yes
                                                        </span>
                                                      ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                          No
                                                        </span>
                                                      )}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Revised Vessel
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.revised_vessel ||
                                                        "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      ETD of Revised Vessel
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.etd_of_revised_vessel
                                                        ? new Date(
                                                            detail.etd_of_revised_vessel
                                                          ).toLocaleDateString()
                                                        : "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Empty Pickup From
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.empty_pickup_validity_from
                                                        ? new Date(
                                                            detail.empty_pickup_validity_from
                                                          ).toLocaleDateString()
                                                        : "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Empty Pickup Till
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.empty_pickup_validity_till
                                                        ? new Date(
                                                            detail.empty_pickup_validity_till
                                                          ).toLocaleDateString()
                                                        : "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Gate Opening Date
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.estimate_gate_opening_date
                                                        ? new Date(
                                                            detail.estimate_gate_opening_date
                                                          ).toLocaleDateString()
                                                        : "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Gate Cutoff Date
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.estimated_gate_cutoff_date
                                                        ? new Date(
                                                            detail.estimated_gate_cutoff_date
                                                          ).toLocaleDateString()
                                                        : "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      SI Cut Off Date
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.s_i_cut_off_date
                                                        ? new Date(
                                                            detail.s_i_cut_off_date
                                                          ).toLocaleDateString()
                                                        : "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Booking Received On
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.booking_received_from_carrier_on
                                                        ? new Date(
                                                            detail.booking_received_from_carrier_on
                                                          ).toLocaleDateString()
                                                        : "N/A"}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Line Booking Copy (URL)
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.line_booking_copy ? (
                                                        <a
                                                          href={
                                                            detail.line_booking_copy
                                                          }
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="text-blue-600 hover:text-blue-800 underline break-all"
                                                        >
                                                          {
                                                            detail.line_booking_copy
                                                          }
                                                        </a>
                                                      ) : (
                                                        "N/A"
                                                      )}
                                                    </p>
                                                  </div>

                                                  <div>
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Line Booking Copy (PDF
                                                      File)
                                                    </Label>
                                                    <p className="mt-1 text-gray-900">
                                                      {detail.line_booking_copy_file ? (
                                                        <a
                                                          href={
                                                            detail.line_booking_copy_file
                                                          }
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 underline"
                                                        >
                                                          <svg
                                                            className="w-4 h-4"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                          >
                                                            <path
                                                              strokeLinecap="round"
                                                              strokeLinejoin="round"
                                                              strokeWidth={2}
                                                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                            />
                                                          </svg>
                                                          View PDF
                                                        </a>
                                                      ) : (
                                                        "N/A"
                                                      )}
                                                    </p>
                                                  </div>
                                                </div>

                                                {detail.additional_remarks && (
                                                  <div className="mt-4">
                                                    <Label className="text-xs font-medium text-gray-500">
                                                      Additional Remarks
                                                    </Label>
                                                    <p className="mt-1 text-gray-900 text-sm bg-gray-50 p-2 rounded border">
                                                      {
                                                        detail.additional_remarks
                                                      }
                                                    </p>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                  )}

                                  {(!data?.liner_booking_details ||
                                    data.liner_booking_details.length ===
                                      0) && (
                                    <div className="text-center py-8 text-gray-500">
                                      <p>No liner booking details found.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* original request booking UI for non-booked status */}
                                <div className="flex justify-between items-center mb-4">
                                  <h4 className="text-md font-semibold text-gray-800">
                                    Booking Details
                                  </h4>
                                  <Button
                                    type="button"
                                    onClick={addLinerBookingDetail}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200"
                                  >
                                    Add Booking Detail
                                  </Button>
                                </div>
                              </>
                            )}

                            {/* Bulk Add block should only appear for new creation and when not booked */}
                            {mode === "new" && currentStatus !== "Booked" && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                {/* Equipment Type */}
                                <div className="space-y-2">
                                  <Label className="text-xs font-medium text-gray-600">
                                    Equipment Type
                                  </Label>
                                  <Select
                                    value={bulkEquipmentType}
                                    onChange={(e) =>
                                      setBulkEquipmentType(e.target.value)
                                    }
                                    className="text-sm"
                                  >
                                    <option value="">
                                      -- Select Equipment Type --
                                    </option>
                                    {(dataPoints?.equipment || []).map(
                                      (eq: any) => (
                                        <option key={eq.id} value={eq.name}>
                                          {eq.name}
                                        </option>
                                      )
                                    )}
                                  </Select>
                                </div>

                                {/* Quantity */}
                                <div className="space-y-2">
                                  <Label className="text-xs font-medium text-gray-600">
                                    Quantity
                                  </Label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={bulkQuantity}
                                    onChange={(e) =>
                                      setBulkQuantity(e.target.value)
                                    }
                                    className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                                    placeholder="e.g. 2"
                                  />
                                </div>

                                {/* MBL Number */}
                                <div className="space-y-2">
                                  <Label className="text-xs font-medium text-gray-600">
                                    MBL Number
                                  </Label>
                                  <input
                                    type="text"
                                    value={bulkMblNumber}
                                    onChange={(e) =>
                                      setBulkMblNumber(e.target.value)
                                    }
                                    className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                                    placeholder="Enter MBL number"
                                  />
                                </div>

                                {/* Carrier */}
                                <div className="space-y-2">
                                  <Label className="text-xs font-medium text-gray-600">
                                    Carrier
                                  </Label>
                                  <SearchableSelect
                                    value={bulkCarrier}
                                    onChange={(value: string) =>
                                      setBulkCarrier(value)
                                    }
                                    placeholder="Search carriers..."
                                    className="text-sm"
                                    options={(dataPoints?.carriers || []).map(
                                      (c: any) => ({
                                        value: c.name,
                                        label: c.name,
                                      })
                                    )}
                                  />
                                </div>

                                {/* Auto-generation preview */}
                                {bulkEquipmentType &&
                                  (Number.parseInt(
                                    (bulkQuantity || "").trim(),
                                    10
                                  ) || 0) > 0 && (
                                    <div className="md:col-span-3 bg-blue-50 rounded-lg p-3 border border-blue-200">
                                      <p className="text-xs text-blue-700">
                                        Temporary Booking Numbers will be
                                        generated automatically:{" "}
                                        <strong>
                                          {generateEquipmentCodeForBooking(
                                            bulkEquipmentType
                                          )}
                                          -001
                                        </strong>{" "}
                                        to{" "}
                                        <strong>
                                          {generateEquipmentCodeForBooking(
                                            bulkEquipmentType
                                          )}
                                          -
                                          {String(
                                            Number.parseInt(
                                              (bulkQuantity || "").trim(),
                                              10
                                            )
                                          ).padStart(3, "0")}
                                        </strong>
                                      </p>
                                    </div>
                                  )}

                                <div className="flex items-end">
                                  <Button
                                    type="button"
                                    onClick={bulkAddLinerBookingDetails}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-all duration-200 w-full md:w-auto"
                                  >
                                    Bulk Add
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Existing details list/cards */}
                            {/* Only show editable booking details when not booked */}
                            {currentStatus !== "Booked" &&
                              (isAssignment
                                ? requestedBookingDetails
                                : linerBookingDetails
                              ).map((detail: any, index: number) => (
                                <div
                                  key={index}
                                  className="bg-white border border-gray-200 rounded-lg p-6 mb-4 relative"
                                >
                                  <div className="flex justify-between items-center mb-4">
                                    <h5 className="text-sm font-semibold text-gray-700">
                                      Booking Detail #{index + 1}
                                    </h5>
                                    <div className="flex gap-2">
                                      {/* Unlink button: Only show if this booking detail has been allocated */}
                                      {isAssignment &&
                                        mode === "edit" &&
                                        linerBooking?.shipmentPlan &&
                                        allocatedBookingDetails.has(index) && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              // Handle unlinking individual booking detail
                                              // Remove from allocated set
                                              const newAllocated = new Set(
                                                allocatedBookingDetails
                                              );
                                              newAllocated.delete(index);
                                              setAllocatedBookingDetails(
                                                newAllocated
                                              );
                                              // This would remove the detail from the assignment but keep it in the form
                                              if (
                                                requestedBookingDetails.length >
                                                1
                                              ) {
                                                setRequestedBookingDetails(
                                                  requestedBookingDetails.filter(
                                                    (_: any, i: number) =>
                                                      i !== index
                                                  )
                                                );
                                              }
                                            }}
                                            className="px-3 py-1 bg-gray-500 text-white text-xs font-medium rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                                          >
                                            Unlink
                                          </button>
                                        )}

                                      {/* Allocate button: Only show if this booking detail has NOT been allocated and has equipment type */}
                                      {isAssignment &&
                                        mode === "edit" &&
                                        linerBooking?.shipmentPlan &&
                                        !allocatedBookingDetails.has(index) &&
                                        detail.equipment_type && (
                                          <button
                                            type="submit"
                                            name="_action"
                                            value="allocate_individual"
                                            onClick={(e) => {
                                              // Add hidden input for booking detail index
                                              const form = e.currentTarget.form;
                                              if (form) {
                                                // Remove any existing detailIndex inputs
                                                const existingInputs =
                                                  form.querySelectorAll(
                                                    'input[name="detailIndex"]'
                                                  );
                                                existingInputs.forEach(
                                                  (input) => input.remove()
                                                );

                                                // Add new hidden input
                                                const hiddenInput =
                                                  document.createElement(
                                                    "input"
                                                  );
                                                hiddenInput.type = "hidden";
                                                hiddenInput.name =
                                                  "detailIndex";
                                                hiddenInput.value =
                                                  index.toString();
                                                form.appendChild(hiddenInput);
                                              }

                                              // Mark this booking detail as allocated
                                              const newAllocated = new Set(
                                                allocatedBookingDetails
                                              );
                                              newAllocated.add(index);
                                              setAllocatedBookingDetails(
                                                newAllocated
                                              );
                                            }}
                                            className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                          >
                                            Allocate
                                          </button>
                                        )}

                                      {/* Remove button: Always show */}
                                      <Button
                                        type="button"
                                        onClick={() => {
                                          // Remove from allocated set if it was allocated
                                          const newAllocated = new Set(
                                            allocatedBookingDetails
                                          );
                                          newAllocated.delete(index);
                                          setAllocatedBookingDetails(
                                            newAllocated
                                          );
                                          // Remove the booking detail
                                          removeLinerBookingDetail(index);
                                        }}
                                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium transition-all duration-200"
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Hidden field to track if this booking detail is allocated */}
                                  <input
                                    type="hidden"
                                    name={`liner_booking_details[${index}][allocated]`}
                                    value={
                                      allocatedBookingDetails.has(index)
                                        ? "true"
                                        : "false"
                                    }
                                  />

                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {/* Equipment Selection - Only show if linked to shipment plan in edit mode */}
                                    {mode === "edit" &&
                                      linerBooking?.shipmentPlan &&
                                      getShipmentPlanEquipment().length > 0 && (
                                        <>
                                          <div>
                                            <label
                                              htmlFor={`liner_booking_details[${index}][equipment_type]`}
                                              className="block text-sm font-medium text-gray-700"
                                            >
                                              Equipment Type *
                                            </label>
                                            <Select
                                              id={`liner_booking_details[${index}][equipment_type]`}
                                              name={`liner_booking_details[${index}][equipment_type]`}
                                              value={
                                                detail.equipment_type || ""
                                              }
                                              onChange={(e) =>
                                                updateLinerBookingDetail(
                                                  index,
                                                  "equipment_type",
                                                  e.target.value
                                                )
                                              }
                                              className="text-sm"
                                            >
                                              <option value="">
                                                -- Select Equipment --
                                              </option>
                                              {getUnallocatedEquipmentTypes().map(
                                                (
                                                  equipment: any,
                                                  eqIndex: number
                                                ) => (
                                                  <option
                                                    key={`${equipment.trackingNumber}-${eqIndex}`}
                                                    value={`${equipment.equipment_type}|${equipment.trackingNumber}`}
                                                  >
                                                    {`${equipment.equipment_type} (${equipment.trackingNumber})`}
                                                  </option>
                                                )
                                              )}
                                            </Select>
                                          </div>

                                          <div className="space-y-2">
                                            <Label className="text-xs font-medium text-gray-600">
                                              Booking For
                                            </Label>
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700">
                                              {detail.equipment_type
                                                ? (() => {
                                                    const [
                                                      equipmentType,
                                                      trackingNumber,
                                                    ] =
                                                      detail.equipment_type.split(
                                                        "|"
                                                      );
                                                    return trackingNumber &&
                                                      trackingNumber !==
                                                        "undefined"
                                                      ? `${equipmentType} (${trackingNumber})`
                                                      : equipmentType;
                                                  })()
                                                : "Select equipment"}
                                            </div>
                                            <input
                                              type="hidden"
                                              name={`liner_booking_details[${index}][booking_for]`}
                                              value={
                                                detail.booking_for ||
                                                (detail.equipment_type
                                                  ? (() => {
                                                      const [
                                                        equipmentType,
                                                        trackingNumber,
                                                      ] =
                                                        detail.equipment_type.split(
                                                          "|"
                                                        );
                                                      return trackingNumber &&
                                                        trackingNumber !==
                                                          "undefined"
                                                        ? `${equipmentType} (${trackingNumber})`
                                                        : equipmentType;
                                                    })()
                                                  : "")
                                              }
                                            />
                                          </div>
                                        </>
                                      )}

                                    {mode === "edit" &&
                                      (!linerBooking?.shipmentPlan ||
                                        getShipmentPlanEquipment().length ===
                                          0) && (
                                        <>
                                          <div className="space-y-2">
                                            <Label className="text-xs font-medium text-gray-600">
                                              Equipment Type{" "}
                                              <span className="text-red-500">
                                                *
                                              </span>
                                            </Label>
                                            <Select
                                              name={`liner_booking_details[${index}][equipment_type]`}
                                              value={(() => {
                                                console.log(
                                                  `[DEBUG] Dropdown value calculation:`,
                                                  {
                                                    isAssignment,
                                                    availableEquipmentLength:
                                                      availableEquipment.length,
                                                    detailTrackingNumber:
                                                      detail.trackingNumber,
                                                    detailEquipmentType:
                                                      detail.equipment_type,
                                                    willUseTrackingNumber:
                                                      isAssignment &&
                                                      availableEquipment.length >
                                                        0,
                                                  }
                                                );
                                                return isAssignment &&
                                                  availableEquipment.length > 0
                                                  ? detail.trackingNumber || ""
                                                  : detail.equipment_type || "";
                                              })()}
                                              onChange={(e) => {
                                                // If in assignment mode, the value is the tracking number
                                                if (
                                                  isAssignment &&
                                                  availableEquipment.length > 0
                                                ) {
                                                  const selectedEquipment =
                                                    availableEquipment.find(
                                                      (eq) =>
                                                        eq.trackingNumber ===
                                                        e.target.value
                                                    );
                                                  if (selectedEquipment) {
                                                    updateLinerBookingDetail(
                                                      index,
                                                      "equipment_type",
                                                      selectedEquipment.equipmentType
                                                    );
                                                    updateLinerBookingDetail(
                                                      index,
                                                      "trackingNumber",
                                                      selectedEquipment.trackingNumber
                                                    );
                                                    updateLinerBookingDetail(
                                                      index,
                                                      "displayName",
                                                      selectedEquipment.displayName
                                                    );
                                                    updateLinerBookingDetail(
                                                      index,
                                                      "booking_for",
                                                      selectedEquipment.displayName
                                                    );
                                                  }
                                                } else {
                                                  updateLinerBookingDetail(
                                                    index,
                                                    "equipment_type",
                                                    e.target.value
                                                  );
                                                }
                                              }}
                                              className="text-sm"
                                            >
                                              <option value="">
                                                -- Select Equipment --
                                              </option>
                                              {(() => {
                                                console.log(
                                                  `[DEBUG] Assignment dropdown check:`,
                                                  {
                                                    isAssignment,
                                                    availableEquipmentLength:
                                                      availableEquipment.length,
                                                    availableEquipment:
                                                      availableEquipment.slice(
                                                        0,
                                                        3
                                                      ),
                                                    willUseAssignmentMode:
                                                      isAssignment &&
                                                      availableEquipment.length >
                                                        0,
                                                  }
                                                );
                                                return (
                                                  isAssignment &&
                                                  availableEquipment.length > 0
                                                );
                                              })()
                                                ? availableEquipment
                                                    .filter((eq) => {
                                                      // Filter out already selected equipment from requested bookings
                                                      const selectedInRequested =
                                                        requestedBookingDetails.some(
                                                          (
                                                            detail,
                                                            detailIndex
                                                          ) =>
                                                            detailIndex !==
                                                              index &&
                                                            detail.trackingNumber ===
                                                              eq.trackingNumber
                                                        );

                                                      // Filter out already selected equipment from linked bookings
                                                      const selectedInLinked =
                                                        linerBookingDetails.some(
                                                          (detail) =>
                                                            detail.trackingNumber ===
                                                              eq.trackingNumber ||
                                                            detail.booking_for ===
                                                              eq.displayName
                                                        );

                                                      console.log(
                                                        `[DEBUG] Equipment filter for ${eq.displayName}:`,
                                                        {
                                                          selectedInRequested,
                                                          selectedInLinked,
                                                          include:
                                                            !selectedInRequested &&
                                                            !selectedInLinked,
                                                          requestedBookingDetails:
                                                            requestedBookingDetails
                                                              .map(
                                                                (d) =>
                                                                  d.trackingNumber
                                                              )
                                                              .filter(Boolean),
                                                          linerBookingDetails:
                                                            linerBookingDetails
                                                              .map(
                                                                (d) =>
                                                                  d.booking_for
                                                              )
                                                              .filter(Boolean),
                                                        }
                                                      );

                                                      return (
                                                        !selectedInRequested &&
                                                        !selectedInLinked
                                                      );
                                                    })
                                                    .map((eq) => (
                                                      <option
                                                        key={eq.trackingNumber}
                                                        value={
                                                          eq.trackingNumber
                                                        }
                                                      >
                                                        {eq.displayName}
                                                      </option>
                                                    ))
                                                : (
                                                    dataPoints?.equipment || []
                                                  ).map((eq: any) => (
                                                    <option
                                                      key={eq.id}
                                                      value={eq.name}
                                                    >
                                                      {eq.name}
                                                    </option>
                                                  ))}
                                            </Select>
                                          </div>

                                          <div className="space-y-2">
                                            <Label className="text-xs font-medium text-gray-600">
                                              {isAssignment &&
                                              availableEquipment.length > 0
                                                ? "Equipment Number"
                                                : "Booking For"}
                                            </Label>
                                            {isAssignment &&
                                            availableEquipment.length > 0 ? (
                                              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 font-medium">
                                                {detail.displayName ||
                                                  "Select equipment to see details"}
                                              </div>
                                            ) : (
                                              <div className="p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700">
                                                {detail.equipment_type ||
                                                  "Select equipment type"}
                                              </div>
                                            )}
                                            <input
                                              type="hidden"
                                              name={`liner_booking_details[${index}][booking_for]`}
                                              value={
                                                isAssignment &&
                                                availableEquipment.length > 0
                                                  ? detail.displayName || ""
                                                  : detail.booking_for ||
                                                    detail.equipment_type ||
                                                    ""
                                              }
                                            />
                                            {/* Store tracking number for assignment mode */}
                                            <input
                                              type="hidden"
                                              name={`liner_booking_details[${index}][trackingNumber]`}
                                              value={
                                                detail.trackingNumber || ""
                                              }
                                            />
                                          </div>
                                        </>
                                      )}

                                    {/* In "new" mode, show Equipment Type dropdown (from dataPoints.equipment)
                                      and a free-text "Booking For" field */}
                                    {mode === "new" && (
                                      <>
                                        <div className="space-y-2">
                                          <Label className="text-xs font-medium text-gray-600">
                                            Equipment Type{" "}
                                            <span className="text-red-500">
                                              *
                                            </span>
                                          </Label>
                                          <Select
                                            name={`liner_booking_details[${index}][equipment_type]`}
                                            value={detail.equipment_type || ""}
                                            onChange={(e) =>
                                              updateLinerBookingDetail(
                                                index,
                                                "equipment_type",
                                                e.target.value
                                              )
                                            }
                                            className="text-sm"
                                          >
                                            <option value="">
                                              -- Select Equipment Type --
                                            </option>
                                            {(dataPoints?.equipment || []).map(
                                              (eq: any) => (
                                                <option
                                                  key={eq.id}
                                                  value={eq.name}
                                                >
                                                  {eq.name}
                                                </option>
                                              )
                                            )}
                                          </Select>
                                        </div>

                                        <div className="space-y-2">
                                          <Label className="text-xs font-medium text-gray-600">
                                            Booking For
                                          </Label>
                                          <div className="p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700">
                                            {detail.equipment_type ||
                                              "Select equipment type"}
                                          </div>
                                          <input
                                            type="hidden"
                                            name={`liner_booking_details[${index}][booking_for]`}
                                            value={
                                              detail.booking_for ||
                                              detail.equipment_type ||
                                              ""
                                            }
                                          />
                                        </div>
                                      </>
                                    )}

                                    {/* keep rest of the fields */}
                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Temporary Booking Number
                                      </Label>
                                      <Input
                                        name={`liner_booking_details[${index}][temporary_booking_number]`}
                                        value={detail.temporary_booking_number}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "temporary_booking_number",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Enter temp booking number"
                                        className="text-sm"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Suffix for Anticipatory Temp Booking
                                        Number
                                      </Label>
                                      <Input
                                        name={`liner_booking_details[${index}][suffix_for_anticipatory_temporary_booking_number]`}
                                        value={
                                          detail.suffix_for_anticipatory_temporary_booking_number
                                        }
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "suffix_for_anticipatory_temporary_booking_number",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Enter suffix"
                                        className="text-sm"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Liner Booking Number
                                      </Label>
                                      <Input
                                        name={`liner_booking_details[${index}][liner_booking_number]`}
                                        value={detail.liner_booking_number}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "liner_booking_number",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Enter liner booking number"
                                        className="text-sm"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        MBL Number
                                      </Label>
                                      <Input
                                        name={`liner_booking_details[${index}][mbl_number]`}
                                        value={detail.mbl_number}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "mbl_number",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Enter MBL number"
                                        className="text-sm"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Carrier
                                      </Label>
                                      <SearchableSelect
                                        name={`liner_booking_details[${index}][carrier]`}
                                        value={detail.carrier}
                                        onChange={(value) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "carrier",
                                            value
                                          )
                                        }
                                        placeholder="Search carriers..."
                                        className="text-sm"
                                        options={dataPoints.carriers.map(
                                          (carrier) => ({
                                            value: carrier.name,
                                            label: carrier.name,
                                          })
                                        )}
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Contract
                                      </Label>
                                      <Input
                                        name={`liner_booking_details[${index}][contract]`}
                                        value={detail.contract}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "contract",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Enter contract"
                                        className="text-sm"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Original Planned Vessel
                                      </Label>
                                      <SearchableSelect
                                        name={`liner_booking_details[${index}][original_planned_vessel]`}
                                        value={detail.original_planned_vessel}
                                        onChange={(value) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "original_planned_vessel",
                                            value
                                          )
                                        }
                                        placeholder="Search vessels..."
                                        className="text-sm"
                                        options={dataPoints.vessels.map(
                                          (vessel) => ({
                                            value: vessel.name,
                                            label: vessel.name,
                                          })
                                        )}
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        <Checkbox
                                          name={`liner_booking_details[${index}][change_in_original_vessel]`}
                                          checked={
                                            detail.change_in_original_vessel
                                          }
                                          onChange={(checked) =>
                                            updateLinerBookingDetail(
                                              index,
                                              "change_in_original_vessel",
                                              checked
                                            )
                                          }
                                          className="mr-2"
                                        />
                                        Change in Original Vessel
                                      </Label>
                                    </div>
                                  </div>

                                  {detail.change_in_original_vessel && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                      <div className="space-y-2">
                                        <Label className="text-xs font-medium text-gray-600">
                                          Revised Vessel
                                        </Label>
                                        <SearchableSelect
                                          name={`liner_booking_details[${index}][revised_vessel]`}
                                          value={detail.revised_vessel}
                                          onChange={(value) =>
                                            updateLinerBookingDetail(
                                              index,
                                              "revised_vessel",
                                              value
                                            )
                                          }
                                          placeholder="Search vessels..."
                                          className="text-sm"
                                          options={dataPoints.vessels.map(
                                            (vessel) => ({
                                              value: vessel.name,
                                              label: vessel.name,
                                            })
                                          )}
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label className="text-xs font-medium text-gray-600">
                                          ETD of Revised Vessel
                                        </Label>
                                        <Input
                                          type="date"
                                          name={`liner_booking_details[${index}][etd_of_revised_vessel]`}
                                          value={formatDateForInput(
                                            detail.etd_of_revised_vessel
                                          )}
                                          onChange={(e) =>
                                            updateLinerBookingDetail(
                                              index,
                                              "etd_of_revised_vessel",
                                              e.target.value
                                            )
                                          }
                                          className="text-sm"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        ETD of Original Planned Vessel
                                      </Label>
                                      <Input
                                        type="date"
                                        name={`liner_booking_details[${index}][e_t_d_of_original_planned_vessel]`}
                                        value={formatDateForInput(
                                          detail.e_t_d_of_original_planned_vessel
                                        )}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "e_t_d_of_original_planned_vessel",
                                            e.target.value
                                          )
                                        }
                                        className="text-sm"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Empty Pickup Validity From
                                      </Label>
                                      <Input
                                        type="date"
                                        name={`liner_booking_details[${index}][empty_pickup_validity_from]`}
                                        value={formatDateForInput(
                                          detail.empty_pickup_validity_from
                                        )}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "empty_pickup_validity_from",
                                            e.target.value
                                          )
                                        }
                                        className="text-sm"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Empty Pickup Validity Till
                                      </Label>
                                      <Input
                                        type="date"
                                        name={`liner_booking_details[${index}][empty_pickup_validity_till]`}
                                        value={formatDateForInput(
                                          detail.empty_pickup_validity_till
                                        )}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "empty_pickup_validity_till",
                                            e.target.value
                                          )
                                        }
                                        className="text-sm"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Gate Opening Date
                                      </Label>
                                      <Input
                                        type="date"
                                        name={`liner_booking_details[${index}][estimate_gate_opening_date]`}
                                        value={formatDateForInput(
                                          detail.estimate_gate_opening_date
                                        )}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "estimate_gate_opening_date",
                                            e.target.value
                                          )
                                        }
                                        className="text-sm"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Gate Cutoff Date
                                      </Label>
                                      <Input
                                        type="date"
                                        name={`liner_booking_details[${index}][estimated_gate_cutoff_date]`}
                                        value={formatDateForInput(
                                          detail.estimated_gate_cutoff_date
                                        )}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "estimated_gate_cutoff_date",
                                            e.target.value
                                          )
                                        }
                                        className="text-sm"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        SI Cut Off Date
                                      </Label>
                                      <Input
                                        type="date"
                                        name={`liner_booking_details[${index}][s_i_cut_off_date]`}
                                        value={formatDateForInput(
                                          detail.s_i_cut_off_date
                                        )}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "s_i_cut_off_date",
                                            e.target.value
                                          )
                                        }
                                        className="text-sm"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Booking Received From Carrier On
                                      </Label>
                                      <Input
                                        type="date"
                                        name={`liner_booking_details[${index}][booking_received_from_carrier_on]`}
                                        value={formatDateForInput(
                                          detail.booking_received_from_carrier_on
                                        )}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "booking_received_from_carrier_on",
                                            e.target.value
                                          )
                                        }
                                        className="text-sm"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Line Booking Copy (URL)
                                      </Label>
                                      <Input
                                        type="url"
                                        name={`liner_booking_details[${index}][line_booking_copy]`}
                                        value={detail.line_booking_copy}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "line_booking_copy",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Enter document URL"
                                        className="text-sm"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Line Booking Copy (PDF File)
                                      </Label>
                                      <Input
                                        type="file"
                                        name={`liner_booking_details[${index}][line_booking_copy_file]`}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "line_booking_copy_file",
                                            e.target.files
                                              ? e.target.files[0]
                                              : null
                                          )
                                        }
                                        accept=".pdf"
                                        className="text-sm"
                                      />
                                      {detail.line_booking_copy_file &&
                                        typeof detail.line_booking_copy_file ===
                                          "string" && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            Current file:{" "}
                                            <a
                                              href={
                                                detail.line_booking_copy_file
                                              }
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:underline"
                                            >
                                              View PDF
                                            </a>
                                          </p>
                                        )}
                                    </div>

                                    <div className="space-y-2 md:col-span-3">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Additional Remarks
                                      </Label>
                                      <Textarea
                                        name={`liner_booking_details[${index}][additional_remarks]`}
                                        value={detail.additional_remarks}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            index,
                                            "additional_remarks",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Enter additional remarks"
                                        className="text-sm"
                                        rows={2}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Individual allocation is now handled by the Allocate button on each form card */}

                {/* Form Actions */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex justify-end space-x-3">
                    <Link
                      to="/liner-bookings"
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                    >
                      Cancel
                    </Link>

                    <div className="flex justify-end space-x-4 border-t border-gray-200">
                      {/* Debug info removed */}
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        {isSubmitting ? (
                          <>
                            <svg
                              className="animate-spin -ml-1 mr-3 h-6 w-6 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            {mode === "edit" ? "Updating..." : "Creating..."}
                          </>
                        ) : mode === "edit" ? (
                          "Update Liner Booking"
                        ) : (
                          "Create Liner Booking"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              {/* </div> closes the divide-y container above */}
            </div>
            {/* </div> closes the bg-white rounded-xl shadow card */}
          </Form>
          {/* </Form> closes the post form */}
        </div>
        {/* </div> closes max-w-5xl wrapper */}
      </div>
      {/* </div> closes Main Content (flex-1 overflow-auto ...) */}
    </>
  );
}
