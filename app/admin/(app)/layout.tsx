import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, currentSession, sessionCookieOptions } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { navCounts } from "@/lib/nav-counts";
import NavProgress from "@/components/NavProgress";
import Shell from "./Shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Middleware checks the signature; this also rejects sessions issued against
  // a password that has since been changed.
  const session = await currentSession();
  if (!session) redirect("/admin/login");

  async function signOut() {
    "use server";
    const s = await currentSession();
    if (s) {
      await audit("signout", s.username, {
        branch: s.role === "branch" ? s.branchName : null,
      });
    }
    cookies().set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    redirect("/admin/login");
  }

  const counts = await navCounts();
  const collapsed = cookies().get("lsc_sb")?.value === "1";

  const name =
    session.role === "admin" ? "Administrator"
    : session.role === "call_center" ? "Call centre"
    : session.role === "viewer" ? session.username
    : session.branchName;
  const roleLabel =
    session.role === "admin" ? "Admin"
    : session.role === "call_center" ? "Call centre"
    : session.role === "viewer" ? "View only"
    : "Branch";

  return (
    <>
      <NavProgress />
      <Shell
        role={session.role}
        name={name}
        roleLabel={roleLabel}
        counts={counts}
        collapsedInitially={collapsed}
        signOut={signOut}
      >
        {children}
      </Shell>
    </>
  );
}
