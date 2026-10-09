import { sendMail, recipientsFor, table, row, button, esc } from "./mailer";
import { categoryLabel, statusLabel } from "./i18n";
import { formatLongDateTime } from "./time";
import type { CaseWithBranch } from "./types";

function base(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
}

function link(id: string): string {
  const b = base();
  return b ? button(`${b}/admin/cases/${id}`, "Open the case") : "";
}

function facts(c: CaseWithBranch, repeat?: number): string {
  return table(
    row("Reference", esc(c.ref)) +
      row("Branch", esc(c.branches?.name_en ?? "—")) +
      row("Topic", esc(categoryLabel(c.category, "en"))) +
      row("Status", esc(statusLabel(c.status))) +
      row("Patient", esc(c.patient_name)) +
      row("Mobile", esc(c.mobile)) +
      row("Received", formatLongDateTime(c.created_at)) +
      (repeat && repeat > 1
        ? row("Repeat patient", `<span style="color:#fbbf24">${repeat} cases from this mobile</span>`)
        : "")
  );
}

/** A patient has written in. Goes to the branch and the administrator. */
export async function notifyNewCase(c: CaseWithBranch, repeat?: number): Promise<void> {
  const to = await recipientsFor(c.branches?.code ?? null);
  const all = [...to.branch, ...to.admin];
  if (all.length === 0) return;

  const urgent = c.priority === "high" || c.priority === "urgent";
  await sendMail(
    all,
    `New case ${c.ref} — ${c.branches?.name_en ?? "Lumiere"}`,
    `<p style="margin:0 0 4px;font-size:16px;color:#c9a84c">A patient has been in touch</p>
     <p style="margin:0;color:#a89364;font-size:13px">
       ${urgent ? "This is a medical concern and is marked high priority. " : ""}
       The branch has 24 hours to respond before it is reported as overdue.
     </p>
     ${facts(c, repeat)}
     ${c.description ? `<p style="margin:0 0 10px;padding:12px;background:#101010;border-left:2px solid #8a7340;color:#e3dccb">${esc(c.description)}</p>` : ""}
     ${c.voice_url ? `<p style="color:#8a7340;font-size:12px">A voice note is attached to this case.</p>` : ""}
     ${link(c.id)}`
  );
}

/** The branch has solved it; the administrator must review before closing. */
export async function notifyReadyForReview(c: CaseWithBranch, note: string): Promise<void> {
  const to = await recipientsFor(c.branches?.code ?? null);
  if (to.admin.length === 0) return;

  await sendMail(
    to.admin,
    `Ready for review: ${c.ref} — ${c.branches?.name_en ?? "Lumiere"}`,
    `<p style="margin:0 0 4px;font-size:16px;color:#c9a84c">A case is waiting on you</p>
     <p style="margin:0;color:#a89364;font-size:13px">
       ${esc(c.branches?.name_en ?? "The branch")} has marked this solved and attached the signed
       complaint form. It stays open until you review the trail and close it.
     </p>
     ${facts(c)}
     ${note ? `<p style="margin:0 0 10px;padding:12px;background:#101010;border-left:2px solid #8a7340">${esc(note)}</p>` : ""}
     ${link(c.id)}`
  );
}

/** Closed by the administrator. Goes to both. */
export async function notifyClosed(c: CaseWithBranch, note: string, satisfaction: number): Promise<void> {
  const to = await recipientsFor(c.branches?.code ?? null);
  const all = [...to.branch, ...to.admin];
  if (all.length === 0) return;

  await sendMail(
    all,
    `Closed: ${c.ref} — ${c.branches?.name_en ?? "Lumiere"}`,
    `<p style="margin:0 0 4px;font-size:16px;color:#c9a84c">This case is closed</p>
     <p style="margin:0;color:#a89364;font-size:13px">
       Reviewed and closed by the administrator. Patient satisfaction recorded as
       ${satisfaction}/5.
     </p>
     ${facts(c)}
     ${note ? `<p style="margin:0 0 10px;padding:12px;background:#101010;border-left:2px solid #8a7340">${esc(note)}</p>` : ""}
     ${link(c.id)}`
  );
}

