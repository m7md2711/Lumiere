import { createHash, randomBytes } from "crypto";
import { db } from "./supabase";

/**
 * Keys for the management API. Only a SHA-256 hash is stored — the key itself
 * is shown once, when it is created. Keys are long and random, so a fast hash
 * is the right tool here; slow password hashing exists for guessable secrets.
 *
 * A key is either clinic-wide or bound to one branch. A branch key sees only
 * that branch's cases, the same rule the branch's own login follows.
 */
const KEY = "api_keys";

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  hash: string;
  branchId: string | null;
  createdAt: string;
  createdBy: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function listApiKeys(): Promise<ApiKey[]> {
  const { data } = await db().from("app_settings").select("value").eq("key", KEY).maybeSingle();
  const raw = (data as { value: string } | null)?.value;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ApiKey[];
  } catch {
    return [];
  }
}

async function save(keys: ApiKey[]): Promise<void> {
  const { error } = await db()
    .from("app_settings")
    .upsert({ key: KEY, value: JSON.stringify(keys), updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function createApiKey(opts: {
  name: string;
  branchId: string | null;
  createdBy: string;
}): Promise<{ key: string; record: ApiKey }> {
  const secret = `lsc_${randomBytes(24).toString("hex")}`;
  const record: ApiKey = {
    id: randomBytes(6).toString("hex"),
    name: opts.name,
    prefix: secret.slice(0, 12),
    hash: sha(secret),
    branchId: opts.branchId,
    createdAt: new Date().toISOString(),
    createdBy: opts.createdBy,
    lastUsedAt: null,
    revokedAt: null,
  };
  const keys = await listApiKeys();
  await save([...keys, record]);
  return { key: secret, record };
}

export async function revokeApiKey(id: string): Promise<ApiKey | null> {
  const keys = await listApiKeys();
  const k = keys.find((x) => x.id === id && !x.revokedAt);
  if (!k) return null;
  k.revokedAt = new Date().toISOString();
  await save(keys);
  return k;
}

/** The live key matching a presented secret, or null. */
export async function verifyApiKey(secret: string): Promise<ApiKey | null> {
  if (!secret.startsWith("lsc_") || secret.length < 20) return null;
  const hash = sha(secret);
  const keys = await listApiKeys();
  const k = keys.find((x) => x.hash === hash && !x.revokedAt) ?? null;

  // Note when a key was last used, at most every ten minutes — a write on
  // every poll from another system would be waste.
  if (k && (!k.lastUsedAt || Date.now() - new Date(k.lastUsedAt).getTime() > 10 * 60_000)) {
    k.lastUsedAt = new Date().toISOString();
    save(keys).catch(() => {});
  }
  return k;
}
