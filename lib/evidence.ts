import { db } from "./supabase";

/**
 * Signed complaint forms. Unlike voice notes these carry a patient's
 * signature, so the bucket is private and the admin view uses a short-lived
 * signed URL rather than a public link.
 */
export const DOC_BUCKET = "case-documents";

const ALLOWED = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
];

const MAX_BYTES = 10 * 1024 * 1024;

let ensured = false;

/** Created on first use, so no migration is needed on a live database. */
async function ensureBucket(): Promise<void> {
  if (ensured) return;
  const sb = db();
  const { data } = await sb.storage.getBucket(DOC_BUCKET);
  if (!data) {
    await sb.storage.createBucket(DOC_BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
    });
  }
  ensured = true;
}

export type UploadResult =
  | { ok: true; path: string; name: string; size: number }
  | { ok: false; error: string };

export async function uploadEvidence(
  ref: string,
  file: File
): Promise<UploadResult> {
  if (!file || file.size === 0) return { ok: false, error: "Choose the signed form to upload." };
  if (file.size > MAX_BYTES) return { ok: false, error: "That file is larger than 10 MB." };

  const type = file.type || "application/octet-stream";
  if (!ALLOWED.includes(type)) {
    return { ok: false, error: "Upload a PDF or a photo (JPG, PNG, HEIC)." };
  }

  try {
    await ensureBucket();
    const ext = type === "application/pdf" ? "pdf" : type.split("/")[1] || "bin";
    const path = `${ref}/signed-form-${Date.now()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error } = await db()
      .storage.from(DOC_BUCKET)
      .upload(path, bytes, { contentType: type, upsert: false });
    if (error) return { ok: false, error: error.message };

    return { ok: true, path, name: file.name || `signed-form.${ext}`, size: file.size };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed." };
  }
}

/** A link that works for an hour — long enough to read, not to pass around. */
export async function signedUrlFor(path: string): Promise<string | null> {
  try {
    const { data } = await db().storage.from(DOC_BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------- the record

/**
 * Which form is attached to which case. Kept in app_settings under
 * "case_evidence:<id>" rather than a column, so this ships without a migration
 * against a live database. One row per case, so there is no read-modify-write
 * and no way for two uploads to clobber one another.
 */
export type EvidenceRecord = { path: string; name: string; at: string; by: string };

const key = (caseId: string) => `case_evidence:${caseId}`;

export async function setEvidence(caseId: string, rec: EvidenceRecord): Promise<void> {
  await db()
    .from("app_settings")
    .upsert({ key: key(caseId), value: JSON.stringify(rec), updated_at: rec.at });
}

export async function getEvidence(caseId: string): Promise<EvidenceRecord | null> {
  const { data } = await db()
    .from("app_settings")
    .select("value")
    .eq("key", key(caseId))
    .maybeSingle();
  const raw = (data as { value: string } | null)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EvidenceRecord;
  } catch {
    return null;
  }
}

/** Which of these cases already have a signed form, in one query. */
export async function evidencePresence(caseIds: string[]): Promise<Set<string>> {
  if (caseIds.length === 0) return new Set();
  const { data } = await db()
    .from("app_settings")
    .select("key")
    .in("key", caseIds.map(key));
  return new Set(
    ((data ?? []) as { key: string }[]).map((r) => r.key.replace("case_evidence:", ""))
  );
}

/** Called when cases are archived away, so nothing is orphaned behind them. */
export async function deleteEvidenceFor(caseIds: string[]): Promise<void> {
  if (caseIds.length === 0) return;
  const records = await Promise.all(caseIds.map((id) => getEvidence(id)));
  const paths = records.filter(Boolean).map((r) => r!.path);
  if (paths.length) {
    try {
      await db().storage.from(DOC_BUCKET).remove(paths);
    } catch {
      /* the rows still go */
    }
  }
  await db().from("app_settings").delete().in("key", caseIds.map(key));
}
