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
  Link,
} from "react-router";
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
            userId: planData.liner_broker_approval ? planData.liner_broker_approval : user.id,
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
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
            <p className="text-sm text-gray-600 mt-1">
              Review and approve shipment plans awaiting your approval
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              {pagination.totalCount} pending approvals
            </Badge>
          </div>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <Form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <Input
                  name="search"
                  placeholder="Search by reference, business branch, customer, or created by..."
                  defaultValue={search}
                />
              </div>
              <Button type="submit">Search</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newSearchParams = new URLSearchParams();
                  newSearchParams.set("page", "1");
                  navigate(`?${newSearchParams.toString()}`);
                }}
              >
                Clear
              </Button>
            </Form>
          </CardContent>
        </Card>

        {/* Action Messages */}
        {actionData?.success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800">{actionData.success}</p>
          </div>
        )}
        {actionData?.error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{actionData.error}</p>
          </div>
        )}

        {/* Shipment Plans Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Customer</TableHead>
                    <TableHead className="w-36">Business Branch</TableHead>
                    <TableHead className="w-52">Equipment Details</TableHead>
                    <TableHead className="w-32">Selling Price</TableHead>
                    <TableHead className="w-44">Shipper</TableHead>
                    <TableHead className="w-40">Loading Port</TableHead>
                    <TableHead className="w-44">Port of Discharge</TableHead>
                    <TableHead className="w-48">Final Place of Delivery</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipmentPlans.map((plan) => {
                    const planData = plan.data as any;
                    return (
                      <TableRow 
                        key={plan.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => navigate(`/shipment-plans/${plan.id}/edit`)}
                      >
                        <TableCell>
                          {planData.container_movement?.customer || "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-400">🏢</span>
                            <span className="font-medium text-gray-700">
                              {planData.bussiness_branch || "N/A"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {planData.equipment_details && planData.equipment_details.length > 0 ? (
                            <div className="space-y-1">
                              {(() => {
                                // Group equipment by type and count occurrences
                                const equipmentCounts = planData.equipment_details.reduce((acc: any, equipment: any) => {
                                  const type = equipment.equipment_type;
                                  if (type) {
                                    acc[type] = (acc[type] || 0) + 1;
                                  }
                                  return acc;
                                }, {});
                                
                                // Display each unique equipment type with count on the same line
                                return Object.entries(equipmentCounts).map(([type, count]: [string, any]) => (
                                  <div key={type} className="text-sm whitespace-nowrap">
                                    {type} x{count}
                                  </div>
                                ));
                              })()}
                            </div>
                          ) : "N/A"}
                        </TableCell>
                        <TableCell>
                          {planData.container_movement?.selling_price || "N/A"}
                        </TableCell>
                        <TableCell>
                          {planData.package_details?.[0]?.shipper || "N/A"}
                        </TableCell>
                        <TableCell>
                          {planData.container_movement?.loading_port || "N/A"}
                        </TableCell>
                        <TableCell>
                          {planData.container_movement?.port_of_discharge || "N/A"}
                        </TableCell>
                        <TableCell>
                          {planData.container_movement?.delivery_till || "N/A"}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                              onClick={() => {
                                const reason = prompt("Please provide a reason for rejection:");
                                if (reason?.trim()) {
                                  const form = document.createElement('form');
                                  form.method = 'post';
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
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        {search ? "No shipment plans found matching your search." : "No pending approvals found."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{" "}
              {pagination.totalCount} results
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
    </AdminLayout>
  );
}