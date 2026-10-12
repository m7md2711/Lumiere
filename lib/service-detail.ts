import { db } from "./supabase";

/**
 * Who performed the service and on which machine, captured when a branch
 * closes out a concern raised after a service. Both optional and free text —
 * the branch often knows one and not the other, and a required field would
 * just collect guesses.
 *
 * One app_settings row per case, so this ships without a migration.
 */
export type ServiceDetail = {
  employee: string;
  device: string;
  recordedBy: string;
  at: string;
};

const key = (caseId: string) => `case_service:${caseId}`;
const PREFIX = "case_service:";

export async function getServiceDetail(caseId: string): Promise<ServiceDetail | null> {
  const { data } = await db()
    .from("app_settings").select("value").eq("key", key(caseId)).maybeSingle();
  const raw = (data as { value: string } | null)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceDetail;
  } catch {
    return null;
  }
}

export async function setServiceDetail(
  caseId: string,
  d: { employee: string; device: string; recordedBy: string }
): Promise<void> {
  // Nothing worth storing if both were left blank.
  if (!d.employee && !d.device) return;

  const existing = await getServiceDetail(caseId);
  const rec: ServiceDetail = {
    employee: d.employee || existing?.employee || "",
    device: d.device || existing?.device || "",
    recordedBy: d.recordedBy,
    at: new Date().toISOString(),
  };
  await db()
    .from("app_settings")
    .upsert({ key: key(caseId), value: JSON.stringify(rec), updated_at: rec.at });
}

export async function serviceDetailsFor(caseIds: string[]): Promise<Record<string, ServiceDetail>> {
  if (caseIds.length === 0) return {};
  const out: Record<string, ServiceDetail> = {};

  // Chunked: a long "in" list is slower than a few round trips.
  for (let i = 0; i < caseIds.length; i += 200) {
    const slice = caseIds.slice(i, i + 200);
    const { data } = await db()
      .from("app_settings").select("key, value").in("key", slice.map(key));
    for (const r of (data ?? []) as { key: string; value: string }[]) {
      try {
        out[r.key.replace(PREFIX, "")] = JSON.parse(r.value) as ServiceDetail;
      } catch {
        /* skip a malformed row */
      }
    }
  }
  return out;
}

export async function deleteServiceDetailFor(caseIds: string[]): Promise<void> {
  if (caseIds.length === 0) return;
  await db().from("app_settings").delete().in("key", caseIds.map(key));
}

// ---------------------------------------------------------------- analysis

export type Tally = { name: string; cases: number; share: number };

/** Ranked counts, commonest first, with blanks grouped as "not recorded". */
export function tally(values: string[]): Tally[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const name = raw.trim() || "Not recorded";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const total = values.length || 1;
  return Array.from(counts.entries())
    .map(([name, cases]) => ({ name, cases, share: Math.round((cases / total) * 100) }))
    .sort((a, b) => b.cases - a.cases || a.name.localeCompare(b.name));
}
