import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { DataPointsList } from "~/components/DataPointsList";

export const meta: MetaFunction = () => {
  return [
    { title: "Commodities - Cargo Care" },
    { name: "description", content: "Manage commodities data" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    if (user.role.name !== "ADMIN") {
      return redirect("/dashboard");
    }

    const commodities = await prisma.commodity.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { commodities, user };
  } catch (error) {
    console.error("Error loading commodities:", error);
    throw new Response("Error loading commodities", { status: 500 });
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
      await prisma.commodity.delete({
        where: { id },
      });
      return { success: true, message: "Commodity deleted successfully" };
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("Error in commodities action:", error);
    return Response.json({ error: "An error occurred" }, { status: 500 });
  }
}

export default function CommoditiesPage() {
  const { commodities, user } = useLoaderData<typeof loader>();

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
      title="Commodities"
      icon="📦"
      description="Manage commodity types"
      basePath="/data-points/commodities"
      items={commodities}
      user={user}
      columns={columns}
    />
  );
}
