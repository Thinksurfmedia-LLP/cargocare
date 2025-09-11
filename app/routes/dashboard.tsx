import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Form, Link, redirect } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

export const meta: MetaFunction = () => {
  return [
    { title: "Dashboard - Cargo Care" },
    { name: "description", content: "Cargo Care Dashboard" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    // Redirect SHIPMENT_PLAN_TEAM users directly to shipment plans
    if (user.role.name === "SHIPMENT_PLAN_TEAM") {
      return redirect("/shipment-plans");
    }
    
    // Redirect LINER_BOOKING_TEAM users directly to liner bookings
    if (user.role.name === "LINER_BOOKING_TEAM") {
      return redirect("/liner-bookings");
    }
    
    // Redirect ADMIN users to shipment plans as default
    if (user.role.name === "ADMIN") {
      return redirect("/shipment-plans");
    }

    if (user.role.name === "MD") {
      return redirect("/pending-approvals");
    }
    
    return { user };
  } catch {
    return redirect("/login");
  }
}

export default function Dashboard() {
  const { user } = useLoaderData<typeof loader>();

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
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleDescription = (roleName: string) => {
    switch (roleName) {
      case "ADMIN":
        return "Full system access and user management";
      case "LINER_BOOKING_TEAM":
        return "Manage liner bookings and schedules";
      case "SHIPMENT_PLAN_TEAM":
        return "Handle shipment planning and logistics";
      case "INACTIVE":
        return "Account pending activation";
      default:
        return "Unknown role";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Cargo Care Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {user.name}
              </span>
              <Form method="post" action="/logout">
                <Button type="submit" variant="outline" size="sm">
                  Logout
                </Button>
              </Form>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* User Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>User Information</CardTitle>
                <CardDescription>Your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <p className="text-sm text-gray-900">{user.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-sm text-gray-900">{user.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Role</label>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role.name)}`}>
                      {user.role.name.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {getRoleDescription(user.role.name)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions Card */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {user.role.name === "ADMIN" && (
                  <>
                    <Button className="w-full" variant="outline">
                      <Link to="/admin" className="w-full">
                        Manage Users
                      </Link>
                    </Button>
                    <Button className="w-full" variant="outline">
                      <Link to="/shipment-plans" className="w-full">
                        Shipment Plans
                      </Link>
                    </Button>
                    <Button className="w-full" variant="outline">
                      <Link to="/liner-bookings" className="w-full">
                        Liner Bookings
                      </Link>
                    </Button>
                  </>
                )}
                {user.role.name === "LINER_BOOKING_TEAM" && (
                  <>
                    <Button className="w-full" variant="outline">
                      <Link to="/liner-bookings/new" className="w-full">
                        New Booking
                      </Link>
                    </Button>
                    <Button className="w-full" variant="outline">
                      <Link to="/liner-bookings" className="w-full">
                        View Bookings
                      </Link>
                    </Button>
                  </>
                )}
                {user.role.name === "SHIPMENT_PLAN_TEAM" && (
                  <>
                    <Button className="w-full" variant="outline">
                      <Link to="/shipment-plans" className="w-full">
                        Manage Shipment Plans
                      </Link>
                    </Button>
                    <Button className="w-full" variant="outline">
                      Track Cargo
                    </Button>
                  </>
                )}
                {user.role.name === "INACTIVE" && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">
                      Your account is pending activation. Please contact an administrator.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Current system information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Online
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Version</span>
                  <span className="text-sm text-gray-900">v1.0.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Environment</span>
                  <span className="text-sm text-gray-900">Development</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Role-specific content */}
          {user.role.name !== "INACTIVE" && (
            <Card>
              <CardHeader>
                <CardTitle>Welcome to Cargo Care</CardTitle>
                <CardDescription>
                  Your comprehensive cargo management solution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Based on your role as <strong>{user.role.name.replace(/_/g, ' ')}</strong>, 
                  you have access to specific features and capabilities within the system.
                </p>
                
                {user.role.name === "ADMIN" && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Admin Capabilities:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      <li>Manage user accounts and permissions</li>
                      <li>Configure system settings</li>
                      <li>View all bookings and shipments</li>
                      <li>Generate reports and analytics</li>
                      <li>Activate/deactivate user accounts</li>
                    </ul>
                  </div>
                )}

                {user.role.name === "LINER_BOOKING_TEAM" && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Booking Team Capabilities:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      <li>Create and manage liner bookings</li>
                      <li>View shipping schedules</li>
                      <li>Coordinate with customers</li>
                      <li>Track booking status</li>
                    </ul>
                  </div>
                )}

                {user.role.name === "SHIPMENT_PLAN_TEAM" && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Shipment Planning Capabilities:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      <li>Plan and optimize shipment routes</li>
                      <li>Manage cargo allocation</li>
                      <li>Track shipment progress</li>
                      <li>Coordinate logistics operations</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
