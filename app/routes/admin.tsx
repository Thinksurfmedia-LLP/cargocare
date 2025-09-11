import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Form, useActionData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { AdminLayout } from "~/components/AdminLayout";
import { redirect } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Admin Panel - Cargo Care" },
    { name: "description", content: "User Management" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    // Check if user is admin
    if (user.role.name !== "ADMIN" && user.role.name !== "MD") {
      throw new Response("Forbidden", { status: 403 });
    }

    // Get all users with their roles
    const users = await prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: "desc" },
    });

    const roles = await prisma.role.findMany({
      orderBy: { name: "asc" },
    });
    //const roles = sortedRoles.sort((a, b) => a.name.localeCompare(b.name));

    const businessBranches = await prisma.businessBranch.findMany({ 
      orderBy: { name: "asc" } 
    });

    return { user, users, roles, businessBranches };
  } catch {
    return redirect("/login");
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    if (user.role.name !== "ADMIN") {
      throw new Response("Forbidden", { status: 403 });
    }

    const formData = await request.formData();
    const action = formData.get("action") as string;
    const userId = formData.get("userId") as string;
    const roleId = formData.get("roleId") as string;
    const branchId = formData.get("branchId") as string;

    if (action === "updateRole" && userId && roleId) {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          roleId,
          isActive: true, // Activate user when changing role
        },
      });
      return { success: "User role updated successfully" };
    }

    if (action === "updateBranch" && userId && branchId) {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          branchId,
          isActive: true, // Activate user when changing role
        },
      });
      
      return { success: "User branch updated successfully" };
    }

    if (action === "toggleActive" && userId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { isActive: !targetUser?.isActive },
      });

      return { success: `User ${targetUser?.isActive ? "deactivated" : "activated"} successfully` };
    }

    return { error: "Invalid action" };
  } catch (error) {
    return { error: "Failed to update user" };
  }
}

export default function AdminPanel() {
  const { user, users, roles, businessBranches } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const getRoleColor = (roleName: string) => {
    switch (roleName) {
      case "ADMIN":
        return "bg-red-100 text-red-800";
      case "LINER_BOOKING_TEAM":
        return "bg-blue-100 text-blue-800";
      case "SHIPMENT_PLAN_TEAM":
        return "bg-green-100 text-green-800";
      case "INACTIVE":
        return "bg-gray-100 text-gray-800";
      case "MD":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <AdminLayout user={user}>
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
              <p className="text-sm text-gray-600 mt-1">Manage user accounts, roles, and activation status</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        {actionData?.success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {actionData.success}
          </div>
        )}

        {actionData?.error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {actionData.error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Manage user accounts, roles, and activation status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    {user.role.name != "MD" && (
                      <> 
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role Update
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Branch Update
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((userRecord: any) => (
                    <tr key={userRecord.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {userRecord.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {userRecord.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(userRecord.role.name)}`}>
                          {userRecord.role.name.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          userRecord.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {userRecord.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(userRecord.createdAt).toLocaleDateString()}
                      </td>


                      {user.role.name != "MD" && (
                            <>
                            
                          <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
      
                                {/* Role Update Form */}
                                <Form method="post" className="inline-block">
                                  <input type="hidden" name="action" value="updateRole" />
                                  <input type="hidden" name="userId" value={userRecord.id} />
                                  <select 
                                    name="roleId" 
                                    className="text-xs border rounded px-2 py-1"
                                    defaultValue={userRecord.roleId}
                                  >
                                    {roles.map((role: any) => (
                                      <option key={role.id} value={role.id}>
                                        {role.name.replace(/_/g, ' ')}
                                      </option>
                                    ))}
                                  </select>
                                  <Button type="submit" size="sm" variant="outline" className="ml-1">
                                    Update
                                  </Button>
                                </Form>

                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">

                                {/* Branch Update Form */}
                                {(userRecord.role.name != "ADMIN") && (userRecord.role.name != "MD") && (userRecord.role.name != "SHIPMENT_PLAN_TEAM") && (
                                  <>
                                      <Form method="post" className="inline-block">
                                      <input type="hidden" name="action" value="updateBranch" />
                                      <input type="hidden" name="userId" value={userRecord.id} />
                                      <select 
                                        name="branchId" 
                                        className="text-xs border rounded px-2 py-1"
                                        defaultValue={userRecord.branchId}
                                      >
                                        {businessBranches.map((branch: any) => (
                                          <option key={branch.id} value={branch.id}>
                                            {branch.name.replace(/_/g, ' ')}
                                          </option>
                                        ))}
                                      </select>
                                      <Button type="submit" size="sm" variant="outline" className="ml-1">
                                        Update
                                      </Button>
                                    </Form>
                                  </>
                              )}
                            

                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
      
                                {/* Toggle Active Form */}
                                <Form method="post" className="inline-block">
                                  <input type="hidden" name="action" value="toggleActive" />
                                  <input type="hidden" name="userId" value={userRecord.id} />
                                  <Button 
                                    type="submit" 
                                    size="sm" 
                                    variant={userRecord.isActive ? "destructive" : "default"}
                                  >
                                    {userRecord.isActive ? "Deactivate" : "Activate"}
                                  </Button>
                                </Form>                               
                          </td>

                      </>
                      )}

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {users.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No users found.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
