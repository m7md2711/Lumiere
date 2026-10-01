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
     ${base() ? button(`${base()}/admin/cases?overdue=1`, "See them all") : ""}`
  );
}
