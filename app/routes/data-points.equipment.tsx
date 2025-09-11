import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { DataPointsList } from "~/components/DataPointsList";

export const meta: MetaFunction = () => {
  return [
    { title: "Equipment - Cargo Care" },
    { name: "description", content: "Manage equipment data" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    if (user.role.name !== "ADMIN") {
      return redirect("/dashboard");
    }

    const equipment = await prisma.equipment.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { equipment, user };
  } catch (error) {
    console.error("Error loading equipment:", error);
    throw new Response("Error loading equipment", { status: 500 });
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
      await prisma.equipment.delete({
        where: { id },
      });
      return { success: true, message: "Equipment deleted successfully" };
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("Error in equipment action:", error);
    return Response.json({ error: "An error occurred" }, { status: 500 });
  }
}

export default function EquipmentPage() {
  const { equipment, user } = useLoaderData<typeof loader>();

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
      title="Equipment"
      icon="⚙️"
      description="Manage equipment types"
      basePath="/data-points/equipment"
      items={equipment}
      user={user}
      columns={columns}
    />
  );
}
