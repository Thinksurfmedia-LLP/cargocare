import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { DataPointsList } from "~/components/DataPointsList";

export const meta: MetaFunction = () => {
  return [
    { title: "Organizations - Cargo Care" },
    { name: "description", content: "Manage organizations data" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    // Only allow ADMIN role to access data points
    if (user.role.name !== "ADMIN") {
      return redirect("/dashboard");
    }

    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { organizations, user };
  } catch (error) {
    console.error("Error loading organizations:", error);
    throw new Response("Error loading organizations", { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  
  if (user.role.name !== "ADMIN") {
    return redirect("/dashboard");
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "delete") {
      const id = formData.get("id") as string;
      await prisma.organization.delete({
        where: { id },
      });
      return { success: true, message: "Organization deleted successfully" };
    }    if (intent === "create") {
      const name = formData.get("name") as string;
      const orgTypesData = formData.getAll("orgTypes") as string[];

      if (!name || orgTypesData.length === 0) {
        return Response.json({ error: "Name and at least one organization type are required" }, { status: 400 });
      }

      await prisma.organization.create({
        data: { name, orgTypes: orgTypesData },
      });
      return { success: true, message: "Organization created successfully" };
    }    if (intent === "update") {
      const id = formData.get("id") as string;
      const name = formData.get("name") as string;
      const orgTypesData = formData.getAll("orgTypes") as string[];

      if (!id || !name || orgTypesData.length === 0) {
        return Response.json({ error: "ID, name and at least one organization type are required" }, { status: 400 });
      }

      await prisma.organization.update({
        where: { id },
        data: { name, orgTypes: orgTypesData },
      });
      return { success: true, message: "Organization updated successfully" };
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("Error in organizations action:", error);
    return Response.json({ error: "An error occurred" }, { status: 500 });
  }
}

export default function OrganizationsPage() {
  const { organizations, user } = useLoaderData<typeof loader>();
  const columns = [
    { key: "name", label: "Name" },
    { 
      key: "orgTypes", 
      label: "Organization Types",
      render: (value: string[]) => Array.isArray(value) ? value.join(", ") : value
    },
    { 
      key: "createdAt", 
      label: "Created", 
      render: (value: string) => new Date(value).toLocaleDateString() 
    },
  ];

  return (
    <DataPointsList
      title="Organizations"
      icon="🏢"
      description="Manage organizations and their types"
      basePath="/data-points/organizations"
      items={organizations}
      user={user}
      columns={columns}
    />
  );
}
