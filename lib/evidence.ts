import { db } from "./supabase";

/**
 * Signed complaint forms — several per case, since a form is often scanned as
 * one photo per page and the pages turn up at different times.
 *
 * Unlike voice notes these carry a patient's signature, so the bucket is
 * private and every view goes through a short-lived signed URL.
 *
 * Files are uploaded straight from the browser to storage with a signed upload
 * URL rather than through a server action. Server actions accept 1 MB by
 * default and Vercel caps any request body at 4.5 MB, while a phone photo of a
 * form is commonly 2–5 MB — routed through the server, real uploads failed.
 */
export const DOC_BUCKET = "case-documents";

export const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;
export const MAX_FILES_PER_CASE = 30;

let ensured = false;

/**
 * Created on first use so no migration is needed. Type and size limits are set
 * on the bucket itself, so storage refuses a file the browser misdescribed.
 */
export async function ensureBucket(): Promise<void> {
  if (ensured) return;
  const sb = db();
  const opts = { public: false, fileSizeLimit: MAX_FILE_BYTES, allowedMimeTypes: ALLOWED_TYPES };
  const { data } = await sb.storage.getBucket(DOC_BUCKET);
  if (!data) await sb.storage.createBucket(DOC_BUCKET, opts);
  else await sb.storage.updateBucket(DOC_BUCKET, opts);
  ensured = true;
}

export function extensionFor(type: string): string {
  if (type === "application/pdf") return "pdf";
  if (type === "image/jpeg") return "jpg";
  return type.split("/")[1] || "bin";
}

// --------------------------------------------------------------- the record

export type EvidenceFile = {
  path: string;
  name: string;
  size: number;
  type: string;
  at: string;
  by: string;
};

/** Kept in app_settings under "case_evidence:<id>", one row per case. */
type Stored = { files: EvidenceFile[] };

/** The single-file shape written before multiple uploads existed. */
type Legacy = { path: string; name: string; at: string; by: string };

const key = (caseId: string) => `case_evidence:${caseId}`;
const PREFIX = "case_evidence:";

function decode(raw: string): EvidenceFile[] {
  try {
    const v = JSON.parse(raw) as Stored | Legacy;
    if ("files" in v && Array.isArray(v.files)) return v.files;
    if ("path" in v) {
      // Read a pre-existing single file as a list of one.
      return [{ path: v.path, name: v.name, at: v.at, by: v.by, size: 0, type: "" }];
    }
  } catch {
    /* fall through */
  }
  return [];
}

export async function getEvidenceFiles(caseId: string): Promise<EvidenceFile[]> {
  const { data } = await db()
    .from("app_settings")
    .select("value")
    .eq("key", key(caseId))
    .maybeSingle();
  const raw = (data as { value: string } | null)?.value;
  return raw ? decode(raw) : [];
}

async function writeFiles(caseId: string, files: EvidenceFile[]): Promise<void> {
  if (files.length === 0) {
    await db().from("app_settings").delete().eq("key", key(caseId));
    return;
  }
  await db()
    .from("app_settings")
    .upsert({
      key: key(caseId),
      value: JSON.stringify({ files } satisfies Stored),
      updated_at: new Date().toISOString(),
    });
}

export async function addEvidenceFiles(caseId: string, added: EvidenceFile[]): Promise<EvidenceFile[]> {
  const existing = await getEvidenceFiles(caseId);
  const known = new Set(existing.map((f) => f.path));
  const merged = [...existing, ...added.filter((f) => !known.has(f.path))];
  await writeFiles(caseId, merged);
  return merged;
}

export async function removeEvidenceFile(caseId: string, path: string): Promise<EvidenceFile | null> {
  const existing = await getEvidenceFiles(caseId);
  const target = existing.find((f) => f.path === path) ?? null;
  if (!target) return null;
  try {
    await db().storage.from(DOC_BUCKET).remove([path]);
  } catch {
    /* the record still goes */
  }
  await writeFiles(caseId, existing.filter((f) => f.path !== path));
  return target;
}

/** Which of these cases have at least one signed form, in one query. */
export async function evidencePresence(caseIds: string[]): Promise<Set<string>> {
  if (caseIds.length === 0) return new Set();
  const { data } = await db()
    .from("app_settings")
    .select("key, value")
    .in("key", caseIds.map(key));
  const out = new Set<string>();
  for (const r of (data ?? []) as { key: string; value: string }[]) {
    if (decode(r.value).length > 0) out.add(r.key.replace(PREFIX, ""));
  }
  return out;
}

/** Everything attached to a set of cases — for the archive. */
export async function evidenceFor(caseIds: string[]): Promise<Record<string, EvidenceFile[]>> {
  if (caseIds.length === 0) return {};
  const out: Record<string, EvidenceFile[]> = {};
  for (let i = 0; i < caseIds.length; i += 200) {
    const slice = caseIds.slice(i, i + 200);
    const { data } = await db()
      .from("app_settings")
      .select("key, value")
      .in("key", slice.map(key));
    for (const r of (data ?? []) as { key: string; value: string }[]) {
      out[r.key.replace(PREFIX, "")] = decode(r.value);
    }
  }
  return out;
}

/** Called when cases are deleted or archived, so nothing is orphaned. */
export async function deleteEvidenceFor(caseIds: string[]): Promise<void> {
  if (caseIds.length === 0) return;
  const all = await evidenceFor(caseIds);
  const paths = Object.values(all).flat().map((f) => f.path);
  for (let i = 0; i < paths.length; i += 100) {
    try {
      await db().storage.from(DOC_BUCKET).remove(paths.slice(i, i + 100));
    } catch {
      /* the rows still go */
    }
  }
  await db().from("app_settings").delete().in("key", caseIds.map(key));
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

export async function downloadEvidence(path: string): Promise<Uint8Array | null> {
  try {
    const { data } = await db().storage.from(DOC_BUCKET).download(path);
    return data ? new Uint8Array(await data.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
