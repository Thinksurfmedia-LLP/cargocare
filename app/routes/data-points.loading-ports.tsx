import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { DataPointsList } from "~/components/DataPointsList";

export const meta: MetaFunction = () => {
  return [
    { title: "Loading Ports - Cargo Care" },
    { name: "description", content: "Manage loading ports data" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    if (user.role.name !== "ADMIN") {
      return redirect("/dashboard");
    }

    const loadingPorts = await prisma.loadingPort.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { loadingPorts, user };
  } catch (error) {
    console.error("Error loading loading ports:", error);
    throw new Response("Error loading loading ports", { status: 500 });
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
      await prisma.loadingPort.delete({
        where: { id },
      });
      return { success: true, message: "Loading port deleted successfully" };
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("Error in loading ports action:", error);
    return Response.json({ error: "An error occurred" }, { status: 500 });
  }
}

export default function LoadingPortsPage() {
  const { loadingPorts, user } = useLoaderData<typeof loader>();

  const columns = [
    { key: "name", label: "Port Name" },
    { key: "country", label: "Country" },
    { 
      key: "createdAt", 
      label: "Created", 
      render: (value: string) => new Date(value).toLocaleDateString() 
    },
  ];

  return (
    <DataPointsList
      title="Loading Ports"
      icon="🚢"
      description="Manage loading ports and their locations"
      basePath="/data-points/loading-ports"
      items={loadingPorts}
      user={user}
      columns={columns}
    />
  );
}
