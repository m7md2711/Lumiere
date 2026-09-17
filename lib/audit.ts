import { headers } from "next/headers";
import { db } from "./supabase";

/**
 * System-level activity log: who signed in, what they exported, what was
 * deleted. Distinct from a case's own timeline, which records what happened
 * to one patient's complaint.
 *
 * It also keeps the database from idling out. Supabase pauses a free project
 * after seven days with no activity, and reads alone do not count — so a quiet
 * week used to risk patients meeting a dead form. Every sign-in now writes.
 *
 * Entries live in app_settings, one row each under an "audit:<iso>:<rand>" key
 * rather than a JSON array, so two people signing in at the same moment cannot
 * overwrite one another's entry. ISO timestamps sort lexically, which makes
 * both "newest first" and "delete everything older than" plain key ranges.
 */
export const RETENTION_DAYS = 7;

const PREFIX = "audit:";

export type AuditAction =
  | "signin" | "signin_failed" | "signout"
  | "export" | "password_change" | "branch_logins"
  | "archive_prepared" | "archive_deleted"
  | "keepalive";

export type AuditEntry = {
  at: string;
  action: AuditAction;
  actor: string;
  branch?: string | null;
  detail?: string;
  ip?: string;
};

function clientIp(): string {
  try {
    const h = headers();
    const fwd = h.get("x-forwarded-for") ?? "";
    return fwd.split(",")[0].trim() || h.get("x-real-ip") || "";
  } catch {
    return ""; // outside a request scope (e.g. a cron invocation)
  }
}

/** Never throws: an audit write must not be able to fail a sign-in. */
export async function audit(
  action: AuditAction,
  actor: string,
  opts: { branch?: string | null; detail?: string } = {}
): Promise<void> {
  const at = new Date().toISOString();
  const entry: AuditEntry = {
    at,
    action,
    actor,
    branch: opts.branch ?? null,
    detail: opts.detail,
    ip: clientIp() || undefined,
  };

  const suffix = Math.random().toString(36).slice(2, 8);

  try {
    await db().from("app_settings").insert({
      key: `${PREFIX}${at}:${suffix}`,
      value: JSON.stringify(entry),
      updated_at: at,
    });
    await prune();
  } catch {
    // Logging is best effort. Losing an entry must never lock anybody out.
  }
}

/** Drops anything past the retention window. Cheap: one ranged delete. */
export async function prune(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  try {
    await db()
      .from("app_settings")
      .delete()
      .gte("key", PREFIX)
      .lt("key", `${PREFIX}${cutoff}`);
  } catch {
    /* tidy-up only */
  }
}

export async function recentActivity(limit = 120): Promise<AuditEntry[]> {
  const { data, error } = await db()
    .from("app_settings")
    .select("key, value")
    .gte("key", PREFIX)
    .lt("key", PREFIX + "￿")
    .order("key", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const out: AuditEntry[] = [];
  for (const row of data as { key: string; value: string }[]) {
    try {
      out.push(JSON.parse(row.value) as AuditEntry);
    } catch {
      /* skip a malformed row rather than break the page */
    }
  }
  return out;
}

export async function activityStats(): Promise<{ entries: number; oldest: string | null }> {
  const rows = await recentActivity(500);
  return {
    entries: rows.length,
    oldest: rows.length ? rows[rows.length - 1].at : null,
  };
}

export const actionLabels: Record<AuditAction, string> = {
  signin: "Signed in",
  signin_failed: "Failed sign-in",
  signout: "Signed out",
  export: "Exported cases",
  password_change: "Changed the admin password",
  branch_logins: "Issued branch logins",
  archive_prepared: "Prepared an archive",
  archive_deleted: "Deleted archived cases",
  keepalive: "Scheduled check",
};
