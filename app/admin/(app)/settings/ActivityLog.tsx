import { actionLabels, recentActivity, RETENTION_DAYS, type AuditEntry } from "@/lib/audit";
import { formatLongDateTime } from "@/lib/time";

const tone: Record<string, string> = {
  signin: "text-clinic-700",
  signin_failed: "text-rose-300",
  signout: "text-slate-500",
  export: "text-sky-300",
  password_change: "text-amber-300",
  branch_logins: "text-amber-300",
  archive_prepared: "text-slate-600",
  archive_deleted: "text-rose-300",
  keepalive: "text-slate-400",
};

export default async function ActivityLog() {
  const entries: AuditEntry[] = await recentActivity(80);
  const failures = entries.filter((e) => e.action === "signin_failed").length;

  return (
    <section className="card p-5">
      <h2 className="text-xs uppercase tracking-label text-slate-500">Activity log</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Sign-ins, exports and deletions across the group. Kept for{" "}
        {RETENTION_DAYS} days, then removed automatically.
        {failures > 0 ? (
          <span className="text-rose-300">
            {" "}
            {failures} failed sign-in{failures === 1 ? "" : "s"} in that window.
          </span>
        ) : null}
      </p>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm italic text-slate-400">Nothing recorded yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200">
          {entries.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
              <span className={`text-sm ${tone[e.action] ?? "text-slate-700"}`}>
                {actionLabels[e.action] ?? e.action}
              </span>
              <span className="text-sm text-slate-800">{e.actor}</span>
              {e.branch ? <span className="chip">{e.branch}</span> : null}
              {e.detail ? <span className="text-xs text-slate-500">{e.detail}</span> : null}
              <span className="tabular ms-auto whitespace-nowrap text-xs text-slate-400">
                {formatLongDateTime(e.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
