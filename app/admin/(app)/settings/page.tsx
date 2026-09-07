import { adminUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { data } = await db()
    .from("app_settings")
    .select("updated_at")
    .eq("key", "admin_password_hash")
    .maybeSingle();

  const changedAt = (data as { updated_at: string } | null)?.updated_at ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">The sign-in used by clinic staff.</p>
      </div>

      <section className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Account</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-400">Username</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{adminUser()}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Password last changed</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {changedAt
                ? new Date(changedAt).toLocaleString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })
                : "Never — still the deployment password"}
            </dd>
          </div>
        </dl>
      </section>

      <ChangePasswordForm />
    </div>
  );
}
