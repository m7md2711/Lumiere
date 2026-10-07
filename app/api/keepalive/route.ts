import { NextResponse } from "next/server";
import { audit, prune } from "@/lib/audit";
import { db } from "@/lib/supabase";
import { listCases } from "@/lib/cases";
import { isOverdue } from "@/lib/types";
import { notifyOverdue, notifyFollowUpDue } from "@/lib/notify";
import { dueFollowUps, markReminded } from "@/lib/followup";
import { getCase } from "@/lib/cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily write, so the database never idles out.
 *
 * Supabase pauses a free project after seven days without activity, and reads
 * do not count. Staff sign-ins usually cover it, but a holiday week would not
 * — and a paused project means patients scanning a QR code meet a dead form.
 * Vercel Cron calls this once a day; the write is what matters.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // A real read as well, so a failure here surfaces a broken database
    // rather than a silently successful no-op.
    const { count, error } = await db()
      .from("branches")
      .select("id", { count: "exact", head: true });
    if (error) throw error;

    // Same sweep reports anything nobody picked up inside 24 hours.
    const late = (await listCases({}, 1000)).filter(isOverdue);
    if (late.length) await notifyOverdue(late);

    // Scheduled follow-ups whose morning has arrived.
    const due = await dueFollowUps();
    const ready: { c: typeof late[number]; at: string; note: string; round: number }[] = [];
    for (const d of due) {
      const c = await getCase(d.caseId);
      if (!c) continue;
      ready.push({ c, at: d.rec.at, note: d.rec.note, round: d.rec.round });
    }
    if (ready.length) {
      await notifyFollowUpDue(ready);
      // Marked after sending, so a failed send is retried tomorrow.
      for (const d of due) await markReminded(d.caseId, d.rec);
    }

    await audit("keepalive", "system", {
      detail: `${count ?? 0} branches reachable, ${late.length} overdue, ${ready.length} follow-ups due`,
    });
    await prune();

    return NextResponse.json({
      ok: true, branches: count ?? 0, overdue: late.length, followUps: due.length, at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("keepalive failed", e);
    return NextResponse.json({ ok: false, error: "Database unreachable" }, { status: 500 });
  }
}
