import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { getUser } from "~/lib/auth.server";

export function meta() {
  return [
    { title: "Cargo Care" },
    { name: "description", content: "Cargo Care Management System" },
  ];
}

export async function loader({ request }: LoaderFunctionArgs) {
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
