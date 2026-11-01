import { cache } from "react";
import { db } from "./supabase";
import { currentSession } from "./auth";
import { followUpsFor } from "./followup";
import { clinicDayStart } from "./time";
import { CALLCENTER_CODE } from "./sources";

export type NavCounts = { open: number; followDue: number; review: number; overdue: number };

/**
 * The numbers on the menu badges, scoped exactly like everything else: a
 * branch counts only its own cases, the call centre only what it raised.
 * One query per page, deduplicated within the request.
 */
export const navCounts = cache(async function navCounts(): Promise<NavCounts> {
  const s = await currentSession();
  const empty = { open: 0, followDue: 0, review: 0, overdue: 0 };
  if (!s) return empty;

  let q = db()
    .from("cases")
    .select("id, status, sla_due_at, qr_locations ( code )")
    .neq("status", "closed")
    .limit(2000);
  if (s.role === "branch") q = q.eq("branch_id", s.branchId);

  const { data } = await q;
  let rows = (data ?? []) as unknown as {
    id: string; status: string; sla_due_at: string; qr_locations: { code: string } | null;
  }[];
  if (s.role === "call_center") rows = rows.filter((r) => r.qr_locations?.code === CALLCENTER_CODE);

  const now = Date.now();
  const open = rows.filter((r) => r.status !== "follow_up");
  const follow = rows.filter((r) => r.status === "follow_up");
  const recs = follow.length ? await followUpsFor(follow.map((r) => r.id)) : {};
  const today = clinicDayStart().getTime();

  return {
    open: open.length,
    review: open.filter((r) => r.status === "solved").length,
    overdue: open.filter((r) => new Date(r.sla_due_at).getTime() < now).length,
    followDue: follow.filter((r) => {
      const at = recs[r.id]?.at;
      return at ? new Date(`${at}T00:00:00.000+04:00`).getTime() <= today : false;
    }).length,
  };
});
