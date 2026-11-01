import { db } from "./supabase";
import { getBranches, getLocations } from "./cases";
import { evidencePresence } from "./evidence";
import { followUpsFor } from "./followup";
import { sourceOf, sourceShort, type Source } from "./sources";
import { categoryLabel, statusLabel } from "./i18n";
import { normalizeCategory } from "./types";
import { clinicDayStart, formatDayLabel } from "./time";

/**
 * One place where performance is worked out. The dashboard and the management
 * API both read from here, so the number on screen and the number another
 * system pulls can never disagree.
 *
 * Scoring follows the clinic's quality dashboard: a speed measure scores 100
 * when it meets its target and 50 when it takes twice as long; a percentage
 * scores its own value. The overall score is the mean of whichever measures
 * have data in the period.
 */
export const TARGET_RESPONSE_HOURS = 24;
export const TARGET_CLOSE_HOURS = 72;

type Row = {
  id: string;
  ref: string;
  branch_id: string;
  qr_location_id: string | null;
  category: string;
  status: string;
  priority: string;
  sla_due_at: string;
  created_at: string;
  closed_at: string | null;
  closure_reason: string | null;
  satisfaction: number | null;
  mobile: string;
};

type Ev = { case_id: string; type: string; message: string; created_at: string };

export type Kpi = {
  key: string;
  label: string;
  hint: string;
  value: number | null;
  display: string;
  previous: number | null;
  previousDisplay: string;
  /** 0–100, or null when the period has nothing to measure. */
  score: number | null;
  items: number;
  /** Positive means better than the previous period, whichever way "better" runs. */
  change: number | null;
  better: "lower" | "higher";
  target: string;
};

export type Slice = { key: string; label: string; count: number };

export type Summary = {
  generatedAt: string;
  scope: { branchId: string | null };
  period: { days: number; from: string; to: string; previousFrom: string };
  score: { value: number | null; band: string; previous: number | null; change: number | null };
  kpis: Kpi[];
  now: {
    open: number;
    new: number;
    overdue: number;
    awaitingReview: number;
    escalated: number;
    followUpScheduled: number;
    followUpDue: number;
  };
  incoming: {
    total: number;
    perDay: number;
    previousTotal: number;
    previousPerDay: number;
    change: number | null;
    trend: { date: string; label: string; count: number }[];
  };
  averages: {
    responseHours: number | null;
    closeHours: number | null;
    previousResponseHours: number | null;
    previousCloseHours: number | null;
  };
  openByStatus: Slice[];
  byCategory: Slice[];
  bySource: Slice[];
  byBranch: { branchId: string; code: string; name: string; received: number; open: number }[];
  overdueCases: { id: string; ref: string; branch: string; hoursLate: number; status: string }[];
};

const HOUR = 3_600_000;
const DAY = 86_400_000;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : null);
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

function speedScore(hours: number | null, target: number): number | null {
  if (hours === null) return null;
  if (hours <= 0) return 100;
  return Math.min(100, Math.round((100 * target) / hours));
}

export function bandFor(score: number | null): string {
  if (score === null) return "Not enough data";
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 65) return "Satisfactory";
  if (score >= 50) return "Needs attention";
  return "Poor";
}

/** Notes written by the system at intake are not someone responding. */
function isResponse(e: Ev): boolean {
  if (e.type === "created" || e.type === "evidence") return false;
  if (e.type === "note" && /^(Raised by|Logged by)\b/.test(e.message)) return false;
  return true;
}

function fmtHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h >= 72) return `${round1(h / 24)} d`;
  return `${round1(h)} h`;
}

const fmtPct = (p: number | null) => (p === null ? "—" : `${Math.round(p)}%`);

