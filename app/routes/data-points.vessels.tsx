import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { DataPointsList } from "~/components/DataPointsList";

export const meta: MetaFunction = () => {
  return [
    { title: "Vessels - Cargo Care" },
    { name: "description", content: "Manage vessels data" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    if (user.role.name !== "ADMIN") {
      return redirect("/dashboard");
    }

    const vessels = await prisma.vessel.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { vessels, user };
  } catch (error) {
    console.error("Error loading vessels:", error);
    throw new Response("Error loading vessels", { status: 500 });
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
      await prisma.vessel.delete({
        where: { id },
      });
      return { success: true, message: "Vessel deleted successfully" };
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("Error in vessels action:", error);
    return Response.json({ error: "An error occurred" }, { status: 500 });
  }
}

export default function VesselsPage() {
  const { vessels, user } = useLoaderData<typeof loader>();

  const columns = [
    { key: "name", label: "Name" },
    { 
      key: "createdAt", 
      label: "Created", 
      render: (value: string) => new Date(value).toLocaleDateString() 
    },
  ];

  return (
    <DataPointsList
      title="Vessels"
      icon="🚢"
      description="Manage shipping vessels"
      basePath="/data-points/vessels"
      items={vessels}
      user={user}
      columns={columns}
    />
  );
}
