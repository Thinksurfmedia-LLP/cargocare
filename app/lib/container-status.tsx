// Shared real-time container status + multi-shipper helpers.
// Single source of truth for both the Shipment Plans and Shipment Assignments list pages —
// both derive status from `equipment_details[]` booleans, never from the stale
// `container_tracking.container_current_status` form field.

export interface EquipmentDetail {
  trackingNumber?: string;
  equipment_type?: string;
  emptyPickupStatus?: boolean;
  emptyPickupDate?: string | null;
  stuffingStatus?: boolean;
  stuffingDate?: string | null;
  gateInStatus?: boolean;
  gateInDate?: string | null;
  loadedStatus?: boolean;
  loadedDate?: string | null;
  [key: string]: unknown;
}

interface LinerBookingDetail {
  trackingNumber?: string;
  booking_for?: string;
  liner_booking_number?: string;
  [key: string]: unknown;
}

interface PlanLike {
  data?: {
    equipment_details?: EquipmentDetail[];
    booking_status?: string;
    [key: string]: unknown;
  };
  linerBooking?: { data?: { liner_booking_details?: LinerBookingDetail[] } };
  shipmentAssignment?: { data?: { liner_booking_details?: LinerBookingDetail[] } };
  [key: string]: unknown;
}

// Aggregate plan-wide milestone status from equipment details.
export function getMilestoneStatus(plan: PlanLike): string {
  const equipmentDetails = plan.data?.equipment_details || [];
  if (equipmentDetails.length === 0) return "No Equipment";

  let emptyPickupCompleted = 0;
  let stuffingCompleted = 0;
  let gateInCompleted = 0;
  let loadedCompleted = 0;
  const totalEquipments = equipmentDetails.length;

  equipmentDetails.forEach((equipment) => {
    if (equipment.emptyPickupStatus && equipment.emptyPickupDate) emptyPickupCompleted++;
    if (equipment.stuffingStatus && equipment.stuffingDate) stuffingCompleted++;
    if (equipment.gateInStatus && equipment.gateInDate) gateInCompleted++;
    if (equipment.loadedStatus && equipment.loadedDate) loadedCompleted++;
  });

  if (loadedCompleted === totalEquipments) return "Loaded on Vessel";
  if (stuffingCompleted === totalEquipments) return "Container Stuffing Completed";
  if (gateInCompleted === totalEquipments) return "Gate In Completed";
  if (emptyPickupCompleted === totalEquipments) return "Empty Container Picked Up";
  if (loadedCompleted > 0) return `Loaded: ${loadedCompleted}/${totalEquipments}`;
  if (stuffingCompleted > 0) return `Stuffing: ${stuffingCompleted}/${totalEquipments}`;
  if (gateInCompleted > 0) return `Gate In: ${gateInCompleted}/${totalEquipments}`;
  if (emptyPickupCompleted > 0) return `Empty Pickup: ${emptyPickupCompleted}/${totalEquipments}`;
  return "Pending";
}

