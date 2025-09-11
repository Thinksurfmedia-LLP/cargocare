import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { Form, useLoaderData, useNavigation, redirect, Link } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select } from "~/components/ui/select";
import { AdminLayout } from "~/components/AdminLayout";

export const meta: MetaFunction = () => {
  return [
    { title: "New Organization - Cargo Care" },
    { name: "description", content: "Create a new organization" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  
  if (user.role.name !== "ADMIN") {
    return redirect("/dashboard");
  }

  return { user };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  
  if (user.role.name !== "ADMIN") {
    return redirect("/dashboard");
  }
  const formData = await request.formData();
  const name = formData.get("name") as string;
  
  // Get all selected org types from checkboxes
  const orgTypes: string[] = [];
  const allOrgTypes = ["Shipper", "Customer", "Consignee", "Consolidators"];
  
  allOrgTypes.forEach(type => {
    if (formData.get(`orgTypes.${type}`) === "true") {
      orgTypes.push(type);
    }
  });

  if (!name || orgTypes.length === 0) {
    return Response.json({ error: "Name and at least one organization type are required" }, { status: 400 });
  }

  try {
    await prisma.organization.create({
      data: { name, orgTypes },
    });
    return redirect("/data-points/organizations");
  } catch (error) {
    console.error("Error creating organization:", error);
    return Response.json({ error: "Failed to create organization" }, { status: 500 });
  }
}

export default function NewOrganizationPage() {
  const { user } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AdminLayout user={user}>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">New Organization</h1>
                <p className="mt-1 text-sm text-gray-600">Add a new organization to the system</p>
              </div>
              <Link
                to="/data-points/organizations"
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ✕
              </Link>
            </div>
          </div>

          <Form method="post" className="px-6 py-6 space-y-6">
            <div>
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                className="mt-1"
                placeholder="Enter organization name"
              />
            </div>            <div>
              <Label>Organization Types</Label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="orgType-shipper"
                    name="orgTypes.Shipper"
                    value="true"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="orgType-shipper" className="ml-2 text-sm text-gray-700">
                    Shipper
                  </Label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="orgType-customer"
                    name="orgTypes.Customer"
                    value="true"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="orgType-customer" className="ml-2 text-sm text-gray-700">
                    Customer
                  </Label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="orgType-consignee"
                    name="orgTypes.Consignee"
                    value="true"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="orgType-consignee" className="ml-2 text-sm text-gray-700">
                    Consignee
                  </Label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="orgType-consolidators"
                    name="orgTypes.Consolidators"
                    value="true"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="orgType-consolidators" className="ml-2 text-sm text-gray-700">
                    Consolidators
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Link
                to="/data-points/organizations"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </Link>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                {isSubmitting ? "Creating..." : "Create Organization"}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </AdminLayout>
  );
}