export async function computeSummary(opts: {
  branchId?: string | null;
  days?: number;
}): Promise<Summary> {
  const days = Math.min(365, Math.max(1, Math.round(opts.days ?? 30)));
  const branchId = opts.branchId ?? null;

  const nowMs = Date.now();
  const to = new Date(nowMs);
  const from = new Date(nowMs - days * DAY);
  const prevFrom = new Date(nowMs - 2 * days * DAY);

  let q = db()
    .from("cases")
    .select(
      "id, ref, branch_id, qr_location_id, category, status, priority, sla_due_at, created_at, closed_at, closure_reason, satisfaction, mobile"
    )
    .order("created_at", { ascending: false })
    .limit(5000);
  if (branchId) q = q.eq("branch_id", branchId);

  const [{ data, error }, locations, branches] = await Promise.all([q, getLocations(), getBranches()]);
  if (error) throw error;
  const rows = (data ?? []) as Row[];

  const locCode = new Map(locations.map((l) => [l.id, l.code]));
  const branchName = new Map(branches.map((b) => [b.id, { code: b.code, name: b.name_en }]));

  // Events only for cases that can affect either period, in chunks.
  const inPlay = rows.filter(
    (r) =>
      new Date(r.created_at) >= prevFrom ||
      (r.closed_at && new Date(r.closed_at) >= prevFrom) ||
      r.status !== "closed"
  );
  const events: Ev[] = [];
  for (let i = 0; i < inPlay.length; i += 200) {
    const ids = inPlay.slice(i, i + 200).map((r) => r.id);
    const { data: ev } = await db()
      .from("case_events")
      .select("case_id, type, message, created_at")
      .in("case_id", ids);
    events.push(...((ev ?? []) as Ev[]));
  }
  const evBy = new Map<string, Ev[]>();
  for (const e of events) {
    const list = evBy.get(e.case_id) ?? [];
    list.push(e);
    evBy.set(e.case_id, list);
  }

  const firstResponse = (r: Row): number | null => {
    const created = new Date(r.created_at).getTime();
    const times = (evBy.get(r.id) ?? [])
      .filter(isResponse)
      .map((e) => new Date(e.created_at).getTime())
      .filter((t) => t >= created);
    return times.length ? Math.min(...times) : null;
  };
  const wasEscalated = (r: Row) =>
    r.status === "escalated" ||
    (evBy.get(r.id) ?? []).some(
      (e) => e.type === "escalation" || (e.type === "status" && /Escalated/i.test(e.message))
    );
  const isDuplicate = (r: Row) => r.closure_reason === "Duplicate of another case";

  // How many cases each mobile has raised, across everything in scope.
  const perMobile = new Map<string, number>();
  for (const r of rows) perMobile.set(r.mobile, (perMobile.get(r.mobile) ?? 0) + 1);

  const closedIdsForForms = rows
    .filter((r) => r.closed_at && new Date(r.closed_at) >= prevFrom && !isDuplicate(r))
    .map((r) => r.id);
  const withForm = await evidencePresence(closedIdsForForms);

  // ---------------------------------------------------------- per window
  function measure(start: Date, end: Date) {
    const created = rows.filter((r) => {
      const t = new Date(r.created_at);
      return t >= start && t < end;
    });
    const closed = rows.filter((r) => {
      if (!r.closed_at) return false;
      const t = new Date(r.closed_at);
      return t >= start && t < end;
    });
    const closedReal = closed.filter((r) => !isDuplicate(r));

    const responseHours: number[] = [];
    let onTime = 0;
    let judged = 0;
    for (const r of created) {
      const c = new Date(r.created_at).getTime();
      const fr = firstResponse(r);
      if (fr !== null) {
        const h = (fr - c) / HOUR;
        responseHours.push(h);
        judged += 1;
        if (h <= TARGET_RESPONSE_HOURS) onTime += 1;
      } else if (Math.min(end.getTime(), nowMs) - c >= TARGET_RESPONSE_HOURS * HOUR) {
        judged += 1; // no answer and already past the mark: late
      }
    }

    const closeHours = closedReal.map(
      (r) => (new Date(r.closed_at!).getTime() - new Date(r.created_at).getTime()) / HOUR
    );
    const sat = closedReal.map((r) => Number(r.satisfaction ?? 0)).filter((n) => n > 0);

    return {
      created,
      avgResponse: mean(responseHours),
      responseItems: responseHours.length,
      onTimePct: pct(onTime, judged),
      onTimeItems: judged,
      avgClose: mean(closeHours),
      closeItems: closeHours.length,
      clearancePct: created.length ? Math.min(100, (closed.length / created.length) * 100) : null,
      clearanceItems: created.length,
      satisfactionAvg: mean(sat),
      satisfactionItems: sat.length,
      atBranchPct: pct(closedReal.filter((r) => !wasEscalated(r)).length, closedReal.length),
      atBranchItems: closedReal.length,
      formPct: pct(closedReal.filter((r) => withForm.has(r.id)).length, closedReal.length),
      formItems: closedReal.length,
      repeatFreePct: pct(created.filter((r) => (perMobile.get(r.mobile) ?? 0) <= 1).length, created.length),
      repeatItems: created.length,
    };
  }

  const cur = measure(from, to);
  const prev = measure(prevFrom, from);

  const kpi = (
    k: Omit<Kpi, "change" | "score" | "previousDisplay"> & { scoreOf: (v: number | null) => number | null; fmt: (v: number | null) => string }
  ): Kpi => {
    const score = k.items > 0 ? k.scoreOf(k.value) : null;
    let change: number | null = null;
    if (k.value !== null && k.previous !== null) {
      if (k.better === "lower") change = k.previous > 0 ? round1(((k.previous - k.value) / k.previous) * 100) : null;
      else change = round1(k.value - k.previous);
    }
    return {
      key: k.key, label: k.label, hint: k.hint, value: k.value === null ? null : round1(k.value),
      display: k.fmt(k.value), previous: k.previous === null ? null : round1(k.previous),
      previousDisplay: k.fmt(k.previous), score, items: k.items, change, better: k.better, target: k.target,
    };
  };

  const kpis: Kpi[] = [
    kpi({
      key: "response_time", label: "Time to open", hint: "From the patient writing in to the first response",
      value: cur.avgResponse, previous: prev.avgResponse, items: cur.responseItems,
      better: "lower", target: `${TARGET_RESPONSE_HOURS} h`,
      scoreOf: (v) => speedScore(v, TARGET_RESPONSE_HOURS), fmt: fmtHours, display: "",
    }),
    kpi({
      key: "close_time", label: "Time to close", hint: "From the patient writing in to the case being closed",
      value: cur.avgClose, previous: prev.avgClose, items: cur.closeItems,
      better: "lower", target: `${TARGET_CLOSE_HOURS} h`,
      scoreOf: (v) => speedScore(v, TARGET_CLOSE_HOURS), fmt: fmtHours, display: "",
    }),
    kpi({
      key: "opened_on_time", label: "Opened on time", hint: `Answered within ${TARGET_RESPONSE_HOURS} hours`,
      value: cur.onTimePct, previous: prev.onTimePct, items: cur.onTimeItems,
      better: "higher", target: "100%", scoreOf: (v) => (v === null ? null : Math.round(v)), fmt: fmtPct, display: "",
    }),
    kpi({
      key: "clearance", label: "Clearance rate", hint: "Cases closed against cases received",
      value: cur.clearancePct, previous: prev.clearancePct, items: cur.clearanceItems,
      better: "higher", target: "100%", scoreOf: (v) => (v === null ? null : Math.round(v)), fmt: fmtPct, display: "",
    }),
    kpi({
      key: "satisfaction", label: "Patient satisfaction", hint: "Average score recorded at closing",
      value: cur.satisfactionAvg, previous: prev.satisfactionAvg, items: cur.satisfactionItems,
      better: "higher", target: "5 / 5", scoreOf: (v) => (v === null ? null : Math.round((v / 5) * 100)),
      fmt: (v) => (v === null ? "—" : `${round1(v)} / 5`), display: "",
    }),
    kpi({
      key: "resolved_at_branch", label: "Resolved at branch", hint: "Closed without needing escalation",
      value: cur.atBranchPct, previous: prev.atBranchPct, items: cur.atBranchItems,
      better: "higher", target: "100%", scoreOf: (v) => (v === null ? null : Math.round(v)), fmt: fmtPct, display: "",
    }),
    kpi({
      key: "signed_form", label: "Signed form on file", hint: "Closed cases with the patient's form attached",
      value: cur.formPct, previous: prev.formPct, items: cur.formItems,
      better: "higher", target: "100%", scoreOf: (v) => (v === null ? null : Math.round(v)), fmt: fmtPct, display: "",
    }),
    kpi({
      key: "answered_first_time", label: "Answered first time", hint: "Patients who did not need to write again",
      value: cur.repeatFreePct, previous: prev.repeatFreePct, items: cur.repeatItems,
      better: "higher", target: "100%", scoreOf: (v) => (v === null ? null : Math.round(v)), fmt: fmtPct, display: "",
    }),
  ];

  const scored = kpis.map((k) => k.score).filter((s): s is number => s !== null);
  const scoreValue = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;

  // The previous score, from the previous window's own measures.
  const prevScores = [
    speedScore(prev.avgResponse, TARGET_RESPONSE_HOURS),
    speedScore(prev.avgClose, TARGET_CLOSE_HOURS),
    prev.onTimePct, prev.clearancePct,
    prev.satisfactionAvg === null ? null : (prev.satisfactionAvg / 5) * 100,
    prev.atBranchPct, prev.formPct, prev.repeatFreePct,
  ].filter((s): s is number => s !== null);
  const prevScore = prevScores.length ? Math.round(prevScores.reduce((a, b) => a + b, 0) / prevScores.length) : null;

  // ---------------------------------------------------------------- now
  const live = rows.filter((r) => r.status !== "closed");
  const openRows = live.filter((r) => r.status !== "follow_up");
  const followRows = live.filter((r) => r.status === "follow_up");
  const recs = followRows.length ? await followUpsFor(followRows.map((r) => r.id)) : {};
  const todayStart = clinicDayStart().getTime();
  const followDue = followRows.filter((r) => {
    const at = recs[r.id]?.at;
    return at ? new Date(`${at}T00:00:00.000+04:00`).getTime() <= todayStart : false;
  }).length;
  const overdueRows = openRows
    .filter((r) => new Date(r.sla_due_at).getTime() < nowMs)
    .sort((a, b) => new Date(a.sla_due_at).getTime() - new Date(b.sla_due_at).getTime());

  // ------------------------------------------------------------ incoming
  const trend: { date: string; label: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = clinicDayStart(new Date(nowMs - i * DAY));
    const dayEnd = new Date(dayStart.getTime() + DAY);
    trend.push({
      date: dayStart.toISOString(),
      label: formatDayLabel(dayStart),
      count: cur.created.filter((r) => {
        const t = new Date(r.created_at);
        return t >= dayStart && t < dayEnd;
      }).length,
    });
  }
  const perDay = cur.created.length / days;
  const prevPerDay = prev.created.length / days;

  // ------------------------------------------------------------- slices
  const statusOrder = ["new", "opened", "under_review", "solved", "escalated", "follow_up"];
  const openByStatus: Slice[] = statusOrder
    .map((k) => ({ key: k, label: statusLabel(k), count: live.filter((r) => r.status === k).length }))
    .filter((s) => s.count > 0);

  const catCounts = new Map<string, number>();
  for (const r of cur.created) {
    const c = normalizeCategory(r.category);
    catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
  }
  const byCategory: Slice[] = Array.from(catCounts.entries())
    .map(([k, count]) => ({ key: k, label: categoryLabel(k, "en"), count }))
    .sort((a, b) => b.count - a.count);

  const srcCounts = new Map<Source, number>();
  for (const r of cur.created) {
    const s = sourceOf(locCode.get(r.qr_location_id ?? "") ?? null);
    srcCounts.set(s, (srcCounts.get(s) ?? 0) + 1);
  }
  const bySource: Slice[] = (["patient", "branch_manager", "call_center"] as Source[])
    .map((k) => ({ key: k, label: sourceShort[k], count: srcCounts.get(k) ?? 0 }))
    .filter((s) => s.count > 0);

  const branchIds = branchId ? [branchId] : branches.filter((b) => b.is_active).map((b) => b.id);
  const byBranch = branchIds.map((id) => ({
    branchId: id,
    code: branchName.get(id)?.code ?? "",
    name: branchName.get(id)?.name ?? "",
    received: cur.created.filter((r) => r.branch_id === id).length,
    open: openRows.filter((r) => r.branch_id === id).length,
  }));

  return {
    generatedAt: new Date(nowMs).toISOString(),
    scope: { branchId },
    period: { days, from: from.toISOString(), to: to.toISOString(), previousFrom: prevFrom.toISOString() },
    score: {
      value: scoreValue,
      band: bandFor(scoreValue),
      previous: prevScore,
      change: scoreValue !== null && prevScore !== null ? scoreValue - prevScore : null,
    },
    kpis,
    now: {
      open: openRows.length,
      new: openRows.filter((r) => r.status === "new").length,
      overdue: overdueRows.length,
      awaitingReview: openRows.filter((r) => r.status === "solved").length,
      escalated: openRows.filter((r) => r.status === "escalated").length,
      followUpScheduled: followRows.length,
      followUpDue: followDue,
    },
    incoming: {
      total: cur.created.length,
      perDay: round1(perDay) ?? 0,
      previousTotal: prev.created.length,
      previousPerDay: round1(prevPerDay) ?? 0,
      change: prev.created.length ? round1(((cur.created.length - prev.created.length) / prev.created.length) * 100) : null,
      trend,
    },
    averages: {
      responseHours: round1(cur.avgResponse),
      closeHours: round1(cur.avgClose),
      previousResponseHours: round1(prev.avgResponse),
      previousCloseHours: round1(prev.avgClose),
    },
    openByStatus,
    byCategory,
    bySource,
    byBranch,
    overdueCases: overdueRows.slice(0, 8).map((r) => ({
      id: r.id,
      ref: r.ref,
      branch: branchName.get(r.branch_id)?.name ?? "",
      hoursLate: Math.floor((nowMs - new Date(r.sla_due_at).getTime()) / HOUR),
      status: r.status,
    })),
  };
}
