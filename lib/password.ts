import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";

/**
 * scrypt from node:crypto — no dependency to add, and memory-hard, so a stolen
 * hash is expensive to attack. Stored as `scrypt$<salt hex>$<hash hex>`.
 */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const actual = scryptSync(plain, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/**
 * Short fingerprint of whatever password is currently in force. It rides in the
 * session token, so changing the password stops every existing session — the
 * whole point of changing it when you think it has leaked.
 */
export function passwordVersion(secretMaterial: string): string {
  return createHash("sha256").update(secretMaterial).digest("hex").slice(0, 12);
}

export type PasswordProblem = string | null;

export function validateNewPassword(p: string, confirm: string, current: string): PasswordProblem {
  if (p.length < 10) return "Use at least 10 characters.";
  if (p.length > 200) return "That password is too long.";
  if (p !== confirm) return "The two new passwords do not match.";
  if (p === current) return "The new password is the same as the current one.";
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return "Include at least one letter and one number.";
  return null;
}
