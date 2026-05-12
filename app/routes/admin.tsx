import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Form, useActionData } from "react-router";
import React, { useState, useEffect } from "react";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { AdminLayout } from "~/components/AdminLayout";
import { redirect } from "react-router";
import bcryptjs from "bcryptjs";

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

    // Get all users with their roles and business branches
    const users = await prisma.user.findMany({
      include: {
        role: true,
        businessBranch: true
      },
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

    if (action === "createUser") {
      const email = formData.get("email") as string;
      const name = formData.get("name") as string;
      const newRoleId = formData.get("newRoleId") as string;
      const password = formData.get("password") as string;
      const branchIdNew = formData.get("newBranchId") as string;

      // Validate inputs
      if (!email || !name || !newRoleId || !password) {
        return { error: "All fields are required" };
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return { error: "User with this email already exists" };
      }

      // Hash password
      const passwordHash = await bcryptjs.hash(password, 10);

      // Create user
      await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          roleId: newRoleId,
          branchId: branchIdNew || null,
          isActive: true,
        },
      });

      return { success: "User created successfully" };
    }

    if (action === "changePassword") {
      const newPassword = formData.get("newPassword") as string;
      const confirmPassword = formData.get("confirmPassword") as string;

      if (!newPassword || !confirmPassword) {
        return { error: "Password fields are required" };
      }

      if (newPassword !== confirmPassword) {
        return { error: "Passwords do not match" };
      }

      if (newPassword.length < 6) {
        return { error: "Password must be at least 6 characters" };
      }

      const passwordHash = await bcryptjs.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      return { success: "Password changed successfully" };
    }

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

    if (action === "deleteUser" && userId) {
      // Prevent deleting the current user
      if (user.id === userId) {
        return { error: "Cannot delete your own user account" };
      }

      // Get user info before deletion for success message
      const userToDelete = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });

      if (!userToDelete) {
        return { error: "User not found" };
      }

      // Delete the user
      await prisma.user.delete({
        where: { id: userId },
      });

      return { success: `User ${userToDelete.name} (${userToDelete.email}) has been permanently deleted` };
    }

    return { error: "Invalid action" };
  } catch (error) {
    console.error("Action error:", error);
    return { error: "Failed to process request" };
  }
}

