import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { Form, useLoaderData, useNavigation, redirect, Link } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { AdminLayout } from "~/components/AdminLayout";

export const meta: MetaFunction = () => {
  return [
    { title: "Edit Carrier - Cargo Care" },
    { name: "description", content: "Edit carrier details" },
  ];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  
  if (user.role.name !== "ADMIN") {
    return redirect("/dashboard");
  }

  const { id } = params;
  if (!id) {
    throw new Response("Carrier ID is required", { status: 400 });
  }

  const carrier = await prisma.carrier.findUnique({
    where: { id },
  });

  if (!carrier) {
    throw new Response("Carrier not found", { status: 404 });
  }

  return { user, carrier };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  
  if (user.role.name !== "ADMIN") {
    return redirect("/dashboard");
  }

  const { id } = params;
  if (!id) {
    throw new Response("Carrier ID is required", { status: 400 });
  }

  const formData = await request.formData();
  const name = formData.get("name") as string;

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    await prisma.carrier.update({
      where: { id },
      data: { name },
    });
    return redirect("/data-points/carriers");
  } catch (error: any) {
    console.error("Error updating carrier:", error);
    if (error.code === "P2002") {
      return Response.json({ error: "Carrier name already exists" }, { status: 400 });
    }
    return Response.json({ error: "Failed to update carrier" }, { status: 500 });
  }
}

export default function EditCarrierPage() {
  const { user, carrier } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AdminLayout user={user}>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Edit Carrier</h1>
                <p className="mt-1 text-sm text-gray-600">Update carrier details</p>
              </div>
              <Link
                to="/data-points/carriers"
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                ✕
              </Link>
            </div>
          </div>

          <Form method="post" className="px-6 py-6 space-y-6">
            <div>
              <Label htmlFor="name">Carrier Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={carrier.name}
                className="mt-1"
                placeholder="Enter carrier name"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Link
                to="/data-points/carriers"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </Link>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                {isSubmitting ? "Updating..." : "Update Carrier"}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </AdminLayout>
  );
}
