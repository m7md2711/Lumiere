import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";

export default async function AdminIndex() {
  const s = await currentSession();
  redirect(s?.role === "call_center" ? "/admin/logged" : "/admin/cases");
}
