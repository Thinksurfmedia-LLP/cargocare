import type { LoaderFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import type { ExportFilterOptions } from "~/lib/export-filters";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

// Fixed value sets with no backing table - kept in sync by convention across the
// route handlers that assign them (no shared enum exists in the codebase).
const SHIPMENT_TYPES = ["Direct", "Consolidation"];
const STATUSES = [
  "Draft",
  "Awaiting MD Approval",
  "MD Approval Rejected",
  "Awaiting Booking",
  "Approved by MD for Booking",
  "Booked",
  "Partially Unmapped",
  "Partial Unmapping Requested",
  "Unmapping Requested",
  "Unmapping Approval",
  "Ready for Re-linking",
  "Completed",
  "Cancelled",
];

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    if (user.role.name !== "ADMIN") {
      return json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const [businessBranches, destinationCountries, organizations, users, linerBookingTeamUsers] = await Promise.all([
      prisma.businessBranch.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
      prisma.destinationCountry.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
      prisma.organization.findMany({ select: { name: true, orgTypes: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({
        where: { role: { name: "LINER_BOOKING_TEAM" } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const customers = organizations.filter((org) => org.orgTypes.includes("Customer")).map((org) => org.name);
    const shippers = organizations.filter((org) => org.orgTypes.includes("Shipper")).map((org) => org.name);

    const options: ExportFilterOptions = {
      businessBranches: businessBranches.map((b) => b.name),
      destinationCountries: destinationCountries.map((c) => c.name),
      customers,
      shippers,
      salesPersons: users.map((u) => ({ id: u.id, name: u.name })),
      // "Assigned To" = the LINER_BOOKING_TEAM member a booking/plan's work is assigned to (assignBookingId).
      assignedToUsers: linerBookingTeamUsers.map((u) => ({ id: u.id, name: u.name })),
      shipmentTypes: SHIPMENT_TYPES,
      statuses: STATUSES,
    };
    return json(options);
  } catch (error) {
    console.error("Export filter options error:", error);
    return json({ error: "Failed to load filter options" }, { status: 500 });
  }
}
