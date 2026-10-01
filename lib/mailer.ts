import nodemailer from "nodemailer";
import { getSmtp, getBranchEmails, type SmtpSettings } from "./settings";

/**
 * Outbound mail. Every send is best effort: a clinic's notification must never
 * be able to fail a patient's submission or block a branch from working.
 */
export type MailResult = { ok: true } | { ok: false; error: string };

function transport(s: SmtpSettings) {
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
  });
}

export async function sendMail(
  to: string[],
  subject: string,
  html: string
): Promise<MailResult> {
  const s = await getSmtp();
  const recipients = to.filter(Boolean);

  if (!s.enabled) return { ok: false, error: "Email notifications are switched off." };
  if (!s.host || !s.fromEmail) return { ok: false, error: "SMTP is not configured." };
  if (recipients.length === 0) return { ok: false, error: "No recipient address." };

  try {
    await transport(s).sendMail({
      from: `"${s.fromName}" <${s.fromEmail}>`,
      to: recipients.join(", "),
      subject,
      html: wrap(html),
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed.";
    console.error("mail failed:", msg);
    return { ok: false, error: msg };
  }
}

export async function recipientsFor(branchCode: string | null): Promise<{
  admin: string[];
  branch: string[];
}> {
  const s = await getSmtp();
  const emails = await getBranchEmails();
  return {
    admin: s.adminEmail ? s.adminEmail.split(",").map((x) => x.trim()).filter(Boolean) : [],
    branch: branchCode && emails[branchCode] ? [emails[branchCode]] : [],
  };
}

/** The clinic's gold-on-black, inlined — mail clients strip stylesheets. */
function wrap(inner: string): string {
  return `
<div style="margin:0;padding:28px 12px;background:#080808;font-family:Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#1a1a1a;border:1px solid #3a3226;border-radius:14px;overflow:hidden">
    <div style="padding:20px 26px;border-bottom:1px solid #262626;background:#101010">
      <div style="font-size:17px;letter-spacing:4px;color:#c9a84c;text-transform:uppercase">LUMIERE</div>
      <div style="font-size:9px;letter-spacing:2px;color:#8a7340;text-transform:uppercase;margin-top:3px">Clinic &amp; Cosmetix</div>
    </div>
    <div style="padding:24px 26px;color:#e3dccb;font-size:14px;line-height:1.65">
      ${inner}
    </div>
    <div style="padding:14px 26px;border-top:1px solid #262626;color:#6e6450;font-size:11px">
      Patient Feedback System &middot; this message is automatic
    </div>
  </div>
</div>`;
}

export function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:5px 14px 5px 0;color:#8a7340;font-size:12px;white-space:nowrap">${label}</td>
    <td style="padding:5px 0;color:#f1ece0;font-size:13px">${value}</td>
  </tr>`;
}

export function table(rows: string): string {
  return `<table style="border-collapse:collapse;margin:14px 0">${rows}</table>`;
}

export function button(href: string, text: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:8px;padding:10px 22px;background:#c9a84c;color:#080808;text-decoration:none;border-radius:99px;font-size:13px;letter-spacing:1.5px;text-transform:uppercase">${text}</a>`;
}

export function esc(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));
}
