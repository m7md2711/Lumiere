import { db } from "./supabase";

/**
 * Small typed key/value store on top of app_settings, used for configuration
 * the administrator edits in the UI rather than redeploys to change.
 */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  const { data } = await db().from("app_settings").select("value").eq("key", key).maybeSingle();
  const raw = (data as { value: string } | null)?.value;
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  const { error } = await db()
    .from("app_settings")
    .upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ------------------------------------------------------------------ smtp

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  adminEmail: string;
  /** Management, copied in on reminders only — not on every case notification. */
  ccEmails: string;
  enabled: boolean;
};

export const SMTP_KEY = "smtp_settings";

export const defaultSmtp: SmtpSettings = {
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  user: "",
  pass: "",
  fromName: "Lumiere Patient Feedback",
  fromEmail: "",
  adminEmail: "",
  ccEmails: "",
  enabled: false,
};

export async function getSmtp(): Promise<SmtpSettings> {
  return readJson<SmtpSettings>(SMTP_KEY, defaultSmtp);
}

export async function saveSmtp(s: SmtpSettings): Promise<void> {
  await writeJson(SMTP_KEY, s);
}

/** Never leaves the server with the password in it. */
export function redactSmtp(s: SmtpSettings) {
  const { pass, ...rest } = s;
  return { ...rest, hasPassword: pass.length > 0 };
}

// -------------------------------------------------------- branch recipients

export const BRANCH_EMAIL_KEY = "branch_emails";

/** branch code -> the address that receives that branch's case mail. */
export type BranchEmails = Record<string, string>;

/** Splits a comma-separated field into addresses, dropping the empties. */
export function addressList(raw: string): string[] {
  return raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

export async function getBranchEmails(): Promise<BranchEmails> {
  return readJson<BranchEmails>(BRANCH_EMAIL_KEY, {});
}

export async function setBranchEmail(code: string, email: string): Promise<void> {
  const all = await getBranchEmails();
  if (email) all[code] = email;
  else delete all[code];
  await writeJson(BRANCH_EMAIL_KEY, all);
}
