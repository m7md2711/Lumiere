import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./supabase";
import { hashPassword, passwordVersion, verifyPassword } from "./password";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sessionCookieOptions } from "./session";
import { branchUserVersion, findBranchUser, verifyBranchUser, type BranchUser } from "./users";

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

async function adminPasswordOk(pass: string): Promise<boolean> {
  const hash = await storedHash();
  if (hash) return verifyPassword(pass, hash);
  const env = envPassword();
  return env.length > 0 && pass === env;
}

/** Kept for the change-password form, which only ever checks the admin. */
export async function checkCredentials(user: string, pass: string): Promise<boolean> {
  return user === adminUser() && (await adminPasswordOk(pass));
}

export type Identity =
  | { role: "admin"; username: string; pv: string }
  | {
      role: "branch"; username: string; pv: string;
      branchId: string; branchCode: string; branchName: string;
    };

/** Admin first, then the per-branch logins. */
export async function authenticate(user: string, pass: string): Promise<Identity | null> {
  const supplied = user.trim();

  if (supplied === adminUser() && (await adminPasswordOk(pass))) {
    return { role: "admin", username: adminUser(), pv: await currentPasswordVersion() };
  }

  const branchUser: BranchUser | null = await verifyBranchUser(supplied, pass);
  if (branchUser) {
    return {
      role: "branch",
      username: branchUser.username,
      pv: branchUserVersion(branchUser),
      branchId: branchUser.branchId,
      branchCode: branchUser.branchCode,
      branchName: branchUser.branchName,
    };
  }

  return null;
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

export async function createSessionToken(identity: Identity): Promise<string> {
  const { role, username, pv } = identity;
  const branch =
    identity.role === "branch"
      ? { b: identity.branchId, bc: identity.branchCode, bn: identity.branchName }
      : {};
  return new SignJWT({ u: username, r: role, pv, ...branch })
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

/** Issue the cookie for an already-authenticated identity. */
export async function issueSession(identity: Identity): Promise<void> {
  cookies().set(SESSION_COOKIE, await createSessionToken(identity), sessionCookieOptions());
}

/** Re-issue the admin cookie after a password change. */
export async function reissueAdminSession(pv: string): Promise<void> {
  await issueSession({ role: "admin", username: adminUser(), pv });
}

export type Session =
  | { role: "admin"; username: string }
  | { role: "branch"; username: string; branchId: string; branchCode: string; branchName: string };

/**
 * Reads and validates the session. Beyond the signature it checks the token was
 * issued against the password currently in force for that identity, so changing
 * a password signs out every device holding the old one.
 */
export async function currentSession(): Promise<Session | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let claims: Record<string, unknown>;
  try {
    claims = (await jwtVerify(token, secret())).payload as Record<string, unknown>;
  } catch {
    return null;
  }

  const role = claims.r === "branch" ? "branch" : "admin";
  const username = String(claims.u ?? "");

  if (role === "admin") {
    if (claims.pv !== (await currentPasswordVersion())) return null;
    return { role: "admin", username };
  }

  const branchCode = String(claims.bc ?? "");
  const user = await findBranchUser(branchCode);
  if (!user || claims.pv !== branchUserVersion(user)) return null;

  return {
    role: "branch",
    username,
    branchId: user.branchId,
    branchCode: user.branchCode,
    branchName: user.branchName,
  };
}

/** Any signed-in user. Throws rather than returning null, for server actions. */
export async function requireSession(): Promise<Session> {
  const s = await currentSession();
  if (!s) throw new Error("Not authenticated.");
  return s;
}

/** Admin only — branch staff must not reach settings, branches or archiving. */
export async function requireAdmin(): Promise<void> {
  const s = await currentSession();
  if (!s) throw new Error("Not authenticated.");
  if (s.role !== "admin") throw new Error("This action is for the administrator only.");
}

/** The branch a session is confined to, or null when it sees everything. */
export async function sessionBranchId(): Promise<string | null> {
  const s = await currentSession();
  return s && s.role === "branch" ? s.branchId : null;
}

export async function isSessionValid(): Promise<boolean> {
  return (await currentSession()) !== null;
}
