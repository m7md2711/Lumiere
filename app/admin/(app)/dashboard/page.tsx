import { db } from "@/lib/supabase";
import { getBranches } from "@/lib/cases";
import { categoryLabel } from "@/lib/i18n";
import { CATEGORIES } from "@/lib/types";
import type { Case } from "@/lib/types";
import Charts from "./Charts";

export const dynamic = "force-dynamic";

type Row = Pick<
  Case,
  "id" | "branch_id" | "category" | "status" | "priority" | "sla_due_at"
  | "created_at" | "closed_at" | "refund_amount" | "refund_status" | "satisfaction"
>;

export default async function DashboardPage() {
  const [branches, { data }] = await Promise.all([
    getBranches(),
    db()
      .from("cases")
      .select(
        "id, branch_id, category, status, priority, sla_due_at, created_at, closed_at, refund_amount, refund_status, satisfaction"
      )
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const rows = (data ?? []) as Row[];
  const now = Date.now();
  const terminal = (s: string) => s === "resolved" || s === "closed";

  const open = rows.filter((r) => !terminal(r.status)).length;
  const overdue = rows.filter(
    (r) => !terminal(r.status) && new Date(r.sla_due_at).getTime() < now
  ).length;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
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
    rows.filter((r) => r.status === "escalated" || r.status === "refund_approved").map((r) => r.id)
  );
  const resolutionSplit = branches.map((b) => {
    const mine = rows.filter((r) => r.branch_id === b.id);
    return {
      name: b.code,
      atBranch: mine.filter((r) => !escalatedIds.has(r.id)).length,
      escalated: mine.filter((r) => escalatedIds.has(r.id)).length,
    };
  });

  const trend: { name: string; cases: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const next = new Date(day.getTime() + 86_400_000);
    trend.push({
      name: day.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
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
