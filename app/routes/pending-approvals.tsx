import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from "react-router";
import {
  Form,
  useLoaderData,
  useNavigate,
  useActionData,
  useSearchParams,
} from "react-router";
import { useState } from "react";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { AdminLayout } from "~/components/AdminLayout";
import { redirect } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Pending Approvals - Cargo Care" },
    { name: "description", content: "Review shipment plans awaiting MD approval" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);

    // Only allow MD users to access this route
    if (user.role.name !== "MD") {
      return redirect("/dashboard");
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    let whereCondition: any = {
      data: {
        path: ["booking_status"],
        equals: "Awaiting MD Approval",
      },
    };

    // Search functionality - use raw SQL with ILIKE for case-insensitive search
    if (search) {
      try {
        // Get IDs that match search criteria with case-insensitive search
        const matchingIds = await prisma.$queryRaw`
          SELECT id FROM "shipment_plans" 
          WHERE data->>'booking_status' = 'Awaiting MD Approval'
          AND (
            data->>'reference_number' ILIKE ${`%${search}%`}
            OR data->>'bussiness_branch' ILIKE ${`%${search}%`}
            OR data->'container_movement'->>'customer' ILIKE ${`%${search}%`}
          )
        `;

        const ids = (matchingIds as any[]).map((row: any) => row.id);

        // Also search by user name (case-insensitive via Prisma)
        const userMatches = await prisma.shipmentPlan.findMany({
          where: {
            data: {
              path: ["booking_status"],
              equals: "Awaiting MD Approval",
            },
            user: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
          select: { id: true },
        });

        const userMatchIds = userMatches.map((m) => m.id);
        const allMatchingIds = [...new Set([...ids, ...userMatchIds])];

        if (allMatchingIds.length > 0) {
          whereCondition = {
            id: { in: allMatchingIds },
          };
        } else {
          // No matches found, return empty result
          whereCondition = {
            id: { in: [] },
          };
        }
      } catch (error) {
        console.error("Error in search:", error);
      }
    }

    const [shipmentPlans, totalCount] = await Promise.all([
      prisma.shipmentPlan.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: offset,
        take: limit,
      }),
      prisma.shipmentPlan.count({
        where: whereCondition,
      }),
    ]);

    return {
      user,
      shipmentPlans,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      search,
    };
  } catch (error) {
    return redirect("/login");
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request);

    // Only allow MD users
    if (user.role.name !== "MD") {
      return redirect("/dashboard");
    }

    const formData = await request.formData();
    const action = formData.get("action") as string;
    const id = formData.get("id") as string;

    if (action === "approve") {
      const existingPlan = await prisma.shipmentPlan.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          salesPerson: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      if (!existingPlan) {
        return { error: "Shipment plan not found" };
      }

      // Check if the plan is in "Awaiting MD Approval" status
      const planData = existingPlan.data as any;
      if (planData.booking_status !== "Awaiting MD Approval") {
        return {
          error: "Only plans with 'Awaiting MD Approval' status can be approved",
        };
      }

      // Update the status to "Awaiting Booking"
      const updatedData = {
        ...planData,
        booking_status: "Awaiting Booking",
        md_approval_status: "approved",
        md_approved_by: user.id,
        md_approved_at: new Date().toISOString(),
      };

      const linerBrokerId = planData.liner_broker_approval;

      // Update shipment plan and create liner booking in a transaction
      await prisma.$transaction(async (tx) => {
        // Create a new liner booking
        const linerBookingData = {
          carrier_booking_status: "Awaiting Booking",
          reference_number: planData.reference_number,
        };

        const linerBooking = await tx.linerBooking.create({
          data: {
            data: linerBookingData,
            userId: linerBrokerId ? linerBrokerId : user.id,
          },
        });

        // Update the shipment plan status and link it to the liner booking
        await tx.shipmentPlan.update({
          where: { id },
          data: {
            data: updatedData,
            linerBookingId: linerBooking.id,
          },
        });
      });

      // Send approval email notification to MD, Salesperson, and Liner Broker
      try {
        const { emailService } = await import("~/lib/email.server");
        const baseUrl = process.env.BASE_URL || "http://localhost:5173";

        const recipientEmails: string[] = [];

        // Add MD email (the current user who approved)
        recipientEmails.push(user.email);

        // Add salesperson email
        let salesPersonName = "Not Assigned";
        if (existingPlan.salesPerson) {
          salesPersonName = existingPlan.salesPerson.name;
          if (existingPlan.salesPerson.email && !recipientEmails.includes(existingPlan.salesPerson.email)) {
            recipientEmails.push(existingPlan.salesPerson.email);
          }
        }

        // Add liner broker email
        let linerBrokerName = "Not Assigned";
        if (linerBrokerId) {
          const linerBrokerUser = await prisma.user.findUnique({
            where: { id: linerBrokerId },
            select: { email: true, name: true }
          });
          if (linerBrokerUser?.email && !recipientEmails.includes(linerBrokerUser.email)) {
            recipientEmails.push(linerBrokerUser.email);
          }
          linerBrokerName = linerBrokerUser?.name || "Not Assigned";
        }

        // Format equipment
        const equipmentDetailsData = planData.equipment_details || [];
        const equipmentCounts = equipmentDetailsData.reduce((acc: any, eq: any) => {
          if (eq.equipment_type) {
            acc[eq.equipment_type] = (acc[eq.equipment_type] || 0) + 1;
          }
          return acc;
        }, {});
        const formattedEquipment = Object.entries(equipmentCounts)
          .map(([type, count]) => `${type} (${count} unit${(count as number) !== 1 ? 's' : ''})`)
          .join(", ") || "N/A";

        const containerMovement = planData.container_movement || {};

        await emailService.sendShipmentApprovedNotification(recipientEmails, {
          referenceNumber: planData.reference_number || "N/A",
          customer: containerMovement.customer || "N/A",
          businessBranch: planData.bussiness_branch || "N/A",
          approvedBy: user.name,
          salesPerson: salesPersonName,
          linerBroker: linerBrokerName,
          equipmentType: formattedEquipment,
          portOfLoading: containerMovement.loading_port || "N/A",
          portOfDischarge: containerMovement.port_of_discharge || "N/A",
          shipmentPlansUrl: `${baseUrl}/shipment-plans`,
        });

        console.log(`✅ Approval notification sent to ${recipientEmails.length} recipient(s): ${recipientEmails.join(', ')}`);
      } catch (emailError) {
        console.error("❌ Failed to send approval notification:", emailError);
      }

      return {
        success: "Shipment plan approved successfully",
      };
    }

    if (action === "reject") {
      const rejectionReason = formData.get("rejectionReason") as string;

      if (!rejectionReason?.trim()) {
        return { error: "Rejection reason is required" };
      }

      const existingPlan = await prisma.shipmentPlan.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      if (!existingPlan) {
        return { error: "Shipment plan not found" };
      }

      const planData = existingPlan.data as any;
      if (planData.booking_status !== "Awaiting MD Approval") {
        return {
          error: "Only plans with 'Awaiting MD Approval' status can be rejected",
        };
      }

      const updatedData = {
        ...planData,
        booking_status: "MD Approval Rejected",
        md_approval_status: "rejected",
        md_rejection_reason: rejectionReason,
        md_rejected_by: user.id,
        md_rejected_at: new Date().toISOString(),
      };

      await prisma.shipmentPlan.update({
        where: { id },
        data: {
          data: updatedData,
        },
      });

      // Send rejection email notification to MD and Shipment Plan Owner
      try {
        const { emailService } = await import("~/lib/email.server");
        const baseUrl = process.env.BASE_URL || "http://localhost:5173";

        const recipientEmails: string[] = [];

        // Add MD email (the current user who rejected)
        recipientEmails.push(user.email);

        // Add shipment plan creator (owner) email
        if (existingPlan.user?.email && !recipientEmails.includes(existingPlan.user.email)) {
          recipientEmails.push(existingPlan.user.email);
        }

        // Format equipment
        const equipmentDetailsData = planData.equipment_details || [];
        const equipmentCounts = equipmentDetailsData.reduce((acc: any, eq: any) => {
          if (eq.equipment_type) {
            acc[eq.equipment_type] = (acc[eq.equipment_type] || 0) + 1;
          }
          return acc;
        }, {});
        const formattedEquipment = Object.entries(equipmentCounts)
          .map(([type, count]) => `${type} (${count} unit${(count as number) !== 1 ? 's' : ''})`)
          .join(", ") || "N/A";

        const containerMovement = planData.container_movement || {};

        await emailService.sendShipmentRejectedNotification(recipientEmails, {
          referenceNumber: planData.reference_number || "N/A",
          customer: containerMovement.customer || "N/A",
          businessBranch: planData.bussiness_branch || "N/A",
          rejectedBy: user.name,
          rejectionReason: rejectionReason,
          createdBy: existingPlan.user?.name || "Unknown",
          equipmentType: formattedEquipment,
          portOfLoading: containerMovement.loading_port || "N/A",
          portOfDischarge: containerMovement.port_of_discharge || "N/A",
          shipmentPlansUrl: `${baseUrl}/shipment-plans`,
        });

        console.log(`✅ Rejection notification sent to ${recipientEmails.length} recipient(s): ${recipientEmails.join(', ')}`);
      } catch (emailError) {
        console.error("❌ Failed to send rejection notification:", emailError);
      }

      return {
        success: "Shipment plan rejected successfully",
      };
    }

    return { error: "Invalid action" };
  } catch (error) {
    console.error("Action error:", error);
    return { error: "An error occurred while processing your request" };
  }
}

