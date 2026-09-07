/**
 * Cookie constants only. Middleware runs on the Edge runtime, so this module
 * must stay free of node:crypto and the Supabase client — importing either
 * from here would drag them into the Edge bundle.
 */
export const SESSION_COOKIE = "lsc_session";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
