import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { getUser } from "~/lib/auth.server";

export function meta() {
  return [
    { title: "Cargo Care" },
    { name: "description", content: "Cargo Care Management System" },
  ];
}

// Track if scheduler has been initialized
let schedulerInitialized = false;

export async function loader({ request }: LoaderFunctionArgs) {
  // Initialize scheduler on first request (happens on server start)
  if (!schedulerInitialized) {
    const { schedulerService } = await import("~/lib/scheduler.server");
    schedulerService.init();
    schedulerInitialized = true;
  }

  const user = await getUser(request);

  if (user) {
    return redirect("/dashboard");
  } else {
    return redirect("/login");
  }
}

export default function Home() {
  return null; // This component should never render due to redirects
}