export default function AdminPanel() {
  const { user, users, roles, businessBranches } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<string | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<string | null>(null);

  // Close modals on successful action
  useEffect(() => {
    if (actionData?.success) {
      if (showAddUserModal) {
        setShowAddUserModal(false);
      }
      if (showChangePasswordModal) {
        setShowChangePasswordModal(null);
      }
      if (deleteConfirmModal) {
        setDeleteConfirmModal(null);
      }
    }
  }, [actionData?.success]);

  async function handleExportXlsx() {
    try {
      setDownloadError(null);
      setDownloadingXlsx(true);
      const res = await fetch("/api/export-xlsx", { method: "POST" });
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || `shipment-plans-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setDownloadError(err?.message || "Export failed");
    } finally {
      setDownloadingXlsx(false);
    }
  }

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
        <div className="px-6 py-3">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
              <p className="text-sm text-gray-600 mt-1">Manage user accounts, roles, and activation status</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleExportXlsx} disabled={downloadingXlsx}>
                {downloadingXlsx ? "Exporting…" : "Export Shipments (XLSX)"}
              </Button>
              <Form method="post" action="/api/export-csv">
                <Button type="submit" variant="outline">Export Shipments (CSV)</Button>
              </Form>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white">
        {actionData?.success && (
          <div className="m-4 shrink-0 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {actionData.success}
          </div>
        )}

        {actionData?.error && (
          <div className="m-4 shrink-0 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {actionData.error}
          </div>
        )}

        {downloadError && (
          <div className="m-4 shrink-0 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {downloadError}
          </div>
        )}

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
          <div className="px-4 py-3 border-b border-gray-200 shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Users</h3>
                <p className="text-sm text-gray-500">
                  Manage user accounts, roles, and activation status
                </p>
              </div>
              <Button onClick={() => setShowAddUserModal(true)} className="bg-green-600 hover:bg-green-700">
                ➕ Add New User
              </Button>
            </div>
          </div>
          <div className="overflow-x-scroll overflow-y-auto flex-1 min-h-0 custom-scrollbar pb-2">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 z-30 bg-gray-50 shadow-[2px_0_5px_-1px_rgba(0,0,0,0.1)]">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Branch
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
                    <tr key={userRecord.id} className="hover:bg-gray-50 transition-colors duration-150 group">
                      <td className="px-6 py-4 whitespace-nowrap sticky left-0 z-20 bg-white group-hover:bg-gray-50 shadow-[2px_0_5px_-1px_rgba(0,0,0,0.1)] transition-colors duration-150">
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
                        {userRecord.businessBranch ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {userRecord.businessBranch.name.replace(/_/g, ' ')}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">No branch assigned</span>
                        )}
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
                                {(userRecord.role.name != "ADMIN") && (userRecord.role.name != "MD") && (
                                  <>
                                      <Form method="post" className="inline-block">
                                      <input type="hidden" name="action" value="updateBranch" />
                                      <input type="hidden" name="userId" value={userRecord.id} />
                                      <select
                                        name="branchId"
                                        className="text-xs border rounded px-2 py-1"
                                        defaultValue={userRecord.branchId || ""}
                                      >
                                        <option value="" disabled>Select a branch...</option>
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

                                {/* Change Password Button */}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setShowChangePasswordModal(userRecord.id)}
                                  className="ml-1"
                                >
                                  🔑 Change Password
                                </Button>

                                {/* Delete User Button */}
                                {user.id !== userRecord.id && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setDeleteConfirmModal(userRecord.id)}
                                    className="ml-1"
                                  >
                                    🗑️ Delete
                                  </Button>
                                )}
                          </td>

                      </>
                      )}

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        {/* Add User Modal */}
        {showAddUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <span className="mr-2">➕</span>
                  Add New User
                </h3>
              </div>
              <Form method="post" className="p-6 space-y-4">
                <input type="hidden" name="action" value="createUser" />
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="user@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newRoleId">Role *</Label>
                  <select
                    id="newRoleId"
                    name="newRoleId"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Select a role...</option>
                    {roles.map((role: any) => (
                      <option key={role.id} value={role.id}>
                        {role.name.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newBranchId">Business Branch</Label>
                  <select
                    id="newBranchId"
                    name="newBranchId"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">No branch assignment</option>
                    {businessBranches.map((branch: any) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                  <p className="text-xs text-gray-500">Minimum 6 characters</p>
                </div>

                {actionData?.error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                    {actionData.error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddUserModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Create User
                  </Button>
                </div>
              </Form>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {showChangePasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <span className="mr-2">🔑</span>
                  Change Password
                </h3>
              </div>
              <Form method="post" className="p-6 space-y-4">
                <input type="hidden" name="action" value="changePassword" />
                <input type="hidden" name="userId" value={showChangePasswordModal} />
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password *</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                  <p className="text-xs text-gray-500">Minimum 6 characters</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {actionData?.error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                    {actionData.error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowChangePasswordModal(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Update Password
                  </Button>
                </div>
              </Form>
            </div>
          </div>
        )}

        {/* Delete User Confirmation Modal */}
        {deleteConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <span className="mr-2">⚠️</span>
                  Delete User
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-700">
                  Are you sure you want to permanently delete this user? This action cannot be undone.
                </p>
                <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded">
                  User ID: {deleteConfirmModal}
                </p>

                {actionData?.error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                    {actionData.error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDeleteConfirmModal(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Form method="post" className="flex-1">
                    <input type="hidden" name="action" value="deleteUser" />
                    <input type="hidden" name="userId" value={deleteConfirmModal} />
                    <Button
                      type="submit"
                      variant="destructive"
                      className="w-full"
                    >
                      Delete Permanently
                    </Button>
                  </Form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
