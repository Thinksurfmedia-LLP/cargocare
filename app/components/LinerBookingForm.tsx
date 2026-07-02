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
import { useState, useEffect, useCallback, useMemo, useRef } from "react";

export interface LinerBookingFormProps {
  mode: "new" | "edit";
  linerBooking?: any;
  availableShipmentPlans?: any[];
  dataPoints: {
    carriers: any[];
    vessels: any[];
    organizations: any[];
    equipment?: any[];
    loadingPorts?: any[];
    destinationCountries?: any[];
    portsOfDischarge?: any[];
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
  pendingUnmappingRequests?: any[];
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
  pendingUnmappingRequests = [],
}: LinerBookingFormProps) {
  const navigation = useNavigation();
  const { addToast } = useToast();

  // Extract data from the JSON field for edit mode
  const data = mode === "edit" ? (linerBooking?.data as any) : null;


  // Initialize state for liner booking details - show all existing details including those that remain after individual unmapping
  const [linerBookingDetails, setLinerBookingDetails] = useState(() => {
    if (mode === "edit" && data?.liner_booking_details && isAssignment) {
      // In assignment mode, show all existing liner booking details
      // This includes details that remain after individual unmapping
      return data.liner_booking_details || [];
    } else if (mode === "edit" && data?.liner_booking_details) {
      return data.liner_booking_details;
    } else if (mode === "new") {
      // Initialize new mode with empty array - booking details will be added via "Add Booking Detail" button or bulk add
      return [];
    }
    return [];
  });

  const [requestedBookingDetails, setRequestedBookingDetails] = useState(() => {
    const initial = mode === "edit" && data?.requested_booking_details
      ? data.requested_booking_details
      : [];
    return initial;
  });

  // Track which booking details have been allocated
  const [allocatedBookingDetails, setAllocatedBookingDetails] = useState<
    Set<number>
  >(new Set());

  const [openSections, setOpenSections] = useState(() => {
    if (mode === "edit") {
      return {
        linkedPlan: false,
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
  const [bulkTempBookingNumber, setBulkTempBookingNumber] = useState<string>("");
  const [bulkLinerBookingNumber, setBulkLinerBookingNumber] = useState<string>("");
  const [bulkSuffixForAnticipatoryTempBookingNumber, setBulkSuffixForAnticipatoryTempBookingNumber] = useState<string>("");
  const [bulkContract, setBulkContract] = useState<string>("");
  const [bulkOriginalPlannedVessel, setBulkOriginalPlannedVessel] = useState<string>("");
  const [bulkEtdOfOriginalPlannedVessel, setBulkEtdOfOriginalPlannedVessel] = useState<string>("");
  const [bulkEmptyPickupValidityFrom, setBulkEmptyPickupValidityFrom] = useState<string>("");
  const [bulkLoadingPort, setBulkLoadingPort] = useState<string>("");
  const [bulkDestinationCountry, setBulkDestinationCountry] = useState<string>("");
  const [bulkPortOfDischarge, setBulkPortOfDischarge] = useState<string>("");

  // Handle destination country change to reset port of discharge
  const handleBulkDestinationCountryChange = (value: string) => {
    setBulkDestinationCountry(value);
    setBulkPortOfDischarge(""); // Reset port of discharge when country changes
  };

  // Track destination countries for individual booking details for immediate UI updates
  const [individualDestinationCountries, setIndividualDestinationCountries] = useState<Record<number, string>>({});

  const isSubmitting = navigation.state === "submitting";

  // Get equipment details from linked shipment plan
  const getShipmentPlanEquipment = () => {
    if (mode === "edit" && linerBooking?.shipmentPlan) {
      const planData = linerBooking.shipmentPlan.data as any;
      const equipment = planData?.equipment_details || [];
      console.log("[DEBUG] getShipmentPlanEquipment - Raw equipment data:", equipment);
      return equipment;
    }
    return [];
  };

  // Add this function after the getShipmentPlanEquipment function (around line 85)
  const getAvailableEquipmentForBookingDetail = (currentIndex: number) => {
    console.log(`[DEBUG] getAvailableEquipmentForBookingDetail called - currentIndex: ${currentIndex}`);
    console.log("[DEBUG] requestedBookingDetails:", requestedBookingDetails);
    const allEquipment = getShipmentPlanEquipment();

    // Get all existing liner booking details (same logic as calculateAllocatedEquipment)
    const allExistingDetails = isAssignment && data?.liner_booking_details
      ? data.liner_booking_details
      : linerBookingDetails;

    // Get the liner booking numbers that are already linked
    const alreadyLinkedBookingNumbers = new Set<string>();
    allExistingDetails.forEach((detail: any) => {
      if (detail.liner_booking_number) {
        alreadyLinkedBookingNumbers.add(detail.liner_booking_number);
      }
    });

    // Get selected equipment from existing details (filter out unmapped ones)
    const selectedFromExisting = allExistingDetails
      .filter((detail: any) => {
        if (!detail || !detail.equipment_type) return false;
        // Filter out unmapped equipment
        if (detail.equipment_type.includes("|")) {
          const trackingNumber = detail.equipment_type.split("|")[1];
          const shipmentPlanEquipment = getShipmentPlanEquipment();
          return !shipmentPlanEquipment.some((eq: any) => eq.trackingNumber === trackingNumber && eq.unmapped);
        }
        return true;
      })
      .map((detail: any) => detail.equipment_type && detail.equipment_type.includes("|")
        ? detail.equipment_type.split("|")[1]
        : null)
      .filter(Boolean);

    // Get selected equipment from requested details (excluding current)
    const selectedFromRequested = isAssignment
      ? requestedBookingDetails
          .filter((detail: any, index: number) => {
            return detail && detail.equipment_type && index !== currentIndex;
          })
          .map((detail: any) => detail.equipment_type && detail.equipment_type.includes("|")
            ? detail.equipment_type.split("|")[1]
            : null)
          .filter(Boolean)
      : [];

    // Equipment is considered "already linked" if its trackingNumber matches a liner booking number 
    // from the existing details - use actual linked booking numbers, not just the prefix
    const equipmentWithLinerBookingsAssigned = allEquipment
      .filter((eq: any) => {
        const trackingNumber = eq.trackingNumber || '';
        // Check if equipment tracking number is ACTUALLY in the linked booking numbers
        const isLinkedByNumber = alreadyLinkedBookingNumbers.has(trackingNumber);
        // If tracking looks like LBN/XYZ but isn't actually linked, DON'T filter it out
        return isLinkedByNumber;
      })
      .map((eq: any) => eq.trackingNumber || eq.originalTrackingNumber)
      .filter(Boolean);

    const selectedEquipment = [...selectedFromExisting, ...selectedFromRequested, ...equipmentWithLinerBookingsAssigned];
    
    console.log("[DEBUG] getAvailableEquipmentForBookingDetail - selectedEquipment:", selectedEquipment);
    console.log("[DEBUG] getAvailableEquipmentForBookingDetail - alreadyLinkedBookingNumbers:", Array.from(alreadyLinkedBookingNumbers));
    console.log("[DEBUG] getAvailableEquipmentForBookingDetail - equipmentWithLinerBookingsAssigned:", equipmentWithLinerBookingsAssigned);

    return allEquipment.filter((equipment: any) => {
      const trackingNumber = equipment.trackingNumber;
      // Equipment is available if:
      // 1. Its tracking number is not in the list of selected equipment
      // 2. It's not unmapped
      // 3. Its tracking number is not a liner booking number that's already linked
      const isSelected = selectedEquipment.includes(trackingNumber);
      const isUnmapped = equipment.unmapped === true;
      const isLinkedLinerBooking = alreadyLinkedBookingNumbers.has(trackingNumber);
      
      return !isSelected && !isUnmapped && !isLinkedLinerBooking;
    });
  };

  // Calculate total equipment required from shipment plan
  const calculateRequiredEquipment = () => {
    const equipment = getShipmentPlanEquipment();
    const required = {} as Record<string, number>;

    equipment.forEach((item: any) => {
      // Count ALL equipment including unmapped ones, because unmapped equipment still needs to be allocated to new bookings
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
    const shipmentPlanEquipment = getShipmentPlanEquipment();

    // Get all existing liner booking details (both from state and original data)
    const allExistingDetails = isAssignment && data?.liner_booking_details
      ? data.liner_booking_details
      : linerBookingDetails;

    console.log("[DEBUG] calculateAllocatedEquipment - allExistingDetails:", allExistingDetails);
    console.log("[DEBUG] calculateAllocatedEquipment - shipmentPlanEquipment:", shipmentPlanEquipment.map(eq => ({
      trackingNumber: eq.trackingNumber,
      equipmentType: eq.equipment_type,
      unmapped: eq.unmapped
    })));


    // Count from linked bookings (Link Available tab or existing details)
    allExistingDetails.forEach((detail: any, index: number) => {
      if (detail.equipment_type) {
        // Handle both cases: "equipment_type|tracking" and just "equipment_type"
        const equipmentType = detail.equipment_type.includes("|")
          ? detail.equipment_type.split("|")[0]
          : detail.equipment_type;

        // Check if this specific allocation corresponds to an unmapped equipment
        // We need to check if this liner booking number was used for equipment that got unmapped
        const trackingNumber = detail.equipment_type.includes("|")
          ? detail.equipment_type.split("|")[1]
          : detail.booking_for && detail.booking_for.includes("|")
          ? detail.booking_for.split("|")[1]
          : null;

        // Check if this specific allocation was for equipment that is now unmapped
        // by checking if the tracking number or liner booking number matches unmapped equipment
        const isThisAllocationUnmapped = detail.liner_booking_number &&
          shipmentPlanEquipment.some((eq: any) =>
            eq.unmapped &&
            // Check if this equipment was unmapped and had this liner booking number
            (eq.originalTrackingNumber === detail.liner_booking_number ||
             // Also check by tracking number match
             (trackingNumber && (eq.trackingNumber === trackingNumber || eq.originalTrackingNumber === trackingNumber)))
          );

        console.log(`[DEBUG] Processing booking detail ${index}:`, {
          equipmentType,
          trackingNumber,
          linerBookingNumber: detail.liner_booking_number,
          isThisAllocationUnmapped,
          willCount: !isThisAllocationUnmapped
        });

        // Only count if this specific allocation is not for unmapped equipment
        if (!isThisAllocationUnmapped) {
          allocated[equipmentType] = (allocated[equipmentType] || 0) + 1;
          console.log(`[DEBUG] Counted booking ${index} - ${equipmentType} total: ${allocated[equipmentType]}`);
        } else {
          console.log(`[DEBUG] Skipped unmapped booking ${index} - ${equipmentType}`);
        }
      }
    });

    // Count from allocated requested bookings (Request Booking tab)
    requestedBookingDetails.forEach((detail: any, index: number) => {
      if (detail && detail.equipment_type && allocatedBookingDetails.has(index)) {
        // Handle both cases: "equipment_type|tracking" and just "equipment_type"
        const equipmentType = detail.equipment_type.includes("|")
          ? detail.equipment_type.split("|")[0]
          : detail.equipment_type;

        const trackingNumber = detail.equipment_type.includes("|")
          ? detail.equipment_type.split("|")[1]
          : detail.booking_for && detail.booking_for.includes("|")
          ? detail.booking_for.split("|")[1]
          : null;

        // For requested bookings, we should NOT skip new allocations to unmapped equipment
        // Requested bookings are NEW allocations, so they should always be counted
        // We only need to skip old allocations that were for equipment that got unmapped
        const isThisAllocationUnmapped = false; // Always count new requested bookings

        // Only count if this specific allocation is not for unmapped equipment
        if (!isThisAllocationUnmapped) {
          allocated[equipmentType] = (allocated[equipmentType] || 0) + 1;
        } else {
        }
      }
    });

    return allocated;
  };

  const getUnallocatedEquipmentTypes = () => {
    // In "new" mode, return equipment from dataPoints
    if (mode === "new") {
      return (dataPoints?.equipment || []).map((eq: any) => ({
        equipment_type: eq.name,
        trackingNumber: `TEMP-${eq.id}`, // Generate temporary tracking number
        id: eq.id,
        name: eq.name
      }));
    }

    // In "edit" mode, use original logic with shipment plan
    if (mode !== "edit" || !linerBooking?.shipmentPlan) return [];

    const required = calculateRequiredEquipment();
    const allocated = calculateAllocatedEquipment();
    const allEquipment = getShipmentPlanEquipment();
    const unallocated: any[] = [];

    console.log("[DEBUG] getUnallocatedEquipmentTypes - START");
    console.log("[DEBUG] getUnallocatedEquipmentTypes - allEquipment:", allEquipment.map((eq: any) => ({
      trackingNumber: eq.trackingNumber,
      originalTrackingNumber: eq.originalTrackingNumber,
      equipment_type: eq.equipment_type,
      linerBookingAssigned: eq.linerBookingAssigned
    })));
    console.log("[DEBUG] getUnallocatedEquipmentTypes - required:", required);
    console.log("[DEBUG] getUnallocatedEquipmentTypes - allocated:", allocated);

    // Get all existing liner booking details (same as in calculateAllocatedEquipment)
    const allExistingDetails = isAssignment && data?.liner_booking_details
      ? data.liner_booking_details
      : linerBookingDetails;

    // Get already selected tracking numbers to exclude them
    const selectedTrackingNumbers = [
      // From linked bookings - but exclude those that correspond to unmapped equipment
      ...allExistingDetails
        .filter((detail: any) => {
          // Exclude allocations that correspond to unmapped equipment
          const trackingNumber = detail.equipment_type && detail.equipment_type.includes("|")
            ? detail.equipment_type.split("|")[1]
            : detail.booking_for && detail.booking_for.includes("|")
            ? detail.booking_for.split("|")[1]
            : detail.trackingNumber;

          // Check if this allocation corresponds to unmapped equipment
          const isForUnmappedEquipment = detail.liner_booking_number &&
            allEquipment.some((eq: any) =>
              eq.unmapped &&
              (eq.originalTrackingNumber === detail.liner_booking_number ||
               (trackingNumber && (eq.trackingNumber === trackingNumber || eq.originalTrackingNumber === trackingNumber)))
            );

          return !isForUnmappedEquipment; // Include only allocations that are NOT for unmapped equipment
        })
        .map((detail: any) => {
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
      // From allocated requested bookings in assignment mode - but exclude those that correspond to unmapped equipment
      ...requestedBookingDetails
        .filter((detail: any, index: number) => {
          if (!allocatedBookingDetails.has(index)) return false;

          // Check if this allocation corresponds to unmapped equipment
          const trackingNumber = detail.equipment_type && detail.equipment_type.includes("|")
            ? detail.equipment_type.split("|")[1]
            : detail.trackingNumber;

          const isForUnmappedEquipment = detail.liner_booking_number &&
            allEquipment.some((eq: any) =>
              eq.unmapped &&
              (eq.originalTrackingNumber === detail.liner_booking_number ||
               (trackingNumber && (eq.trackingNumber === trackingNumber || eq.originalTrackingNumber === trackingNumber)))
            );

          return !isForUnmappedEquipment; // Include only allocations that are NOT for unmapped equipment
        })
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

    console.log("[DEBUG] getUnallocatedEquipmentTypes - selectedTrackingNumbers:", selectedTrackingNumbers);

    // Get all liner booking numbers that are actually linked (from assignment's liner_booking_details)
    const actualLinkedBookingNumbers = new Set<string>();
    allExistingDetails.forEach((detail: any) => {
      if (detail.liner_booking_number) {
        actualLinkedBookingNumbers.add(detail.liner_booking_number);
      }
    });

    for (const [equipmentType, requiredQty] of Object.entries(required)) {
      const allocatedQty = allocated[equipmentType] || 0;
      const remaining = requiredQty - allocatedQty;

      console.log(`[DEBUG] getUnallocatedEquipmentTypes - Processing type: ${equipmentType}, required: ${requiredQty}, allocated: ${allocatedQty}, remaining: ${remaining}`);
      console.log(`[DEBUG] getUnallocatedEquipmentTypes - actualLinkedBookingNumbers:`, Array.from(actualLinkedBookingNumbers));

      if (remaining > 0) {
        // Find available equipment of this type that hasn't been selected
        // Note: Unmapped equipment should be AVAILABLE for new allocations, so we don't exclude it
        const availableEquipment = allEquipment.filter(
          (eq: any) => {
            // Equipment is allocated if its tracking number is a liner booking number that's actually linked
            const trackingNumber = eq.trackingNumber || '';
            const originalTrackingNumber = eq.originalTrackingNumber || '';
            
            // Check if this tracking number is an ACTUAL linked booking
            const isTrackingLinkedBookingNumber = actualLinkedBookingNumbers.has(trackingNumber);
            
            // If tracking starts with LBN/XYZ but is NOT in actualLinkedBookingNumbers, 
            // the booking was unlinked but equipment wasn't restored - treat as available
            const trackingStartsWithLBN = trackingNumber.startsWith('LBN');
            const trackingStartsWithXYZ = trackingNumber.startsWith('XYZ');
            const looksLikeBookingNumber = trackingStartsWithLBN || trackingStartsWithXYZ;
            
            // Equipment is ALLOCATED only if tracking is an ACTUAL linked booking number
            // If tracking looks like LBN but isn't linked, it's available (use originalTrackingNumber)
            const hasLinerBookingNumber = isTrackingLinkedBookingNumber;

            // Also check traditional selection logic for backwards compatibility
            // Use originalTrackingNumber for comparison if tracking looks like a booking number but isn't linked
            const trackingToCheck = (looksLikeBookingNumber && !isTrackingLinkedBookingNumber && originalTrackingNumber) 
              ? originalTrackingNumber 
              : trackingNumber;
            const isSelected = selectedTrackingNumbers.includes(trackingToCheck) ||
                              (originalTrackingNumber && selectedTrackingNumbers.includes(originalTrackingNumber));

            console.log(`[DEBUG] getUnallocatedEquipmentTypes - Equipment ${trackingNumber} (orig: ${originalTrackingNumber}): type=${eq.equipment_type}, isActuallyLinked=${isTrackingLinkedBookingNumber}, looksLikeBookingNumber=${looksLikeBookingNumber}, isSelected=${isSelected}, matchesType=${eq.equipment_type === equipmentType}, AVAILABLE=${eq.equipment_type === equipmentType && !hasLinerBookingNumber && !isSelected}`);

            // Equipment is available if it's the right type AND not actually allocated AND not selected
            return eq.equipment_type === equipmentType && !hasLinerBookingNumber && !isSelected;
          }
        );

        console.log(`[DEBUG] getUnallocatedEquipmentTypes - availableEquipment for ${equipmentType}:`, availableEquipment.map((eq: any) => eq.trackingNumber));

        // Add up to the remaining quantity needed
        for (
          let i = 0;
          i < Math.min(remaining, availableEquipment.length);
          i++
        ) {
          unallocated.push(availableEquipment[i]);
        }
        
        console.log(`[DEBUG] getUnallocatedEquipmentTypes - unallocated after adding:`, unallocated.map((eq: any) => eq.trackingNumber));
      }
    }

    console.log("[DEBUG] getUnallocatedEquipmentTypes - FINAL unallocated:", unallocated);
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

  const getFirstPdfLink = useCallback(() => {
    const details = (linerBooking?.data as any)?.liner_booking_details;
    if (Array.isArray(details)) {
      for (const d of details) {
        if (d?.line_booking_copy_file) return d.line_booking_copy_file as string;
        if (d?.line_booking_copy) return d.line_booking_copy as string;
      }
    }
    return null;
  }, [linerBooking?.data]);

  const parsedErrors = useMemo(() => {
    if (!actionData?.error) return [] as string[];
    const parts = actionData.error
      .split(";")
      .map((p: string) => p.trim())
      .filter(Boolean);
    const unique: string[] = [];
    parts.forEach((p) => {
      if (!unique.includes(p)) unique.push(p);
    });
    return unique;
  }, [actionData?.error]);

  // Keep details open and show success toast when submission succeeds
  useEffect(() => {
    if (!actionData || actionData.error) return;

    const pdfLink = getFirstPdfLink();

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
      title: "Booking saved",
      description: (
        <span className="flex items-center gap-2">
          <span>Booking updated successfully.</span>
          {pdfLink ? (
            <Link
              to={pdfLink}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              View booking PDF
            </Link>
          ) : null}
        </span>
      ),
      duration: pdfLink ? 7000 : 5000,
    });
  }, [actionData, addToast, getFirstPdfLink, linerBooking?.shipmentPlan, mode]);

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

    // For Equipment Details, reorder columns to show number_of_equipment before equipment_type
    let orderedKeys = Object.keys(array[0] || {});
    if (title === "Equipment Details") {
      // Find indices of relevant columns
      const equipmentTypeIndex = orderedKeys.indexOf("equipment_type");
      const numberIndex = orderedKeys.indexOf("number_of_equipment");
      
      // If both columns exist and number comes after equipment_type, reorder
      if (equipmentTypeIndex !== -1 && numberIndex !== -1 && numberIndex > equipmentTypeIndex) {
        orderedKeys = orderedKeys.filter(key => key !== "number_of_equipment");
        orderedKeys.splice(equipmentTypeIndex, 0, "number_of_equipment");
      }
    }

    return (
      <div className="mt-6">
        <h4 className="text-md font-semibold text-gray-800 mb-4">{title}</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                {orderedKeys.map((key) => (
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
                  {orderedKeys.map((key) => (
                    <td
                      key={key}
                      className="px-4 py-2 text-sm text-gray-900 border-b"
                    >
                      {renderData(item[key])}
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
    console.log("[DEBUG] addLinerBookingDetail called");
    console.log("[DEBUG] Current requestedBookingDetails length:", requestedBookingDetails.length);

    // Get route data from shipment plan when in assignment mode
    let routeData = {
      loading_port: "",
      destination_country: "",
      port_of_discharge: "",
    };

    if (isAssignment && linerBooking?.shipmentPlan) {
      const planData = (linerBooking.shipmentPlan.data as any) ?? {};
      const containerMovement = planData?.container_movement ?? {};

      routeData = {
        loading_port: containerMovement?.loading_port || "",
        destination_country: containerMovement?.destination_country || "",
        port_of_discharge: containerMovement?.port_of_discharge || "",
      };

      console.log("[DEBUG] Inheriting route data from shipment plan:", routeData);
    }

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
      ...routeData, // Inherit route data from shipment plan in assignment mode
    };

    if (isAssignment) {
      setRequestedBookingDetails([...requestedBookingDetails, newDetail]);
    } else {
      setLinerBookingDetails([...linerBookingDetails, newDetail]);
    }
  };

  const duplicateLinerBookingDetail = (originalIndex: number) => {
    console.log("[DEBUG] duplicateLinerBookingDetail called for index:", originalIndex);

    // Only allow duplication in assignment mode
    if (!isAssignment) {
      console.warn("[DEBUG] Duplicate not allowed - not in assignment mode");
      alert("Duplicate functionality is only available in assignment mode.");
      return;
    }

    // Check if the booking detail is allocated first
    if (!allocatedBookingDetails.has(originalIndex)) {
      console.warn("[DEBUG] Duplicate not allowed - booking detail not allocated");
      alert("Please allocate this booking detail first before duplicating.");
      return;
    }

    // Get the original booking detail
    const originalDetail = requestedBookingDetails[originalIndex];
    if (!originalDetail) {
      console.warn("[DEBUG] Original detail not found at index:", originalIndex);
      return;
    }

    console.log("[DEBUG] Original detail:", originalDetail);
    console.log("[DEBUG] Original PDF file:", originalDetail.line_booking_copy_file);

    // Get current equipment selection from original detail
    const currentEquipmentSelection = originalDetail.equipment_type || "";
    console.log("[DEBUG] Current equipment selection:", currentEquipmentSelection);

    // Get all unallocated equipment (any type, in order)
    const unallocatedEquipment = getUnallocatedEquipmentTypes();
    console.log("[DEBUG] All unallocated equipment:", unallocatedEquipment);

    // Find the next available equipment (any type, in order) that is not the current one
    const nextEquipment = unallocatedEquipment.find(
      (equipment: any) => {
        const equipmentSelection = `${equipment.equipment_type}|${equipment.trackingNumber}`;
        return equipmentSelection !== currentEquipmentSelection;
      }
    );

    if (!nextEquipment) {
      console.warn("[DEBUG] No next equipment available");
      alert("No more unallocated equipment available.");
      return;
    }

    console.log("[DEBUG] Next equipment found:", nextEquipment);

    // Get route data from shipment plan when in assignment mode
    let routeData = {
      loading_port: "",
      destination_country: "",
      port_of_discharge: "",
    };

    if (isAssignment && linerBooking?.shipmentPlan) {
      const planData = (linerBooking.shipmentPlan.data as any) ?? {};
      const containerMovement = planData?.container_movement ?? {};

      routeData = {
        loading_port: containerMovement?.loading_port || "",
        destination_country: containerMovement?.destination_country || "",
        port_of_discharge: containerMovement?.port_of_discharge || "",
      };
    }

    // Create duplicated detail with same values except equipment
    const duplicatedDetail = {
      ...originalDetail, // Copy all fields from original
      equipment_type: `${nextEquipment.equipment_type}|${nextEquipment.trackingNumber}`, // Use next available equipment with tracking
      booking_for: `${nextEquipment.equipment_type}|${nextEquipment.trackingNumber}`, // Mirror with equipment and tracking
      ...routeData, // Ensure route data is still inherited from shipment plan
    };

    // Handle File object copying separately
    if (originalDetail.line_booking_copy_file) {
      if (originalDetail.line_booking_copy_file instanceof File) {
        // For File objects, we need to preserve the reference
        duplicatedDetail.line_booking_copy_file = originalDetail.line_booking_copy_file;
        console.log("[DEBUG] Copied File object for PDF:", originalDetail.line_booking_copy_file.name);
      } else {
        // For string paths, copy directly
        duplicatedDetail.line_booking_copy_file = originalDetail.line_booking_copy_file;
        console.log("[DEBUG] Copied PDF file path:", originalDetail.line_booking_copy_file);
      }
    } else {
      duplicatedDetail.line_booking_copy_file = null;
      console.log("[DEBUG] No PDF file to copy");
    }

    console.log("[DEBUG] Duplicated detail:", duplicatedDetail);

    // Add the duplicated detail to the list
    setRequestedBookingDetails([...requestedBookingDetails, duplicatedDetail]);

    console.log("[DEBUG] Added duplicated booking detail successfully");
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

  // Validation function to check if all booking details are properly filled
  const validateAllBookingDetails = () => {
    console.log('[DEBUG] validateAllBookingDetails called with:', {
      linerBookingDetails,
      length: linerBookingDetails?.length,
      individualDestinationCountries
    });

    // If no booking details exist, don't allow submission
    if (!linerBookingDetails || linerBookingDetails.length === 0) {
      console.log('[DEBUG] No booking details found');
      return false;
    }

    // Check each booking detail
    for (let index = 0; index < linerBookingDetails.length; index++) {
      const detail = linerBookingDetails[index];
      // Check if this booking detail is "in use" (has content)
      const isBookingDetailInUse = detail.temporary_booking_number?.trim() ||
                                   detail.carrier?.trim() ||
                                   detail.equipment_type?.trim();

      if (isBookingDetailInUse) {
        // If booking detail is in use, all required fields must be filled
        if (!detail.liner_booking_number || detail.liner_booking_number.trim() === '') {
          return false;
        }
        if (!detail.carrier || detail.carrier.trim() === '') {
          return false;
        }
        if (!detail.e_t_d_of_original_planned_vessel) {
          return false;
        }
        if (!detail.empty_pickup_validity_from) {
          return false;
        }
        if (!detail.loading_port || detail.loading_port.trim() === '') {
          return false;
        }

        // Check destination country with fallback to immediate UI state
        const destinationCountry = detail.destination_country?.trim() || individualDestinationCountries[index]?.trim();
        if (!destinationCountry) {
          console.log('[DEBUG] Destination country validation failed for detail:', {
            index,
            detail,
            destination_country: detail.destination_country,
            individualValue: individualDestinationCountries[index],
            finalValue: destinationCountry
          });
          return false;
        }

        if (!detail.port_of_discharge || detail.port_of_discharge.trim() === '') {
          return false;
        }
      }
    }

    // Check if we have at least one booking detail that's actually in use
    const hasAtLeastOneValidBookingDetail = linerBookingDetails.some((detail: any) => {
      const isInUse = detail.temporary_booking_number?.trim() ||
                      detail.carrier?.trim() ||
                      detail.equipment_type?.trim();
      return isInUse;
    });

    return hasAtLeastOneValidBookingDetail;
  };

  // Memoized validation result to ensure it's reactive to state changes
  const isFormValid = useMemo(() => {
    return validateAllBookingDetails();
  }, [linerBookingDetails, individualDestinationCountries]);

  // Function to get missing required fields for display to user
  const getMissingRequiredFields = () => {
    if (!linerBookingDetails || linerBookingDetails.length === 0) {
      return ["Please add at least one booking detail"];
    }

    const missingFields: string[] = [];
    let hasAnyInUseDetail = false;

    linerBookingDetails.forEach((detail: any, index: number) => {
      const isBookingDetailInUse = detail.temporary_booking_number?.trim() ||
                                   detail.carrier?.trim() ||
                                   detail.equipment_type?.trim();

      if (isBookingDetailInUse) {
        hasAnyInUseDetail = true;
        const detailNumber = index + 1;

        if (!detail.liner_booking_number || detail.liner_booking_number.trim() === '') {
          missingFields.push(`Booking Detail #${detailNumber}: Liner Booking Number`);
        }
        if (!detail.carrier || detail.carrier.trim() === '') {
          missingFields.push(`Booking Detail #${detailNumber}: Carrier`);
        }
        if (!detail.e_t_d_of_original_planned_vessel) {
          missingFields.push(`Booking Detail #${detailNumber}: ETD of Original Planned Vessel`);
        }
        if (!detail.empty_pickup_validity_from) {
          missingFields.push(`Booking Detail #${detailNumber}: Empty Pickup Validity From`);
        }
        if (!detail.loading_port || detail.loading_port.trim() === '') {
          missingFields.push(`Booking Detail #${detailNumber}: Loading Port`);
        }
        // Check destination country with fallback to immediate UI state
        const destinationCountry = detail.destination_country?.trim() || individualDestinationCountries[index]?.trim();
        if (!destinationCountry) {
          console.log('[DEBUG] getMissingRequiredFields - Destination country missing for detail:', {
            detailNumber,
            index,
            detail,
            destination_country: detail.destination_country,
            individualValue: individualDestinationCountries[index],
            finalValue: destinationCountry
          });
          missingFields.push(`Booking Detail #${detailNumber}: Destination Country`);
        }
        if (!detail.port_of_discharge || detail.port_of_discharge.trim() === '') {
          missingFields.push(`Booking Detail #${detailNumber}: Port of Discharge`);
        }
      }
    });

    if (!hasAnyInUseDetail) {
      missingFields.push("Please fill in at least one booking detail");
    }

    return missingFields;
  };

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


      // Get route data from shipment plan for assignment mode
      let routeData = {
        loading_port: "",
        destination_country: "",
        port_of_discharge: "",
      };

      if (linerBooking?.shipmentPlan) {
        const planData = (linerBooking.shipmentPlan.data as any) ?? {};
        const containerMovement = planData?.container_movement ?? {};

        routeData = {
          loading_port: containerMovement?.loading_port || "",
          destination_country: containerMovement?.destination_country || "",
          port_of_discharge: containerMovement?.port_of_discharge || "",
        };

        console.log("[DEBUG] Bulk add - inheriting route data from shipment plan:", routeData);
      }

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
            ...routeData, // Inherit route data from shipment plan
          };
        });
    } else {
      // For non-assignment mode (new mode) or when no available equipment, use unallocated equipment
      if (mode === "new") {
        // In new mode, just create booking details with the selected equipment type
        // No need to check unallocated equipment since user can book any quantity
        newItems = Array.from({ length: qty }, (_, i) => {
          const seq = String(existingCount + i + 1).padStart(3, "0");

          return {
            temporary_booking_number: `${code}-${seq}`,
            liner_booking_number: bulkLinerBookingNumber || "",
            suffix_for_anticipatory_temporary_booking_number: bulkSuffixForAnticipatoryTempBookingNumber || "",
            mbl_number: bulkMblNumber || "",
            carrier: bulkCarrier || "",
            contract: bulkContract || "",
            original_planned_vessel: bulkOriginalPlannedVessel || "",
            e_t_d_of_original_planned_vessel: bulkEtdOfOriginalPlannedVessel || "",
            change_in_original_vessel: false,
            revised_vessel: "",
            etd_of_revised_vessel: "",
            empty_pickup_validity_from: bulkEmptyPickupValidityFrom || "",
            empty_pickup_validity_till: bulkEmptyPickupValidityFrom ? addDays(bulkEmptyPickupValidityFrom, 3) : "",
            estimate_gate_opening_date: bulkEtdOfOriginalPlannedVessel ? addDays(bulkEtdOfOriginalPlannedVessel, -3) : "",
            estimated_gate_cutoff_date: bulkEtdOfOriginalPlannedVessel ? addDays(bulkEtdOfOriginalPlannedVessel, -2) : "",
            s_i_cut_off_date: "",
            booking_received_from_carrier_on: "",
            additional_remarks: "",
            line_booking_copy: "",
            equipment_type: bulkEquipmentType, // Just the equipment type name
            booking_for: bulkEquipmentType, // Mirror with equipment type
            loading_port: bulkLoadingPort || "",
            destination_country: bulkDestinationCountry || "",
            port_of_discharge: bulkPortOfDischarge || "",
          };
        });
      } else {
        // For edit mode without shipment plan, use unallocated equipment
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
              loading_port: bulkLoadingPort || "",
              destination_country: bulkDestinationCountry || "",
              port_of_discharge: bulkPortOfDischarge || "",
            };
          });
      }
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

  // Helper function to add/subtract days from a date
  const addDays = (dateString: string, days: number): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  };

  // Helper function to auto-calculate related dates
  const calculateRelatedDates = (field: string, value: string, currentDetail: any) => {
    const updates: any = {};

    if (field === "e_t_d_of_original_planned_vessel" && value) {
      // Auto-calculate Gate Opening Date (ETD - 3 days)
      updates.estimate_gate_opening_date = addDays(value, -3);
      // Auto-calculate Gate Cutoff Date (ETD - 2 days)
      updates.estimated_gate_cutoff_date = addDays(value, -2);
    }

    if (field === "empty_pickup_validity_from" && value) {
      // Auto-calculate Empty Pickup Validity Till (From + 3 days)
      updates.empty_pickup_validity_till = addDays(value, 3);
    }

    return updates;
  };

  const updateLinerBookingDetail = (
    index: number,
    field: string,
    value: any
  ) => {
    console.log(`[DEBUG] updateLinerBookingDetail called - index: ${index}, field: ${field}, value:`, value);
    console.log("[DEBUG] Current requestedBookingDetails length:", requestedBookingDetails.length);
    console.log("[DEBUG] isAssignment:", isAssignment);
    if (isAssignment) {
      const updated = [...requestedBookingDetails];

      // Ensure the array has enough elements, fill with empty objects if needed
      while (updated.length <= index) {
        updated.push({
          temporary_booking_number: "",
          liner_booking_number: "",
          mbl_number: "",
          carrier: "",
          contract: "",
          original_planned_vessel: "",
          e_t_d_of_original_planned_vessel: "",
          change_in_original_vessel: false,
          revised_vessel: "",
          empty_pickup_from: "",
          empty_pickup_till: "",
          gate_opening_date: "",
          estimated_gate_cutoff_date: "",
          s_i_cut_off_date: "",
          booking_received_from_carrier_on: "",
          empty_pickup_validity_from: "",
          empty_pickup_validity_till: "",
          estimate_gate_opening_date: "",
          line_booking_copy: "",
          line_booking_copy_file: null,
          additional_remarks: "",
          equipment_type: "",
          booking_for: "",
          loading_port: "",
          destination_country: "",
          port_of_discharge: "",
        });
      }

      // Apply the main field update
      updated[index] = { ...updated[index], [field]: value };

      // Auto-calculate related dates
      const relatedUpdates = calculateRelatedDates(field, value, updated[index]);
      updated[index] = { ...updated[index], ...relatedUpdates };

      // Mirror behavior: in assignment mode keep booking_for in sync with selected equipment
      if (field === "equipment_type") {
        updated[index].booking_for = value || "";
      }
      // For assignment mode with available equipment, when displayName is set, update booking_for too
      if (field === "displayName" && availableEquipment.length > 0) {
        updated[index].booking_for = value || "";
      }
      console.log("[DEBUG] Setting requestedBookingDetails to:", updated);
      setRequestedBookingDetails(updated);
    } else {
      const updated = [...linerBookingDetails];

      // Ensure the array has enough elements, fill with empty objects if needed
      while (updated.length <= index) {
        updated.push({
          temporary_booking_number: "",
          liner_booking_number: "",
          suffix_for_anticipatory_temporary_booking_number: "",
          mbl_number: "",
          carrier: "",
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
          line_booking_copy_file: null,
          equipment_type: "",
          booking_for: "",
          loading_port: "",
          destination_country: "",
          port_of_discharge: "",
        });
      }

      // Apply the main field update
      updated[index] = { ...updated[index], [field]: value };

      // Auto-calculate related dates
      const relatedUpdates = calculateRelatedDates(field, value, updated[index]);
      updated[index] = { ...updated[index], ...relatedUpdates };

      // Mirror behavior: in "new" mode keep booking_for in sync with selected equipment
      if (mode === "new" && field === "equipment_type") {
        updated[index].booking_for = value || "";
      }
      console.log("[DEBUG] Setting linerBookingDetails to:", updated);
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

  const [showAllBookingCard, setShowAllBookingCard] = useState(false);
  const [railVisible, setRailVisible] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const formRef = useRef<HTMLFormElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  const referenceNumber =
    mode === "edit"
      ? (linerBooking?.shipmentPlan?.data as any)?.reference_number || "N/A"
      : "New Booking";

  const quickLinks = [
    { id: "section-linked-plan", label: "Linked Plan" },
    { id: "section-general", label: "General" },
    { id: "section-details", label: "Booking Details" },
  ];

  useEffect(() => {
    if (!actionData?.error) return;

    addToast({
      type: "error",
      title: "Save failed",
      description: parsedErrors.length ? (
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {parsedErrors.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      ) : (
        actionData.error
      ),
      duration: 6500,
    });

    if (errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [actionData?.error, addToast, parsedErrors]);

  // On validation errors, jump to the first errored field (fallback to summary)
  useEffect(() => {
    if (!actionData || !(actionData as any)?.fieldErrors) return;
    const fieldErrors = (actionData as any).fieldErrors;
    const firstKey = Object.keys(fieldErrors || {}).find(
      (key) => Array.isArray(fieldErrors[key]) ? fieldErrors[key].length : fieldErrors[key]
    );
    if (!firstKey) return;

    const formEl = formRef.current;
    const target = formEl?.querySelector(`[name="${firstKey}"]`) as
      | HTMLElement
      | null;

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if ("focus" in target) {
        (target as HTMLInputElement).focus({ preventScroll: true });
      }
    } else if (errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [actionData]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const onScroll = () => {
      setRailVisible(false);
      setShowBackToTop(window.scrollY > 400);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        setRailVisible(true);
      }, 300);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

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
        {/* In-page error banner removed in favor of toast notifications */}

        <div className="max-w-5xl mx-auto relative">
          {/* Sticky action bar */}
          <div className="sticky top-0 z-30 mb-4 bg-white/95 backdrop-blur border border-gray-200 rounded-lg shadow-sm px-3 py-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500">Reference</p>
              <p className="text-sm font-semibold text-gray-900">{referenceNumber}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap">
                {currentStatus}
              </span>
              <Button
                type="submit"
                form="liner-booking-form"
                disabled={isSubmitting || !isFormValid}
                className="inline-flex items-center px-3 py-2 text-sm font-semibold text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isSubmitting
                  ? mode === "edit"
                    ? "Saving..."
                    : "Creating..."
                  : mode === "edit"
                  ? "Update Liner Booking"
                  : "Create Liner Booking"}
              </Button>
            </div>
          </div>

          {/* Quick jump nav */}
          <div
            className={`hidden xl:block fixed right-4 top-24 z-20 space-y-2 drop-shadow-sm transition-opacity duration-150 ${
              railVisible ? "opacity-90" : "opacity-0 pointer-events-none"
            }`}
          >
            {quickLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => {
                  const el = document.getElementById(link.id);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className="block w-36 text-left px-3 py-2 text-sm font-medium bg-white border border-gray-200 rounded-md hover:border-blue-300 hover:text-blue-700"
              >
                {link.label}
              </button>
            ))}
          </div>

          <Form
            id="liner-booking-form"
            ref={formRef}
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
                  <div
                    className="relative scroll-mt-28 md:scroll-mt-24"
                    id="section-linked-plan"
                  >
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

                            {/* Buying Price Field - Required if missing from shipment plan */}
                            {(() => {
                              const currentBuyingPrice = (linerBooking.shipmentPlan?.data as any)?.container_movement?.buying_price;

                              if (!currentBuyingPrice) {
                                // Show editable field if buying price is missing
                                return (
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-700">
                                      Buying Price <span className="text-red-500">*</span>
                                      <span className="text-xs text-gray-500 block mt-1">
                                        (Required - not provided by planner)
                                      </span>
                                    </Label>
                                    <Input
                                      name="buying_price"
                                      placeholder="Enter buying price"
                                      className="text-sm"
                                      required
                                    />
                                  </div>
                                );
                              } else {
                                // Show read-only field if buying price exists
                                return (
                                  <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-gray-700">
                                      Buying Price
                                      <span className="text-xs text-green-600 block mt-1">
                                        (Provided by planner)
                                      </span>
                                    </Label>
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-gray-700">
                                      ${currentBuyingPrice}
                                    </div>
                                  </div>
                                );
                              }
                            })()}

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
                <div
                  className="relative scroll-mt-28 md:scroll-mt-24"
                  id="section-general"
                >
                  <button
                    type="button"
                    onClick={() => user?.role?.name !== "LINER_BOOKING_TEAM" && toggleSection("general")}
                    className={`w-full px-6 py-5 text-left flex items-center justify-between transition-all duration-200 focus:outline-none ${
                      user?.role?.name !== "LINER_BOOKING_TEAM"
                        ? "hover:bg-gray-50 focus:bg-gray-50 cursor-pointer"
                        : "cursor-default"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                          openSections.general || user?.role?.name === "LINER_BOOKING_TEAM"
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
                    {user?.role?.name !== "LINER_BOOKING_TEAM" && (
                      <div
                        className={`transform transition-transform duration-200 ${
                          openSections.general ? "rotate-180" : ""
                        }`}
                      >
                        <span className="text-gray-400">↓</span>
                      </div>
                    )}
                  </button>

                  {(openSections.general || user?.role?.name === "LINER_BOOKING_TEAM") && (
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
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setShowAllBookingCard((p) => !p)}
                                    className="text-sm font-semibold text-gray-700 flex items-center gap-2 hover:text-green-700"
                                  >
                                    <span>All Booking Assigned</span>
                                    <span className={`transition-transform ${showAllBookingCard ? "rotate-180" : ""}`}>
                                      ↓
                                    </span>
                                  </button>
                                  <span className={`text-xs px-2 py-1 rounded-full ${equipmentValidation.isValid ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                                    {equipmentValidation.isValid ? "Ready" : "Incomplete"}
                                  </span>
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
                              {showAllBookingCard && (
                                <p className="text-sm text-gray-600 mt-3">
                                  {equipmentValidation.isValid
                                    ? 'Click to mark both liner booking and linked shipment plan as "Booked"'
                                    : "Complete equipment allocation to enable this option"}
                                </p>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* Liner Booking Details Section */}
                <div
                  className="relative scroll-mt-28 md:scroll-mt-24"
                  id="section-details"
                >
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
                          Liner Booking Details ({(() => {
                            // For assignment mode, show count of non-unmapped liner booking details
                            if (isAssignment && data?.liner_booking_details) {
                              console.log("[DEBUG] Filtering liner booking details for count display");
                              console.log("[DEBUG] Total liner booking details:", data.liner_booking_details.length);

                              const shipmentPlanEquipment = getShipmentPlanEquipment();
                              console.log("[DEBUG] Shipment plan equipment:", shipmentPlanEquipment.map((eq: any, idx: number) => ({
                                index: idx,
                                trackingNumber: eq.trackingNumber,
                                equipmentType: eq.equipment_type,
                                unmapped: eq.unmapped
                              })));

                              const activeLinerBookingDetails = data.liner_booking_details.filter((detail: any, originalIndex: number) => {
                                // Extract tracking number from booking_for field
                                const detailTrackingNumber = detail.booking_for && detail.booking_for.includes("|")
                                  ? detail.booking_for.split("|")[1]
                                  : null;

                                // Find if this detail corresponds to an unmapped equipment
                                const isUnmapped = shipmentPlanEquipment.some(
                                  (eq: any) => eq.trackingNumber === detailTrackingNumber && eq.unmapped
                                );

                                console.log(`[DEBUG] Liner booking detail ${originalIndex}:`, {
                                  equipmentType: detail.equipment_type,
                                  linerBookingNumber: detail.liner_booking_number,
                                  detailTrackingNumber,
                                  isUnmapped,
                                  willBeIncluded: !isUnmapped
                                });

                                return !isUnmapped;
                              });

                              console.log("[DEBUG] Active liner booking details count:", activeLinerBookingDetails.length);
                              return activeLinerBookingDetails.length;
                            }
                            return linerBookingDetails.length;
                          })()})
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
                                  <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                      <tr>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          Select
                                        </th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          Temp Booking #
                                        </th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          Equipment
                                        </th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          Liner Booking #
                                        </th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          MBL Number
                                        </th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          Created
                                        </th>
                                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                                          Actions
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white text-sm">
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
                                            <td className="px-2 py-2 whitespace-nowrap">
                                              <input
                                                type="checkbox"
                                                name="selectedAvailableIds"
                                                value={b.id}
                                                className="h-4 w-4"
                                                disabled={isLinked}
                                              />
                                            </td>
                                            <td className="px-2 py-2 text-gray-800 whitespace-nowrap">
                                              <div className="flex items-center gap-2">
                                                {temp}
                                                {isLinked && (
                                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    Linked
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-2 py-2 text-gray-700 whitespace-nowrap">
                                              {eqp}
                                            </td>
                                            <td className="px-2 py-2 text-gray-700 whitespace-nowrap">
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
                                            <td className="px-2 py-2 text-gray-700 whitespace-nowrap">
                                              {mblNumber}
                                            </td>
                                            <td className="px-2 py-2 text-gray-600 whitespace-nowrap">
                                              {b.createdAt
                                                ? new Date(
                                                    b.createdAt
                                                  ).toLocaleDateString()
                                                : "N/A"}
                                            </td>
                                            <td className="px-2 py-2 whitespace-nowrap">
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
                            {/* Show allocated liner booking details when there are existing bookings */}
                            {isAssignment && data?.liner_booking_details && data.liner_booking_details.length > 0 && (
                              <div className="mb-6">
                                <h4 className="text-md font-semibold text-gray-800 mb-4">
                                  {currentStatus === "Booked" ? "Booked Liner Booking Details" : "Allocated Liner Booking Details"}
                                </h4>
                                <div className="space-y-2">
                                  {data?.liner_booking_details?.map((detail: any, originalIndex: number) => {
                                    // Filter out unmapped equipment by checking if this detail corresponds to unmapped equipment
                                    const shipmentPlanEquipment = getShipmentPlanEquipment();

                                    // Extract tracking number from booking_for field
                                    const detailTrackingNumber = detail.booking_for && detail.booking_for.includes("|")
                                      ? detail.booking_for.split("|")[1]
                                      : null;

                                    const isUnmapped = shipmentPlanEquipment.some(
                                      (eq: any) => eq.trackingNumber === detailTrackingNumber && eq.unmapped
                                    );

                                    console.log(`[DEBUG] Display filter - Detail ${originalIndex}:`, {
                                      equipmentType: detail.equipment_type,
                                      linerBookingNumber: detail.liner_booking_number,
                                      detailTrackingNumber,
                                      isUnmapped,
                                      willDisplay: !isUnmapped
                                    });

                                    if (isUnmapped) {
                                      console.log(`[DEBUG] Hiding detail ${originalIndex} because it's unmapped`);
                                      return null;
                                    }

                                    const isExpanded =
                                      expandedBookingDetail === originalIndex;

                                      return (
                                        <div
                                          key={originalIndex}
                                          className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                                        >
                                          {/* Accordion Header */}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedBookingDetail(
                                                isExpanded ? null : originalIndex
                                              )
                                            }
                                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:bg-gray-50"
                                          >
                                            <div className="flex items-center gap-3">
                                              <h5 className="text-sm font-semibold text-gray-700">
                                                Booking Detail #{originalIndex + 1}
                                              </h5>
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Booked
                                              </span>
                                              {detail.liner_booking_number && (
                                                <span className="text-xs font-medium text-blue-600">
                                                  {detail.liner_booking_number}
                                                </span>
                                              )}
                                              {/* Show unmapping request indicator */}
                                              {(() => {
                                                const hasUnmappingRequest = pendingUnmappingRequests.some(
                                                  (req: any) => req.linerBookingNumber === detail.liner_booking_number && req.equipmentIndex === originalIndex
                                                );
                                                return hasUnmappingRequest ? (
                                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                    🔄 Unmapping Requested
                                                  </span>
                                                ) : null;
                                              })()}
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

                                                {/* Individual Equipment Unmapping Button */}
                                                {(() => {
                                                  const hasUnmappingRequest = pendingUnmappingRequests.some(
                                                    (req: any) => req.linerBookingNumber === detail.liner_booking_number && req.equipmentIndex === originalIndex
                                                  );

                                                  if (hasUnmappingRequest) {
                                                    return (
                                                      <div className="mt-4 pt-4 border-t border-gray-100">
                                                        <div className="flex justify-end">
                                                          <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                                                            Unmapping request pending approval
                                                          </div>
                                                        </div>
                                                      </div>
                                                    );
                                                  }

                                                  return (
                                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                                      <div className="flex justify-end">
                                                        <Button
                                                          type="button"
                                                          variant="outline"
                                                          className="border-amber-300 text-amber-700 hover:bg-amber-50 bg-white text-xs px-3 py-1"
                                                      onClick={(e) => {
                                                        e.preventDefault();

                                                        // Prompt for unmapping reason
                                                        const reason = prompt(
                                                          `Please provide a reason for requesting unmapping of ${detail.equipment_type} (${detail.liner_booking_number}):`
                                                        );

                                                        if (!reason || reason.trim() === '') {
                                                          alert('Unmapping reason is required');
                                                          return;
                                                        }

                                                        if (confirm(`Are you sure you want to request unmapping for ${detail.equipment_type} (${detail.liner_booking_number})?\n\nReason: ${reason}`)) {
                                                          // Create a temporary form to submit the unmapping request
                                                          const form = document.createElement('form');
                                                          form.method = 'post';
                                                          form.action = window.location.href;

                                                          // Add hidden inputs
                                                          const inputs = [
                                                            { name: '_action', value: 'request_individual_unmapping' },
                                                            { name: 'equipmentIndex', value: originalIndex.toString() },
                                                            { name: 'equipmentType', value: detail.equipment_type || '' },
                                                            { name: 'linerBookingNumber', value: detail.liner_booking_number || '' },
                                                            { name: 'unmappingReason', value: reason.trim() }
                                                          ];

                                                          inputs.forEach(({ name, value }) => {
                                                            const input = document.createElement('input');
                                                            input.type = 'hidden';
                                                            input.name = name;
                                                            input.value = value;
                                                            form.appendChild(input);
                                                          });

                                                          document.body.appendChild(form);
                                                          form.submit();
                                                        }
                                                      }}
                                                    >
                                                          Request Unmapping
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  );
                                                })()}
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
                            )}

                            {/* Hidden form inputs for existing liner booking details to preserve them during submission */}
                            {isAssignment && data?.liner_booking_details && data.liner_booking_details.length > 0 && (
                              <>
                                {data.liner_booking_details.map((detail: any, originalIndex: number) => {
                                  // Filter out unmapped equipment (same logic as display)
                                  const shipmentPlanEquipment = getShipmentPlanEquipment();
                                  const isUnmapped = shipmentPlanEquipment.some(
                                    (eq: any, equipmentIndex: number) => equipmentIndex === originalIndex && eq.unmapped
                                  );
                                  if (isUnmapped) return null;

                                  // Calculate the form index (existing details come first, then requested details)
                                  const existingDetailsBeforeThis = data.liner_booking_details
                                    .slice(0, originalIndex)
                                    .filter((d: any, i: number) => {
                                      const spe = getShipmentPlanEquipment();
                                      return !spe.some((eq: any, equipmentIndex: number) => equipmentIndex === i && eq.unmapped);
                                    }).length;

                                  const formIndex = existingDetailsBeforeThis;

                                  return (
                                    <div key={`existing-${originalIndex}`}>
                                      {/* Hidden inputs for all the liner booking detail fields */}
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][temporary_booking_number]`} value={detail.temporary_booking_number || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][equipment_type]`} value={detail.equipment_type || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][booking_for]`} value={detail.booking_for || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][loading_port]`} value={detail.loading_port || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][destination_country]`} value={detail.destination_country || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][port_of_discharge]`} value={detail.port_of_discharge || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][line_booking_copy]`} value={detail.line_booking_copy || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][line_booking_copy_file]`} value={detail.line_booking_copy_file || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][additional_remarks]`} value={detail.additional_remarks || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][suffix_for_anticipatory_temporary_booking_number]`} value={detail.suffix_for_anticipatory_temporary_booking_number || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][liner_booking_number]`} value={detail.liner_booking_number || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][mbl_number]`} value={detail.mbl_number || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][carrier]`} value={detail.carrier || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][contract]`} value={detail.contract || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][original_planned_vessel]`} value={detail.original_planned_vessel || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][change_in_original_vessel]`} value={detail.change_in_original_vessel ? "true" : "false"} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][revised_vessel]`} value={detail.revised_vessel || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][empty_pickup_from]`} value={detail.empty_pickup_from || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][empty_pickup_till]`} value={detail.empty_pickup_till || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][gate_opening_date]`} value={detail.gate_opening_date || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][estimated_gate_cutoff_date]`} value={detail.estimated_gate_cutoff_date || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][s_i_cut_off_date]`} value={detail.s_i_cut_off_date || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][booking_received_from_carrier_on]`} value={detail.booking_received_from_carrier_on || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][e_t_d_of_original_planned_vessel]`} value={detail.e_t_d_of_original_planned_vessel || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][etd_of_revised_vessel]`} value={detail.etd_of_revised_vessel || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][empty_pickup_validity_from]`} value={detail.empty_pickup_validity_from || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][empty_pickup_validity_till]`} value={detail.empty_pickup_validity_till || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][estimate_gate_opening_date]`} value={detail.estimate_gate_opening_date || ""} />
                                      <input type="hidden" name={`liner_booking_details[${formIndex}][allocated]`} value="true" />
                                    </div>
                                  );
                                })}
                              </>
                            )}

                            {/* Request booking UI - Always show when on request tab */}
                            {isAssignment && assignmentTab === "request" && currentStatus !== "Booked" && (
                              <div className="flex justify-between items-center mb-4">
                                <h4 className="text-md font-semibold text-gray-800">
                                  Request New Booking Details
                                </h4>
                                <Button
                                  type="button"
                                  onClick={addLinerBookingDetail}
                                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200"
                                >
                                  Add Booking Detail
                                </Button>
                              </div>
                            )}

                            {/* Bulk Add block should only appear for new creation and when not booked */}
                            {mode === "new" && currentStatus !== "Booked" && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                                <h4 className="text-md font-semibold text-gray-800 mb-4">
                                  Add Booking Details
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                  {/* Equipment Type */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-600">
                                      Equipment Type <span className="text-red-500">*</span>
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
                                      Quantity <span className="text-red-500">*</span>
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

                                  {/* Liner Booking Number */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-600">
                                      Liner Booking Number <span className="text-red-500">*</span>
                                    </Label>
                                    <input
                                      type="text"
                                      value={bulkLinerBookingNumber}
                                      onChange={(e) =>
                                        setBulkLinerBookingNumber(e.target.value)
                                      }
                                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                                      placeholder="Enter liner booking number"
                                    />
                                  </div>

                                  {/* Suffix for Anticipatory Temp Booking Number */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-600">
                                      Suffix for Anticipatory Temp Booking Number
                                    </Label>
                                    <input
                                      type="text"
                                      value={bulkSuffixForAnticipatoryTempBookingNumber}
                                      onChange={(e) =>
                                        setBulkSuffixForAnticipatoryTempBookingNumber(e.target.value)
                                      }
                                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                                      placeholder="Enter suffix"
                                    />
                                  </div>

                                  {/* Carrier */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-600">
                                      Carrier <span className="text-red-500">*</span>
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

                                  {/* Contract */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-600">
                                      Contract
                                    </Label>
                                    <input
                                      type="text"
                                      value={bulkContract}
                                      onChange={(e) =>
                                        setBulkContract(e.target.value)
                                      }
                                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                                      placeholder="Enter contract"
                                    />
                                  </div>

                                  {/* Original Planned Vessel */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-600">
                                      Original Planned Vessel
                                    </Label>
                                    <SearchableSelect
                                      value={bulkOriginalPlannedVessel}
                                      onChange={(value: string) =>
                                        setBulkOriginalPlannedVessel(value)
                                      }
                                      placeholder="Search vessels..."
                                      className="text-sm"
                                      options={(dataPoints?.vessels || []).map(
                                        (v: any) => ({
                                          value: v.name,
                                          label: v.name,
                                        })
                                      )}
                                    />
                                  </div>

                                  {/* ETD of Original Planned Vessel */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-600">
                                      ETD of Original Planned Vessel <span className="text-red-500">*</span>
                                    </Label>
                                    <input
                                      type="date"
                                      value={bulkEtdOfOriginalPlannedVessel}
                                      onChange={(e) =>
                                        setBulkEtdOfOriginalPlannedVessel(e.target.value)
                                      }
                                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                                    />
                                  </div>

                                  {/* Empty Pickup Validity From */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-600">
                                      Empty Pickup Validity From <span className="text-red-500">*</span>
                                    </Label>
                                    <input
                                      type="date"
                                      value={bulkEmptyPickupValidityFrom}
                                      onChange={(e) =>
                                        setBulkEmptyPickupValidityFrom(e.target.value)
                                      }
                                      className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                                    />
                                  </div>

                                  {/* Loading Port */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-600">
                                      Loading Port
                                    </Label>
                                    <SearchableSelect
                                      value={bulkLoadingPort}
                                      onChange={(value: string) =>
                                        setBulkLoadingPort(value)
                                      }
                                      placeholder="Select loading port"
                                      className="text-sm"
                                      options={(dataPoints?.loadingPorts || []).map(
                                        (port: any) => ({
                                          value: port.name,
                                          label: `🚢 ${port.name}, ${port.country}`,
                                        })
                                      )}
                                    />
                                  </div>

                                  {/* Destination Country */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-600">
                                      Destination Country
                                    </Label>
                                    <SearchableSelect
                                      value={bulkDestinationCountry}
                                      onChange={(value: string) =>
                                        handleBulkDestinationCountryChange(value)
                                      }
                                      placeholder="Select destination country"
                                      className="text-sm"
                                      options={(dataPoints?.destinationCountries || []).map(
                                        (country: any) => ({
                                          value: country.name,
                                          label: `🌍 ${country.name}`,
                                        })
                                      )}
                                    />
                                  </div>

                                  {/* Port of Discharge */}
                                  <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-600">
                                      Port of Discharge
                                    </Label>
                                    <SearchableSelect
                                      value={bulkPortOfDischarge}
                                      onChange={(value: string) =>
                                        setBulkPortOfDischarge(value)
                                      }
                                      placeholder={
                                        bulkDestinationCountry
                                          ? `Select port in ${bulkDestinationCountry}`
                                          : "Select destination country first"
                                      }
                                      className="text-sm"
                                      disabled={!bulkDestinationCountry}
                                      options={(dataPoints?.portsOfDischarge || [])
                                        .filter(
                                          (port: any) =>
                                            !bulkDestinationCountry ||
                                            port.country === bulkDestinationCountry
                                        )
                                        .map((port: any) => ({
                                          value: port.name,
                                          label: `🏢 ${port.name}, ${port.country}`,
                                        }))}
                                    />
                                  </div>
                                </div>

                                {/* Auto-generation preview */}
                                {bulkEquipmentType &&
                                  (Number.parseInt(
                                    (bulkQuantity || "").trim(),
                                    10
                                  ) || 0) > 0 && (
                                    <div className="bg-blue-100 rounded-lg p-3 border border-blue-300 mb-4">
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

                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    onClick={bulkAddLinerBookingDetails}
                                    disabled={!bulkEquipmentType || !bulkQuantity || Number.parseInt(bulkQuantity || "0", 10) < 1}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-medium transition-all duration-200"
                                  >
                                    Bulk Add ({bulkQuantity || 0} booking details)
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Add Booking Detail button for new mode */}
                            {mode === "new" && currentStatus !== "Booked" && (
                              <div className="flex justify-between items-center mb-4">
                                <h4 className="text-md font-semibold text-gray-800">
                                  Liner Booking Details
                                </h4>
                                <Button
                                  type="button"
                                  onClick={addLinerBookingDetail}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200"
                                >
                                  Add Booking Detail
                                </Button>
                              </div>
                            )}

                            {/* Existing details list/cards */}
                            {/* Only show editable booking details when not booked */}
                            {currentStatus !== "Booked" &&
                              (isAssignment
                                ? requestedBookingDetails
                                : linerBookingDetails
                              ).map((detail: any, originalIndex: number) => {
                                console.log(`[DEBUG] Mapping booking detail - originalIndex: ${originalIndex}, detail:`, detail);
                                // Calculate the correct form index for requested booking details
                                // In assignment mode, requested details should come after existing details
                                let index = originalIndex;
                                if (isAssignment && data?.liner_booking_details) {
                                  // Count existing details that are NOT unmapped
                                  const existingValidDetailsCount = data.liner_booking_details.filter((d: any) => {
                                    if (d.equipment_type && d.equipment_type.includes("|")) {
                                      const trackingNumber = d.equipment_type.split("|")[1];
                                      const shipmentPlanEquipment = getShipmentPlanEquipment();
                                      return !shipmentPlanEquipment.some((eq: any) => eq.trackingNumber === trackingNumber && eq.unmapped);
                                    }
                                    return true;
                                  }).length;
                                  index = existingValidDetailsCount + originalIndex;
                                  console.log(`[DEBUG] Assignment mode - existingValidDetailsCount: ${existingValidDetailsCount}, originalIndex: ${originalIndex}, calculated index: ${index}`);
                                }

                                return (
                                <div
                                  key={`${isAssignment ? 'requested' : 'liner'}-${originalIndex}`}
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
                                        allocatedBookingDetails.has(originalIndex) && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              // Handle unlinking individual booking detail
                                              // Remove from allocated set
                                              const newAllocated = new Set(
                                                allocatedBookingDetails
                                              );
                                              newAllocated.delete(originalIndex);
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
                                                      i !== originalIndex
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
                                                  originalIndex.toString();
                                                form.appendChild(hiddenInput);
                                              }

                                              // Mark this booking detail as allocated
                                              const newAllocated = new Set(
                                                allocatedBookingDetails
                                              );
                                              newAllocated.add(originalIndex);
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
                                          newAllocated.delete(originalIndex);
                                          setAllocatedBookingDetails(
                                            newAllocated
                                          );
                                          // Remove the booking detail
                                          removeLinerBookingDetail(originalIndex);
                                        }}
                                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium transition-all duration-200"
                                      >
                                        Remove
                                      </Button>

                                      {/* Duplicate button: Only show in assignment mode */}
                                      {isAssignment && (
                                        <Button
                                          type="button"
                                          onClick={() => {
                                            duplicateLinerBookingDetail(originalIndex);
                                          }}
                                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-medium transition-all duration-200"
                                        >
                                          Duplicate
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Hidden field to track if this booking detail is allocated */}
                                  <input
                                    type="hidden"
                                    name={`liner_booking_details[${index}][allocated]`}
                                    value={
                                      allocatedBookingDetails.has(originalIndex)
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
                                          <div className="md:col-span-2">
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
                                                  originalIndex,
                                                  "equipment_type",
                                                  e.target.value
                                                )
                                              }
                                              disabled={allocatedBookingDetails.has(
                                                originalIndex
                                              )}
                                              className="text-sm"
                                            >
                                              <option value="">
                                                -- Select Equipment --
                                              </option>
                                              {(() => {
                                                const unallocatedOptions =
                                                  getUnallocatedEquipmentTypes();
                                                const currentValue =
                                                  detail.equipment_type || "";
                                                const isCurrentListed =
                                                  unallocatedOptions.some(
                                                    (equipment: any) =>
                                                      `${equipment.equipment_type}|${equipment.trackingNumber}` ===
                                                      currentValue
                                                  );
                                                const [
                                                  currentType,
                                                  currentTracking,
                                                ] = currentValue.split("|");
                                                return (
                                                  <>
                                                    {currentValue &&
                                                      !isCurrentListed && (
                                                        <option
                                                          value={currentValue}
                                                        >
                                                          {currentTracking &&
                                                          currentTracking !==
                                                            "undefined"
                                                            ? `${currentType} (${currentTracking})`
                                                            : currentType}
                                                        </option>
                                                      )}
                                                    {unallocatedOptions.map(
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
                                                  </>
                                                );
                                              })()}
                                            </Select>
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
                                                    console.log("[DEBUG] Assignment mode equipment selected - originalIndex:", originalIndex, "calculated index:", index);
                                                    updateLinerBookingDetail(
                                                      originalIndex,
                                                      "equipment_type",
                                                      selectedEquipment.equipmentType
                                                    );
                                                    updateLinerBookingDetail(
                                                      originalIndex,
                                                      "trackingNumber",
                                                      selectedEquipment.trackingNumber
                                                    );
                                                    updateLinerBookingDetail(
                                                      originalIndex,
                                                      "displayName",
                                                      selectedEquipment.displayName
                                                    );
                                                    updateLinerBookingDetail(
                                                      originalIndex,
                                                      "booking_for",
                                                      selectedEquipment.displayName
                                                    );
                                                  }
                                                } else {
                                                  console.log("[DEBUG] Equipment selected - originalIndex:", originalIndex, "calculated index:", index);
                                                  updateLinerBookingDetail(
                                                    originalIndex,
                                                    "equipment_type",
                                                    e.target.value
                                                  );
                                                }
                                              }}
                                              disabled={allocatedBookingDetails.has(
                                                originalIndex
                                              )}
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
                                                originalIndex,
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
                                            originalIndex,
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
                                            originalIndex,
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
                                        Liner Booking Number <span className="text-red-500">*</span>
                                      </Label>
                                      <Input
                                        name={`liner_booking_details[${index}][liner_booking_number]`}
                                        value={detail.liner_booking_number}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            originalIndex,
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
                                            originalIndex,
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
                                        Carrier <span className="text-red-500">*</span>
                                      </Label>
                                      <SearchableSelect
                                        name={`liner_booking_details[${index}][carrier]`}
                                        value={detail.carrier}
                                        onChange={(value) =>
                                          updateLinerBookingDetail(
                                            originalIndex,
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
                                            originalIndex,
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
                                            originalIndex,
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
                                              originalIndex,
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
                                              originalIndex,
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
                                              originalIndex,
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
                                        ETD of Original Planned Vessel <span className="text-red-500">*</span>
                                      </Label>
                                      <Input
                                        type="date"
                                        name={`liner_booking_details[${index}][e_t_d_of_original_planned_vessel]`}
                                        value={formatDateForInput(
                                          detail.e_t_d_of_original_planned_vessel
                                        )}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            originalIndex,
                                            "e_t_d_of_original_planned_vessel",
                                            e.target.value
                                          )
                                        }
                                        className="text-sm"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Empty Pickup Validity From <span className="text-red-500">*</span>
                                      </Label>
                                      <Input
                                        type="date"
                                        name={`liner_booking_details[${index}][empty_pickup_validity_from]`}
                                        value={formatDateForInput(
                                          detail.empty_pickup_validity_from
                                        )}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            originalIndex,
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
                                        <span className="text-xs text-blue-600 block">(Auto: From + 3 days)</span>
                                      </Label>
                                      <Input
                                        type="date"
                                        name={`liner_booking_details[${index}][empty_pickup_validity_till]`}
                                        value={formatDateForInput(
                                          detail.empty_pickup_validity_till
                                        )}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            originalIndex,
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
                                        <span className="text-xs text-blue-600 block">(Auto: ETD - 3 days)</span>
                                      </Label>
                                      <Input
                                        type="date"
                                        name={`liner_booking_details[${index}][estimate_gate_opening_date]`}
                                        value={formatDateForInput(
                                          detail.estimate_gate_opening_date
                                        )}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            originalIndex,
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
                                        <span className="text-xs text-blue-600 block">(Auto: ETD - 2 days)</span>
                                      </Label>
                                      <Input
                                        type="date"
                                        name={`liner_booking_details[${index}][estimated_gate_cutoff_date]`}
                                        value={formatDateForInput(
                                          detail.estimated_gate_cutoff_date
                                        )}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            originalIndex,
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
                                            originalIndex,
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
                                            originalIndex,
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
                                            originalIndex,
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
                                            originalIndex,
                                            "line_booking_copy_file",
                                            e.target.files
                                              ? e.target.files[0]
                                              : null
                                          )
                                        }
                                        accept=".pdf"
                                        className="text-sm"
                                      />
                                      {detail.line_booking_copy_file && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          Current file:{" "}
                                          {typeof detail.line_booking_copy_file === "string" ? (
                                            <a
                                              href={detail.line_booking_copy_file}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:underline"
                                            >
                                              View PDF
                                            </a>
                                          ) : detail.line_booking_copy_file instanceof File ? (
                                            <span className="text-gray-700 font-medium">
                                              {detail.line_booking_copy_file.name} ({Math.round(detail.line_booking_copy_file.size / 1024)} KB)
                                            </span>
                                          ) : (
                                            <span className="text-gray-500">Unknown file type</span>
                                          )}
                                        </p>
                                      )}
                                    </div>

                                    {/* Only show route fields in new mode, not in assignment mode */}
                                    {!isAssignment && (
                                      <>
                                        {/* Loading Port */}
                                        <div className="space-y-2">
                                          <Label className="text-xs font-medium text-gray-600">
                                            Loading Port
                                          </Label>
                                          <SearchableSelect
                                            name={`liner_booking_details[${index}][loading_port]`}
                                            value={detail.loading_port || ""}
                                            onChange={(value: string) =>
                                              updateLinerBookingDetail(
                                                originalIndex,
                                                "loading_port",
                                                value
                                              )
                                            }
                                            placeholder="Select loading port"
                                            className="text-sm"
                                            options={(dataPoints?.loadingPorts || []).map(
                                              (port: any) => ({
                                                value: port.name,
                                                label: `🚢 ${port.name}, ${port.country}`,
                                              })
                                            )}
                                          />
                                        </div>

                                        {/* Destination Country */}
                                        <div className="space-y-2">
                                          <Label className="text-xs font-medium text-gray-600">
                                            Destination Country
                                          </Label>
                                          <SearchableSelect
                                            name={`liner_booking_details[${index}][destination_country]`}
                                            value={detail.destination_country || ""}
                                            onChange={(value: string) => {
                                              console.log(`[DEBUG] Destination country changed for detail ${originalIndex}:`, value);

                                              // Update immediate state for UI responsiveness
                                              setIndividualDestinationCountries(prev => ({
                                                ...prev,
                                                [originalIndex]: value
                                              }));

                                              // Update form state
                                              updateLinerBookingDetail(
                                                originalIndex,
                                                "destination_country",
                                                value
                                              );
                                              // Reset port of discharge when country changes
                                              updateLinerBookingDetail(
                                                originalIndex,
                                                "port_of_discharge",
                                                ""
                                              );
                                            }}
                                            placeholder="Select destination country"
                                            className="text-sm"
                                            options={(dataPoints?.destinationCountries || []).map(
                                              (country: any) => ({
                                                value: country.name,
                                                label: `🌍 ${country.name}`,
                                              })
                                            )}
                                          />
                                        </div>

                                        {/* Port of Discharge */}
                                        <div className="space-y-2">
                                          <Label className="text-xs font-medium text-gray-600">
                                            Port of Discharge
                                          </Label>
                                          <SearchableSelect
                                            name={`liner_booking_details[${index}][port_of_discharge]`}
                                            value={detail.port_of_discharge || ""}
                                            onChange={(value: string) =>
                                              updateLinerBookingDetail(
                                                originalIndex,
                                                "port_of_discharge",
                                                value
                                              )
                                            }
                                            placeholder={(() => {
                                              const currentCountry = individualDestinationCountries[originalIndex] || detail.destination_country;
                                              return currentCountry
                                                ? `Select port in ${currentCountry}`
                                                : "Select destination country first";
                                            })()}
                                            className="text-sm"
                                            disabled={!individualDestinationCountries[originalIndex] && !detail.destination_country}
                                            options={(() => {
                                              const currentCountry = individualDestinationCountries[originalIndex] || detail.destination_country;
                                              const allPorts = dataPoints?.portsOfDischarge || [];
                                              const filteredPorts = allPorts.filter(
                                                (port: any) =>
                                                  !currentCountry ||
                                                  port.country === currentCountry
                                              );
                                              console.log(`[DEBUG] Port filtering for detail ${originalIndex}:`, {
                                                currentCountry,
                                                immediateState: individualDestinationCountries[originalIndex],
                                                detailState: detail.destination_country,
                                                allPortsCount: allPorts.length,
                                                filteredPortsCount: filteredPorts.length,
                                                samplePorts: filteredPorts.slice(0, 3).map(p => `${p.name}, ${p.country}`)
                                              });
                                              return filteredPorts.map((port: any) => ({
                                                value: port.name,
                                                label: `🏢 ${port.name}, ${port.country}`,
                                              }));
                                            })()}
                                          />
                                        </div>
                                      </>
                                    )}

                                    {/* In assignment mode, add hidden inputs to preserve route data from shipment plan */}
                                    {isAssignment && (
                                      <>
                                        <input
                                          type="hidden"
                                          name={`liner_booking_details[${index}][loading_port]`}
                                          value={detail.loading_port || ""}
                                        />
                                        <input
                                          type="hidden"
                                          name={`liner_booking_details[${index}][destination_country]`}
                                          value={detail.destination_country || ""}
                                        />
                                        <input
                                          type="hidden"
                                          name={`liner_booking_details[${index}][port_of_discharge]`}
                                          value={detail.port_of_discharge || ""}
                                        />
                                      </>
                                    )}

                                    <div className="space-y-2 md:col-span-3">
                                      <Label className="text-xs font-medium text-gray-600">
                                        Additional Remarks
                                      </Label>
                                      <Textarea
                                        name={`liner_booking_details[${index}][additional_remarks]`}
                                        value={detail.additional_remarks}
                                        onChange={(e) =>
                                          updateLinerBookingDetail(
                                            originalIndex,
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
                              );
                              })}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Individual allocation is now handled by the Allocate button on each form card */}

                {/* Missing Required Fields Alert */}
                {!isFormValid && (
                  <div className="px-6 py-4 bg-red-50 border-t border-red-200">
                    <div className="rounded-md bg-red-50 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">
                            Required fields missing
                          </h3>
                          <div className="mt-2 text-sm text-red-700">
                            <p className="mb-2">Please complete the following to enable the Create Liner Booking button:</p>
                            <ul className="list-disc pl-5 space-y-1">
                              {getMissingRequiredFields().map((field, index) => (
                                <li key={index}>{field}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {showBackToTop && (
                  <div className="px-6 pt-4 bg-gray-50 border-t border-gray-200 flex justify-end lg:hidden">
                    <Button
                      type="button"
                      variant="outline"
                      className="text-sm px-3 py-2"
                      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    >
                      ↑ Back to top
                    </Button>
                  </div>
                )}

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
                        disabled={isSubmitting || !isFormValid}
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
