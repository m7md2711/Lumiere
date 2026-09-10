import JSZip from "jszip";
import { db, VOICE_BUCKET } from "./supabase";
import { casesToCsv } from "./cases";
import { formatForCsv } from "./time";
import type { CaseWithBranch } from "./types";

/**
 * Archiving exists because voice notes fill the storage bucket long before the
 * database fills up. Closed cases are packaged into a ZIP the clinic keeps, and
 * only then removed, freeing space for new recordings.
 *
 * Deletion is irreversible, so it is split in two: a batch is prepared and
 * downloaded first, and the delete step afterwards targets exactly the case ids
 * that were written into that ZIP. Cases created in between are never caught.
 */

// Measured from real recordings: 27 kbps mono opus.
export const BYTES_PER_VOICE_MINUTE = 198 * 1024;

// Supabase free tier.
export const STORAGE_LIMIT_BYTES = 1024 ** 3;
export const DB_LIMIT_BYTES = 500 * 1024 ** 2;

// Measured with pg_column_size on a representative row.
const CASE_ROW_BYTES = 792;
const EVENT_ROW_BYTES = 192;
const INDEX_FACTOR = 1.6;

const PENDING_KEY = "archive_pending";
const LOG_KEY = "archive_log";

// ------------------------------------------------------------------ settings

async function readSetting<T>(key: string): Promise<T | null> {
  const { data } = await db().from("app_settings").select("value").eq("key", key).maybeSingle();
  const raw = (data as { value: string } | null)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  const { error } = await db()
    .from("app_settings")
    .upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
  if (error) throw error;
}

// --------------------------------------------------------------------- stats

export type StorageStats = {
  voiceBytes: number;
  voiceCount: number;
  caseCount: number;
  eventCount: number;
  dbEstimateBytes: number;
  storageUsedPct: number;
  dbUsedPct: number;
  minutesStored: number;
  minutesRemaining: number;
};

/** Walks the bucket rather than guessing — the object list carries real sizes. */
async function bucketUsage(): Promise<{ bytes: number; count: number }> {
  const sb = db();
  let bytes = 0;
  let count = 0;

  // Files are laid out one folder per branch code.
  const { data: folders } = await sb.storage.from(VOICE_BUCKET).list("", { limit: 1000 });
  for (const folder of folders ?? []) {
    const { data: files } = await sb.storage
      .from(VOICE_BUCKET)
      .list(folder.name, { limit: 1000 });
    for (const f of files ?? []) {
      const size = (f.metadata as { size?: number } | null)?.size;
      if (typeof size === "number") {
        bytes += size;
        count += 1;
      }
    }
  }
  return { bytes, count };
}

export async function storageStats(): Promise<StorageStats> {
  const sb = db();
  const [{ bytes, count }, casesRes, eventsRes] = await Promise.all([
    bucketUsage(),
    sb.from("cases").select("id", { count: "exact", head: true }),
    sb.from("case_events").select("id", { count: "exact", head: true }),
  ]);

  const caseCount = casesRes.count ?? 0;
  const eventCount = eventsRes.count ?? 0;
  const dbEstimateBytes = Math.round(
    (caseCount * CASE_ROW_BYTES + eventCount * EVENT_ROW_BYTES) * INDEX_FACTOR
  );

  return {
    voiceBytes: bytes,
    voiceCount: count,
    caseCount,
    eventCount,
    dbEstimateBytes,
    storageUsedPct: Math.min(100, (bytes / STORAGE_LIMIT_BYTES) * 100),
    dbUsedPct: Math.min(100, (dbEstimateBytes / DB_LIMIT_BYTES) * 100),
    minutesStored: bytes / BYTES_PER_VOICE_MINUTE,
    minutesRemaining: Math.max(0, (STORAGE_LIMIT_BYTES - bytes) / BYTES_PER_VOICE_MINUTE),
  };
}

// ----------------------------------------------------------------------- zip

