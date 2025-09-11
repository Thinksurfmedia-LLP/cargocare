import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { sessionStorage } from "~/lib/session.server";

export async function action({ request }: ActionFunctionArgs) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
