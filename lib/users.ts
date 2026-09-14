import { db } from "./supabase";
import { hashPassword, passwordVersion, verifyPassword } from "./password";
import { getBranches } from "./cases";

/**
 * One login per branch, each seeing only its own cases, alongside the single
 * admin who sees everything. Records live in app_settings rather than their own
 * table so no migration is needed on a database that is already live.
 *
 * Only hashes are stored. The plaintext is shown to the admin once, at the
 * moment it is generated, and never again.
 */
const KEY = "branch_users";

export type BranchUser = {
  username: string;
  hash: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  updatedAt: string;
};

type Store = Record<string, BranchUser>;

/** "Al Ain Ladies Club" -> "AlAinLadiesClub", for the password. */
export function pascalName(name: string): string {
  return name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).join("");
}

/** The same, lowercased, for the username staff actually type. */
export function usernameForBranch(name: string): string {
  return pascalName(name).toLowerCase();
}

/**
 * The clinic's pattern lives in the environment, not the source: branch names
 * are printed on public posters, so a pattern committed to a public repository
 * would hand out every branch password. With no template set, each branch gets
 * a random password instead — less memorable, and far safer.
 */
export function generatePassword(branchName: string): string {
  const template = process.env.BRANCH_PASS_TEMPLATE ?? "";
  if (template.includes("{branch}")) {
    return template.replace("{branch}", pascalName(branchName));
  }
  const rand = Array.from({ length: 5 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[
      Math.floor(Math.random() * 56)
    ]
  ).join("");
  return `${pascalName(branchName)}-${rand}-26`;
}

async function readStore(): Promise<Store> {
  const { data } = await db().from("app_settings").select("value").eq("key", KEY).maybeSingle();
  const raw = (data as { value: string } | null)?.value;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

async function writeStore(s: Store): Promise<void> {
  const { error } = await db()
    .from("app_settings")
    .upsert({ key: KEY, value: JSON.stringify(s), updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function listBranchUsers(): Promise<BranchUser[]> {
  return Object.values(await readStore()).sort((a, b) =>
    a.branchCode.localeCompare(b.branchCode)
  );
}

/** Accepts the username or the branch code, so BR05 works as well as deerfields. */
export async function findBranchUser(supplied: string): Promise<BranchUser | null> {
  const needle = supplied.trim().toLowerCase();
  const users = Object.values(await readStore());
  return (
    users.find((u) => u.username === needle) ??
    users.find((u) => u.branchCode.toLowerCase() === needle) ??
    null
  );
}

export async function verifyBranchUser(
  supplied: string,
  password: string
): Promise<BranchUser | null> {
  const user = await findBranchUser(supplied);
  if (!user) return null;
  return verifyPassword(password, user.hash) ? user : null;
}

export function branchUserVersion(u: BranchUser): string {
  return passwordVersion(u.hash);
}

export type GeneratedLogin = {
  branchCode: string;
  branchName: string;
  username: string;
  password: string;
};

/**
 * Creates or resets logins. `only` limits it to one branch code; without it
 * every active branch is (re)generated. Existing branches keep their login
 * unless `reset` is set, so adding a branch does not change the others.
 */
export async function generateBranchLogins(
  opts: { only?: string; reset?: boolean } = {}
): Promise<GeneratedLogin[]> {
  const branches = (await getBranches()).filter((b) => b.is_active);
  const store = await readStore();
  const made: GeneratedLogin[] = [];

  for (const b of branches) {
    if (opts.only && b.code !== opts.only) continue;
    if (store[b.code] && !opts.reset && !opts.only) continue;

    const password = generatePassword(b.name_en);
    store[b.code] = {
      username: usernameForBranch(b.name_en),
      hash: hashPassword(password),
      branchId: b.id,
      branchCode: b.code,
      branchName: b.name_en,
      updatedAt: new Date().toISOString(),
    };
    made.push({
      branchCode: b.code,
      branchName: b.name_en,
      username: store[b.code].username,
      password,
    });
  }

  await writeStore(store);
  return made;
}

export async function removeBranchUser(branchCode: string): Promise<void> {
  const store = await readStore();
  delete store[branchCode];
  await writeStore(store);
}
