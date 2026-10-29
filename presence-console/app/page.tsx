import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { isAtieRole } from "@/lib/auth/permissions";

export default async function Home() {
  const v = await getViewer();
  if (!v) redirect("/connexion");
  redirect(isAtieRole(v.role) ? "/admin" : "/client");
}
