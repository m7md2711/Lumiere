import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Every call site is a server action or a route handler —
 * this module must never be imported from a "use client" component, or the key
 * would be bundled into the browser.
 */
let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const VOICE_BUCKET = "voice-notes";
