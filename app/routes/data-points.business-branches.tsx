import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { prisma } from "~/lib/prisma.server";
import { DataPointsList } from "~/components/DataPointsList";

export const meta: MetaFunction = () => {
  return [
    { title: "Business Branches - Cargo Care" },
    { name: "description", content: "Manage business branches data" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    if (user.role.name !== "ADMIN") {
      return redirect("/dashboard");
    }

    const businessBranches = await prisma.businessBranch.findMany({
      orderBy: { createdAt: "desc" },
    });

    return { businessBranches, user };
  } catch (error) {
    console.error("Error loading business branches:", error);
    throw new Response("Error loading business branches", { status: 500 });
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
      await prisma.businessBranch.delete({
        where: { id },
      });
      return { success: true, message: "Business branch deleted successfully" };
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("Error in business branches action:", error);
    return Response.json({ error: "An error occurred" }, { status: 500 });
  }
}

export default function BusinessBranchesPage() {
  const { businessBranches, user } = useLoaderData<typeof loader>();

  const columns = [
    { key: "name", label: "Name" },
    { key: "code", label: "Code" },
    { 
      key: "createdAt", 
      label: "Created", 
      render: (value: string) => new Date(value).toLocaleDateString() 
    },
  ];

  return (
    <DataPointsList
      title="Business Branches"
      icon="🏪"
      description="Manage business branches and their codes"
      basePath="/data-points/business-branches"
      items={businessBranches}
      user={user}
      columns={columns}
    />
  );
}