/** Daily sweep: cases nobody has picked up inside 24 hours. */
export async function notifyOverdue(cases: CaseWithBranch[]): Promise<void> {
  const to = await recipientsFor(null);
  if (to.admin.length === 0 || cases.length === 0) return;

  const rows = cases
    .map(
      (c) => `<tr>
        <td style="padding:6px 14px 6px 0;color:#c9a84c;font-size:12px">${esc(c.ref)}</td>
        <td style="padding:6px 14px 6px 0;color:#e3dccb;font-size:12px">${esc(c.branches?.name_en ?? "—")}</td>
        <td style="padding:6px 0;color:#fca5a5;font-size:12px">${Math.floor(
          (Date.now() - new Date(c.sla_due_at).getTime()) / 3_600_000
        )} h late</td>
      </tr>`
    )
    .join("");

  await sendMail(
    to.admin,
    `${cases.length} case${cases.length === 1 ? "" : "s"} past the 24-hour response time`,
    `<p style="margin:0 0 4px;font-size:16px;color:#c9a84c">Nobody has picked these up</p>
     <p style="margin:0;color:#a89364;font-size:13px">
       These patients wrote in more than 24 hours ago and their branch has not opened the case.
     </p>
     <table style="border-collapse:collapse;margin:14px 0">${rows}</table>
     ${base() ? button(`${base()}/admin/cases?overdue=1`, "See them all") : ""}`,
    to.management
  );
}

/**
 * A nudge the administrator sends by hand — "this one has gone quiet". Goes to
 * the branch and the administrator, with management copied.
 */
export async function notifyReminder(
  c: CaseWithBranch,
  message: string,
  from: string
): Promise<{ ok: boolean; error?: string; to: string[]; cc: string[] }> {
  const r = await recipientsFor(c.branches?.code ?? null);
  const to = [...r.branch, ...r.admin];
  if (to.length === 0) {
    return { ok: false, error: "No branch or administrator address is set.", to: [], cc: [] };
  }

  const age = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86_400_000);
  const res = await sendMail(
    to,
    `Reminder: ${c.ref} — ${c.branches?.name_en ?? "Lumiere"}`,
    `<p style="margin:0 0 4px;font-size:16px;color:#c9a84c">A reminder about this case</p>
     <p style="margin:0;color:#a89364;font-size:13px">
       Sent by ${esc(from)}. The patient wrote in
       ${age === 0 ? "today" : `${age} day${age === 1 ? "" : "s"} ago`} and the case is
       ${esc(statusLabel(c.status)).toLowerCase()}.
     </p>
     ${facts(c)}
     ${message ? `<p style="margin:0 0 10px;padding:12px;background:#101010;border-left:2px solid #c9a84c"><b style="color:#c9a84c">Note:</b> ${esc(message)}</p>` : ""}
     ${c.description ? `<p style="margin:0 0 10px;color:#a89364;font-size:12px"><b>What the patient said:</b> ${esc(c.description)}</p>` : ""}
     ${link(c.id)}`,
    r.management
  );

  return res.ok
    ? { ok: true, to, cc: r.management }
    : { ok: false, error: res.error, to, cc: r.management };
}

/** The morning a scheduled follow-up comes due. Goes to the branch and the admin. */
export async function notifyFollowUpDue(
  items: { c: CaseWithBranch; at: string; note: string; round: number }[]
): Promise<void> {
  for (const { c, at, note, round } of items) {
    const to = await recipientsFor(c.branches?.code ?? null);
    const all = [...to.branch, ...to.admin];
    if (all.length === 0) continue;

    await sendMail(
      all,
      `Follow-up due today: ${c.ref} — ${c.branches?.name_en ?? "Lumiere"}`,
      `<p style="margin:0 0 4px;font-size:16px;color:#c9a84c">Time to check back on this</p>
       <p style="margin:0;color:#a89364;font-size:13px">
         This case was closed on ${formatLongDateTime(c.created_at)} with a follow-up set for
         today${round > 1 ? ` — this is follow-up ${round}` : ""}. Contact the patient, then
         either close it for good or set another date.
       </p>
       ${facts(c)}
       ${note ? `<p style="margin:0 0 10px;padding:12px;background:#101010;border-left:2px solid #8a7340"><b style="color:#c9a84c">What to check:</b> ${esc(note)}</p>` : ""}
       ${c.resolution_note ? `<p style="margin:0 0 10px;color:#a89364;font-size:12px"><b>Originally resolved:</b> ${esc(c.resolution_note)}</p>` : ""}
       ${link(c.id)}`,
      to.management
    );
  }
}
