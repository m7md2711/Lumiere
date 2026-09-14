import { isAdminSession } from "@/lib/scope";
import { redirect } from "next/navigation";
import { adminUser } from "@/lib/auth";
import { formatLongDateTime } from "@/lib/time";
import { db } from "@/lib/supabase";
import { archiveLog, getPending, storageStats } from "@/lib/archive";
import { listBranchUsers } from "@/lib/users";
import ChangePasswordForm from "./ChangePasswordForm";
import BranchLogins from "./BranchLogins";
import { StorageMeter } from "./StorageMeter";
import ArchivePanel from "./ArchivePanel";

export const dynamic = "force-dynamic";

// Branch staff have no business here; the nav hides it, this enforces it.
async function requireAdminPage() {
  if (!(await isAdminSession())) redirect("/admin/cases");
}

export default async function SettingsPage() {
  await requireAdminPage();
  const [{ data }, stats, pending, log, branchUsers] = await Promise.all([
    db().from("app_settings").select("updated_at").eq("key", "admin_password_hash").maybeSingle(),
    storageStats(),
    getPending(),
    archiveLog(),
    listBranchUsers(),
  ]);

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
              {changedAt ? formatLongDateTime(changedAt) : "Never — still the deployment password"}
            </dd>
          </div>
        </dl>
      </section>

      <ChangePasswordForm />

      <BranchLogins
        existing={branchUsers.map((u) => ({
          branchCode: u.branchCode, branchName: u.branchName,
          username: u.username, updatedAt: u.updatedAt,
        }))}
      />

      <StorageMeter stats={stats} />

      <ArchivePanel pending={pending} log={log} />
    </div>
  );
}
