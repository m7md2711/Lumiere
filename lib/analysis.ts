import { db } from "./supabase";
import { getBranches } from "./cases";
import { computeSummary, type Kpi } from "./metrics";
import { serviceDetailsFor, tally, type Tally } from "./service-detail";
import { categoryLabel, priorityLabel } from "./i18n";
import { CATEGORIES, PRIORITIES, SERVICE_CONCERN, normalizeCategory } from "./types";
import { clinicMonthStart } from "./time";

/**
 * The analysis page: comparisons and patterns the dashboard has no room for.
 *
 * The branch league table is built from computeSummary, one branch at a time,
 * so a branch's score here is exactly the score its own dashboard shows. The
 * patterns below it (months, topics, hours, repeat patients) come from one read
 * of the last twelve months of cases.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;
const GST_OFFSET = 4 * HOUR;

export const ANALYSIS_PERIODS = [30, 90, 180, 365] as const;

type Row = {
  id: string;
  branch_id: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  closed_at: string | null;
  closure_reason: string | null;
  mobile: string;
  patient_name: string;
};

export type LeagueRow = {
  branchId: string;
  code: string;
  name: string;
  score: number | null;
  band: string;
  received: number;
  open: number;
  overdue: number;
  kpis: Record<string, Pick<Kpi, "value" | "display" | "score" | "items">>;
};

export type Analysis = {
  days: number;
  branchId: string | null;
  league: LeagueRow[];
  clinic: { score: number | null; band: string };
  months: { key: string; label: string; received: number; closed: number; avgCloseDays: number | null }[];
  topicGrid: {
    topics: { key: string; label: string }[];
    rows: { branchId: string; name: string; counts: number[]; total: number }[];
    max: number;
  };
  hours: { grid: number[][]; max: number; busiest: { day: string; band: string } | null };
  repeats: { mobile: string; name: string; cases: number; branches: string[]; last: string }[];
  byEmployee: Tally[];
  byMachine: Tally[];
  closure: { key: string; label: string; count: number }[];
  priorities: { key: string; label: string; count: number }[];
  totals: { received: number; closed: number };
};

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Two-hour bands through the clinic day, in Gulf time. */
export const HOUR_BANDS = Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, "0")}–${String(i * 2 + 2).padStart(2, "0")}`);

const kpiPick = (k: Kpi) => ({ value: k.value, display: k.display, score: k.score, items: k.items });

export async function computeAnalysis(opts: { days: number; branchId?: string | null }): Promise<Analysis> {
  const days = opts.days;
  const branchId = opts.branchId ?? null;
  const nowMs = Date.now();
  const from = new Date(nowMs - days * DAY);

  // Twelve whole months back from the start of this one.
  const thisMonth = clinicMonthStart();
  const firstMonth = new Date(thisMonth.getTime());
  for (let i = 0; i < 11; i++) firstMonth.setTime(clinicMonthStart(new Date(firstMonth.getTime() - DAY)).getTime());
  const since = new Date(Math.min(firstMonth.getTime(), from.getTime()));

  const branches = (await getBranches()).filter((b) => b.is_active);
  const nameOf = new Map(branches.map((b) => [b.id, b.name_en]));

  let q = db()
    .from("cases")
    .select("id, branch_id, category, status, priority, created_at, closed_at, closure_reason, mobile, patient_name")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(10000);
  if (branchId) q = q.eq("branch_id", branchId);

  const [clinicSummary, perBranch, casesRes] = await Promise.all([
    computeSummary({ days }),
    Promise.all(branches.map((b) => computeSummary({ branchId: b.id, days }))),
    q,
  ]);
  if (casesRes.error) throw casesRes.error;
  const all = (casesRes.data ?? []) as Row[];
  const inPeriod = all.filter((r) => new Date(r.created_at) >= from);

  // ------------------------------------------------------------- league
  const league: LeagueRow[] = branches
    .map((b, i) => {
      const s = perBranch[i];
      return {
        branchId: b.id,
        code: b.code,
        name: b.name_en,
        score: s.score.value,
        band: s.score.band,
        received: s.incoming.total,
        open: s.now.open,
        overdue: s.now.overdue,
        kpis: Object.fromEntries(s.kpis.map((k) => [k.key, kpiPick(k)])),
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.received - a.received);

  // ------------------------------------------------------------- months
  const months: Analysis["months"] = [];
  let cursor = new Date(firstMonth.getTime());
  for (let i = 0; i < 12; i++) {
    const start = cursor;
    const next = clinicMonthStart(new Date(start.getTime() + 32 * DAY));
    const inMonth = (iso: string | null) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= start.getTime() && t < next.getTime();
    };
    const closedRows = all.filter((r) => inMonth(r.closed_at) && r.closure_reason !== "Duplicate of another case");
    const closeDays = closedRows.map((r) => (new Date(r.closed_at!).getTime() - new Date(r.created_at).getTime()) / DAY);
    const label = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "Asia/Dubai" }).format(new Date(start.getTime() + 2 * DAY));
    const yy = new Intl.DateTimeFormat("en-GB", { year: "2-digit", timeZone: "Asia/Dubai" }).format(new Date(start.getTime() + 2 * DAY));
    months.push({
      key: start.toISOString(),
      label: `${label} ${yy}`,
      received: all.filter((r) => inMonth(r.created_at)).length,
      closed: closedRows.length,
      avgCloseDays: closeDays.length ? Math.round((closeDays.reduce((a, b) => a + b, 0) / closeDays.length) * 10) / 10 : null,
    });
    cursor = next;
  }

  // --------------------------------------------------- topic x branch
  const topicKeys = CATEGORIES.filter((c) => inPeriod.some((r) => normalizeCategory(r.category) === c));
  const gridBranches = branchId ? branches.filter((b) => b.id === branchId) : branches;
  const rows = gridBranches
    .map((b) => {
      const mine = inPeriod.filter((r) => r.branch_id === b.id);
      const counts = topicKeys.map((t) => mine.filter((r) => normalizeCategory(r.category) === t).length);
      return { branchId: b.id, name: b.name_en, counts, total: mine.length };
    })
    .sort((a, b) => b.total - a.total);
  const gridMax = Math.max(1, ...rows.flatMap((r) => r.counts));

  // ------------------------------------------------------ day x hour
  const grid = WEEKDAYS.map(() => HOUR_BANDS.map(() => 0));
  for (const r of inPeriod) {
    const local = new Date(new Date(r.created_at).getTime() + GST_OFFSET);
    grid[local.getUTCDay()][Math.floor(local.getUTCHours() / 2)] += 1;
  }
  const hourMax = Math.max(0, ...grid.flat());
  let busiest: Analysis["hours"]["busiest"] = null;
  if (hourMax > 0) {
    outer: for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 12; h++) {
        if (grid[d][h] === hourMax) {
          busiest = { day: WEEKDAYS[d], band: HOUR_BANDS[h] };
          break outer;
        }
      }
    }
  }

  // ------------------------------------------------------ repeat patients
  const byMobile = new Map<string, Row[]>();
  for (const r of inPeriod) {
    if (!r.mobile) continue;
    const list = byMobile.get(r.mobile) ?? [];
    list.push(r);
    byMobile.set(r.mobile, list);
  }
  const repeats = Array.from(byMobile.entries())
    .filter(([, list]) => list.length > 1)
    .map(([mobile, list]) => ({
      mobile,
      name: list[0].patient_name,
      cases: list.length,
      branches: Array.from(new Set(list.map((r) => nameOf.get(r.branch_id) ?? "—"))),
      last: list[0].created_at,
    }))
    .sort((a, b) => b.cases - a.cases || b.last.localeCompare(a.last))
    .slice(0, 12);

  // ---------------------------------------------- concerns after service
  const concernIds = inPeriod
    .filter((r) => normalizeCategory(r.category) === SERVICE_CONCERN)
    .map((r) => r.id);
  const details = concernIds.length ? await serviceDetailsFor(concernIds) : {};
  const byEmployee = tally(concernIds.map((id) => details[id]?.employee ?? "")).slice(0, 8);
  const byMachine = tally(concernIds.map((id) => details[id]?.device ?? "")).slice(0, 8);

  // ------------------------------------------------- how cases end, mix
  const closedInPeriod = all.filter((r) => r.closed_at && new Date(r.closed_at) >= from);
  const closureCounts = new Map<string, number>();
  for (const r of closedInPeriod) {
    const k = r.closure_reason?.trim() || "No reason recorded";
    closureCounts.set(k, (closureCounts.get(k) ?? 0) + 1);
  }
  const closure = Array.from(closureCounts.entries())
    .map(([k, count]) => ({ key: k, label: k, count }))
    .sort((a, b) => b.count - a.count);

  const priorities = PRIORITIES
    .map((p) => ({ key: p, label: priorityLabel(p), count: inPeriod.filter((r) => r.priority === p).length }))
    .filter((p) => p.count > 0);

  return {
    days,
    branchId,
    league,
    clinic: { score: clinicSummary.score.value, band: clinicSummary.score.band },
    months,
    topicGrid: {
      topics: topicKeys.map((k) => ({ key: k, label: categoryLabel(k, "en") })),
      rows,
      max: gridMax,
    },
    hours: { grid, max: hourMax, busiest },
    repeats,
    byEmployee,
    byMachine,
    closure,
    priorities,
    totals: { received: inPeriod.length, closed: closedInPeriod.length },
  };
}