/** Storage path from the public URL the case row holds. */
function pathFromVoiceUrl(url: string): string | null {
  const marker = `/object/public/${VOICE_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

export type ZipResult = { buffer: Buffer; voiceIncluded: number; voiceMissing: string[] };

/** CSV plus every voice note, so the ZIP stands alone once the rows are gone. */
export async function buildZip(rows: CaseWithBranch[]): Promise<ZipResult> {
  const sb = db();
  const zip = new JSZip();

  zip.file("cases.csv", casesToCsv(rows));

  const audio = zip.folder("voice-notes");
  let voiceIncluded = 0;
  const voiceMissing: string[] = [];

  for (const c of rows) {
    if (!c.voice_url) continue;
    const path = pathFromVoiceUrl(c.voice_url);
    if (!path) {
      voiceMissing.push(c.ref);
      continue;
    }
    const { data, error } = await sb.storage.from(VOICE_BUCKET).download(path);
    if (error || !data) {
      voiceMissing.push(c.ref);
      continue;
    }
    const ext = path.split(".").pop() || "webm";
    audio?.file(`${c.ref}.${ext}`, Buffer.from(await data.arrayBuffer()));
    voiceIncluded += 1;
  }

  const lines = [
    "Lumiere Skin Clinic — case archive",
    `Generated: ${formatForCsv(new Date())} (GST)`,
    `Cases: ${rows.length}`,
    `Voice notes: ${voiceIncluded}`,
    voiceMissing.length ? `Voice notes that could not be read: ${voiceMissing.join(", ")}` : "",
    "",
    "cases.csv holds every field. voice-notes/ is named by case reference.",
  ].filter(Boolean);
  zip.file("README.txt", lines.join("\n"));

  return {
    buffer: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
    voiceIncluded,
    voiceMissing,
  };
}

// ------------------------------------------------------------ pending batch

export type PendingBatch = {
  caseIds: string[];
  refs: string[];
  count: number;
  voiceCount: number;
  voiceBytes: number;
  scope: string;
  preparedAt: string;
  downloadedAt: string | null;
};

export async function getPending(): Promise<PendingBatch | null> {
  return readSetting<PendingBatch>(PENDING_KEY);
}

export async function setPending(b: PendingBatch): Promise<void> {
  await writeSetting(PENDING_KEY, b);
}

export async function clearPending(): Promise<void> {
  await db().from("app_settings").delete().eq("key", PENDING_KEY);
}

export async function markDownloaded(): Promise<void> {
  const p = await getPending();
  if (p) await setPending({ ...p, downloadedAt: new Date().toISOString() });
}

// -------------------------------------------------------------------- log

export type ArchiveEntry = {
  at: string;
  caseCount: number;
  voiceCount: number;
  bytesFreed: number;
  refFirst: string;
  refLast: string;
  scope: string;
  note: string;
};

export async function archiveLog(): Promise<ArchiveEntry[]> {
  return (await readSetting<ArchiveEntry[]>(LOG_KEY)) ?? [];
}

export async function appendArchiveLog(entry: ArchiveEntry): Promise<void> {
  const log = await archiveLog();
  log.unshift(entry);
  await writeSetting(LOG_KEY, log.slice(0, 200));
}

// ----------------------------------------------------------------- deletion

/** Removes audio first: an orphaned row is recoverable, an orphaned file is litter. */
export async function deleteCases(caseIds: string[]): Promise<{ filesRemoved: number }> {
  const sb = db();
  if (caseIds.length === 0) return { filesRemoved: 0 };

  const { data } = await sb.from("cases").select("voice_url").in("id", caseIds);
  const paths = ((data ?? []) as { voice_url: string | null }[])
    .map((r) => (r.voice_url ? pathFromVoiceUrl(r.voice_url) : null))
    .filter((p): p is string => Boolean(p));

  if (paths.length) await sb.storage.from(VOICE_BUCKET).remove(paths);

  await sb.from("case_events").delete().in("case_id", caseIds);
  const { error } = await sb.from("cases").delete().in("id", caseIds);
  if (error) throw error;

  return { filesRemoved: paths.length };
}

/** Sizes of specific stored objects, read from the bucket listing. */
export async function voiceBytesFor(rows: { voice_url: string | null }[]): Promise<number> {
  const wanted = new Set(
    rows.map((r) => (r.voice_url ? pathFromVoiceUrl(r.voice_url) : null)).filter(Boolean) as string[]
  );
  if (wanted.size === 0) return 0;

  const sb = db();
  let bytes = 0;
  const { data: folders } = await sb.storage.from(VOICE_BUCKET).list("", { limit: 1000 });
  for (const folder of folders ?? []) {
    const { data: files } = await sb.storage.from(VOICE_BUCKET).list(folder.name, { limit: 1000 });
    for (const f of files ?? []) {
      if (wanted.has(`${folder.name}/${f.name}`)) {
        bytes += (f.metadata as { size?: number } | null)?.size ?? 0;
      }
    }
  }
  return bytes;
}
