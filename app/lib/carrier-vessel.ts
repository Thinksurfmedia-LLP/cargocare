/**
 * Carrier and vessel actually booked vs. the plan's preference.
 *
 * A shipment plan stores the planner's PREFERRED carrier/vessel. Once the liner booking team
 * books, the booking detail holds the REAL carrier/vessel, and it can be changed afterwards
 * (including the inline vessel edit on the plan). Screens and reports must show the booked
 * value when there is one and only fall back to the preference before booking, otherwise a
 * change made after booking never shows up.
 */

interface LinerBookingDetail {
  carrier?: unknown
  original_planned_vessel?: unknown
}

interface PlanDataLike {
  container_movement?: {
    carrier_and_vessel_preference?: { carrier?: unknown; vessel?: unknown } | null
  } | null
}

interface LinkedBookingDataLike {
  liner_booking_details?: LinerBookingDetail[] | null
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function getEffectiveCarrierVessel(
  planData: PlanDataLike | null | undefined,
  linkedBookingData: LinkedBookingDataLike | null | undefined,
): { carrier: string; vessel: string } {
  const details = Array.isArray(linkedBookingData?.liner_booking_details) ? linkedBookingData.liner_booking_details : []
  const preference = planData?.container_movement?.carrier_and_vessel_preference

  const bookedCarrier = details.map((d) => clean(d?.carrier)).find(Boolean)
  const bookedVessel = details.map((d) => clean(d?.original_planned_vessel)).find(Boolean)

  return {
    carrier: bookedCarrier || clean(preference?.carrier),
    vessel: bookedVessel || clean(preference?.vessel),
  }
}