const MILESTONE_BADGE_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; icon: string }
> = {
  "Loaded on Vessel": { color: "text-green-800", bg: "bg-green-100", border: "border-green-300", icon: "🚢" },
  "Gate In Completed": { color: "text-blue-800", bg: "bg-blue-100", border: "border-blue-300", icon: "🚪" },
  "Container Stuffing Completed": { color: "text-purple-800", bg: "bg-purple-100", border: "border-purple-300", icon: "📦" },
  "Empty Container Picked Up": { color: "text-yellow-800", bg: "bg-yellow-100", border: "border-yellow-300", icon: "🚛" },
  "Pending": { color: "text-gray-600", bg: "bg-gray-100", border: "border-gray-300", icon: "⏳" },
  "No Equipment": { color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", icon: "❌" },
};

export function getMilestoneStatusBadge(status: string) {
  let config = MILESTONE_BADGE_CONFIG[status];
  if (!config) {
    if (status.includes("Empty Pickup:")) {
      config = { color: "text-orange-800", bg: "bg-orange-100", border: "border-orange-300", icon: "🚛" };
    } else if (status.includes("Stuffing:")) {
      config = { color: "text-purple-800", bg: "bg-purple-100", border: "border-purple-300", icon: "📦" };
    } else if (status.includes("Gate In:")) {
      config = { color: "text-blue-800", bg: "bg-blue-100", border: "border-blue-300", icon: "🚪" };
    } else if (status.includes("Loaded:")) {
      config = { color: "text-green-800", bg: "bg-green-100", border: "border-green-300", icon: "🚢" };
    } else {
      config = MILESTONE_BADGE_CONFIG["Pending"];
    }
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.color} border ${config.border}`}
    >
      <span className="mr-1">{config.icon}</span>
      {status}
    </span>
  );
}

// Extract the tracking number a liner booking detail refers to
// (handles both the direct `trackingNumber` field and the legacy "equipmentType|trackingNumber" format)
export function getDetailTrackingNumber(detail: LinerBookingDetail | null | undefined): string | null {
  if (!detail) return null;
  if (detail.trackingNumber) return detail.trackingNumber;
  if (typeof detail.booking_for === "string" && detail.booking_for.includes("|")) {
    return detail.booking_for.split("|")[1] || null;
  }
  return null;
}

// Find the Liner Booking Number allocated to a specific piece of equipment
export function getEquipmentLinerBookingNumber(plan: PlanLike, equipment: EquipmentDetail): string | null {
  const trackingNumber = equipment?.trackingNumber;
  if (!trackingNumber) return null;

  const detailSources: LinerBookingDetail[] = [
    ...(Array.isArray(plan?.linerBooking?.data?.liner_booking_details)
      ? plan.linerBooking!.data!.liner_booking_details!
      : []),
    ...(Array.isArray(plan?.shipmentAssignment?.data?.liner_booking_details)
      ? plan.shipmentAssignment!.data!.liner_booking_details!
      : []),
  ];

  const match = detailSources.find((detail) => getDetailTrackingNumber(detail) === trackingNumber);
  return match?.liner_booking_number || null;
}

// Determine the milestone status for a single piece of equipment (not the plan-wide aggregate)
export function getEquipmentStatusLabel(equipment: EquipmentDetail): string {
  if (equipment?.loadedStatus && equipment?.loadedDate) return "Loaded on Vessel";
  if (equipment?.stuffingStatus && equipment?.stuffingDate) return "Container Stuffing Completed";
  if (equipment?.gateInStatus && equipment?.gateInDate) return "Gate In Completed";
  if (equipment?.emptyPickupStatus && equipment?.emptyPickupDate) return "Empty Container Picked Up";
  return "Pending";
}

export const equipmentStatusDotColor: Record<string, string> = {
  "Loaded on Vessel": "bg-green-500",
  "Container Stuffing Completed": "bg-purple-500",
  "Gate In Completed": "bg-blue-500",
  "Empty Container Picked Up": "bg-yellow-500",
  Pending: "bg-gray-400",
};

// Render the real-time per-container status list (booked plans) or the plan-wide aggregate badge.
export function renderContainerStatusCell(plan: PlanLike) {
  const equipmentDetails = Array.isArray(plan.data?.equipment_details) ? plan.data!.equipment_details! : [];
  const isBooked = plan.data?.booking_status === "Booked";

  if (isBooked && equipmentDetails.length > 0) {
    return (
      <div className="flex flex-col gap-1 max-h-28 overflow-y-auto min-w-[220px] py-1">
        {equipmentDetails.map((equipment, idx) => {
          const lbn = getEquipmentLinerBookingNumber(plan, equipment) || equipment.trackingNumber || `Container ${idx + 1}`;
          const label = getEquipmentStatusLabel(equipment);
          return (
            <div key={idx} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${equipmentStatusDotColor[label] || "bg-gray-400"}`} />
              <span className="font-semibold text-gray-800">{lbn}</span>
              <span className="text-gray-400">-</span>
              <span className="text-gray-600">{label}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return getMilestoneStatusBadge(getMilestoneStatus(plan));
}

// Extract every non-empty shipper name from a shipment's package details (consolidated entries have several).
export function getShippers(packageDetails: unknown): string[] {
  const list = Array.isArray(packageDetails) ? packageDetails : [];
  return list
    .map((pkg: any) => pkg?.shipper)
    .filter((shipper: any): shipper is string => typeof shipper === "string" && shipper.trim() !== "");
}

// Render the shipper cell contents: a bulleted list for consolidated (multi-shipper) entries, plain text otherwise.
export function renderShipperCell(packageDetails: unknown) {
  const shippers = getShippers(packageDetails);

  if (shippers.length > 1) {
    return (
      <div className="flex flex-col gap-1 max-h-28 overflow-y-auto min-w-[160px] py-1">
        {shippers.map((shipper, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-blue-500" />
            <span className="text-gray-700">{shipper}</span>
          </div>
        ))}
      </div>
    );
  }

  return shippers[0] || "N/A";
}