export default function PendingApprovals() {
  const { user, shipmentPlans, pagination, search } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [hoveredShipper, setHoveredShipper] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { color: string; label: string } } = {
      "Awaiting MD Approval": {
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        label: "⏳ Awaiting MD Approval",
      },
    };

    const config = statusConfig[status] || {
      color: "bg-gray-100 text-gray-800 border-gray-200",
      label: status,
    };

    return (
      <Badge className={`${config.color} font-medium`}>
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchValue = formData.get("search") as string;
    
    const newSearchParams = new URLSearchParams(searchParams);
    if (searchValue.trim()) {
      newSearchParams.set("search", searchValue);
    } else {
      newSearchParams.delete("search");
    }
    newSearchParams.set("page", "1");
    
    navigate(`?${newSearchParams.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("page", newPage.toString());
    navigate(`?${newSearchParams.toString()}`);
  };

  return (
    <AdminLayout user={user}>
      <div className="flex-1 overflow-auto">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Pending Approvals</h1>
              <p className="text-sm text-gray-600 mt-1">
                Review and approve shipment plans awaiting your approval
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 px-4 py-2">
                {pagination.totalCount} pending approvals
              </Badge>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Action Messages */}
          {actionData?.success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 shadow-sm">
              <p className="font-medium">{actionData.success}</p>
            </div>
          )}
          {actionData?.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 shadow-sm">
              <p className="font-medium">{actionData.error}</p>
            </div>
          )}

          {/* Search */}
          <Card className="border-none shadow-sm bg-[#fff9e3]">
            <CardContent className="p-0">
              <div className="px-5 py-4 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                <Form onSubmit={handleSearch} className="flex-1 w-full">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400 text-sm">
                        🔍
                      </div>
                      <Input
                        name="search"
                        placeholder="Search by reference, business branch, customer, or created by..."
                        defaultValue={search}
                        className="pl-10 pr-4 py-3 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="submit"
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                      >
                        Search
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="px-6 py-3 border-gray-300 rounded-lg hover:bg-gray-50"
                        onClick={() => {
                          const newSearchParams = new URLSearchParams();
                          newSearchParams.set("page", "1");
                          navigate(`?${newSearchParams.toString()}`);
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  {search && (
                    <p className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">{pagination.totalCount}</span> results found for "{search}"
                    </p>
                  )}
                </Form>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    <span className="font-semibold">{pagination.totalCount}</span> total plans
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipment Plans Table */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-[#fffaf0]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg">
                    📦
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Shipment Plans</p>
                    <p className="text-lg font-semibold text-gray-900">Pending Approvals</p>
                  </div>
                </div>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 px-3 py-2">
                  {pagination.totalCount} waiting
                </Badge>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-visible">
              <Table>
                <TableHeader className="bg-[#fffaf0]">
                  <TableRow className="text-gray-600">
                    <TableHead className="w-44 font-semibold text-gray-800">Customer</TableHead>
                    <TableHead className="w-36 font-semibold text-gray-800">Business Branch</TableHead>
                    <TableHead className="w-32 font-semibold text-gray-800">Shipment Type</TableHead>
                    <TableHead className="w-52 font-semibold text-gray-800">Equipment Details</TableHead>
                    <TableHead className="w-32 font-semibold text-gray-800">Selling Price</TableHead>
                    <TableHead className="w-44 font-semibold text-gray-800">Shipper</TableHead>
                    <TableHead className="w-40 font-semibold text-gray-800">Loading Port</TableHead>
                    <TableHead className="w-44 font-semibold text-gray-800">Port of Discharge</TableHead>
                    <TableHead className="w-48 font-semibold text-gray-800">Final Place of Delivery</TableHead>
                    <TableHead className="w-28 font-semibold text-gray-800 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipmentPlans.map((plan) => {
                    const planData = plan.data as any;
                    const isConsolidation = (planData.shipment_type || "").toLowerCase().includes("consol");
                    const shippers = Array.isArray(planData.package_details)
                      ? planData.package_details
                          .map((pkg: any) => pkg?.shipper)
                          .filter((s: any): s is string => Boolean(s))
                      : [];
                    const uniqueShippers = Array.from(new Set(shippers));
                    const primaryShipper = uniqueShippers[0];
                    const extraShippers = uniqueShippers.length > 1 ? uniqueShippers.length - 1 : 0;
                    const shipperTooltip = uniqueShippers.length > 0 ? uniqueShippers.join(", ") : undefined;
                    return (
                      <TableRow
                        key={plan.id}
                        className="cursor-pointer transition-colors hover:bg-slate-50"
                        onClick={() => navigate(`/shipment-plans/${plan.id}/edit?returnTo=/pending-approvals`)}
                      >
                        <TableCell className="font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-blue-500">•</span>
                            <span>{planData.container_movement?.customer || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2 text-gray-700">
                            <span className="text-gray-400">🏢</span>
                            <span className="font-medium">{planData.bussiness_branch || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-700 font-medium">
                          <Badge className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-semibold">
                            {planData.shipment_type || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {planData.equipment_details && planData.equipment_details.length > 0 ? (
                            <div className="space-y-1 text-sm text-gray-700">
                              {(() => {
                                // Group equipment by type and count occurrences for a compact pill list
                                const equipmentCounts = planData.equipment_details.reduce((acc: any, equipment: any) => {
                                  const type = equipment.equipment_type;
                                  if (type) {
                                    acc[type] = (acc[type] || 0) + 1;
                                  }
                                  return acc;
                                }, {});

                                return Object.entries(equipmentCounts).map(([type, count]: [string, any]) => {
                                  const cleanType = typeof type === "string" ? type.replace(/\s*container$/i, "").trim() : type;

                                  return (
                                  <span
                                    key={type}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-gray-700 border border-slate-200 whitespace-nowrap"
                                  >
                                    <span className="text-xs">📦</span>
                                    <span className="text-xs font-semibold whitespace-nowrap">{count} x</span>
                                    <span className="whitespace-nowrap">{cleanType}</span>
                                  </span>
                                  );
                                });
                              })()}
                            </div>
                          ) : (
                            <span className="text-gray-500">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-800 font-medium">
                          {planData.container_movement?.selling_price || "N/A"}
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {isConsolidation && (primaryShipper || extraShippers) ? (
                            <div className="relative inline-block">
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-gray-700 border border-slate-200 text-sm font-medium cursor-help"
                                onMouseEnter={() => setHoveredShipper(plan.id)}
                                onMouseLeave={() => setHoveredShipper(null)}
                              >
                                <span>{primaryShipper || "Shipper"}</span>
                                {extraShippers > 0 && <span className="text-xs font-semibold">+{extraShippers}</span>}
                              </span>
                              {hoveredShipper === plan.id && uniqueShippers.length > 1 && (
                                <div className="absolute z-50 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px] left-0">
                                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">All Shippers</p>
                                  <div className="space-y-1">
                                    {uniqueShippers.map((shipper, idx) => (
                                      <div key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                                        <span className="text-blue-500 text-xs">•</span>
                                        <span>{shipper}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            planData.package_details?.[0]?.shipper || "N/A"
                          )}
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {planData.container_movement?.loading_port || "N/A"}
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {planData.container_movement?.port_of_discharge || "N/A"}
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {planData.container_movement?.delivery_till || "N/A"}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() => {
                                const reason = prompt("Please provide a reason for rejection:");
                                if (reason?.trim()) {
                                  const form = document.createElement("form");
                                  form.method = "post";
                                  form.innerHTML = `
                                    <input type="hidden" name="action" value="reject" />
                                    <input type="hidden" name="id" value="${plan.id}" />
                                    <input type="hidden" name="rejectionReason" value="${reason}" />
                                  `;
                                  document.body.appendChild(form);
                                  form.submit();
                                }
                              }}
                            >
                              ✗ Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {shipmentPlans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                        {search ? "No shipment plans found matching your search." : "No pending approvals found."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-gray-700">
              <div>
                Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Button
                      key={pageNum}
                      variant={pagination.page === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}