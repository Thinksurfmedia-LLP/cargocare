"use client";

import type React from "react";

import { Form, Link } from "react-router";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Select } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { SearchableSelect } from "~/components/ui/searchable-select";
import { useToast } from "~/components/ui/toast";
import { BulkEquipmentModal } from "~/components/ui/bulk-equipment-modal";

interface ShipmentPlanFormProps {
  mode: "create" | "edit";
  dataPoints: any;
  actionData?: any;
  isSubmitting: boolean;
  planData?: any;
  shipmentPlan?: any;
  user: any;
  defaultSalesPersonId?: string | null;
}

export function ShipmentPlanForm({
  mode,
  dataPoints,
  actionData,
  isSubmitting,
  planData = {},
  shipmentPlan,
  user,
  defaultSalesPersonId,
}: ShipmentPlanFormProps) {
  const [specificStuffing, setSpecificStuffing] = useState(
    planData.container_movement?.specific_stuffing_requirement || false
  );
  const [packageDetails, setPackageDetails] = useState(() => {
    return (planData.package_details || []).map((pkg: any) => ({
      ...pkg,
      un_number: pkg?.un_number || "",
      haz_class: pkg?.haz_class || "",
      is_haz: pkg?.is_haz || false,
    })) || [{}];
  });

  // Centralized equipment code generation - uses initials with conflict resolution
  const generateEquipmentCode = (
    equipmentType: string,
    existingCodes: string[] = []
  ) => {
    if (!equipmentType) return "EQP";

    // First, try to find the equipment in master data with a predefined code
    const equipmentMaster = dataPoints.equipment.find(
      (equipment: any) =>
        equipment.name.toLowerCase() === equipmentType.toLowerCase()
    );

    if (equipmentMaster && equipmentMaster.code) {
      return equipmentMaster.code;
    }

    // Fallback to intelligent code generation with conflict resolution
    return generateCodeFromName(equipmentType, existingCodes);
  };

  // Intelligent code generation with conflict resolution
  const generateCodeFromName = (
    equipmentType: string,
    existingCodes: string[] = []
  ) => {
    const type = equipmentType.toLowerCase().trim();
    let code = "";

    // Extract size (20ft, 40ft, 25ft, etc.)
    const sizeMatch = type.match(/(\d+)(?:ft|'|\s*foot|\s*feet)/i);
    if (sizeMatch) {
      code += sizeMatch[1];
    }

    // Extract type words (excluding size-related words and common words)
    const words = type
      .replace(/\d+(?:ft|'|\s*foot|\s*feet)/gi, "") // Remove size
      .replace(/[^a-z\s]/g, "") // Remove special characters
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 0 &&
          ![
            "container",
            "ft",
            "foot",
            "feet",
            "the",
            "and",
            "or",
            "of",
            "with",
            "for",
          ].includes(word)
      );

    if (words.length === 0) {
      return code + "EQP"; // Fallback if no meaningful words
    }

    // Start with single initials
    let typeCode = words.map((word) => word.charAt(0).toUpperCase()).join("");
    let finalCode = code + typeCode;

    // If there's a conflict, progressively add more letters
    let conflictLevel = 1;
    while (existingCodes.includes(finalCode) && conflictLevel <= 3) {
      typeCode = words
        .map((word) => {
          const letters = Math.min(conflictLevel + 1, word.length);
          return word.substring(0, letters).toUpperCase();
        })
        .join("")
        .substring(0, 5); // Limit type code to 5 characters

      finalCode = code + typeCode;
      conflictLevel++;
    }

    // If still conflicting after 3 levels, add a number
    if (existingCodes.includes(finalCode)) {
      let counter = 1;
      let baseCode = finalCode;
      while (existingCodes.includes(finalCode) && counter < 100) {
        finalCode = baseCode + counter;
        counter++;
      }
    }

    // Ensure proper length constraints
    if (finalCode.length < 3) {
      finalCode = finalCode.padEnd(3, "X");
    }
    if (finalCode.length > 8) {
      finalCode = finalCode.substring(0, 8);
    }

    return finalCode;
  };

  // Updated equipment details state to handle new structure
  const [equipmentDetails, setEquipmentDetails] = useState(() => {
    if (
      planData.equipment_details &&
      Array.isArray(planData.equipment_details)
    ) {
      // Convert old format to new format if needed
      return planData.equipment_details.flatMap(
        (equipment: any, index: number) => {
          if (
            equipment.number_of_equipment &&
            equipment.number_of_equipment > 1
          ) {
            // Split old format into individual entries
            const entries = [];
            for (let i = 0; i < equipment.number_of_equipment; i++) {
              const equipmentCode = generateEquipmentCode(
                equipment.equipment_type
              );
              entries.push({
                ...equipment,
                trackingNumber:
                  equipment.trackingNumber ||
                  `${
                    planData.reference_number || "TEMP"
                  }-${equipmentCode}-${String(i + 1).padStart(3, "0")}`,
                equipmentSequence: i + 1,
                number_of_equipment: 1, // Always 1 in new format
                // Individual status fields
                status: equipment.status || "Pending",
                emptyPickupStatus: equipment.emptyPickupStatus || false,
                stuffingStatus: equipment.stuffingStatus || false,
                gateInStatus: equipment.gateInStatus || false,
                loadedStatus: equipment.loadedStatus || false,
                emptyPickupDate: equipment.emptyPickupDate || "",
                stuffingDate: equipment.stuffingDate || "",
                gateInDate: equipment.gateInDate || "",
                loadedDate: equipment.loadedDate || "",
              });
            }
            return entries;
          } else {
            // Already in new format or single equipment
            const equipmentCode = generateEquipmentCode(
              equipment.equipment_type
            );
            return [
              {
                ...equipment,
                trackingNumber:
                  equipment.trackingNumber ||
                  `${
                    planData.reference_number || "TEMP"
                  }-${equipmentCode}-${String(index + 1).padStart(3, "0")}`,
                equipmentSequence: equipment.equipmentSequence || index + 1,
                number_of_equipment: 1,
                // Individual status fields
                status: equipment.status || "Pending",
                emptyPickupStatus: equipment.emptyPickupStatus || false,
                stuffingStatus: equipment.stuffingStatus || false,
                gateInStatus: equipment.gateInStatus || false,
                loadedStatus: equipment.loadedStatus || false,
                emptyPickupDate: equipment.emptyPickupDate || "",
                stuffingDate: equipment.stuffingDate || "",
                gateInDate: equipment.gateInDate || "",
                loadedDate: equipment.loadedDate || "",
              },
            ];
          }
        }
      );
    }
    return []; // Change from [{}] to []
  });

  const [equipmentStuffingPoints, setEquipmentStuffingPoints] = useState<{
    [key: number]: string;
  }>({});
  const [deliveryTill, setDeliveryTill] = useState<string>(
    planData.container_movement?.delivery_till || ""
  );
  const [destinationCountry, setDestinationCountry] = useState<string>(
    planData.container_movement?.destination_country || ""
  );
  const [bookingStatus, setBookingStatus] = useState<string>(
    mode === "create"
      ? "Awaiting MD Approval"
      : planData.booking_status || "Awaiting MD Approval"
  );
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [containerTracking, setContainerTracking] = useState({
    stuffingCompleted:
      planData.container_tracking?.container_stuffing_completed || false,
    emptyContainerPickedUp:
      planData.container_tracking?.empty_container_picked_up_status || false,
    gatedIn: planData.container_tracking?.gated_in_status || false,
    loadedOnBoard: planData.container_tracking?.loaded_on_board_status || false,
  });
  const [openSections, setOpenSections] = useState({
    linkedBooking: false,
    basic: false,
    packages: false,
    equipment: false,
    movement: false,
    carrier: false,
    customer: false,
    stuffing: false,
    tracking: false,
    mdapproval: true,
  });

  // Bulk equipment modal state
  const [showBulkEquipmentModal, setShowBulkEquipmentModal] = useState(false);

  // State to track which equipment cards show liner booking details
  const [expandedLinerBookingDetails, setExpandedLinerBookingDetails] = useState<Set<number>>(new Set());

  // Function to toggle liner booking details visibility
  const toggleLinerBookingDetails = (equipmentIndex: number) => {
    setExpandedLinerBookingDetails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(equipmentIndex)) {
        newSet.delete(equipmentIndex);
      } else {
        newSet.add(equipmentIndex);
      }
      return newSet;
    });
  };

  // New state for MD Approval tabs
  const [activeApprovalTab, setActiveApprovalTab] = useState<
    "approved" | "rejected"
  >("approved");
  const [selectedLinerBroker, setSelectedLinerBroker] = useState<string>(
    planData?.liner_broker_approval || ""
  );
  const [remarks, setRemarks] = useState<string>("");
  const [rejectionComment, setRejectionComment] = useState<string>("");

  // State for cancel shipment plan confirmation
  const [showCancelConfirmation, setShowCancelConfirmation] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Add state to track the selected business branch:
  const [selectedBusinessBranch, setSelectedBusinessBranch] = useState<string>(
    actionData?.formData?.bussiness_branch || planData.bussiness_branch || ""
  );

  // Add toast for validation
  const { addToast } = useToast();

  // Helper function to safely format dates
  const formatDateForDisplay = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  // Helper function to safely render data
  const renderData = (data: any, fallback = "N/A") => {
    if (data === null || data === undefined || data === "") return fallback;
    if (typeof data === "string") return data;
    if (typeof data === "number") return data.toString();
    if (typeof data === "boolean") return data ? "Yes" : "No";
    if (Array.isArray(data))
      return data.length > 0 ? data.join(", ") : fallback;
    if (typeof data === "object") return JSON.stringify(data, null, 2);
    return fallback;
  };

  // Generate tracking number for new equipment
  const generateTrackingNumber = (equipmentType: string, sequence: number) => {
    const refNumber = planData.reference_number || "TEMP";
    const existingCodes = equipmentDetails
      .map((eq) => eq.trackingNumber?.split("-")[1])
      .filter(Boolean);
    const equipmentCode = generateEquipmentCode(equipmentType, existingCodes);
    const seqNumber = String(sequence).padStart(3, "0");
    return `${refNumber}-${equipmentCode}-${seqNumber}`;
  };

  // Add this function after the other helper functions
  const getLinerBrokerUsers = () => {
    if (!selectedBusinessBranch || !dataPoints.linerBookingUsers) {
      return [];
    }

    if (!selectedBusinessBranch) {
      return [];
    }

    // Filter users by branchId and role (assuming liner brokers have a specific role)
    const linerBrokerUsers = dataPoints.linerBookingUsers
      .filter(
        (user: any) => user.businessBranch?.name === selectedBusinessBranch // Adjust role names as needed
      )
      .map((user: any) => ({
        value: user.id.toString(), // or user.email, depending on what you want to store
        label: `👤 ${user.name} (${user.email})`,
      }));

    //console.log("linerBrokerUsers data:", linerBrokerUsers);

    return linerBrokerUsers;
  };

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev],
    }));
  };

  const addPackageDetail = () => {
    setPackageDetails([...packageDetails, {}]);
  };

  const removePackageDetail = (index: number) => {
    if (packageDetails.length > 1) {
      setPackageDetails(
        packageDetails.filter((_: any, i: number) => i !== index)
      );
    }
  };

  // Updated equipment functions
  const addEquipmentDetail = () => {
    // Filter out empty objects to get actual count
    const actualEquipment = equipmentDetails.filter(
      (eq) => eq.equipment_type || Object.keys(eq).length > 1
    );
    // For single equipment addition, we don't know the type yet, so use global sequence
    // This will be updated when equipment type is selected
    const newSequence = equipmentDetails.length + 1;

    const newEquipment = {
      trackingNumber: generateTrackingNumber("", newSequence),
      equipmentSequence: newSequence,
      number_of_equipment: 1,
      status: "Pending",
      emptyPickupStatus: false,
      stuffingStatus: false,
      gateInStatus: false,
      loadedStatus: false,
      emptyPickupDate: "",
      stuffingDate: "",
      gateInDate: "",
      loadedDate: "",
    };

    setEquipmentDetails((prev) => {
      const cleanPrev = prev.filter(
        (eq) => eq.equipment_type || Object.keys(eq).length > 1
      );
      return [...cleanPrev, newEquipment];
    });

    const newIndex = actualEquipment.length;
    setEquipmentStuffingPoints((prev) => ({
      ...prev,
      [newIndex]: "",
    }));
  };

  const removeEquipmentDetail = (index: number) => {
    if (equipmentDetails.length > 1) {
      setEquipmentDetails(
        equipmentDetails.filter((_: any, i: number) => i !== index)
      );
      const updatedStuffingPoints = { ...equipmentStuffingPoints };
      delete updatedStuffingPoints[index];

      const reIndexedStuffingPoints: { [key: number]: string } = {};
      let newIndex = 0;
      for (let i = 0; i < equipmentDetails.length; i++) {
        if (i !== index) {
          reIndexedStuffingPoints[newIndex] = updatedStuffingPoints[i] || "";
          newIndex++;
        }
      }
      setEquipmentStuffingPoints(reIndexedStuffingPoints);
    }
  };

  // Duplicate equipment function
  const duplicateEquipmentDetail = (index: number) => {
    const originalEquipment = equipmentDetails[index];
    // Count equipment of the same type for proper sequence
    const sameTypeCount = equipmentDetails.filter(
      (eq) => eq.equipment_type === originalEquipment.equipment_type
    ).length;
    const newSequence = sameTypeCount + 1; // ✅ Count only same type
    const duplicatedEquipment = {
      ...originalEquipment,
      trackingNumber: generateTrackingNumber(
        originalEquipment.equipment_type || "",
        newSequence
      ),
      equipmentSequence: newSequence,
      // Reset status for duplicated equipment
      status: "Pending",
      emptyPickupStatus: false,
      stuffingStatus: false,
      gateInStatus: false,
      loadedStatus: false,
      emptyPickupDate: "",
      stuffingDate: "",
      gateInDate: "",
      loadedDate: "",
    };

    setEquipmentDetails([...equipmentDetails, duplicatedEquipment]);
    const newIndex = equipmentDetails.length;
    setEquipmentStuffingPoints((prev) => ({
      ...prev,
      [newIndex]: equipmentStuffingPoints[index] || "",
    }));

    addToast({
      type: "success",
      title: "Equipment Duplicated",
      description: `Equipment duplicated with tracking number: ${duplicatedEquipment.trackingNumber}`,
      duration: 3000,
    });
  };

  // FIXED: Handle bulk equipment creation - properly integrates with main form state
  const handleBulkEquipmentCreate = (equipmentData: any) => {
    console.log("=== BULK EQUIPMENT CREATE START ===");
    console.log("Bulk equipment data received:", equipmentData);
    console.log("Current equipmentDetails state:", equipmentDetails);
    console.log("Current equipmentDetails length:", equipmentDetails.length);
    console.log("Current equipmentStuffingPoints:", equipmentStuffingPoints);

    const newEquipments = [];

    // Get existing codes to avoid conflicts
    const existingCodes = equipmentDetails
      .map((eq) => {
        console.log("Processing equipment for code:", eq);
        return eq.trackingNumber?.split("-")[1];
      })
      .filter(Boolean);

    console.log("Existing codes:", existingCodes);

    for (let i = 0; i < equipmentData.quantity; i++) {
      // Count only equipment of the same type for sequence numbering
      const sameTypeCount = equipmentDetails.filter(
        (eq) => eq.equipment_type === equipmentData.equipment_type
      ).length;
      const sequence = sameTypeCount + i + 1; // ✅ This counts only same type equipment
      console.log(`Creating equipment ${i + 1}, sequence: ${sequence}`);

      const equipmentCode = generateEquipmentCode(
        equipmentData.equipment_type,
        existingCodes
      );
      console.log(`Generated equipment code: ${equipmentCode}`);

      const trackingNumber = generateTrackingNumber(
        equipmentData.equipment_type,
        sequence
      );
      console.log(`Generated tracking number: ${trackingNumber}`);

      const newEquipment = {
        equipment_type: equipmentData.equipment_type,
        stuffing_point: equipmentData.stuffing_point || "",
        empty_container_pick_up_from:
          equipmentData.empty_container_pick_up_from || "",
        container_handover_location:
          equipmentData.container_handover_location || "",
        empty_container_pick_up_location:
          equipmentData.empty_container_pick_up_location || "",
        container_handover_at: equipmentData.container_handover_at || "",
        trackingNumber: trackingNumber,
        equipmentSequence: sequence,
        number_of_equipment: 1,
        status: "Pending",
        emptyPickupStatus: false,
        stuffingStatus: false,
        gateInStatus: false,
        loadedStatus: false,
        emptyPickupDate: "",
        stuffingDate: "",
        gateInDate: "",
        loadedDate: "",
      };

      console.log(`New equipment ${i + 1}:`, newEquipment);
      newEquipments.push(newEquipment);
      existingCodes.push(equipmentCode);
    }

    console.log("All new equipments created:", newEquipments);
    console.log("About to update equipmentDetails state...");

    // Use functional update to ensure we get the latest state
    setEquipmentDetails((prevEquipment) => {
      console.log(
        "Inside setEquipmentDetails callback, prevEquipment:",
        prevEquipment
      );
      const updated = [...prevEquipment, ...newEquipments];
      console.log("Updated equipment array:", updated);
      return updated;
    });

    console.log("Equipment details state update called");

    // Update stuffing points for new equipment
    setEquipmentStuffingPoints((prev) => {
      console.log("Inside setEquipmentStuffingPoints callback, prev:", prev);
      const updated = { ...prev };
      newEquipments.forEach((equipment, index) => {
        const newIndex = equipmentDetails.length + index;
        console.log(
          `Setting stuffing point for index ${newIndex}:`,
          equipment.stuffing_point
        );
        updated[newIndex] = equipment.stuffing_point || "";
      });
      console.log("Updated stuffing points:", updated);
      return updated;
    });

    // Force equipment section to open
    setOpenSections((prev) => {
      console.log("Opening equipment section, prev sections:", prev);
      return {
        ...prev,
        equipment: true,
      };
    });

    console.log("Closing modal...");
    setShowBulkEquipmentModal(false);

    console.log("Showing toast...");
    addToast({
      type: "success",
      title: "Bulk Equipment Created",
      description: `Created ${equipmentData.quantity} equipment entries of type ${equipmentData.equipment_type}`,
      duration: 3000,
    });

    console.log("=== BULK EQUIPMENT CREATE END ===");
  };

  // Update equipment tracking number when equipment type changes
  const updateEquipmentType = (index: number, equipmentType: string) => {
    const updatedEquipment = [...equipmentDetails];

    // Count equipment of the same type to determine correct sequence
    const sameTypeCount = equipmentDetails.filter(
      (eq, idx) => idx !== index && eq.equipment_type === equipmentType
    ).length;
    const newSequence = sameTypeCount + 1;

    updatedEquipment[index] = {
      ...updatedEquipment[index],
      equipment_type: equipmentType,
      equipmentSequence: newSequence,
      trackingNumber: generateTrackingNumber(equipmentType, newSequence),
    };
    setEquipmentDetails(updatedEquipment);
  };

  // Update individual equipment status
  const updateEquipmentStatus = (index: number, field: string, value: any) => {
    const updatedEquipment = [...equipmentDetails];
    updatedEquipment[index] = {
      ...updatedEquipment[index],
      [field]: value,
    };

    // Auto-update overall status based on individual statuses
    const equipment = updatedEquipment[index];
    let newStatus = "Pending";
    if (equipment.loadedStatus) {
      newStatus = "Loaded on Board";
    } else if (equipment.gateInStatus) {
      newStatus = "Gated In";
    } else if (equipment.stuffingStatus) {
      newStatus = "Stuffing Completed";
    } else if (equipment.emptyPickupStatus) {
      newStatus = "Empty Picked Up";
    }

    updatedEquipment[index].status = newStatus;
    setEquipmentDetails(updatedEquipment);
  };

  const updatePackageDetails = (index: number, field: string, value: any) => {
    const updatedPackages = [...packageDetails];
    updatedPackages[index] = {
      ...updatedPackages[index],
      [field]: value,
    };
    setPackageDetails(updatedPackages);
  };

  // Group equipment by type for better visualization
  const groupedEquipment = equipmentDetails.reduce(
    (groups: any, equipment: any, index: number) => {
      const type = equipment.equipment_type || "Unspecified";
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push({ ...equipment, originalIndex: index });
      return groups;
    },
    {}
  );

  // Validation function for required fields
  const validateRequiredFields = () => {
    const errors: string[] = [];

    // Check Business Branch - use state variable, hidden input, or planData
    const businessBranchInput = document.querySelector<HTMLInputElement>('input[name="bussiness_branch"]');
    const businessBranchValue = selectedBusinessBranch || businessBranchInput?.value || planData.bussiness_branch || '';
    console.log("Validation - Business Branch:", { selectedBusinessBranch, inputValue: businessBranchInput?.value, planData: planData.bussiness_branch, final: businessBranchValue });
    if (!businessBranchValue) {
      errors.push("Business Branch is required");
    }

    // Check Shipment Type - check select, hidden inputs, or planData
    const shipmentTypeSelect = document.querySelector<HTMLSelectElement>('select[name="shipment_type"]');
    const shipmentTypeInput = document.querySelector<HTMLInputElement>('input[name="shipment_type"]');
    const shipmentTypeValue = shipmentTypeSelect?.value || shipmentTypeInput?.value || planData.shipment_type || '';
    console.log("Validation - Shipment Type:", { selectValue: shipmentTypeSelect?.value, inputValue: shipmentTypeInput?.value, planData: planData.shipment_type, final: shipmentTypeValue });
    if (!shipmentTypeValue) {
      errors.push("Shipment Type is required");
    }

    // Check at least one Package Detail - look for any package shipper (select or hidden input)
    const packageShippers = document.querySelectorAll<HTMLSelectElement>(
      'select[name*="package_details"][name*="shipper"]'
    );
    const packageInputs = document.querySelectorAll<HTMLInputElement>(
      'input[name*="package_details"][name*="shipper"]'
    );
    let hasPackageDetail = false;

    packageShippers.forEach((select) => {
      if (select.value) hasPackageDetail = true;
    });
    packageInputs.forEach((input) => {
      if (input.value) hasPackageDetail = true;
    });

    if (!hasPackageDetail && packageDetails.length === 0) {
      errors.push("At least one Package Detail is required");
    }

    // Check at least one Equipment Detail
    const equipmentTypes = document.querySelectorAll<HTMLSelectElement>(
      'select[name*="equipment_details"][name*="equipment_type"]'
    );
    const equipmentInputs = document.querySelectorAll<HTMLInputElement>(
      'input[name*="equipment_details"][name*="equipment_type"]'
    );
    let hasEquipmentDetail = false;

    equipmentTypes.forEach((select) => {
      if (select.value) hasEquipmentDetail = true;
    });
    equipmentInputs.forEach((input) => {
      if (input.value) hasEquipmentDetail = true;
    });

    if (!hasEquipmentDetail && equipmentDetails.length === 0) {
      errors.push("At least one Equipment Detail is required");
    }

    // Check Container Movement fields
    const loadingPort =
      document.querySelector<HTMLSelectElement>('select[name="loading_port"]')
        ?.value ||
      document.querySelector<HTMLInputElement>('input[name="loading_port"]')
        ?.value;
    if (!loadingPort) {
      errors.push("Loading Port is required");
    }

    const destinationCountry =
      document.querySelector<HTMLSelectElement>(
        'select[name="destination_country"]'
      )?.value ||
      document.querySelector<HTMLInputElement>(
        'input[name="destination_country"]'
      )?.value;
    if (!destinationCountry) {
      errors.push("Destination Country is required");
    }

    const portOfDischarge =
      document.querySelector<HTMLSelectElement>(
        'select[name="port_of_discharge"]'
      )?.value ||
      document.querySelector<HTMLInputElement>(
        'input[name="port_of_discharge"]'
      )?.value;
    if (!portOfDischarge) {
      errors.push("Port of Discharge is required");
    }

    const deliveryTill = document.querySelector<HTMLSelectElement>(
      'select[name="delivery_till"]'
    )?.value;
    if (!deliveryTill) {
      errors.push("Delivery Till is required");
    }

    // Check Incoterm
    const incoterm = document.querySelector<HTMLSelectElement>(
      'select[name="incoterm"]'
    )?.value;
    if (!incoterm) {
      errors.push("Incoterm is required");
    }

    // Check Freight Terms
    const freightTerms = document.querySelector<HTMLSelectElement>(
      'select[name="freight_terms"]'
    )?.value;
    if (!freightTerms) {
      errors.push("Freight Terms is required");
    }

    // Check Free Time in Days
    const freeTimeInDays = (document.querySelector<HTMLInputElement>(
      'input[name="free_time_in_days"]'
    )?.value || "").trim();
    if (!freeTimeInDays || Number.parseInt(freeTimeInDays) < 0) {
      errors.push("Free Time in Days is required and must be a positive number");
    }

    // Check Customer
    const customer =
      document.querySelector<HTMLSelectElement>('select[name="customer"]')
        ?.value ||
      document.querySelector<HTMLInputElement>('input[name="customer"]')?.value;
    if (!customer) {
      errors.push("Customer is required");
    }

    // Check Consignee
    const consignee =
      document.querySelector<HTMLSelectElement>('select[name="consignee"]')
        ?.value ||
      document.querySelector<HTMLInputElement>('input[name="consignee"]')
        ?.value;
    if (!consignee) {
      errors.push("Consignee is required");
    }

    // Check Selling Price
    const sellingPrice = document.querySelector<HTMLInputElement>(
      'input[name="selling_price"]'
    )?.value;
    if (!sellingPrice) {
      errors.push("Selling Price is required");
    }

    // Check Buying Price - Optional for planners
    const buyingPrice = document.querySelector<HTMLInputElement>(
      'input[name="buying_price"]'
    )?.value;
    // Buying price is optional for shipment planners

    if (errors.length > 0) {
      console.log("Validation errors found:", errors);
      addToast({
        type: "error",
        title: "Validation Error",
        description:
          "Please complete the following required fields:\n• " +
          errors.join("\n• "),
        duration: 8000,
      });
    }

    console.log("Validation result:", errors.length === 0 ? "PASSED" : "FAILED");
    return errors.length === 0;
  };

  // Handle form submission with validation
  const handleFormSubmit = (e: React.FormEvent) => {
    console.log("handleFormSubmit called");
    // Get the submit button that was clicked
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const submitAction = submitter?.value;
    console.log("Submit action:", submitAction);
    const isDraft = submitAction === "draft";

    // For drafts, skip validation (formNoValidate on button handles native validation)
    if (isDraft) {
      setIsFormSubmitting(true);
      return;
    }

    // For both create and edit modes (not draft), validate required fields
    if (!validateRequiredFields()) {
      e.preventDefault();
      return;
    }

    // Allow form submission if validation passes
    setIsFormSubmitting(true);
  };

  // Update the validation in handleMDApprovalSubmit function
  // Update the validation in handleMDApprovalSubmit function
  const handleMDApprovalSubmit = async (action: "approved" | "rejected") => {
    if (action === "approved") {
      if (!selectedBusinessBranch) {
        addToast({
          type: "error",
          title: "Validation Error",
          description: "Please select a business branch first.",
          duration: 5000,
        });
        return;
      }
      if (!selectedLinerBroker) {
        addToast({
          type: "error",
          title: "Validation Error",
          description:
            "Please select a liner broker to accept the shipment plan.",
          duration: 5000,
        });
        return;
      }
    }

    if (action === "rejected" && !rejectionComment.trim()) {
      addToast({
        type: "error",
        title: "Validation Error",
        description:
          "Please provide a comment for rejecting the shipment plan.",
        duration: 5000,
      });
      return;
    }
    //return { success: "Shipment plan approved and liner booking created successfully" };

    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    handleFormSubmit(fakeEvent); // ✅ Call the other function

    // // Get the main form element
    // const mainForm = document.querySelector("form") as HTMLFormElement
    // if (!mainForm) {
    //   console.error("Main form not found")
    //   return
    // }

    // // Create FormData from the main form to capture all existing data
    // const formData = new FormData(mainForm)

    // // Add MD approval specific fields
    // formData.set("md_approval_action", action)

    // if (action === "accept") {
    //   formData.set("liner_broker", selectedLinerBroker)
    //   formData.set("business_branch", selectedBusinessBranch)
    // } else {
    //   formData.set("rejection_comment", rejectionComment)
    // }

    // // Create a new form and submit with all data
    // const form = document.createElement("form")
    // form.method = "post"
    // form.style.display = "none"

    // // Add all form data as hidden inputs
    // for (const [key, value] of formData.entries()) {
    //   const input = document.createElement("input")
    //   input.type = "hidden"
    //   input.name = key
    //   input.value = value.toString()
    //   form.appendChild(input)
    // }

    // document.body.appendChild(form)
    // form.submit()
  };

  const handleStuffingPointChange = (index: number, value: string) => {
    setEquipmentStuffingPoints((prev) => ({
      ...prev,
      [index]: value,
    }));
  };

  const handleDeliveryTillChange = (value: string) => {
    setDeliveryTill(value);
  };

  const handleDestinationCountryChange = (value: string) => {
    setDestinationCountry(value);
  };

  // const handleLineBrookerChange = (value: string) => {
  //   setLineBroker(value);
  // };

  const handleBookingStatusChange = (value: string) => {
    setBookingStatus(value);
  };

  const getContainerCurrentStatus = () => {
    if (containerTracking.loadedOnBoard) {
      return "Loaded on Board";
    } else if (containerTracking.gatedIn) {
      return "Gated In";
    } else if (containerTracking.emptyContainerPickedUp) {
      return "Empty Container Picked Up";
    } else if (containerTracking.stuffingCompleted) {
      return "Container Stuffing Completed";
    } else {
      return "Pending";
    }
  };

  const handleContainerTrackingChange = (field: string, value: boolean) => {
    setContainerTracking((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Reset form submission state when submission completes
  useEffect(() => {
    if (!isSubmitting) {
      setIsFormSubmitting(false);
    }
  }, [isSubmitting]);

  // Initialize stuffing point state for initial equipment items
  useEffect(() => {
    const initialStuffingPoints: { [key: number]: string } = {};
    equipmentDetails.forEach((equipment: any, index: number) => {
      if (!(index in equipmentStuffingPoints)) {
        initialStuffingPoints[index] = equipment.stuffing_point || "";
      }
    });
    if (Object.keys(initialStuffingPoints).length > 0) {
      setEquipmentStuffingPoints((prev) => ({
        ...prev,
        ...initialStuffingPoints,
      }));
    }
  }, [equipmentDetails.length]);

  // Debug log to see equipment details changes
  // useEffect(() => {
  //   console.log("Equipment details updated:", equipmentDetails);
  // }, [equipmentDetails]);
  // Debug log to see equipment details changes
  useEffect(() => {
    console.log("=== EQUIPMENT DETAILS STATE CHANGED ===");
    console.log("New equipmentDetails:", equipmentDetails);
    console.log("Equipment count:", equipmentDetails.length);
    console.log(
      "Equipment types:",
      equipmentDetails.map((eq) => eq.equipment_type)
    );
    console.log("=== END EQUIPMENT DETAILS CHANGE ===");
  }, [equipmentDetails]);

  return (
    <div className="max-w-5xl mx-auto">
      <Form method="post" className="" onSubmit={handleFormSubmit}>
        {/* Sticky Header - Inside the form */}
        <div className="sticky z-40 bg-white rounded-t-xl shadow-lg border border-gray-200 px-6 py-4" style={{ top: '-25px' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Shipment Plan Details
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {mode === "create"
                  ? "Enter the details for your new shipment plan"
                  : "Update the details for your shipment plan"}
                {mode === "create" && (
                  <span className="block text-xs text-red-600 mt-1">
                    * Required fields
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* MD Approval Button - Show at top right for MD users when plan is awaiting approval */}
              {mode === "edit" && 
                bookingStatus === "Awaiting MD Approval" && 
                (user?.role?.name === "MD") && (
                <div className="relative group">
                  <Button
                    type="submit"
                    name="submitAction"
                    value="submit"
                    formNoValidate
                    disabled={
                      isSubmitting || 
                      isFormSubmitting || 
                      (activeApprovalTab === "approved" && (!selectedLinerBroker || selectedLinerBroker.trim() === ""))
                    }
                    className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting || isFormSubmitting ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Updating...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>✨</span>
                        <span>Update Shipment Plan</span>
                      </div>
                    )}
                  </Button>
                  {activeApprovalTab === "approved" && (!selectedLinerBroker || selectedLinerBroker.trim() === "") && (
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
                      Please assign a liner broker first
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-800"></div>
                    </div>
                  )}
                </div>
              )}
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  mode === "create"
                    ? "text-gray-500 bg-gray-100"
                    : "text-yellow-700 bg-yellow-100"
                }`}
              >
                {mode === "create" ? "Draft" : "Editing"}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-b-xl shadow-lg border border-gray-200 overflow-hidden -mt-1">
          <div className="divide-y divide-gray-100">
            {/* Linked Liner Booking Information - Only for edit mode */}
            {mode === "edit" && shipmentPlan?.linerBooking && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleSection("linkedBooking")}
                  className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        openSections.linkedBooking
                          ? "bg-green-100 text-green-600"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <span className="text-sm">🔗</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        Linked Liner Booking
                      </h3>
                      <p className="text-sm text-gray-500">
                        Details from the connected liner booking (read-only)
                      </p>
                    </div>
                  </div>
                  <div
                    className={`transform transition-transform duration-200 ${
                      openSections.linkedBooking ? "rotate-180" : ""
                    }`}
                  >
                    <span className="text-gray-400">↓</span>
                  </div>
                </button>
                {openSections.linkedBooking && (
                  <div className="px-6 pb-6 bg-green-50/30">
                    <div className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-gray-700">
                            Reference Number
                          </Label>
                          <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                            {planData.reference_number || "N/A"}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-gray-700">
                            Carrier Booking Status
                          </Label>
                          <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                            {(shipmentPlan.linerBooking.data as any)
                              ?.carrier_booking_status || "N/A"}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-gray-700">
                            Booking Released To
                          </Label>
                          <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                            {(shipmentPlan.linerBooking.data as any)
                              ?.booking_released_to || "N/A"}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-gray-700">
                            Container Status
                          </Label>
                          <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                            {(shipmentPlan.linerBooking.data as any)
                              ?.container_current_status || "N/A"}
                          </div>
                        </div>

                        {/* Unmapping Request Section */}
                        {((shipmentPlan.linerBooking.data as any)
                          ?.carrier_booking_status === "Booked" ||
                          (shipmentPlan.linerBooking.data as any)
                            ?.carrier_booking_status ===
                            "Unmapping Requested") && (
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-sm font-semibold text-gray-700">
                              Unmapping Request
                            </Label>
                            <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                              {(shipmentPlan.linerBooking.data as any)
                                ?.unmapping_request
                                ? "Yes"
                                : "No"}
                              {(shipmentPlan.linerBooking.data as any)
                                ?.unmapping_reason && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Reason:{" "}
                                  {
                                    (shipmentPlan.linerBooking.data as any)
                                      .unmapping_reason
                                  }
                                </div>
                              )}

                              {/* Unmapping Approval Buttons */}
                              {(shipmentPlan.linerBooking.data as any)
                                ?.unmapping_request &&
                                (shipmentPlan.linerBooking.data as any)
                                  ?.carrier_booking_status ===
                                  "Unmapping Requested" && (
                                  <div className="mt-3 space-x-2">
                                    <Button
                                      type="submit"
                                      name="approve_unmapping"
                                      value="true"
                                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm rounded-lg font-medium"
                                      onClick={(e) => {
                                        if (
                                          !confirm(
                                            "Are you sure you want to approve the unmapping? This will unlink the liner booking from this shipment plan."
                                          )
                                        ) {
                                          e.preventDefault();
                                        }
                                      }}
                                    >
                                      ✅ Approve Unmapping
                                    </Button>
                                    <Button
                                      type="submit"
                                      name="reject_unmapping"
                                      value="true"
                                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm rounded-lg font-medium"
                                      onClick={(e) => {
                                        if (
                                          !confirm(
                                            "Are you sure you want to reject the unmapping request? The liner booking will remain linked to this shipment plan."
                                          )
                                        ) {
                                          e.preventDefault();
                                        }
                                      }}
                                    >
                                      ❌ Reject Unmapping
                                    </Button>
                                  </div>
                                )}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-gray-700">
                            Container Stuffing Completed
                          </Label>
                          <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                            {(shipmentPlan.linerBooking.data as any)
                              ?.container_stuffing_completed
                              ? "Yes"
                              : "No"}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-semibold text-gray-700">
                            Created By
                          </Label>
                          <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                            {shipmentPlan.linerBooking.user?.name || "N/A"}
                          </div>
                        </div>
                      </div>

                      {/* Detailed Liner Booking Information */}
                      {(shipmentPlan.linerBooking.data as any)
                        ?.liner_booking_details &&
                        Array.isArray(
                          (shipmentPlan.linerBooking.data as any)
                            .liner_booking_details
                        ) &&
                        (shipmentPlan.linerBooking.data as any)
                          .liner_booking_details.length > 0 && (
                          <div className="mt-8">
                            <h4 className="text-lg font-semibold text-gray-800 mb-4">
                              📋 Liner Booking Details (
                              {
                                (shipmentPlan.linerBooking.data as any)
                                  .liner_booking_details.length
                              }
                              )
                            </h4>
                            <div className="space-y-6">
                              {(
                                shipmentPlan.linerBooking.data as any
                              ).liner_booking_details.map(
                                (detail: any, index: number) => {
                                  // Skip empty details
                                  if (
                                    !detail ||
                                    (typeof detail === "object" &&
                                      Object.keys(detail).every(
                                        (key) => !detail[key]
                                      ))
                                  ) {
                                    return null;
                                  }

                                  return (
                                    <div
                                      key={index}
                                      className="bg-white border border-gray-200 rounded-lg p-6"
                                    >
                                      <div className="flex items-center justify-between mb-4">
                                        <h5 className="text-md font-medium text-gray-900">
                                          Booking Detail #{index + 1}
                                        </h5>
                                        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                          Read-only
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {/* Booking Numbers */}
                                        {detail.temporary_booking_number && (
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-600">
                                              Temporary Booking Number
                                            </Label>
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800">
                                              {detail.temporary_booking_number}
                                              {detail.suffix_for_anticipatory_temporary_booking_number
                                                ? `-${detail.suffix_for_anticipatory_temporary_booking_number}`
                                                : ""}
                                            </div>
                                          </div>
                                        )}

                                        {detail.liner_booking_number && (
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-600">
                                              Liner Booking Number
                                            </Label>
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800">
                                              {detail.liner_booking_number}
                                            </div>
                                          </div>
                                        )}

                                        {detail.mbl_number && (
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-600">
                                              MBL Number
                                            </Label>
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800">
                                              {detail.mbl_number}
                                            </div>
                                          </div>
                                        )}

                                        {/* Carrier Information */}
                                        {detail.carrier && (
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-600">
                                              Carrier
                                            </Label>
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800">
                                              {detail.carrier}
                                            </div>
                                          </div>
                                        )}

                                        {detail.contract && (
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-600">
                                              Contract
                                            </Label>
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800">
                                              {detail.contract}
                                            </div>
                                          </div>
                                        )}

                                        {/* Vessel Information */}
                                        {detail.original_planned_vessel && (
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-600">
                                              Original Planned Vessel
                                            </Label>
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800">
                                              {detail.original_planned_vessel}
                                              {detail.e_t_d_of_original_planned_vessel && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                  ETD:{" "}
                                                  {formatDateForDisplay(
                                                    detail.e_t_d_of_original_planned_vessel
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {detail.change_in_original_vessel &&
                                          detail.revised_vessel && (
                                            <div className="space-y-1">
                                              <Label className="text-xs font-medium text-gray-600">
                                                Revised Vessel
                                              </Label>
                                              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-gray-800">
                                                <div className="flex items-center">
                                                  <span className="text-yellow-600 mr-1">
                                                    ⚠️
                                                  </span>
                                                  {detail.revised_vessel}
                                                </div>
                                                {detail.etd_of_revised_vessel && (
                                                  <div className="text-xs text-gray-500 mt-1">
                                                    ETD:{" "}
                                                    {formatDateForDisplay(
                                                      detail.etd_of_revised_vessel
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )}

                                        {/* Equipment Information */}
                                        {(detail.equipment_type ||
                                          detail.equipment_quantity) && (
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-600">
                                              Equipment
                                            </Label>
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800">
                                              {detail.equipment_type}{" "}
                                              {detail.equipment_quantity &&
                                                `(${detail.equipment_quantity} units)`}
                                            </div>
                                          </div>
                                        )}

                                        {/* Date Information */}
                                        {detail.empty_pickup_validity_from && (
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-600">
                                              Empty Pickup Validity
                                            </Label>
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800">
                                              From:{" "}
                                              {formatDateForDisplay(
                                                detail.empty_pickup_validity_from
                                              )}
                                              {detail.empty_pickup_validity_till && (
                                                <div>
                                                  To:{" "}
                                                  {formatDateForDisplay(
                                                    detail.empty_pickup_validity_till
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {detail.estimate_gate_opening_date && (
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-600">
                                              Gate Opening Date
                                            </Label>
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800">
                                              {formatDateForDisplay(
                                                detail.estimate_gate_opening_date
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {detail.estimated_gate_cutoff_date && (
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-600">
                                              Gate Cutoff Date
                                            </Label>
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800">
                                              {formatDateForDisplay(
                                                detail.estimated_gate_cutoff_date
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {detail.s_i_cut_off_date && (
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-600">
                                              SI Cutoff Date
                                            </Label>
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800">
                                              {formatDateForDisplay(
                                                detail.s_i_cut_off_date
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {detail.booking_received_from_carrier_on && (
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-gray-600">
                                              Booking Received From Carrier
                                            </Label>
                                            <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800">
                                              {formatDateForDisplay(
                                                detail.booking_received_from_carrier_on
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Additional Information */}
                                      {detail.additional_remarks && (
                                        <div className="mt-4 space-y-1">
                                          <Label className="text-xs font-medium text-gray-600">
                                            Additional Remarks
                                          </Label>
                                          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-gray-800">
                                            {detail.additional_remarks}
                                          </div>
                                        </div>
                                      )}

                                      {detail.line_booking_copy && (
                                        <div className="mt-4 space-y-1">
                                          <Label className="text-xs font-medium text-gray-600">
                                            Line Booking Copy
                                          </Label>
                                          <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm">
                                            <a
                                              href={detail.line_booking_copy}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                                            >
                                              📎 View Booking Copy
                                              <span className="ml-1 text-xs">
                                                ↗
                                              </span>
                                            </a>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Accordion Sections */}
            <Accordion className="space-y-0">
              {/* MD Approval Status - Only visible when booking status is rejected and user is ADMIN */}
              {mode != "create" &&
                planData?.md_approval_status === "rejected" &&
                (user?.role.name === "ADMIN" ||
                  user?.role.name === "MD" ||
                  user?.role.name === "SHIPMENT_PLAN_TEAM") && (
                  <AccordionItem>
                    <AccordionTrigger
                      isOpen={openSections.mdapproval}
                      onClick={() => toggleSection("mdapproval")}
                    >
                      MD Approval Status
                    </AccordionTrigger>
                    <AccordionContent isOpen={openSections.mdapproval}>
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                        <div className="mb-6">
                          <h3 className="text-lg font-medium text-red-700 mb-2 flex items-center fw-bold">
                            <span className="mr-2">👨‍💼</span>
                            MD Approval Rejected
                          </h3>
                          <p className="text-sm text-gray-600">
                            MD has been rejected this shipment plan. Please
                            check below comments for more details.
                          </p>
                          <input
                            type="hidden"
                            name="md_approval_rejection"
                            id="md_approval_rejection"
                            className="hidden"
                            value="rejected"
                          />
                        </div>

                        {/* Tab Content */}
                        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                          <div className="space-y-6">
                            <div className="flex items-center space-x-2 mb-4">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <h4 className="text-md font-semibold text-red-700 border-b-2 border-black">
                                Rejection Reason
                              </h4>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                              <p className="text-red-800 font-medium">
                                {planData.md_rejection_reason || "No reason provided"}
                              </p>
                            </div>

                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label
                                  htmlFor="liner_broker_approval"
                                  className="text-sm font-bold text-red-700 fw-bold"
                                >
                                  Additional Comments
                                </Label>
                                <p>&nbsp;</p>
                                <hr />
                                <p className="text-sm text-gray-600 font-bold italic text-center">
                                  (To request shipment plan again, please modify
                                  the required fields and click "Update Shipment
                                  Plan" again.)
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

              {/* MD Approval - Only visible when booking status is "Awaiting MD Approval" and user is ADMIN */}
              {mode != "create" &&
                bookingStatus === "Awaiting MD Approval" &&
                (user?.role.name === "ADMIN" || user?.role.name === "MD") && (
                  <AccordionItem>
                    <AccordionTrigger
                      isOpen={openSections.mdapproval}
                      onClick={() => toggleSection("mdapproval")}
                    >
                      MD Approval
                    </AccordionTrigger>
                    <AccordionContent isOpen={openSections.mdapproval}>
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                        <div className="mb-6">
                          <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                            <span className="mr-2">👨‍💼</span>
                            MD Approval Required
                          </h3>
                          <p className="text-sm text-gray-600">
                            This shipment plan requires Managing Director
                            approval. Please review and take action.
                          </p>
                          <input
                            type="hidden"
                            name="md_approval"
                            id="md_approval"
                            className="hidden"
                            value={activeApprovalTab}
                          />
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1 border border-gray-200">
                          <button
                            type="button"
                            onClick={() => setActiveApprovalTab("approved")}
                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                              activeApprovalTab === "approved"
                                ? "bg-green-100 text-green-700 shadow-sm"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span className="mr-2">✅</span>
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveApprovalTab("rejected")}
                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                              activeApprovalTab === "rejected"
                                ? "bg-red-100 text-red-700 shadow-sm"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span className="mr-2">❌</span>
                            Reject
                          </button>
                        </div>

                        {/* Tab Content */}
                        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                          {activeApprovalTab === "approved" ? (
                            <div className="space-y-6">
                              <div className="flex items-center space-x-2 mb-4">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <h4 className="text-md font-semibold text-gray-900">
                                  Accept Shipment Plan
                                </h4>
                              </div>

                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="liner_broker_approval"
                                    className="text-sm font-semibold text-gray-700"
                                  >
                                    Assign Liner Broker{" "}
                                    <span className="text-red-500">*</span>
                                  </Label>
                                  <SearchableSelect
                                    id="liner_broker_approval"
                                    name="liner_broker_approval"
                                    value={selectedLinerBroker}
                                    onChange={(value) =>
                                      setSelectedLinerBroker(value)
                                    }
                                    options={getLinerBrokerUsers()}
                                    placeholder={
                                      selectedBusinessBranch
                                        ? "Select liner broker"
                                        : "Please select business branch first"
                                    }
                                    disabled={
                                      !selectedBusinessBranch ||
                                      getLinerBrokerUsers().length === 0
                                    }
                                    className="border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                                  />
                                  <p className="text-xs text-gray-500">
                                    {!selectedBusinessBranch
                                      ? "Select a business branch first to see available liner brokers"
                                      : getLinerBrokerUsers().length === 0
                                      ? "No liner brokers available for the selected branch"
                                      : "Select the liner broker who will handle this shipment plan"}
                                  </p>
                                  <Label
                                    htmlFor="remarks"
                                    className="text-sm font-semibold text-gray-700"
                                  >
                                    Remarks (Optional){" "}
                                    <span className="text-red-500">*</span>
                                  </Label>
                                  <Textarea
                                    id="remarks"
                                    name="remarks"
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Booking Details (optional)"
                                    rows={4}
                                    className="border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 resize-none"
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              <div className="flex items-center space-x-2 mb-4">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <h4 className="text-md font-semibold text-gray-900">
                                  Reject Shipment Plan
                                </h4>
                              </div>

                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="rejection_comment"
                                    className="text-sm font-semibold text-gray-700"
                                  >
                                    Rejection Comment{" "}
                                    <span className="text-red-500">*</span>
                                  </Label>
                                  <Textarea
                                    id="rejection_comment"
                                    name="rejection_comment"
                                    value={rejectionComment}
                                    onChange={(e) =>
                                      setRejectionComment(e.target.value)
                                    }
                                    placeholder="Please provide a detailed reason for rejection"
                                    rows={4}
                                    className="border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 resize-none"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

            {/* Enhanced Basic Information */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleSection("basic")}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                      openSections.basic
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <span className="text-sm">📋</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Basic Information
                    </h3>
                    <p className="text-sm text-gray-500">
                      Reference number, branch, and shipment type
                    </p>
                  </div>
                </div>
                <div
                  className={`transform transition-transform duration-200 ${
                    openSections.basic ? "rotate-180" : ""
                  }`}
                >
                  <span className="text-gray-400">↓</span>
                </div>
              </button>

              {openSections.basic && (
                <div className="px-6 pb-6 bg-gray-50/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="reference_number"
                        className="text-sm font-semibold text-gray-700"
                      >
                        Reference Number
                      </Label>
                      <div className="relative">
                        <Input
                          id="reference_number"
                          name="reference_number"
                          value={
                            mode === "create"
                              ? "Will be auto-generated on save"
                              : planData.reference_number || "Not generated"
                          }
                          readOnly
                          className="border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed focus:ring-0 focus:border-gray-300"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                          <span className="text-gray-400 text-xs">
                            🔒 Auto-gen
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        {mode === "create"
                          ? "Format: {BusinessCode}{Year}{4-digit sequence} (e.g., KOL20250001)"
                          : "Reference number cannot be modified after creation"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="bussiness_branch"
                        className="text-sm font-semibold text-gray-700"
                      >
                        Business Branch <span className="text-red-500">*</span>
                      </Label>
                      <SearchableSelect
                        id="bussiness_branch"
                        name="bussiness_branch"
                        defaultValue={
                          actionData?.formData?.bussiness_branch ||
                          planData.bussiness_branch ||
                          ""
                        }
                        options={dataPoints.businessBranches.map(
                          (branch: any) => ({
                            value: branch.name,
                            label: `🏢 ${branch.name} (${branch.code})`,
                          })
                        )}
                        placeholder="Select business branch"
                        className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        onChange={(value) => setSelectedBusinessBranch(value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="shipment_type"
                        className="text-sm font-semibold text-gray-700"
                      >
                        Shipment Type <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        id="shipment_type"
                        name="shipment_type"
                        defaultValue={
                          actionData?.formData?.shipment_type ||
                          planData.shipment_type ||
                          ""
                        }
                        className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        required
                      >
                        <option value="">Select shipment type</option>
                        <option value="Direct">📋 Direct</option>
                        <option value="Consolidation">📦 Consolidation</option>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="booking_status"
                        className="text-sm font-semibold text-gray-700"
                      >
                        Booking Status
                      </Label>
                      {mode === "create" ? (
                        <div className="relative">
                          <Input
                            id="booking_status"
                            name="booking_status"
                            value="Awaiting MD Approval"
                            readOnly
                            className="border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed focus:ring-0 focus:border-gray-300"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-gray-400 text-xs">
                              🔒 Auto-set
                            </span>
                          </div>
                        </div>
                      ) : (
                        <Select
                          id="booking_status"
                          name="booking_status"
                          value={bookingStatus}
                          disabled={true}
                          onChange={(e) =>
                            handleBookingStatusChange(e.target.value)
                          }
                          className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        >
                          <option value="Awaiting MD Approval">
                            ⏳ Awaiting MD Approval
                          </option>
                          <option value="Awaiting Booking">
                            📝 Awaiting Booking
                          </option>
                          <option value="Booked">📋 Booked</option>
                          <option value="Cancelled">❌ Cancelled</option>
                          <option value="Completed">✅ Completed</option>
                          <option value="Unmapping Requested">
                            🔄 Unmapping Requested
                          </option>
                        </Select>
                      )}
                      <p className="text-xs text-gray-500">
                        {mode === "create"
                          ? 'Status is automatically set to "Awaiting MD Approval" for new shipment plans'
                          : ""}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="sales_person_id"
                        className="text-sm font-semibold text-gray-700"
                      >
                        Sales Person
                      </Label>
                      <SearchableSelect
                        id="sales_person_id"
                        name="sales_person_id"
                        defaultValue={
                          actionData?.formData?.sales_person_id ||
                          shipmentPlan?.salesPersonId ||
                          defaultSalesPersonId ||
                          ""
                        }
                        options={dataPoints.salesPersons?.map((sp: any) => ({
                          value: sp.id,
                          label: sp.name,
                        })) || []}
                        placeholder="Select sales person"
                        className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      />
                      <p className="text-xs text-gray-500">
                        Optional - defaults to the person creating this shipment plan
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            
              {/* Customer Information */}
              <AccordionItem>
                <AccordionTrigger
                  isOpen={openSections.customer}
                  onClick={() => toggleSection("customer")}
                >
                  Customer & Financial Information{" "}
                  <span className="text-red-500">*</span>
                </AccordionTrigger>
                <AccordionContent isOpen={openSections.customer}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="customer">
                        Customer <span className="text-red-500">*</span>
                      </Label>
                      <SearchableSelect
                        id="customer"
                        name="customer"
                        defaultValue={planData.container_movement?.customer}
                        options={dataPoints.organizations
                          .filter((org: any) =>
                            org.orgTypes.includes("Customer")
                          )
                          .map((org: any) => ({
                            value: org.name,
                            label: `🏢 ${org.name} (${org.orgTypes.join(
                              ", "
                            )})`,
                          }))}
                        placeholder="Select customer"
                      />
                    </div>

                    <div>
                      <Label htmlFor="consignee">
                        Consignee <span className="text-red-500">*</span>
                      </Label>
                      <SearchableSelect
                        id="consignee"
                        name="consignee"
                        defaultValue={planData.container_movement?.consignee}
                        options={dataPoints.organizations
                          .filter((org: any) =>
                            org.orgTypes.includes("Consignee")
                          )
                          .map((org: any) => ({
                            value: org.name,
                            label: `🏢 ${org.name} (${org.orgTypes.join(
                              ", "
                            )})`,
                          }))}
                        placeholder="Select consignee"
                      />
                    </div>
                    <div>
                      <Label htmlFor="selling_price">
                        Selling Price <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="selling_price"
                        name="selling_price"
                        defaultValue={
                          planData.container_movement?.selling_price
                        }
                        placeholder="Enter selling price"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="buying_price">
                        Buying Price <span className="text-sm text-gray-500">(Optional)</span>
                      </Label>
                      <Input
                        id="buying_price"
                        name="buying_price"
                        type="number"
                        step="0.01"
                        defaultValue={planData.container_movement?.buying_price}
                        placeholder="Enter buying price (optional)"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rebate">Rebate</Label>
                      <Input
                        id="rebate"
                        name="rebate"
                        defaultValue={planData.container_movement?.rebate}
                        placeholder="Enter rebate"
                      />
                    </div>
                    <div>
                      <Label htmlFor="credit_period">
                        Credit Period (days)
                      </Label>
                      <Input
                        id="credit_period"
                        name="credit_period"
                        type="number"
                        defaultValue={
                          planData.container_movement?.credit_period
                        }
                        placeholder="Enter credit period"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Package Details */}
              <AccordionItem>
                <AccordionTrigger
                  isOpen={openSections.packages}
                  onClick={() => toggleSection("packages")}
                >
                  Package Details <span className="text-red-500">*</span>
                </AccordionTrigger>
                <AccordionContent isOpen={openSections.packages}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Package Details</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addPackageDetail}
                      >
                        Add Package
                      </Button>
                    </div>
                    <div className="space-y-6">
                      {packageDetails.map((pkg: any, index: number) => (
                        <div
                          key={index}
                          className="border rounded-lg p-4 relative"
                        >
                          {packageDetails.length > 1 && (
                            <div className="absolute top-2 right-2">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removePackageDetail(index)}
                              >
                                Remove
                              </Button>
                            </div>
                          )}
                          <h4 className="font-medium mb-4">
                            Package {index + 1}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <Label htmlFor={`shipper_${index}`}>
                                Shipper
                              </Label>
                              <SearchableSelect
                                id={`shipper_${index}`}
                                name={`package_details[${index}][shipper]`}
                                defaultValue={
                                  planData.package_details?.[index]?.shipper
                                }
                                options={dataPoints.organizations
                                  .filter((org: any) =>
                                    org.orgTypes.includes("Shipper")
                                  )
                                  .map((org: any) => ({
                                    value: org.name,
                                    label: `🏢 ${org.name} (${org.orgTypes.join(
                                      ", "
                                    )})`,
                                  }))}
                                placeholder="Select shipper"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`invoice_number_${index}`}>
                                Invoice Number
                              </Label>
                              <Input
                                id={`invoice_number_${index}`}
                                name={`package_details[${index}][invoice_number]`}
                                defaultValue={
                                  planData.package_details?.[index]
                                    ?.invoice_number
                                }
                                placeholder="Enter invoice number"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`commodity_${index}`}>
                                Commodity
                              </Label>
                              <SearchableSelect
                                id={`commodity_${index}`}
                                name={`package_details[${index}][commodity]`}
                                defaultValue={
                                  planData.package_details?.[index]?.commodity
                                }
                                options={dataPoints.commodities.map(
                                  (commodity: any) => ({
                                    value: commodity.name,
                                    label: `📦 ${commodity.name}`,
                                  })
                                )}
                                placeholder="Select commodity"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`volume_${index}`}>Volume</Label>
                              <Input
                                id={`volume_${index}`}
                                name={`package_details[${index}][volume]`}
                                type="number"
                                step="0.01"
                                defaultValue={
                                  planData.package_details?.[index]?.volume
                                }
                                placeholder="Enter volume"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`gross_weight_${index}`}>
                                Gross Weight
                              </Label>
                              <Input
                                id={`gross_weight_${index}`}
                                name={`package_details[${index}][gross_weight]`}
                                type="number"
                                step="0.01"
                                defaultValue={
                                  planData.package_details?.[index]
                                    ?.gross_weight
                                }
                                placeholder="Enter gross weight"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`number_of_packages_${index}`}>
                                Number of Packages
                              </Label>
                              <Input
                                id={`number_of_packages_${index}`}
                                name={`package_details[${index}][number_of_packages]`}
                                type="number"
                                defaultValue={
                                  planData.package_details?.[index]
                                    ?.number_of_packages
                                }
                                placeholder="Enter number of packages"
                              />
                            </div>
                            <div>
                              <Label
                                htmlFor={`projected_cargo_ready_date_${index}`}
                              >
                                Projected Cargo Ready Date
                              </Label>
                              <Input
                                id={`projected_cargo_ready_date_${index}`}
                                name={`package_details[${index}][projected_cargo_ready_date]`}
                                type="date"
                                defaultValue={
                                  planData.package_details?.[index]
                                    ?.projected_cargo_ready_date
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor={`hs_code_${index}`}>
                                HS Code
                              </Label>
                              <Input
                                id={`hs_code_${index}`}
                                name={`package_details[${index}][hs_code]`}
                                defaultValue={
                                  planData.package_details?.[index]?.hs_code
                                }
                                placeholder="Enter HS code"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`p_o_number_${index}`}>
                                P.O. Number
                              </Label>
                              <Input
                                id={`p_o_number_${index}`}
                                name={`package_details[${index}][p_o_number]`}
                                defaultValue={
                                  planData.package_details?.[index]?.p_o_number
                                }
                                placeholder="Enter purchase order number"
                              />
                            </div>
                            <div className="flex items-center space-x-8">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`is_haz_${index}`}
                                  name={`package_details[${index}][is_haz]`}
                                  value="true"
                                  checked={
                                    packageDetails[index]?.is_haz || false
                                  }
                                  onChange={(e) =>
                                    updatePackageDetails(index, "is_haz", e.target.checked)
                                  }
                                />
                                <Label htmlFor={`is_haz_${index}`}>
                                  Hazardous Material
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`C_H_A_${index}`}
                                  name={`package_details[${index}][C_H_A]`}
                                  value="true"
                                  defaultChecked={
                                    planData.package_details?.[index]?.C_H_A
                                  }
                                />
                                <Label htmlFor={`C_H_A_${index}`}>
                                  C.H.A. Required
                                </Label>
                              </div>
                            </div>
                            {packageDetails[index]?.is_haz && (
                              <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="space-y-2">
                                  <Label htmlFor={`un_number_${index}`} className="text-sm font-medium">
                                    UN# <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    id={`un_number_${index}`}
                                    type="text"
                                    name={`package_details[${index}][un_number]`}
                                    value={
                                      packageDetails[index]?.un_number || ""
                                    }
                                    onChange={(e) =>
                                      updatePackageDetails(index, "un_number", e.target.value)
                                    }
                                    placeholder="e.g., UN1234"
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`haz_class_${index}`} className="text-sm font-medium">
                                    Class <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    id={`haz_class_${index}`}
                                    type="text"
                                    name={`package_details[${index}][haz_class]`}
                                    value={
                                      packageDetails[index]?.haz_class || ""
                                    }
                                    onChange={(e) =>
                                      updatePackageDetails(index, "haz_class", e.target.value)
                                    }
                                    placeholder="e.g., Class 3"
                                    required
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Equipment Details - Updated Section */}
              <AccordionItem>
                <AccordionTrigger
                  isOpen={openSections.equipment}
                  onClick={() => toggleSection("equipment")}
                >
                  Equipment Details <span className="text-red-500">*</span>
                </AccordionTrigger>
                <AccordionContent isOpen={openSections.equipment}>
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-medium">
                          Equipment Details
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Each equipment entry represents 1 unit with individual
                          tracking
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            console.log("🔵 Bulk Create button clicked!");
                            console.log(
                              "🔵 Current showBulkEquipmentModal:",
                              showBulkEquipmentModal
                            );
                            setShowBulkEquipmentModal(true);
                            console.log("🔵 Modal should now be open");
                          }}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        >
                          📦 Bulk Create
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addEquipmentDetail}
                        >
                          ➕ Add Equipment
                        </Button>
                      </div>
                    </div>

                    {/* Equipment Summary */}
                    {equipmentDetails.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 border">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                          Equipment Summary
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {Object.entries(groupedEquipment).map(
                            ([type, equipments]: [string, any]) => (
                              <div key={type} className="text-center">
                                <div className="text-lg font-bold text-blue-600">
                                  {equipments.length}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {type || "Unspecified"}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Grouped Equipment Display */}
                    <div className="space-y-8">
                      {
                        (console.log("=== RENDERING EQUIPMENT ==="),
                        console.log(
                          "equipmentDetails for rendering:",
                          equipmentDetails
                        ),
                        console.log("groupedEquipment:", groupedEquipment),
                        console.log("=== END RENDERING EQUIPMENT ==="))
                      }
                      {Object.entries(groupedEquipment).map(
                        ([equipmentType, equipments]: [string, any]) => (
                          <div key={equipmentType} className="space-y-4">
                            <div className="flex items-center space-x-2 border-b border-gray-200 pb-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <h4 className="text-lg font-semibold text-gray-800">
                                {equipmentType || "Unspecified Equipment Type"}{" "}
                                ({equipments.length} units)
                              </h4>
                            </div>

                            <div className="grid gap-4">
                              {equipments.map(
                                (equipment: any, groupIndex: number) => {
                                  const index = equipment.originalIndex;
                                  return (
                                    <div
                                      key={index}
                                      className="border rounded-lg p-4 bg-white shadow-sm relative"
                                    >
                                      {/* Equipment Header */}
                                      <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center space-x-3">
                                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                            <span className="text-blue-600 text-sm font-bold">
                                              {equipment.equipmentSequence ||
                                                index + 1}
                                            </span>
                                          </div>
                                          <div>
                                            <h5 className="font-semibold text-gray-900">
                                              {(() => {
                                                // Check if this equipment has been allocated a liner booking number
                                                const linkedBookingData = shipmentPlan?.linerBooking?.data || shipmentPlan?.shipmentAssignment?.data;
                                                if (linkedBookingData && (linkedBookingData as any).liner_booking_details) {
                                                  const details = (linkedBookingData as any).liner_booking_details;

                                                  // First try to match by trackingNumber
                                                  let matchingDetail = details.find((detail: any) => detail.trackingNumber === equipment.trackingNumber);

                                                  // If no match by trackingNumber, try to match by liner_booking_number (most reliable for allocated equipment)
                                                  if (!matchingDetail) {
                                                    matchingDetail = details.find((detail: any) => detail.liner_booking_number === equipment.trackingNumber);
                                                  }

                                                  // If no match by liner_booking_number, try to match by equipment type and booking_for fields that contain the tracking number
                                                  if (!matchingDetail) {
                                                    matchingDetail = details.find((detail: any) => {
                                                      // Check if equipment_type or booking_for fields contain the tracking number
                                                      const equipmentTypeMatches = detail.equipment_type && detail.equipment_type.includes(equipment.trackingNumber);
                                                      const bookingForMatches = detail.booking_for && detail.booking_for.includes(equipment.trackingNumber);
                                                      return equipmentTypeMatches || bookingForMatches;
                                                    });
                                                  }

                                                  if (matchingDetail && matchingDetail.liner_booking_number) {
                                                    return matchingDetail.liner_booking_number;
                                                  }
                                                }
                                                // Fallback to tracking number
                                                return equipment.trackingNumber || `Equipment ${index + 1}`;
                                              })()}
                                            </h5>
                                            <div className="flex items-center space-x-2 mt-1">
                                              <span
                                                className={`text-xs px-2 py-1 rounded-full ${
                                                  equipment.status ===
                                                  "Loaded on Board"
                                                    ? "bg-green-100 text-green-700"
                                                    : equipment.status ===
                                                      "Gated In"
                                                    ? "bg-blue-100 text-blue-700"
                                                    : equipment.status ===
                                                      "Stuffing Completed"
                                                    ? "bg-yellow-100 text-yellow-700"
                                                    : equipment.status ===
                                                      "Empty Picked Up"
                                                    ? "bg-purple-100 text-purple-700"
                                                    : "bg-gray-100 text-gray-700"
                                                }`}
                                              >
                                                {equipment.status || "Pending"}
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex space-x-2">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              duplicateEquipmentDetail(index)
                                            }
                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                            title="Duplicate this equipment"
                                          >
                                            📋 Duplicate
                                          </Button>
                                          {equipmentDetails.length > 1 && (
                                            <Button
                                              type="button"
                                              variant="destructive"
                                              size="sm"
                                              onClick={() =>
                                                removeEquipmentDetail(index)
                                              }
                                              title="Remove this equipment"
                                            >
                                              🗑️ Remove
                                            </Button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Hidden fields for tracking */}
                                      <input
                                        type="hidden"
                                        name={`equipment_details[${index}][trackingNumber]`}
                                        value={equipment.trackingNumber || ""}
                                      />
                                      <input
                                        type="hidden"
                                        name={`equipment_details[${index}][equipmentSequence]`}
                                        value={
                                          equipment.equipmentSequence ||
                                          index + 1
                                        }
                                      />
                                      <input
                                        type="hidden"
                                        name={`equipment_details[${index}][status]`}
                                        value={equipment.status || "Pending"}
                                      />

                                      {/* Equipment Details Grid */}
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <Label
                                            htmlFor={`equipment_type_${index}`}
                                          >
                                            Equipment Type{" "}
                                            <span className="text-red-500">
                                              *
                                            </span>
                                          </Label>
                                          <SearchableSelect
                                            id={`equipment_type_${index}`}
                                            name={`equipment_details[${index}][equipment_type]`}
                                            defaultValue={
                                              equipment.equipment_type
                                            }
                                            options={dataPoints.equipment.map(
                                              (equipment: any) => ({
                                                value: equipment.name,
                                                label: `📋 ${equipment.name}${
                                                  equipment.code
                                                    ? ` (${equipment.code})`
                                                    : ` (${generateCodeFromName(
                                                        equipment.name
                                                      )})`
                                                }`,
                                              })
                                            )}
                                            placeholder="Select equipment type"
                                            onChange={(value) =>
                                              updateEquipmentType(index, value)
                                            }
                                          />
                                        </div>

                                        {/* Container Number field - only visible if booking status is "Booked" and "Empty Container Picked Up" is checked */}
                                        {(bookingStatus === "Booked" && equipment.emptyPickupStatus) && (
                                          <div>
                                            <Label
                                              htmlFor={`container_number_${index}`}
                                            >
                                            Container Number
                                            <span className="text-xs text-gray-500 ml-1">
                                              (4 letters + 7 digits)
                                            </span>
                                          </Label>
                                          <div className="flex gap-2 items-start">
                                            <div className="flex-1">
                                              <Input
                                                id={`container_number_${index}`}
                                                name={`equipment_details[${index}][container_number]`}
                                                type="text"
                                                placeholder="ABCD1234567"
                                                defaultValue={equipment.container_number || ""}
                                                maxLength={11}
                                                style={{ textTransform: 'uppercase' }}
                                                onChange={(e) => {
                                                  // Convert to uppercase and validate format
                                                  const value = e.target.value.toUpperCase();
                                                  const pattern = /^[A-Z]{0,4}[0-9]{0,7}$/;
                                                  
                                                  if (pattern.test(value) || value === "") {
                                                    e.target.value = value;
                                                    // Clear any previous validation styling
                                                    e.target.style.borderColor = '';
                                                    e.target.style.backgroundColor = '';
                                                  } else {
                                                    // Invalid format - restore previous valid value
                                                    e.target.style.borderColor = '#ef4444';
                                                    e.target.style.backgroundColor = '#fef2f2';
                                                  }
                                                  
                                                  // Full validation check
                                                  if (value.length === 11) {
                                                    const fullPattern = /^[A-Z]{4}[0-9]{7}$/;
                                                    if (fullPattern.test(value)) {
                                                      e.target.style.borderColor = '#10b981';
                                                      e.target.style.backgroundColor = '#f0fdf4';
                                                    } else {
                                                      e.target.style.borderColor = '#ef4444';
                                                      e.target.style.backgroundColor = '#fef2f2';
                                                    }
                                                  }
                                                }}
                                                onKeyPress={(e) => {
                                                  // Only allow letters for first 4 positions, numbers for last 7
                                                  const value = e.currentTarget.value;
                                                  const char = e.key;
                                                  
                                                  if (value.length < 4) {
                                                    // First 4 positions: only letters
                                                    if (!/[A-Za-z]/.test(char)) {
                                                      e.preventDefault();
                                                    }
                                                  } else if (value.length < 11) {
                                                    // Last 7 positions: only numbers
                                                    if (!/[0-9]/.test(char)) {
                                                      e.preventDefault();
                                                    }
                                                  } else {
                                                    // Already at max length
                                                    e.preventDefault();
                                                  }
                                                }}
                                                className="text-sm font-mono tracking-wider"
                                              />
                                            </div>
                                            <Button
                                              type="button"
                                              onClick={async (e) => {
                                                const input = document.getElementById(`container_number_${index}`) as HTMLInputElement;
                                                const containerNumber = input?.value?.trim().toUpperCase();
                                                
                                                if (!containerNumber) {
                                                  addToast({
                                                    type: "error",
                                                    title: "Container Number Required",
                                                    description: "Please enter a container number before saving",
                                                    duration: 3000,
                                                  });
                                                  return;
                                                }
                                                
                                                // Validate format
                                                const containerPattern = /^[A-Z]{4}[0-9]{7}$/;
                                                if (!containerPattern.test(containerNumber)) {
                                                  addToast({
                                                    type: "error",
                                                    title: "Invalid Format",
                                                    description: "Container number must be 4 letters followed by 7 digits (e.g., ABCD1234567)",
                                                    duration: 4000,
                                                  });
                                                  return;
                                                }
                                                
                                                // Set loading state
                                                const button = e.currentTarget;
                                                const originalText = button.textContent;
                                                button.disabled = true;
                                                button.innerHTML = '...';
                                                
                                                try {
                                                  // Make API call to save container number
                                                  const response = await fetch('/api/shipment-plans', {
                                                    method: 'POST',
                                                    headers: {
                                                      'Content-Type': 'application/json',
                                                    },
                                                    body: JSON.stringify({
                                                      action: 'update_container_number',
                                                      shipmentPlanId: shipmentPlan?.id,
                                                      equipmentIndex: index,
                                                      trackingNumber: equipment.trackingNumber,
                                                      containerNumber: containerNumber,
                                                    }),
                                                  });
                                                  
                                                  if (response.ok) {
                                                    // Update local state
                                                    const updatedEquipment = [...equipmentDetails];
                                                    updatedEquipment[index] = {
                                                      ...updatedEquipment[index],
                                                      container_number: containerNumber
                                                    };
                                                    setEquipmentDetails(updatedEquipment);
                                                    
                                                    addToast({
                                                      type: "success",
                                                      title: "Container Number Saved",
                                                      description: `Container number ${containerNumber} saved successfully`,
                                                      duration: 3000,
                                                    });
                                                  } else {
                                                    const errorData = await response.json();
                                                    throw new Error(errorData.error || 'Failed to save container number');
                                                  }
                                                } catch (error) {
                                                  console.error('Error saving container number:', error);
                                                  addToast({
                                                    type: "error",
                                                    title: "Save Failed",
                                                    description: error instanceof Error ? error.message : "Failed to save container number. Please try again.",
                                                    duration: 4000,
                                                  });
                                                } finally {
                                                  // Reset button state
                                                  button.disabled = false;
                                                  button.innerHTML = originalText || 'Save';
                                                }
                                              }}
                                              size="sm"
                                              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                            >
                                              Save
                                            </Button>
                                          </div>
                                          <p className="text-xs text-gray-500 mt-1">
                                            Format: 4 uppercase letters followed by 7 digits (e.g., ABCD1234567)
                                          </p>
                                          </div>
                                        )}

                                        <div>
                                          <Label
                                            htmlFor={`stuffing_point_${index}`}
                                          >
                                            Stuffing Point
                                          </Label>
                                          <Select
                                            id={`stuffing_point_${index}`}
                                            name={`equipment_details[${index}][stuffing_point]`}
                                            defaultValue={
                                              equipment.stuffing_point
                                            }
                                            onChange={(e) => {
                                              setEquipmentStuffingPoints(
                                                (prev) => ({
                                                  ...prev,
                                                  [index]: e.target.value,
                                                })
                                              );
                                            }}
                                          >
                                            <option value="">
                                              Select stuffing point
                                            </option>
                                            <option value="Factory Stuffing">
                                              🏭 Factory Stuffing
                                            </option>
                                            <option value="CCL CFS Stuffing">
                                              📦 CCL CFS Stuffing
                                            </option>
                                          </Select>
                                        </div>

                                        {/* Conditionally render these fields only for Factory Stuffing */}
                                        {equipmentStuffingPoints[index] ===
                                          "Factory Stuffing" && (
                                          <>
                                            <div>
                                              <Label
                                                htmlFor={`empty_container_pick_up_from_${index}`}
                                              >
                                                Empty Container Pick Up From
                                              </Label>
                                              <Select
                                                id={`empty_container_pick_up_from_${index}`}
                                                name={`equipment_details[${index}][empty_container_pick_up_from]`}
                                                defaultValue={
                                                  equipment.empty_container_pick_up_from
                                                }
                                              >
                                                <option value="">
                                                  Select pickup location
                                                </option>
                                                <option value="ICD">
                                                  🏢 ICD
                                                </option>
                                                <option value="Port">
                                                  🚢 Port
                                                </option>
                                              </Select>
                                            </div>

                                            <div>
                                              <Label
                                                htmlFor={`container_handover_location_${index}`}
                                              >
                                                Container Handover Location
                                              </Label>
                                              <Select
                                                id={`container_handover_location_${index}`}
                                                name={`equipment_details[${index}][container_handover_location]`}
                                                defaultValue={
                                                  equipment.container_handover_location
                                                }
                                              >
                                                <option value="">
                                                  Select handover location
                                                </option>
                                                <option value="ICD">
                                                  🏢 ICD
                                                </option>
                                                <option value="Port">
                                                  🚢 Port
                                                </option>
                                              </Select>
                                            </div>

                                            <div>
                                              <Label
                                                htmlFor={`empty_container_pick_up_location_${index}`}
                                              >
                                                Empty Container Pick up Location
                                              </Label>
                                              <Input
                                                id={`empty_container_pick_up_location_${index}`}
                                                name={`equipment_details[${index}][empty_container_pick_up_location]`}
                                                defaultValue={
                                                  equipment.empty_container_pick_up_location
                                                }
                                                placeholder="Enter empty container pickup location"
                                              />
                                            </div>

                                            <div>
                                              <Label
                                                htmlFor={`container_handover_at_${index}`}
                                              >
                                                Container Handover At
                                              </Label>
                                              <Input
                                                id={`container_handover_at_${index}`}
                                                name={`equipment_details[${index}][container_handover_at]`}
                                                defaultValue={
                                                  equipment.container_handover_at
                                                }
                                                placeholder="Enter container handover location"
                                              />
                                            </div>
                                          </>
                                        )}
                                      </div>

                                      {/* Individual Equipment Status Tracking */}
                                      {bookingStatus === "Booked" && (
                                        <div className="mt-6 pt-4 border-t border-gray-200">
                                          <h6 className="text-sm font-semibold text-gray-700 mb-3">
                                            Individual Status Tracking
                                          </h6>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Empty Pickup Status */}
                                            <div className="space-y-2">
                                              <div className="flex items-center space-x-2">
                                                <Checkbox
                                                  id={`empty_pickup_status_${index}`}
                                                  name={`equipment_details[${index}][emptyPickupStatus]`}
                                                  value="true"
                                                  checked={
                                                    equipment.emptyPickupStatus
                                                  }
                                                  onChange={(e) =>
                                                    updateEquipmentStatus(
                                                      index,
                                                      "emptyPickupStatus",
                                                      e.target.checked
                                                    )
                                                  }
                                                />
                                                <Label
                                                  htmlFor={`empty_pickup_status_${index}`}
                                                  className="text-sm"
                                                >
                                                  Empty Container Picked Up
                                                </Label>
                                              </div>
                                              {equipment.emptyPickupStatus && (
                                                <Input
                                                  type="date"
                                                  name={`equipment_details[${index}][emptyPickupDate]`}
                                                  value={
                                                    equipment.emptyPickupDate
                                                  }
                                                  onChange={(e) =>
                                                    updateEquipmentStatus(
                                                      index,
                                                      "emptyPickupDate",
                                                      e.target.value
                                                    )
                                                  }
                                                  className="text-sm"
                                                  placeholder="Pickup date"
                                                />
                                              )}
                                            </div>

                                            {/* Stuffing Status */}
                                            <div className="space-y-2">
                                              <div className="flex items-center space-x-2">
                                                <Checkbox
                                                  id={`stuffing_status_${index}`}
                                                  name={`equipment_details[${index}][stuffingStatus]`}
                                                  value="true"
                                                  checked={
                                                    equipment.stuffingStatus
                                                  }
                                                  onChange={(e) =>
                                                    updateEquipmentStatus(
                                                      index,
                                                      "stuffingStatus",
                                                      e.target.checked
                                                    )
                                                  }
                                                />
                                                <Label
                                                  htmlFor={`stuffing_status_${index}`}
                                                  className="text-sm"
                                                >
                                                  Stuffing Completed
                                                </Label>
                                              </div>
                                              {equipment.stuffingStatus && (
                                                <Input
                                                  type="date"
                                                  name={`equipment_details[${index}][stuffingDate]`}
                                                  value={equipment.stuffingDate}
                                                  onChange={(e) =>
                                                    updateEquipmentStatus(
                                                      index,
                                                      "stuffingDate",
                                                      e.target.value
                                                    )
                                                  }
                                                  className="text-sm"
                                                  placeholder="Stuffing date"
                                                />
                                              )}
                                            </div>

                                            {/* Gate In Status */}
                                            <div className="space-y-2">
                                              <div className="flex items-center space-x-2">
                                                <Checkbox
                                                  id={`gate_in_status_${index}`}
                                                  name={`equipment_details[${index}][gateInStatus]`}
                                                  value="true"
                                                  checked={
                                                    equipment.gateInStatus
                                                  }
                                                  onChange={(e) =>
                                                    updateEquipmentStatus(
                                                      index,
                                                      "gateInStatus",
                                                      e.target.checked
                                                    )
                                                  }
                                                />
                                                <Label
                                                  htmlFor={`gate_in_status_${index}`}
                                                  className="text-sm"
                                                >
                                                  Gated In
                                                </Label>
                                              </div>
                                              {equipment.gateInStatus && (
                                                <Input
                                                  type="date"
                                                  name={`equipment_details[${index}][gateInDate]`}
                                                  value={equipment.gateInDate}
                                                  onChange={(e) =>
                                                    updateEquipmentStatus(
                                                      index,
                                                      "gateInDate",
                                                      e.target.value
                                                    )
                                                  }
                                                  className="text-sm"
                                                  placeholder="Gate in date"
                                                />
                                              )}
                                            </div>

                                            {/* Loaded Status */}
                                            <div className="space-y-2">
                                              <div className="flex items-center space-x-2">
                                                <Checkbox
                                                  id={`loaded_status_${index}`}
                                                  name={`equipment_details[${index}][loadedStatus]`}
                                                  value="true"
                                                  checked={
                                                    equipment.loadedStatus
                                                  }
                                                  onChange={(e) =>
                                                    updateEquipmentStatus(
                                                      index,
                                                      "loadedStatus",
                                                      e.target.checked
                                                    )
                                                  }
                                                />
                                                <Label
                                                  htmlFor={`loaded_status_${index}`}
                                                  className="text-sm"
                                                >
                                                  Loaded on Board
                                                </Label>
                                              </div>
                                              {equipment.loadedStatus && (
                                                <Input
                                                  type="date"
                                                  name={`equipment_details[${index}][loadedDate]`}
                                                  value={equipment.loadedDate}
                                                  onChange={(e) =>
                                                    updateEquipmentStatus(
                                                      index,
                                                      "loadedDate",
                                                      e.target.value
                                                    )
                                                  }
                                                  className="text-sm"
                                                  placeholder="Loading date"
                                                />
                                              )}
                                            </div>

                                            {/* SI Filed Status */}
                                            <div className="space-y-2">
                                              <div className="flex items-center space-x-2">
                                                <Checkbox
                                                  id={`si_filed_status_${index}`}
                                                  name={`equipment_details[${index}][siFiledStatus]`}
                                                  value="true"
                                                  checked={
                                                    equipment.siFiledStatus
                                                  }
                                                  onChange={(e) =>
                                                    updateEquipmentStatus(
                                                      index,
                                                      "siFiledStatus",
                                                      e.target.checked
                                                    )
                                                  }
                                                />
                                                <Label
                                                  htmlFor={`si_filed_status_${index}`}
                                                  className="text-sm"
                                                >
                                                  SI Filed
                                                </Label>
                                              </div>
                                              {equipment.siFiledStatus && (
                                                <Input
                                                  type="date"
                                                  name={`equipment_details[${index}][siFiledDate]`}
                                                  value={equipment.siFiledDate}
                                                  onChange={(e) =>
                                                    updateEquipmentStatus(
                                                      index,
                                                      "siFiledDate",
                                                      e.target.value
                                                    )
                                                  }
                                                  className="text-sm"
                                                  placeholder="SI filed date"
                                                />
                                              )}
                                            </div>

                                            {/* ISF/ENS Filed Status */}
                                            <div className="space-y-2">
                                              <div className="flex items-center space-x-2">
                                                <Checkbox
                                                  id={`isfens_filed_status_${index}`}
                                                  name={`equipment_details[${index}][isfensFiledStatus]`}
                                                  value="true"
                                                  checked={
                                                    equipment.isfensFiledStatus
                                                  }
                                                  onChange={(e) =>
                                                    updateEquipmentStatus(
                                                      index,
                                                      "isfensFiledStatus",
                                                      e.target.checked
                                                    )
                                                  }
                                                />
                                                <Label
                                                  htmlFor={`isfens_filed_status_${index}`}
                                                  className="text-sm"
                                                >
                                                  ISF/ENS Filed
                                                </Label>
                                              </div>
                                              {equipment.isfensFiledStatus && (
                                                <Input
                                                  type="date"
                                                  name={`equipment_details[${index}][isfensFiledDate]`}
                                                  value={equipment.isfensFiledDate}
                                                  onChange={(e) =>
                                                    updateEquipmentStatus(
                                                      index,
                                                      "isfensFiledDate",
                                                      e.target.value
                                                    )
                                                  }
                                                  className="text-sm"
                                                  placeholder="ISF/ENS filed date"
                                                />
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Liner Booking Details Button - Only show when there are linked liner booking details */}
                                      {(() => {
                                        // Get liner booking detail for this equipment
                                        const linkedBookingData = shipmentPlan?.linerBooking?.data || shipmentPlan?.shipmentAssignment?.data;

                                        const matchingDetail = linkedBookingData && (linkedBookingData as any).liner_booking_details ?
                                          (() => {
                                            const details = (linkedBookingData as any).liner_booking_details;
                                            console.log(`[DEBUG] ============ MATCHING FOR EQUIPMENT ${index} ============`);
                                            console.log(`[DEBUG] Equipment trackingNumber:`, equipment.trackingNumber);
                                            console.log(`[DEBUG] Equipment type:`, equipment.equipment_type);
                                            console.log(`[DEBUG] Total available liner booking details:`, details.length);
                                            details.forEach((d: any, i: number) => {
                                              console.log(`[DEBUG] Detail ${i}:`, {
                                                trackingNumber: d.trackingNumber,
                                                equipment_type: d.equipment_type,
                                                booking_for: d.booking_for,
                                                liner_booking_number: d.liner_booking_number
                                              });
                                            });

                                            // First try to match by trackingNumber
                                            let match = details.find((detail: any) => detail.trackingNumber === equipment.trackingNumber);
                                            console.log(`[DEBUG] Match by trackingNumber:`, match);

                                            // If no match by trackingNumber, try to match by liner_booking_number (most reliable for allocated equipment)
                                            if (!match) {
                                              match = details.find((detail: any) => detail.liner_booking_number === equipment.trackingNumber);
                                              console.log(`[DEBUG] Match by liner_booking_number:`, match);
                                            }

                                            // If no match by liner_booking_number, try to match by equipment type and booking_for fields that contain the tracking number
                                            if (!match) {
                                              match = details.find((detail: any) => {
                                                // Check if equipment_type or booking_for fields contain the tracking number
                                                const equipmentTypeMatches = detail.equipment_type && detail.equipment_type.includes(equipment.trackingNumber);
                                                const bookingForMatches = detail.booking_for && detail.booking_for.includes(equipment.trackingNumber);
                                                return equipmentTypeMatches || bookingForMatches;
                                              });
                                              console.log(`[DEBUG] Match by equipment_type/booking_for containing trackingNumber:`, match);
                                            }

                                            // If still no match, try by equipment type only
                                            if (!match) {
                                              match = details.find((detail: any) =>
                                                detail.equipment_type === equipment.equipment_type ||
                                                detail.booking_for === equipment.equipment_type
                                              );
                                              console.log(`[DEBUG] Match by equipment type only:`, match);
                                            }

                                            // If still no match, try matching by position index (for existing mismatched data)
                                            // This ensures equipment[0] gets detail[0], equipment[1] gets detail[1], etc.
                                            if (!match && details.length > index && index >= 0) {
                                              match = details[index];
                                              console.log(`[DEBUG] Match by position index ${index}:`, match);
                                            }

                                            console.log(`[DEBUG] Final match for equipment ${equipment.trackingNumber}:`, match);
                                            return match;
                                          })() : null;

                                        return matchingDetail ? (
                                          <div className="mt-4 pt-4 border-t border-gray-200">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => toggleLinerBookingDetails(index)}
                                              className="w-full text-sm flex items-center justify-center gap-2"
                                            >
                                              {expandedLinerBookingDetails.has(index) ? (
                                                <>
                                                  📋 Hide Liner Booking Details
                                                  <span className="text-xs">↑</span>
                                                </>
                                              ) : (
                                                <>
                                                  📋 View Liner Booking Details
                                                  <span className="text-xs">↓</span>
                                                </>
                                              )}
                                            </Button>

                                            {/* Liner Booking Details Summary */}
                                            {expandedLinerBookingDetails.has(index) && (
                                              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                                <h6 className="text-sm font-semibold text-blue-800 mb-3">
                                                  Allocated Liner Booking Details
                                                </h6>

                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                  {/* Equipment Type */}
                                                  {matchingDetail.equipment_type && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Equipment Type
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {matchingDetail.equipment_type}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {/* Booking Numbers */}
                                                  {matchingDetail.temporary_booking_number && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Temporary Booking Number
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {matchingDetail.temporary_booking_number}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.suffix_for_anticipatory_temporary_booking_number && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Suffix for Anticipatory Temp Booking Number
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {matchingDetail.suffix_for_anticipatory_temporary_booking_number}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.liner_booking_number && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Liner Booking Number
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800 font-medium text-blue-700">
                                                        {matchingDetail.liner_booking_number}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.mbl_number && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        MBL Number
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {matchingDetail.mbl_number}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.carrier && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Carrier
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {matchingDetail.carrier}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.contract && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Contract
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {matchingDetail.contract}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.original_planned_vessel && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Original Planned Vessel
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {matchingDetail.original_planned_vessel}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.e_t_d_of_original_planned_vessel && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        ETD of Original Planned Vessel
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {formatDateForDisplay(matchingDetail.e_t_d_of_original_planned_vessel)}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.change_in_original_vessel && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Change in Original Vessel
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {matchingDetail.change_in_original_vessel ? "Yes" : "No"}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.revised_vessel && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Revised Vessel
                                                      </div>
                                                      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-gray-800">
                                                        <div className="flex items-center">
                                                          <span className="text-yellow-600 mr-1">⚠️</span>
                                                          {matchingDetail.revised_vessel}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.etd_of_revised_vessel && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        ETD of Revised Vessel
                                                      </div>
                                                      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-gray-800">
                                                        {formatDateForDisplay(matchingDetail.etd_of_revised_vessel)}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.empty_pickup_validity_from && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Empty Pickup From
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {formatDateForDisplay(matchingDetail.empty_pickup_validity_from)}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.empty_pickup_validity_till && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Empty Pickup Till
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {formatDateForDisplay(matchingDetail.empty_pickup_validity_till)}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.estimate_gate_opening_date && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Gate Opening Date
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {formatDateForDisplay(matchingDetail.estimate_gate_opening_date)}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.estimated_gate_cutoff_date && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Gate Cutoff Date
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {formatDateForDisplay(matchingDetail.estimated_gate_cutoff_date)}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.s_i_cut_off_date && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        SI Cut Off Date
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {formatDateForDisplay(matchingDetail.s_i_cut_off_date)}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.booking_received_from_carrier_on && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Booking Received On
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                        {formatDateForDisplay(matchingDetail.booking_received_from_carrier_on)}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>

                                                {/* Additional sections for dates, remarks, etc. */}
                                                {matchingDetail.additional_remarks && (
                                                  <div className="mt-3 space-y-1">
                                                    <div className="text-xs font-medium text-gray-600">
                                                      Additional Remarks
                                                    </div>
                                                    <div className="p-2 bg-white border border-gray-200 rounded text-xs text-gray-800">
                                                      {matchingDetail.additional_remarks}
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Line Booking Copy Links */}
                                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                  {matchingDetail.line_booking_copy && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Line Booking Copy (URL)
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs">
                                                        <a
                                                          href={matchingDetail.line_booking_copy}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="text-blue-600 hover:text-blue-800 hover:underline flex items-center text-xs"
                                                        >
                                                          🔗 View Booking Copy
                                                          <span className="ml-1">↗</span>
                                                        </a>
                                                      </div>
                                                    </div>
                                                  )}

                                                  {matchingDetail.line_booking_copy_file && (
                                                    <div className="space-y-1">
                                                      <div className="text-xs font-medium text-gray-600">
                                                        Line Booking Copy (PDF File)
                                                      </div>
                                                      <div className="p-2 bg-white border border-gray-200 rounded text-xs">
                                                        <a
                                                          href={matchingDetail.line_booking_copy_file}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="text-blue-600 hover:text-blue-800 hover:underline flex items-center text-xs"
                                                        >
                                                          📄 View PDF
                                                          <span className="ml-1">↗</span>
                                                        </a>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        ) : null;
                                      })()}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Container Movement */}
              <AccordionItem>
                <AccordionTrigger
                  isOpen={openSections.movement}
                  onClick={() => toggleSection("movement")}
                >
                  Container Movement <span className="text-red-500">*</span>
                </AccordionTrigger>
                <AccordionContent isOpen={openSections.movement}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                    <div>
                      <Label htmlFor="loading_port">
                        Loading Port <span className="text-red-500">*</span>
                      </Label>
                      <SearchableSelect
                        id="loading_port"
                        name="loading_port"
                        defaultValue={planData.container_movement?.loading_port}
                        options={dataPoints.loadingPorts.map((port: any) => ({
                          value: port.name,
                          label: `🚢 ${port.name}, ${port.country}`,
                        }))}
                        placeholder="Select loading port"
                      />
                    </div>

                    <div>
                      <Label htmlFor="destination_country">
                        Destination Country{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <SearchableSelect
                        id="destination_country"
                        name="destination_country"
                        defaultValue={
                          planData.container_movement?.destination_country
                        }
                        options={dataPoints.destinationCountries.map(
                          (country: any) => ({
                            value: country.name,
                            label: `🌍 ${country.name}`,
                          })
                        )}
                        placeholder="Select destination country"
                        onChange={(value) =>
                          handleDestinationCountryChange(value)
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="port_of_discharge">
                        Port of Discharge{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <SearchableSelect
                        id="port_of_discharge"
                        name="port_of_discharge"
                        defaultValue={
                          planData.container_movement?.port_of_discharge
                        }
                        options={dataPoints.portsOfDischarge
                          .filter(
                            (port: any) =>
                              !destinationCountry ||
                              port.country === destinationCountry
                          )
                          .map((port: any) => ({
                            value: port.name,
                            label: `🏢 ${port.name}, ${port.country}`,
                          }))}
                        placeholder={
                          destinationCountry
                            ? `Select port in ${destinationCountry}`
                            : "Select destination country first"
                        }
                        disabled={!destinationCountry}
                      />
                    </div>

                    <div>
                      <Label htmlFor="incoterm">
                        Incoterm <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        id="incoterm"
                        name="incoterm"
                        defaultValue={planData.container_movement?.incoterm || ""}
                        required
                        className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      >
                        <option value="">Select Incoterm</option>
                        <option value="EXW">EXW - Ex Works</option>
                        <option value="FCA">FCA - Free Carrier</option>
                        <option value="CPT">CPT - Carriage Paid to</option>
                        <option value="CIP">CIP - Carriage and Insurance Paid To</option>
                        <option value="DAP">DAP - Delivered at Place</option>
                        <option value="DPU">DPU - Delivered at Place Unloaded</option>
                        <option value="DDP">DDP - Delivered Duty Paid</option>
                        <option value="FAS">FAS - Free Alongside Ship</option>
                        <option value="FOB">FOB - Free on Board</option>
                        <option value="CFR">CFR - Cost and Freight</option>
                        <option value="CIF">CIF - Cost Insurance and Freight</option>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="freight_terms">
                        Freight Terms <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        id="freight_terms"
                        name="freight_terms"
                        defaultValue={planData.container_movement?.freight_terms || ""}
                        required
                        className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      >
                        <option value="">Select Freight Terms</option>
                        <option value="Prepaid">💳 Prepaid</option>
                        <option value="Collect">📦 Collect</option>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="free_time_in_days">
                        Free Time in Days <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="free_time_in_days"
                        name="free_time_in_days"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={planData.container_movement?.free_time_in_days || ""}
                        placeholder="Enter number of free days"
                        required
                        className="border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      />
                    </div>

                    <div>
                      <Label htmlFor="delivery_till">
                        Delivery Till <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        id="delivery_till"
                        name="delivery_till"
                        defaultValue={
                          planData.container_movement?.delivery_till
                        }
                        onChange={(e) =>
                          handleDeliveryTillChange(e.target.value)
                        }
                        required
                      >
                        <option value="">Select delivery point</option>
                        <option value="Port">🚢 Port</option>
                        <option value="Rail Ramp">🚂 Rail Ramp</option>
                        <option value="Door">🚪 Door</option>
                      </Select>
                    </div>

                    {/* Conditionally render Final Place of Delivery only when Delivery Till is not Port */}
                    {deliveryTill && deliveryTill !== "Port" && (
                      <div>
                        <Label htmlFor="final_place_of_delivery">
                          Final Place of Delivery
                        </Label>
                        <Input
                          id="final_place_of_delivery"
                          name="final_place_of_delivery"
                          defaultValue={
                            planData.container_movement
                              ?.final_place_of_delivery
                          }
                          placeholder="Enter final delivery place"
                        />
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Carrier & Vessel Information */}
              <AccordionItem>
                <AccordionTrigger
                  isOpen={openSections.carrier}
                  onClick={() => toggleSection("carrier")}
                >
                  Carrier & Vessel Preference
                </AccordionTrigger>
                <AccordionContent isOpen={openSections.carrier}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="carrier">Carrier</Label>
                      <SearchableSelect
                        id="carrier"
                        name="carrier"
                        defaultValue={
                          planData.container_movement
                            ?.carrier_and_vessel_preference?.carrier
                        }
                        options={dataPoints.carriers.map((carrier: any) => ({
                          value: carrier.name,
                          label: `🚛 ${carrier.name}`,
                        }))}
                        placeholder="Select preferred carrier"
                      />
                    </div>
                    <div>
                      <Label htmlFor="vessel">Vessel</Label>
                      <SearchableSelect
                        id="vessel"
                        name="vessel"
                        defaultValue={
                          planData.container_movement
                            ?.carrier_and_vessel_preference?.vessel
                        }
                        options={dataPoints.vessels.map((vessel: any) => ({
                          value: vessel.name,
                          label: `🚢 ${vessel.name}`,
                        }))}
                        placeholder="Select preferred vessel"
                      />
                    </div>
                    <div>
                      <Label htmlFor="preferred_etd">Preferred ETD</Label>
                      <Input
                        id="preferred_etd"
                        name="preferred_etd"
                        type="date"
                        defaultValue={
                          planData.container_movement
                            ?.carrier_and_vessel_preference?.preferred_etd
                        }
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Stuffing Requirements */}
              <AccordionItem>
                <AccordionTrigger
                  isOpen={openSections.stuffing}
                  onClick={() => toggleSection("stuffing")}
                >
                  Stuffing & Special Instructions
                </AccordionTrigger>
                <AccordionContent isOpen={openSections.stuffing}>
                  <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="specific_stuffing_requirement"
                        name="specific_stuffing_requirement"
                        value="true"
                        checked={specificStuffing}
                        onChange={(e) => setSpecificStuffing(e.target.checked)}
                      />
                      <Label htmlFor="specific_stuffing_requirement">
                        Specific Stuffing Requirements
                      </Label>
                    </div>

                    {specificStuffing && (
                      <>
                        <div>
                          <Label htmlFor="stuffing_instructions">
                            Stuffing Instructions
                          </Label>
                          <Textarea
                            id="stuffing_instructions"
                            name="stuffing_instructions"
                            defaultValue={
                              planData.container_movement?.stuffing_instructions
                            }
                            placeholder="Enter specific stuffing instructions"
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label htmlFor="specific_instructions">
                            Specific Instructions
                          </Label>
                          <Textarea
                            id="specific_instructions"
                            name="specific_instructions"
                            defaultValue={
                              planData.container_movement?.specific_instructions
                            }
                            placeholder="Enter any specific instructions"
                            rows={3}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              

              
            </Accordion>
          </div>

          {/* Enhanced Form Actions */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end items-center">
            <div className="flex items-center space-x-3">
              <Link to="/shipment-plans">
                <Button
                  type="button"
                  variant="outline"
                  className="px-6 py-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 bg-transparent"
                >
                  <span className="mr-2">↩️</span>
                  Back to List
                </Button>
              </Link>

              {(user?.role.name === "ADMIN" ||
                user?.role.name === "MD" ||
                user?.role.name === "SHIPMENT_PLAN_TEAM") && (
                <>
                  {/* Delete Shipment Plan Button - Only show in edit mode */}
                  {mode === "edit" && (user?.role.name === "ADMIN" || user?.role.name === "SHIPMENT_PLAN_TEAM") && (
                    <Button
                      type="button"
                      onClick={() => setShowCancelConfirmation(true)}
                      disabled={isSubmitting || isFormSubmitting || isCancelling}
                      className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center space-x-2">
                        <span>🗑️</span>
                        <span>Delete Plan</span>
                      </div>
                    </Button>
                  )}
                  {/* Save as Draft Button - Hide for MD users */}
                  {user?.role.name !== "MD" && (
                    <div className="relative group">
                      <Button
                        type="submit"
                        name="submitAction"
                        value="draft"
                        formNoValidate
                        disabled={isSubmitting || isFormSubmitting || !selectedBusinessBranch}
                        className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting || isFormSubmitting ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Saving...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span>📝</span>
                            <span>Save as Draft</span>
                          </div>
                        )}
                      </Button>
                      {!selectedBusinessBranch && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
                          Please select a business branch first
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Update Shipment Plan Button - Hide for MD when plan is awaiting approval (button is at top) */}
                  {!(mode === "edit" && bookingStatus === "Awaiting MD Approval" && user?.role.name === "MD") && (
                    <div className="relative group">
                      <Button
                        type="submit"
                        name="submitAction"
                        value="submit"
                        formNoValidate
                        disabled={
                          isSubmitting || 
                          isFormSubmitting || 
                          (mode === "edit" && 
                          bookingStatus === "Awaiting MD Approval" && 
                          (user?.role?.name === "ADMIN" || user?.role?.name === "MD") && 
                          activeApprovalTab === "approved" && 
                          (!selectedLinerBroker || selectedLinerBroker.trim() === ""))
                        }
                        className="px-8 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting || isFormSubmitting ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>
                              {mode === "create" ? "Creating..." : "Updating..."}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span>✨</span>
                            <span>
                              {mode === "create"
                                ? "Create Shipment Plan"
                                : "Update Shipment Plan"}
                            </span>
                          </div>
                        )}
                      </Button>
                      {mode === "edit" && 
                      bookingStatus === "Awaiting MD Approval" && 
                      (user?.role?.name === "ADMIN" || user?.role?.name === "MD") && 
                      activeApprovalTab === "approved" && 
                      (!selectedLinerBroker || selectedLinerBroker.trim() === "") && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
                          Please assign a liner broker first
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Form>
      {/* Bulk Equipment Modal */}
      {/* Bulk Equipment Modal */}
      {showBulkEquipmentModal && (
        <BulkEquipmentModal
          isOpen={showBulkEquipmentModal}
          onClose={() => {
            console.log("Modal closing...");
            setShowBulkEquipmentModal(false);
          }}
          onSubmit={(data) => {
            console.log("Modal onSubmit called with:", data);
            handleBulkEquipmentCreate(data);
          }}
          equipmentOptions={dataPoints.equipment}
          existingEquipment={equipmentDetails}
        />
      )}

      {/* Delete Shipment Plan Confirmation Modal */}
      {showCancelConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center">
                <span className="mr-2">⚠️</span>
                Delete Shipment Plan
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 mb-3">
                  Are you sure you want to delete this shipment plan?
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm">
                  <p className="font-semibold text-orange-800 mb-2">This action will:</p>
                  <ul className="list-disc list-inside text-orange-700 space-y-1">
                    <li>Permanently delete this shipment plan</li>
                    <li>Remove it from all lists (Planner, MD, Admin)</li>
                    {planData.booking_status === "Approved" || planData.booking_status === "Booked" ? (
                      <li>Unlink any associated liner bookings (they will be available for re-linking)</li>
                    ) : null}
                  </ul>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Reference:</span> {planData.reference_number || "N/A"}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Status:</span> {planData.booking_status || "N/A"}
                </p>
              </div>
              <p className="text-red-600 text-sm font-medium">
                ⚠️ This action cannot be undone.
              </p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCancelConfirmation(false)}
                disabled={isCancelling}
                className="px-4 py-2 border-gray-300 rounded-lg hover:bg-gray-100"
              >
                No, Keep Plan
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setIsCancelling(true);
                  // Create and submit a form programmatically
                  const form = document.createElement('form');
                  form.method = 'POST';
                  form.style.display = 'none';
                  const input = document.createElement('input');
                  input.type = 'hidden';
                  input.name = 'cancel_shipment_plan';
                  input.value = 'true';
                  form.appendChild(input);
                  document.body.appendChild(form);
                  form.submit();
                }}
                disabled={isCancelling}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {isCancelling ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </div>
                ) : (
                  <span>Yes, Delete Plan</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
