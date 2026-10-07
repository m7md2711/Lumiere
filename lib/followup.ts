import { db } from "./supabase";
import { clinicDayStart } from "./time";

/**
 * Closing a case is not always the end of it. Some complaints want a check
 * back in a fortnight — did the treatment settle, did the refund arrive — so
 * the administrator can close permanently or set a date to look again.
 *
 * One app_settings row per case under "case_followup:<id>", rather than a
 * column, so this ships without a migration. The round counter and the
 * previous dates are kept, so a case followed up three times shows that.
 */
export type FollowUp = {
  at: string;            // the clinic date to look again, yyyy-mm-dd
  note: string;
  setBy: string;
  setAt: string;
  round: number;         // 1 on the first follow-up
  remindedAt?: string;   // so the reminder goes once, not daily
  history?: { at: string; note: string; setBy: string }[];
};

const key = (caseId: string) => `case_followup:${caseId}`;
const PREFIX = "case_followup:";

export async function getFollowUp(caseId: string): Promise<FollowUp | null> {
  const { data } = await db()
    .from("app_settings").select("value").eq("key", key(caseId)).maybeSingle();
  const raw = (data as { value: string } | null)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FollowUp;
  } catch {
    return null;
  }
}

export async function setFollowUp(
  caseId: string,
  next: { at: string; note: string; setBy: string }
): Promise<FollowUp> {
  const existing = await getFollowUp(caseId);
  const rec: FollowUp = {
    at: next.at,
    note: next.note,
    setBy: next.setBy,
    setAt: new Date().toISOString(),
    round: (existing?.round ?? 0) + 1,
    history: existing
      ? [...(existing.history ?? []), { at: existing.at, note: existing.note, setBy: existing.setBy }]
      : [],
  };
  await db()
    .from("app_settings")
    .upsert({ key: key(caseId), value: JSON.stringify(rec), updated_at: rec.setAt });
  return rec;
}

export async function clearFollowUp(caseId: string): Promise<void> {
  await db().from("app_settings").delete().eq("key", key(caseId));
}

/** Follow-up records for a page of cases, in one query. */
export async function followUpsFor(caseIds: string[]): Promise<Record<string, FollowUp>> {
  if (caseIds.length === 0) return {};
  const { data } = await db()
    .from("app_settings").select("key, value").in("key", caseIds.map(key));
  const out: Record<string, FollowUp> = {};
  for (const r of (data ?? []) as { key: string; value: string }[]) {
    try {
      out[r.key.replace(PREFIX, "")] = JSON.parse(r.value) as FollowUp;
    } catch {
      /* skip a malformed row rather than break the page */
    }
  }
  return out;
}

/**
 * Everything whose date has arrived and that has not been reminded about yet.
 * Compared against the clinic's day, not the server's, so a reminder set for
 * the 20th does not fire at 8pm on the 19th.
 */
export async function dueFollowUps(): Promise<{ caseId: string; rec: FollowUp }[]> {
  const { data } = await db()
    .from("app_settings").select("key, value").like("key", `${PREFIX}%`).limit(2000);

  const todayStart = clinicDayStart().getTime();
  const out: { caseId: string; rec: FollowUp }[] = [];

  for (const r of (data ?? []) as { key: string; value: string }[]) {
    let rec: FollowUp;
    try {
      rec = JSON.parse(r.value) as FollowUp;
    } catch {
      continue;
    }
    const dueAt = new Date(`${rec.at}T00:00:00.000+04:00`).getTime();
    if (dueAt > todayStart) continue;                         // not yet
    if (rec.remindedAt && rec.remindedAt >= rec.at) continue; // already told them
    out.push({ caseId: r.key.replace(PREFIX, ""), rec });
  }
  return out;
}

export async function markReminded(caseId: string, rec: FollowUp): Promise<void> {
  const updated: FollowUp = { ...rec, remindedAt: new Date().toISOString().slice(0, 10) };
  await db()
    .from("app_settings")
    .upsert({ key: key(caseId), value: JSON.stringify(updated), updated_at: new Date().toISOString() });
}

/** "in 12 days", "today", "3 days ago" — relative to the clinic's day. */
export function dueLabel(at: string): { text: string; overdue: boolean; today: boolean } {
  const due = new Date(`${at}T00:00:00.000+04:00`).getTime();
  const today = clinicDayStart().getTime();
  const days = Math.round((due - today) / 86_400_000);

  if (days === 0) return { text: "due today", overdue: false, today: true };
  if (days < 0) return { text: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`, overdue: true, today: false };
  return { text: `in ${days} day${days === 1 ? "" : "s"}`, overdue: false, today: false };
}
