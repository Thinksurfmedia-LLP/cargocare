import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { DataPointsList } from "~/components/DataPointsList";

export const meta: MetaFunction = () => {
  return [
    { title: "Destination Countries - Cargo Care" },
    { name: "description", content: "Manage destination countries data" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    if (user.role.name !== "ADMIN") {
      return redirect("/dashboard");
    }

    const destinationCountries = await prisma.destinationCountry.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { destinationCountries, user };
  } catch (error) {
    console.error("Error loading destination countries:", error);
    throw new Response("Error loading destination countries", { status: 500 });
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
      await prisma.destinationCountry.delete({
        where: { id },
      });
      return { success: true, message: "Destination country deleted successfully" };
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("Error in destination countries action:", error);
    return Response.json({ error: "An error occurred" }, { status: 500 });
  }
}

export default function DestinationCountriesPage() {
  const { destinationCountries, user } = useLoaderData<typeof loader>();

  const columns = [
    { key: "name", label: "Country Name" },
    { 
      key: "createdAt", 
      label: "Created", 
      render: (value: string) => new Date(value).toLocaleDateString() 
    },
  ];

  return (
    <DataPointsList
      title="Destination Countries"
      icon="🌍"
      description="Manage destination countries"
      basePath="/data-points/destination-countries"
      items={destinationCountries}
      user={user}
      columns={columns}
    />
  );
}
