import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { Form, useLoaderData, useNavigation, redirect, Link } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SearchableSelect } from "~/components/ui/searchable-select";
import { AdminLayout } from "~/components/AdminLayout";

export const meta: MetaFunction = () => {
  return [
    { title: "New Port of Discharge - Cargo Care" },
    { name: "description", content: "Create a new port of discharge" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  
  if (user.role.name !== "ADMIN") {
    return redirect("/dashboard");
  }

  const destinationCountries = await prisma.destinationCountry.findMany({
    orderBy: { name: "asc" },
  });

  return { user, destinationCountries };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  
  if (user.role.name !== "ADMIN") {
    return redirect("/dashboard");
  }

  const formData = await request.formData();
  const name = (formData.get("name") as string)?.trim();
  const countryInput = (formData.get("country") as string)?.trim();

  if (!name || !countryInput) {
    return Response.json({ error: "Name and country are required" }, { status: 400 });
  }

  const matchedCountry = await prisma.destinationCountry.findFirst({
    where: { name: { equals: countryInput, mode: "insensitive" } },
  });

  if (!matchedCountry) {
    return Response.json(
      { error: "Please select a valid destination country from the list" },
      { status: 400 }
    );
  }

  try {
    await prisma.portOfDischarge.create({
      data: { name, country: matchedCountry.name },
    });
    return redirect("/data-points/ports-of-discharge");
  } catch (error: any) {
    console.error("Error creating port of discharge:", error);
    if (error.code === "P2002") {
      return Response.json({ error: "Port of discharge with this name and country already exists" }, { status: 400 });
    }
    return Response.json({ error: "Failed to create port of discharge" }, { status: 500 });
  }
}

export default function NewPortOfDischargePage() {
  const { user, destinationCountries } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AdminLayout user={user}>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">New Port of Discharge</h1>
                <p className="mt-1 text-sm text-gray-600">Add a new port of discharge to the system</p>
              </div>
              <Link
                to="/data-points/ports-of-discharge"
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ✕
              </Link>
            </div>
          </div>

          <Form method="post" className="px-6 py-6 space-y-6">
            <div>
              <Label htmlFor="name">Port Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                className="mt-1"
                placeholder="Enter port name"
              />
            </div>

            <div>
              <Label htmlFor="country">Country</Label>
              <SearchableSelect
                id="country"
                name="country"
                options={destinationCountries.map((c) => ({
                  value: c.name,
                  label: c.name,
                }))}
                placeholder="Search and select destination country..."
                className="mt-1"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Link
                to="/data-points/ports-of-discharge"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </Link>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                {isSubmitting ? "Creating..." : "Create Port of Discharge"}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </AdminLayout>
  );
}
