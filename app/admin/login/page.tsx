import { redirect } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { SubmitButton } from "@/components/SubmitButton";
import ThemeToggle from "@/components/ThemeToggle";
import { authenticate, issueSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { LOGIN_WINDOW_MIN, clientIp, loginAllowed } from "@/lib/ratelimit";
import LoginNotice from "./LoginNotice";

/**
 * Static on purpose: the page is served from the CDN, so a flood of visits to
 * it never reaches a server. Everything that varies per visitor — the deep
 * link to return to and the error line — is read in the browser by
 * LoginNotice.
 */
export const dynamic = "force-static";

export default function LoginPage() {
  async function signIn(formData: FormData) {
    "use server";
    const user = String(formData.get("username") ?? "");
    const pass = String(formData.get("password") ?? "");
    const next = String(formData.get("next") ?? "/admin/dashboard");

    // Too many attempts from one address: refuse before checking anything,
    // and do not log each refusal — that would let a flood fill the log.
    if (!(await loginAllowed(clientIp()))) {
      redirect(`/admin/login?e=locked&next=${encodeURIComponent(next)}`);
    }

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
      detail:
        identity.role === "admin" ? "Administrator"
        : identity.role === "call_center" ? "Call centre"
        : identity.role === "viewer" ? "View only"
        : "Branch staff",
    });
    // The call centre has no clinic-wide case list; send it where it works.
    const home = identity.role === "call_center" ? "/admin/logged" : "/admin/dashboard";
    // A deep link survives sign-in; a bare visit opens on the dashboard.
    const deep = next.startsWith("/admin/") && !["/admin", "/admin/cases"].includes(next);
    redirect(deep ? next : home);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex justify-center"><ThemeToggle /></div>

      <div className="flex flex-col items-center gap-3 text-center">
        <LogoMark size={46} />
        <div>
          <p className="text-sm text-slate-500">Patient Feedback — staff sign in</p>
        </div>
      </div>

      <form action={signIn} className="card space-y-4 p-6">

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

        <LoginNotice lockMinutes={LOGIN_WINDOW_MIN} />

        <SubmitButton type="submit" className="btn btn-primary btn-lg" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>
    </main>
  );
}
