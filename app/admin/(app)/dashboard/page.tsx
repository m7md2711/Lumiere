import { db } from "@/lib/supabase";
import { getBranches } from "@/lib/cases";
import { categoryLabel } from "@/lib/i18n";
import { CATEGORIES } from "@/lib/types";
import { clinicDayStart, clinicMonthStart, formatDayLabel } from "@/lib/time";
import { redirect } from "next/navigation";
import { currentSession, sessionBranchId } from "@/lib/auth";
import { sourceOf, sourceShort, type Source } from "@/lib/sources";
import { getLocations } from "@/lib/cases";
import type { Case } from "@/lib/types";
import Charts from "./Charts";

export const dynamic = "force-dynamic";

type Row = Pick<
  Case,
  "id" | "branch_id" | "qr_location_id" | "category" | "status" | "priority" | "sla_due_at"
  | "created_at" | "closed_at" | "refund_amount" | "refund_status" | "satisfaction"
>;

export default async function DashboardPage() {
  // The call centre has no clinic-wide view; it follows what it raised.
  const s = await currentSession();
  if (s?.role === "call_center") redirect("/admin/logged");

  const scopeBranchId = await sessionBranchId();

  let query = db()
    .from("cases")
    .select(
      "id, branch_id, qr_location_id, category, status, priority, sla_due_at, created_at, closed_at, refund_amount, refund_status, satisfaction"
    )
    .order("created_at", { ascending: false })
    .limit(5000);
  if (scopeBranchId) query = query.eq("branch_id", scopeBranchId);

  const [allBranches, { data }, allLocations] = await Promise.all([
    getBranches(), query, getLocations(),
  ]);
  const locCode = new Map(allLocations.map((l) => [l.id, l.code]));
  // A branch session charts only itself, so the per-branch bars stay meaningful.
  const branches = scopeBranchId
    ? allBranches.filter((b) => b.id === scopeBranchId)
    : allBranches;

  const rows = (data ?? []) as Row[];
  const now = Date.now();
  const terminal = (s: string) => s === "closed";

  const open = rows.filter((r) => !terminal(r.status)).length;
  const overdue = rows.filter(
    (r) => !terminal(r.status) && new Date(r.sla_due_at).getTime() < now
  ).length;

  const monthStart = clinicMonthStart();
  const resolvedThisMonth = rows.filter(
    (r) => terminal(r.status) && new Date(r.closed_at ?? r.created_at) >= monthStart
  ).length;

  // Average hours from submission to closure, over cases that actually closed.
  const closed = rows.filter((r) => r.closed_at);
  const avgHours = closed.length
    ? closed.reduce(
        (sum, r) =>
          sum + (new Date(r.closed_at!).getTime() - new Date(r.created_at).getTime()) / 3600_000,
        0
      ) / closed.length
    : 0;

  const refunds = rows.filter((r) => r.refund_amount !== null && r.refund_amount !== undefined);
  const refundTotal = refunds.reduce((s, r) => s + Number(r.refund_amount ?? 0), 0);

  const rated = rows.filter((r) => r.satisfaction);
  const avgSatisfaction = rated.length
    ? rated.reduce((s, r) => s + Number(r.satisfaction), 0) / rated.length
    : 0;

  const branchName = new Map(branches.map((b) => [b.id, b.name_en]));

  const byBranch = branches.map((b) => {
    const mine = rows.filter((r) => r.branch_id === b.id);
    return {
      name: b.code,
      full: b.name_en,
      cases: mine.length,
      open: mine.filter((r) => !terminal(r.status)).length,
    };
  });

  const byCategory = CATEGORIES.map((c) => ({
    name: categoryLabel(c, "en").split(" ").slice(0, 2).join(" "),
    full: categoryLabel(c, "en"),
    cases: rows.filter((r) => r.category === c).length,
  })).filter((d) => d.cases > 0);

  // "Resolved at branch" means it closed without ever needing an escalation.
  const escalatedIds = new Set(
    rows.filter((r) => r.status === "escalated").map((r) => r.id)
  );
  const resolutionSplit = branches.map((b) => {
    const mine = rows.filter((r) => r.branch_id === b.id);
    return {
      name: b.code,
      atBranch: mine.filter((r) => !escalatedIds.has(r.id)).length,
      escalated: mine.filter((r) => escalatedIds.has(r.id)).length,
    };
  });

  // Where cases came from. An internally logged complaint never touched the
  // patient form, so it is worth seeing apart from the self-service ones.
  const bySource = rows.reduce<Record<Source, number>>(
    (acc, r) => {
      const s = sourceOf(locCode.get(r.qr_location_id ?? "") ?? null);
      acc[s] += 1;
      return acc;
    },
    { patient: 0, branch_manager: 0, call_center: 0 }
  );
  const internalTotal = bySource.branch_manager + bySource.call_center;
  const openInternal = rows.filter(
    (r) => !terminal(r.status) && sourceOf(locCode.get(r.qr_location_id ?? "") ?? null) !== "patient"
  ).length;

  const trend: { name: string; cases: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = clinicDayStart(new Date(Date.now() - i * 86_400_000));
    const next = new Date(day.getTime() + 86_400_000);
    trend.push({
      name: formatDayLabel(day),
      cases: rows.filter((r) => {
        const t = new Date(r.created_at);
        return t >= day && t < next;
      }).length,
    });
  }

  const oldest = rows
    .filter((r) => !terminal(r.status) && new Date(r.sla_due_at).getTime() < now)
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Open cases" value={open} />
        <Kpi label="Overdue" value={overdue} tone={overdue > 0 ? "danger" : "default"} />
        <Kpi label="Resolved this month" value={resolvedThisMonth} tone="good" />
        <Kpi label="Avg resolution" value={avgHours ? `${avgHours.toFixed(1)} h` : "—"} />
        <Kpi label="Refunds" value={refunds.length} sub={`AED ${refundTotal.toFixed(2)}`} />
        <Kpi
          label="Avg satisfaction"
          value={avgSatisfaction ? `${avgSatisfaction.toFixed(1)} / 5` : "—"}
        />
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xs uppercase tracking-label text-slate-500">Where cases come from</h2>
          <span className="text-xs text-slate-500">
            {internalTotal} logged by staff · {openInternal} of those still open
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(["patient", "branch_manager", "call_center"] as Source[]).map((s) => {
            const n = bySource[s];
            const pct = rows.length ? Math.round((n / rows.length) * 100) : 0;
            return (
              <div key={s} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">{sourceShort[s]}</div>
                <div className="tabular mt-1 text-2xl text-clinic-800">{n}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={s === "patient" ? "h-full bg-clinic-600" : "h-full bg-clinic-400"}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="tabular mt-1.5 text-xs text-slate-400">{pct}% of all cases</div>
              </div>
            );
          })}
        </div>
      </section>

      <Charts
        byBranch={byBranch}
        byCategory={byCategory}
        resolutionSplit={resolutionSplit}
        trend={trend}
      />

      {oldest.length ? (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Needs attention now
          </h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {oldest.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <a
                  href={`/admin/cases/${r.id}`}
                  className="font-medium text-clinic-700 hover:underline"
                >
                  {branchName.get(r.branch_id) ?? "—"} · {categoryLabel(r.category, "en")}
                </a>
                <span className="whitespace-nowrap text-xs font-medium text-rose-600">
                  {Math.floor((now - new Date(r.sla_due_at).getTime()) / 3600_000)} h overdue
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Kpi({
  label, value, sub, tone = "default",
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "default" | "good" | "danger";
}) {
  const toneClass =
    tone === "danger" ? "text-rose-600" : tone === "good" ? "text-emerald-600" : "text-clinic-800";
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`tabular mt-1.5 text-2xl font-bold ${toneClass}`}>{value}</div>
      {sub ? <div className="tabular mt-0.5 text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}
