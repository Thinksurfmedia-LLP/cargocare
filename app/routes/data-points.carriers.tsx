import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { DataPointsList } from "~/components/DataPointsList";

export const meta: MetaFunction = () => {
  return [
    { title: "Carriers - Cargo Care" },
    { name: "description", content: "Manage carriers data" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    if (user.role.name !== "ADMIN") {
      return redirect("/dashboard");
    }

    const carriers = await prisma.carrier.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { carriers, user };
  } catch (error) {
    console.error("Error loading carriers:", error);
    throw new Response("Error loading carriers", { status: 500 });
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
      await prisma.carrier.delete({
        where: { id },
      });
      return { success: true, message: "Carrier deleted successfully" };
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("Error in carriers action:", error);
    return Response.json({ error: "An error occurred" }, { status: 500 });
  }
}

export default function CarriersPage() {
  const { carriers, user } = useLoaderData<typeof loader>();

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
      title="Carriers"
      icon="🚛"
      description="Manage shipping carriers"
      basePath="/data-points/carriers"
      items={carriers}
      user={user}
      columns={columns}
    />
  );
}
