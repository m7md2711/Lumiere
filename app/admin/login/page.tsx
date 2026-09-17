import { redirect } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { authenticate, issueSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; e?: string };
}) {
  async function signIn(formData: FormData) {
    "use server";
    const user = String(formData.get("username") ?? "");
    const pass = String(formData.get("password") ?? "");
    const next = String(formData.get("next") ?? "/admin/cases");

    const identity = await authenticate(user, pass);
    if (!identity) {
      // Repeated failures against one branch login is how a circulating
      // password shows up, so the attempt is worth recording.
      await audit("signin_failed", user || "(blank)", { detail: "Wrong username or password" });
      redirect(`/admin/login?e=1&next=${encodeURIComponent(next)}`);
    }

    await issueSession(identity);
    await audit("signin", identity.username, {
      branch: identity.role === "branch" ? identity.branchName : null,
      detail: identity.role === "admin" ? "Administrator" : "Branch staff",
    });
    redirect(next.startsWith("/admin") ? next : "/admin/cases");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <LogoMark size={46} />
        <div>
          <p className="text-sm text-slate-500">Patient Feedback — staff sign in</p>
        </div>
      </div>

      <form action={signIn} className="card space-y-4 p-6">
        <input type="hidden" name="next" value={searchParams.next ?? "/admin/cases"} />

        <div>
          <label className="label" htmlFor="username">Username</label>
          <input
            id="username" name="username" className="field" autoComplete="username"
            autoCapitalize="none" required
          />
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password" name="password" type="password" className="field"
            autoComplete="current-password" required
          />
        </div>

        {searchParams.e ? (
          <p role="alert" className="alert-error">
            Wrong username or password.
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary btn-lg">Sign in</button>
      </form>
    </main>
  );
}
