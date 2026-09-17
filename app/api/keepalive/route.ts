import { NextResponse } from "next/server";
import { audit, prune } from "@/lib/audit";
import { db } from "@/lib/supabase";

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

    await audit("keepalive", "system", { detail: `${count ?? 0} branches reachable` });
    await prune();

    return NextResponse.json({ ok: true, branches: count ?? 0, at: new Date().toISOString() });
  } catch (e) {
    console.error("keepalive failed", e);
    return NextResponse.json({ ok: false, error: "Database unreachable" }, { status: 500 });
  }
}
