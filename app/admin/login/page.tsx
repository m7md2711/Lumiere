import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LogoMark } from "@/components/Logo";
import {
  SESSION_COOKIE, checkCredentials, createSessionToken, sessionCookieOptions,
} from "@/lib/auth";

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

    if (!checkCredentials(user, pass)) {
      redirect(`/admin/login?e=1&next=${encodeURIComponent(next)}`);
    }

    const token = await createSessionToken(user);
    cookies().set(SESSION_COOKIE, token, sessionCookieOptions());
    redirect(next.startsWith("/admin") ? next : "/admin/cases");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-clinic-700">
          <LogoMark size={52} />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Lumiere Skin Clinic</h1>
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
          <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Wrong username or password.
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary btn-lg">Sign in</button>
      </form>
    </main>
  );
}
