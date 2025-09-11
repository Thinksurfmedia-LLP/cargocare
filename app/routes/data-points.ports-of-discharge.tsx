import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { DataPointsList } from "~/components/DataPointsList";

export const meta: MetaFunction = () => {
  return [
    { title: "Ports of Discharge - Cargo Care" },
    { name: "description", content: "Manage ports of discharge data" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    if (user.role.name !== "ADMIN") {
      return redirect("/dashboard");
    }

    const portsOfDischarge = await prisma.portOfDischarge.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { portsOfDischarge, user };
  } catch (error) {
    console.error("Error loading ports of discharge:", error);
    throw new Response("Error loading ports of discharge", { status: 500 });
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
      await prisma.portOfDischarge.delete({
        where: { id },
      });
      return { success: true, message: "Port of discharge deleted successfully" };
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("Error in ports of discharge action:", error);
    return Response.json({ error: "An error occurred" }, { status: 500 });
  }
}

export default function PortsOfDischargePage() {
  const { portsOfDischarge, user } = useLoaderData<typeof loader>();

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
      title="Ports of Discharge"
      icon="⚓"
      description="Manage ports of discharge and their locations"
      basePath="/data-points/ports-of-discharge"
      items={portsOfDischarge}
      user={user}
      columns={columns}
    />
  );
}
