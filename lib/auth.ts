import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./supabase";
import { hashPassword, passwordVersion, verifyPassword } from "./password";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sessionCookieOptions } from "./session";

export { SESSION_COOKIE, sessionCookieOptions };

const PASSWORD_KEY = "admin_password_hash";

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (use 32+ random characters).");
  }
  return new TextEncoder().encode(s);
}

// ------------------------------------------------------------- stored password

async function storedHash(): Promise<string | null> {
  const { data, error } = await db()
    .from("app_settings")
    .select("value")
    .eq("key", PASSWORD_KEY)
    .maybeSingle();
  if (error) return null;
  return (data as { value: string } | null)?.value ?? null;
}

function envPassword(): string {
  return process.env.ADMIN_PASS ?? "";
}

export function adminUser(): string {
  return process.env.ADMIN_USER || "admin";
}

/**
 * The password in force, and a fingerprint of it. Until someone changes the
 * password in the UI there is no row, and ADMIN_PASS applies — which is also
 * the way back in if the stored password is ever lost: delete the row and the
 * env var takes over again.
 */
async function currentSecretMaterial(): Promise<string> {
  return (await storedHash()) ?? `env:${envPassword()}`;
}

export async function currentPasswordVersion(): Promise<string> {
  return passwordVersion(await currentSecretMaterial());
}

export async function checkCredentials(user: string, pass: string): Promise<boolean> {
  if (user !== adminUser()) return false;

  const hash = await storedHash();
  if (hash) return verifyPassword(pass, hash);

  const env = envPassword();
  return env.length > 0 && pass === env;
}

/** Writes the new password and returns the fingerprint the session must carry. */
export async function setAdminPassword(plain: string): Promise<string> {
  const hash = hashPassword(plain);
  const { error } = await db()
    .from("app_settings")
    .upsert({ key: PASSWORD_KEY, value: hash, updated_at: new Date().toISOString() });
  if (error) throw error;
  return passwordVersion(hash);
}

// ------------------------------------------------------------------- session

export async function createSessionToken(user: string, pv: string): Promise<string> {
  return new SignJWT({ u: user, pv })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

/** Issue the cookie for an already-authenticated admin. */
export async function issueSession(pv: string): Promise<void> {
  cookies().set(SESSION_COOKIE, await createSessionToken(adminUser(), pv), sessionCookieOptions());
}

/**
 * Server-side guard. Beyond the signature it checks the token was issued for
 * the password currently in force, so a password change logs out every other
 * device instead of only changing what the login form accepts.
 */
export async function requireAdmin(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("Not authenticated.");

  let claims: { pv?: unknown };
  try {
    claims = (await jwtVerify(token, secret())).payload as { pv?: unknown };
  } catch {
    throw new Error("Not authenticated.");
  }

  if (claims.pv !== (await currentPasswordVersion())) {
    throw new Error("Session expired — the password was changed.");
  }
}

/** Same check, as a boolean, for layouts that redirect rather than throw. */
export async function isAdminSessionValid(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}
