import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useActionData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { redirect } from "react-router";
import { AdminLayout } from "~/components/AdminLayout";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);

    // Only allow ADMIN users
    if (user.role.name !== "ADMIN") {
      return redirect("/dashboard");
    }

    // Get all MD users
    const mdUsers = await prisma.user.findMany({
      where: {
        role: {
          name: "MD",
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        role: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return json({
      user,
      mdUsers,
    });
  } catch (error) {
    return redirect("/login");
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request);

    // Only allow ADMIN users
    if (user.role.name !== "ADMIN") {
      return json({ error: "Unauthorized" }, { status: 403 });
    }

    const formData = await request.formData();
    const userId = formData.get("userId") as string;
    const newEmail = formData.get("email") as string;

    if (!userId || !newEmail) {
      return json({ error: "User ID and email are required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return json({ error: "Invalid email format" }, { status: 400 });
    }

    // Check if user exists and is MD
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!existingUser) {
      return json({ error: "User not found" }, { status: 404 });
    }

    if (existingUser.role.name !== "MD") {
      return json({ error: "Can only update MD user emails" }, { status: 400 });
    }

    // Update the email
    await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail },
    });

    return json({
      success: `Email updated successfully for ${existingUser.name}`,
      updatedUser: {
        name: existingUser.name,
        oldEmail: existingUser.email,
        newEmail: newEmail,
      },
    });
  } catch (error) {
    console.error("Email update error:", error);
    return json({ error: "Failed to update email" }, { status: 500 });
  }
}

export default function EmailSettings() {
  const { user, mdUsers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <AdminLayout user={user}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Email Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage email addresses for MD approval notifications
          </p>
        </div>

        {/* Action Messages */}
        {actionData?.success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800">{actionData.success}</p>
            {actionData.updatedUser && (
              <p className="text-sm text-green-700 mt-2">
                Changed from: {actionData.updatedUser.oldEmail} → {actionData.updatedUser.newEmail}
              </p>
            )}
          </div>
        )}
        {actionData?.error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{actionData.error}</p>
          </div>
        )}

        {/* Email Configuration Info */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">📧 Email Notification Flow</h2>
            <div className="space-y-3">
              <div>
                <strong>From:</strong> Your SMTP email (configured in .env file)
              </div>
              <div>
                <strong>To:</strong> All active MD users listed below
              </div>
              <div>
                <strong>When:</strong>
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>Immediately when new shipment plans need approval</li>
                  <li>Daily at 12:00 PM IST if there are pending approvals</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MD Users List */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              Managing Director Users ({mdUsers.length})
            </h2>

            {mdUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No MD users found.</p>
                <p className="text-sm mt-2">Emails will not be sent until MD users exist.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {mdUsers.map((mdUser) => (
                  <div key={mdUser.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{mdUser.name}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge
                            className={mdUser.isActive
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-red-100 text-red-800 border-red-200"
                            }
                          >
                            {mdUser.isActive ? "✅ Active" : "❌ Inactive"}
                          </Badge>
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                            {mdUser.role.name}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <Form method="post" className="flex items-end space-x-3">
                      <input type="hidden" name="userId" value={mdUser.id} />
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address (where notifications will be sent)
                        </label>
                        <Input
                          name="email"
                          type="email"
                          defaultValue={mdUser.email}
                          placeholder="Enter email address"
                          required
                        />
                      </div>
                      <Button type="submit" size="sm">
                        Update Email
                      </Button>
                    </Form>

                    {!mdUser.isActive && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-sm text-yellow-800">
                          ⚠️ This user is inactive and will not receive email notifications.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Info */}
        <Card className="mt-6">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2">💡 Quick Info</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Only <strong>active MD users</strong> receive email notifications</li>
              <li>• Email changes take effect immediately</li>
              <li>• You can test emails using the API: <code>/api/test-email</code></li>
              <li>• Configure sender email in your .env file</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}