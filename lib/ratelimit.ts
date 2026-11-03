import { headers } from "next/headers";
import { db } from "./supabase";

/**
 * Request limits for the endpoints a flood would aim at: signing in and
 * submitting a case.
 *
 * Two layers. The first is a counter held in the function's memory — free,
 * instant, and it stops a single source hammering an instance without touching
 * the database at all. Instances are reused heavily, so this catches most of
 * a flood, but each instance counts on its own. The second layer asks the
 * database, which every instance shares: failed sign-ins per address, and
 * cases per mobile number. It only runs once the first layer has let a
 * request through, so a flood never turns into a flood of queries.
 *
 * This protects the application. Volumetric attacks are the platform's job:
 * Vercel's firewall sits in front of all of this.
 */

type Window = { count: number; resetAt: number };
const buckets = new Map<string, Window>();
const MAX_KEYS = 20_000;

/** The caller's address as Vercel reports it. */
export function clientIp(): string {
  try {
    const h = headers();
    return (
      h.get("x-real-ip") ||
      (h.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

/**
 * Counts one hit against `key` and says whether it is within `limit` per
 * `windowMs`. Fixed windows: simple, and good enough to blunt a flood.
 */
export function hit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  let w = buckets.get(key);
  if (!w || w.resetAt <= now) {
    // Keep memory bounded under a flood of distinct addresses.
    if (buckets.size >= MAX_KEYS) {
      buckets.forEach((v, k) => {
        if (v.resetAt <= now) buckets.delete(k);
      });
      if (buckets.size >= MAX_KEYS) buckets.clear();
    }
    w = { count: 0, resetAt: now + windowMs };
    buckets.set(key, w);
  }
  w.count += 1;
  return { ok: w.count <= limit, retryAfter: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) };
}

// ------------------------------------------------------------- sign in

export const LOGIN_WINDOW_MIN = 15;
const LOGIN_ATTEMPTS_PER_WINDOW = 10;

/**
 * Whether this address may try to sign in now. Every attempt counts in
 * memory; failed attempts recorded in the activity log count across every
 * instance, so spreading guesses over many servers does not help.
 */
export async function loginAllowed(ip: string): Promise<boolean> {
  if (!hit(`login:${ip}`, LOGIN_ATTEMPTS_PER_WINDOW, LOGIN_WINDOW_MIN * 60_000).ok) return false;
  if (ip === "unknown") return true;

  try {
    const since = new Date(Date.now() - LOGIN_WINDOW_MIN * 60_000).toISOString();
    const { data } = await db()
      .from("app_settings")
      .select("value")
      .gte("key", `audit:${since}`)
      .lt("key", "audit:￿")
      .like("value", `%"signin_failed"%`)
      .limit(500);
    const failures = ((data ?? []) as { value: string }[]).filter((r) => {
      try {
        return (JSON.parse(r.value) as { ip?: string }).ip === ip;
      } catch {
        return false;
      }
    }).length;
    return failures < LOGIN_ATTEMPTS_PER_WINDOW;
  } catch {
    // If the check itself fails, the in-memory limit still applies.
    return true;
  }
}

// ------------------------------------------------------- case submission

const SUBMITS_PER_IP = 10;         // per 10 minutes — a busy reception shares one Wi-Fi address
const SUBMIT_WINDOW_MS = 10 * 60_000;
const CASES_PER_MOBILE_PER_HOUR = 3;

export function submitAllowedForIp(ip: string): { ok: boolean; retryAfter: number } {
  return hit(`submit:${ip}`, SUBMITS_PER_IP, SUBMIT_WINDOW_MS);
}

/** A real patient does not need a fourth case within the hour. */
export async function submitAllowedForMobile(mobile: string): Promise<boolean> {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length < 7) return true; // validation will reject it anyway
  try {
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await db()
      .from("cases")
      .select("id", { count: "exact", head: true })
      .like("mobile", `%${digits.slice(-9)}`)
      .gte("created_at", since);
    return (count ?? 0) < CASES_PER_MOBILE_PER_HOUR;
  } catch {
    return true;
  }
}
