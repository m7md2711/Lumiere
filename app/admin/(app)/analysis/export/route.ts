import { requireReader } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ANALYSIS_PERIODS, computeAnalysis } from "@/lib/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The analysis page as a spreadsheet: the branch league, then the twelve months. */
export async function GET(req: Request) {
  const session = await requireReader();
  if (session.role !== "admin" && session.role !== "viewer") {
    return new Response("Not available for this account.", { status: 403 });
  }

  const p = new URL(req.url).searchParams;
  const days = (ANALYSIS_PERIODS as readonly number[]).includes(Number(p.get("days"))) ? Number(p.get("days")) : 90;
  const a = await computeAnalysis({ days, branchId: p.get("branch") || null });

  const kpiKeys = [
    ["response_time", "Time to open"], ["opened_on_time", "Opened on time"], ["close_time", "Time to close"],
    ["clearance", "Clearance rate"], ["satisfaction", "Satisfaction"], ["resolved_at_branch", "Resolved at branch"],
    ["signed_form", "Signed form on file"], ["answered_first_time", "Answered first time"],
  ] as const;

  const lines: string[] = [];
  lines.push(`Branch league,last ${days} days`);
  lines.push(["Rank", "Branch", "Code", "Score", "Band", "Received", "Open now", "Overdue now", ...kpiKeys.map(([, l]) => l)].map(cell).join(","));
  a.league.forEach((r, i) => {
    lines.push([
      i + 1, r.name, r.code, r.score, r.band, r.received, r.open, r.overdue,
      ...kpiKeys.map(([k]) => (r.kpis[k]?.items ? r.kpis[k].display : "")),
    ].map(cell).join(","));
  });
  lines.push("");
  lines.push("Twelve months");
  lines.push(["Month", "Received", "Closed", "Average days to close"].map(cell).join(","));
  for (const m of a.months) lines.push([m.label, m.received, m.closed, m.avgCloseDays].map(cell).join(","));

  await audit("export", session.username, { detail: `Analysis, last ${days} days` });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lumiere-analysis-${days}d-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
