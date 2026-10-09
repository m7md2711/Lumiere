"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import {
  checkCredentials, adminUser, reissueAdminSession, requireAdmin,
  requireSession, setAdminPassword,
} from "@/lib/auth";
import { assertCaseInScope } from "@/lib/scope";
import { validateNewPassword } from "@/lib/password";
import { addEvent, createCase, getCase, slaHoursFor } from "@/lib/cases";
import { statusLabel } from "@/lib/i18n";
import { formatLongDateTime } from "@/lib/time";
import {
  appendArchiveLog, buildZip, clearPending, deleteCases, getPending,
  setPending, voiceBytesFor,
} from "@/lib/archive";
import { listCases } from "@/lib/cases";
import { generateBranchLogins, generateCallCentreLogin, type GeneratedLogin } from "@/lib/users";
import { audit } from "@/lib/audit";
import { clearFollowUp, setFollowUp } from "@/lib/followup";
import { clinicDayStart } from "@/lib/time";
import { getSmtp, saveSmtp, setBranchEmail, writeJson, type SmtpSettings } from "@/lib/settings";
import {
  CALLCENTER_CODE, INTAKE_KEY, MANAGER_CODE, ensureInternalLocations, type IntakeCodes,
} from "@/lib/sources";
import { sendMail } from "@/lib/mailer";
import { getEvidence, setEvidence, uploadEvidence } from "@/lib/evidence";
import { notifyClosed, notifyReadyForReview, notifyReminder } from "@/lib/notify";
import { currentSession } from "@/lib/auth";
import {
  BRANCH_STATUSES, CATEGORIES, EVIDENCE_REQUIRED_STATUSES, NOTE_REQUIRED_STATUSES, STATUSES,
} from "@/lib/types";
import type { Category, Priority, Status } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

function refresh(id: string) {
  revalidatePath(`/admin/cases/${id}`);
  revalidatePath("/admin/cases");
  revalidatePath("/admin/dashboard");
}

// ---------------------------------------------------------------- cases

export async function changeStatus(formData: FormData): Promise<ActionResult> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  await assertCaseInScope(id);
  const status = String(formData.get("status") ?? "") as Status;
  const note = String(formData.get("note") ?? "").trim();
  const session = await currentSession();
  const isAdmin = session?.role === "admin";

  if (!id || !STATUSES.includes(status)) return { ok: false, error: "Unknown status." };

  // Closing is the review step, and the review belongs to the administrator.
  if (status === "closed" && !isAdmin) {
    return { ok: false, error: "Only the administrator can close a case, after reviewing it." };
  }
  if (!isAdmin && !BRANCH_STATUSES.includes(status)) {
    return { ok: false, error: "That status is not available to a branch." };
  }
  if (NOTE_REQUIRED_STATUSES.includes(status) && !note) {
    return { ok: false, error: `Moving a case to "${statusLabel(status)}" needs a note.` };
  }

  const existing = await getCase(id);
  if (!existing) return { ok: false, error: "That case no longer exists." };

  // Solving is a claim that the patient signed off; it needs the form.
  const file = formData.get("evidence");
  const hasNewFile = file instanceof File && file.size > 0;
  const alreadyAttached = await getEvidence(id);
  if (EVIDENCE_REQUIRED_STATUSES.includes(status) && !hasNewFile && !alreadyAttached) {
    return {
      ok: false,
      error: "Attach the complaint form signed by the patient before marking this solved.",
    };
  }

  const patch: Record<string, unknown> = { status };

  if (hasNewFile) {
    const up = await uploadEvidence(existing.ref, file as File);
    if (!up.ok) return { ok: false, error: up.error };
    await setEvidence(id, {
      path: up.path,
      name: up.name,
      at: new Date().toISOString(),
      by: session?.username ?? "unknown",
    });
    await addEvent(id, "evidence", `Signed complaint form attached: ${up.name}`);
  }

  if (status === "closed") {
    if (note) patch.resolution_note = note;
    patch.closed_at = new Date().toISOString();
  }

  const { error } = await db().from("cases").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await addEvent(
    id,
    status === "closed" ? "closed" : "status",
    `Status changed to ${statusLabel(status)}.${note ? ` ${note}` : ""}`
  );

  // The administrator is told when a case needs reviewing, not on every move.
  const fresh = await getCase(id);
  if (fresh) {
    if (status === "solved") void notifyReadyForReview(fresh, note).catch(() => {});
    if (status === "closed") {
      void notifyClosed(fresh, note, Number(fresh.satisfaction ?? 0)).catch(() => {});
    }
  }

  refresh(id);
  return { ok: true };
}

export async function changePriority(formData: FormData): Promise<ActionResult> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  await assertCaseInScope(id);
  const priority = String(formData.get("priority") ?? "") as Priority;
  if (!id || !["low", "normal", "high", "urgent"].includes(priority)) {
    return { ok: false, error: "Unknown priority." };
  }

  // The SLA clock is re-derived from the case's own creation time, so raising
  // priority tightens the deadline instead of granting a fresh window.
  const { data } = await db().from("cases").select("created_at").eq("id", id).maybeSingle();
  const created = data ? new Date((data as { created_at: string }).created_at) : new Date();
  const due = new Date(created.getTime() + slaHoursFor(priority) * 3600_000);

  const { error } = await db()
    .from("cases")
    .update({ priority, sla_due_at: due.toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await addEvent(id, "status", `Priority set to ${priority}. SLA due ${formatLongDateTime(due)}.`);
  refresh(id);
  return { ok: true };
}

export async function addNote(formData: FormData): Promise<ActionResult> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  await assertCaseInScope(id);
  const note = String(formData.get("note") ?? "").trim();
  if (!id || !note) return { ok: false, error: "Write a note first." };

  await addEvent(id, "note", note);
  refresh(id);
  return { ok: true };
}

export async function logContact(formData: FormData): Promise<ActionResult> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  await assertCaseInScope(id);
  const method = String(formData.get("method") ?? "call");
  const outcome = String(formData.get("outcome") ?? "").trim();
  if (!id || !outcome) return { ok: false, error: "Describe the outcome of the contact." };

  // Reaching out is what "under review" means, so record it without asking.
  const { data } = await db().from("cases").select("status").eq("id", id).maybeSingle();
  const now = (data as { status: Status } | null)?.status;
  if (now === "new" || now === "opened") {
    await db().from("cases").update({ status: "under_review" }).eq("id", id);
  }

  await addEvent(id, "contact", `Contact attempt by ${method}: ${outcome}`);
  refresh(id);
  return { ok: true };
}

export async function escalate(formData: FormData): Promise<ActionResult> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  await assertCaseInScope(id);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id || !reason) return { ok: false, error: "Escalation needs a reason." };

  const { error } = await db().from("cases").update({ status: "escalated" }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await addEvent(id, "escalation", `Escalated: ${reason}`);
  refresh(id);
  return { ok: true };
}

export async function approveRefund(formData: FormData): Promise<ActionResult> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  await assertCaseInScope(id);
  const amount = Number(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!id) return { ok: false, error: "Missing case." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a refund amount." };
  if (!reason) return { ok: false, error: "Refunds need a reason." };

  const { error } = await db()
    .from("cases")
    // A refund is a fact about money, not a stage: the case still has to be
    // solved by the branch and closed by the administrator.
    .update({ refund_amount: amount, refund_status: "pending" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await addEvent(id, "refund", `Refund of AED ${amount.toFixed(2)} approved: ${reason}`);
  refresh(id);
  return { ok: true };
}

export async function markRefundProcessed(formData: FormData): Promise<ActionResult> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  await assertCaseInScope(id);
  if (!id) return { ok: false, error: "Missing case." };

  const { error } = await db().from("cases").update({ refund_status: "processed" }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await addEvent(id, "refund", "Refund marked as processed.");
  refresh(id);
  return { ok: true };
}

export async function closeCase(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  await assertCaseInScope(id);
  const note = String(formData.get("resolution_note") ?? "").trim();
  const reason = String(formData.get("closure_reason") ?? "").trim();
  const satisfaction = Number(formData.get("satisfaction"));

  if (!id) return { ok: false, error: "Missing case." };
  if (!note) return { ok: false, error: "A resolution note is required to close." };
  if (!reason) return { ok: false, error: "Choose a closure reason." };
  if (!Number.isInteger(satisfaction) || satisfaction < 1 || satisfaction > 5) {
    return { ok: false, error: "Record the patient's satisfaction from 1 to 5." };
  }

  // Closing has two outcomes: finished, or finished for now with a date to
  // look again. A follow-up case is off everyone's desk until that morning.
  const mode = String(formData.get("close_mode") ?? "permanent");
  const followDate = String(formData.get("follow_up_at") ?? "").trim();

  if (mode === "follow_up") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(followDate)) {
      return { ok: false, error: "Choose the date to look at this again." };
    }
    if (new Date(`${followDate}T00:00:00.000+04:00`).getTime() < clinicDayStart().getTime()) {
      return { ok: false, error: "Choose today or a date after it." };
    }
  }

  const closingNow = mode !== "follow_up";
  const { error } = await db()
    .from("cases")
    .update({
      status: closingNow ? "closed" : "follow_up",
      resolution_note: note,
      closure_reason: reason,
      satisfaction,
      closed_at: closingNow ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (!closingNow) {
    const rec = await setFollowUp(id, { at: followDate, note, setBy: adminUser() });
    await addEvent(
      id,
      "status",
      `Follow-up set for ${followDate} (round ${rec.round}). ${note}`
    );
    await audit("follow_up_set", adminUser(), { detail: `${followDate} — round ${rec.round}` });
    refresh(id);
    revalidatePath("/admin/follow-up");
    return { ok: true };
  }

  await clearFollowUp(id);

  await addEvent(id, "closed", `Closed (${reason}) · satisfaction ${satisfaction}/5. ${note}`);
  refresh(id);
  return { ok: true };
}

// ------------------------------------------------------------- branches

export async function saveBranch(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name_en = String(formData.get("name_en") ?? "").trim();
  const name_ar = String(formData.get("name_ar") ?? "").trim();
  const is_active = formData.get("is_active") === "on";

  if (!id || !name_en || !name_ar) return { ok: false, error: "Both names are required." };

  const { error } = await db()
    .from("branches")
    .update({ name_en, name_ar, is_active })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/branches");
  revalidatePath("/admin/qr");
  return { ok: true };
}

export async function saveLocation(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const label_en = String(formData.get("label_en") ?? "").trim();
  const label_ar = String(formData.get("label_ar") ?? "").trim();
  if (!id || !label_en || !label_ar) return { ok: false, error: "Both labels are required." };

  const { error } = await db()
    .from("qr_locations")
    .update({ label_en, label_ar })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/branches");
  revalidatePath("/admin/qr");
  return { ok: true };
}

export async function addLocation(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const branch_id = String(formData.get("branch_id") ?? "");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const label_en = String(formData.get("label_en") ?? "").trim();
  const label_ar = String(formData.get("label_ar") ?? "").trim();

  if (!branch_id || !code || !label_en || !label_ar) {
    return { ok: false, error: "Code and both labels are required." };
  }
  if (!/^[A-Z0-9]{2,8}$/.test(code)) {
    return { ok: false, error: "Use 2–8 letters or digits for the code, e.g. TR2." };
  }

  const { error } = await db()
    .from("qr_locations")
    .insert({ branch_id, code, label_en, label_ar });
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "That code already exists at this branch." : error.message,
    };
  }

  revalidatePath("/admin/branches");
  revalidatePath("/admin/qr");
  return { ok: true };
}

export async function deleteLocation(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing location." };

  const { error } = await db().from("qr_locations").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      error: error.code === "23503"
        ? "Cases already reference this location, so it cannot be removed."
        : error.message,
    };
  }

  revalidatePath("/admin/branches");
  revalidatePath("/admin/qr");
  return { ok: true };
}

// ------------------------------------------------------------- credentials

export async function changePassword(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!(await checkCredentials(adminUser(), current))) {
    return { ok: false, error: "That is not the current password." };
  }

  const problem = validateNewPassword(next, confirm, current);
  if (problem) return { ok: false, error: problem };

  // Re-issue this session against the new password, or the change would log
  // the person making it straight out along with everyone else.
  const pv = await setAdminPassword(next);
  await reissueAdminSession(pv);
  await audit("password_change", adminUser(), { detail: "Admin password changed" });

  revalidatePath("/admin/settings");
  return { ok: true };
}

// ---------------------------------------------------------------- archiving

/**
 * A second password, separate from the admin login, because this is the only
 * action in the system that destroys patient records. It lives in an
 * environment variable rather than the source: the repository is public, and a
 * password that deletes data must not be readable by everyone.
 */
function masterPasswordOk(supplied: string): boolean {
  const master = process.env.ARCHIVE_MASTER_PASS ?? "";
  return master.length > 0 && supplied === master;
}

export async function prepareArchive(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  if (!masterPasswordOk(String(formData.get("master") ?? ""))) {
    return { ok: false, error: "That is not the archive password." };
  }

  const scope = String(formData.get("scope") ?? "closed");
  const beforeRaw = String(formData.get("before") ?? "").trim();

  let rows = await listCases({}, 5000);
  if (scope !== "all") {
    // Only closed cases are finished now; "solved" still awaits review.
    rows = rows.filter((c) => c.status === "closed");
  }
  if (beforeRaw) {
    const cutoff = new Date(`${beforeRaw}T23:59:59.999+04:00`).getTime();
    rows = rows.filter((c) => new Date(c.created_at).getTime() <= cutoff);
  }

  if (rows.length === 0) {
    return { ok: false, error: "No cases match that selection." };
  }

  const refs = rows.map((r) => r.ref).sort();
  await setPending({
    caseIds: rows.map((r) => r.id),
    refs,
    count: rows.length,
    voiceCount: rows.filter((r) => r.voice_url).length,
    voiceBytes: await voiceBytesFor(rows),
    scope: scope === "all" ? "All cases" : "Closed and resolved",
    preparedAt: new Date().toISOString(),
    downloadedAt: null,
  });

  await audit("archive_prepared", adminUser(), {
    detail: `${rows.length} case${rows.length === 1 ? "" : "s"} staged (${scope === "all" ? "all cases" : "closed and resolved"})`,
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function cancelArchive(): Promise<ActionResult> {
  await requireAdmin();
  await clearPending();
  revalidatePath("/admin/settings");
  return { ok: true };
}

/**
 * Deletes exactly the ids written into the ZIP. Cases created after the batch
 * was prepared are untouched, so nothing disappears unarchived.
 */
export async function confirmArchiveDelete(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  if (!masterPasswordOk(String(formData.get("master") ?? ""))) {
    return { ok: false, error: "That is not the archive password." };
  }
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return { ok: false, error: 'Type DELETE to confirm.' };
  }

  const pending = await getPending();
  if (!pending) return { ok: false, error: "Nothing is prepared for archiving." };
  if (!pending.downloadedAt) {
    return { ok: false, error: "Download the archive first — nothing is deleted until you hold the file." };
  }

  await deleteCases(pending.caseIds);
  await appendArchiveLog({
    at: new Date().toISOString(),
    caseCount: pending.count,
    voiceCount: pending.voiceCount,
    bytesFreed: pending.voiceBytes,
    refFirst: pending.refs[0] ?? "",
    refLast: pending.refs[pending.refs.length - 1] ?? "",
    scope: pending.scope,
    note: `${pending.count} cases and ${pending.voiceCount} voice notes exported and removed.`,
  });
  await clearPending();
  await audit("archive_deleted", adminUser(), {
    detail: `${pending.count} case${pending.count === 1 ? "" : "s"} and ${pending.voiceCount} recording${pending.voiceCount === 1 ? "" : "s"} removed (${pending.refs[0] ?? ""} to ${pending.refs[pending.refs.length - 1] ?? ""})`,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/cases");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

// ------------------------------------------------------------ branch logins

export type LoginsResult =
  | { ok: true; logins: GeneratedLogin[] }
  | { ok: false; error: string };

/**
 * Creates logins for branches that have none, or resets them all. The plaintext
 * passwords come back once, for the admin to hand out — only hashes are stored,
 * so there is no way to read them again afterwards.
 */
export async function createBranchLogins(formData: FormData): Promise<LoginsResult> {
  await requireAdmin();

  const reset = formData.get("reset") === "on";
  const only = String(formData.get("only") ?? "").trim() || undefined;

  try {
    const logins = await generateBranchLogins({ only, reset });
    if (logins.length === 0) {
      return { ok: false, error: "Every branch already has a login. Tick reset to reissue them." };
    }
    await audit("branch_logins", adminUser(), {
      detail: `${logins.length} login${logins.length === 1 ? "" : "s"} issued${reset ? " (full reset)" : ""}`,
    });
    revalidatePath("/admin/settings");
    return { ok: true, logins };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create logins." };
  }
}

/**
 * Called when a branch first opens a case. Viewing it is the response, so the
 * clock stops here rather than waiting for someone to remember to set a status.
 */
export async function markOpened(caseId: string): Promise<void> {
  try {
    const session = await currentSession();
    if (!session) return;

    const { data } = await db().from("cases").select("status").eq("id", caseId).maybeSingle();
    if ((data as { status: Status } | null)?.status !== "new") return;

    await db().from("cases").update({ status: "opened" }).eq("id", caseId);
    await addEvent(caseId, "status", `Opened by ${session.username}.`);
    revalidatePath("/admin/cases");
  } catch {
    // Opening a case must never fail because of bookkeeping.
  }
}

// -------------------------------------------------------------- email setup

export async function saveSmtpSettings(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const existing = await getSmtp();
  const typed = String(formData.get("pass") ?? "");

  const next: SmtpSettings = {
    host: String(formData.get("host") ?? "").trim(),
    port: Number(formData.get("port") ?? 465) || 465,
    secure: formData.get("secure") === "on",
    user: String(formData.get("user") ?? "").trim(),
    // Blank means "leave it alone" — the field is never pre-filled with it.
    pass: typed || existing.pass,
    fromName: String(formData.get("fromName") ?? "").trim() || "Lumiere Patient Feedback",
    fromEmail: String(formData.get("fromEmail") ?? "").trim(),
    adminEmail: String(formData.get("adminEmail") ?? "").trim(),
    ccEmails: String(formData.get("ccEmails") ?? "").trim(),
    enabled: formData.get("enabled") === "on",
  };

  if (!next.host) return { ok: false, error: "Enter the SMTP server address." };
  if (!next.fromEmail) return { ok: false, error: "Enter the address mail should come from." };
  if (next.enabled && !next.pass) return { ok: false, error: "Enter the password before switching notifications on." };

  await saveSmtp(next);
  await audit("smtp_settings", adminUser(), {
    detail: next.enabled ? "Email notifications on" : "Email notifications off",
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function sendTestEmail(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const to = String(formData.get("to") ?? "").trim();
  if (!to) return { ok: false, error: "Enter an address to send the test to." };

  const res = await sendMail(
    [to],
    "Lumiere — test message",
    `<p style="margin:0 0 4px;font-size:16px;color:#c9a84c">Email is working</p>
     <p style="margin:0;color:#a89364;font-size:13px">
       If you can read this, the clinic's feedback system can reach you. Nothing else
       needs doing.
     </p>`
  );
  if (!res.ok) return { ok: false, error: res.error };

  await audit("smtp_settings", adminUser(), { detail: `Test message sent to ${to}` });
  return { ok: true };
}

export async function saveBranchEmail(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const code = String(formData.get("code") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!code) return { ok: false, error: "Missing branch." };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "That does not look like an email address." };
  }

  await setBranchEmail(code, email);
  revalidatePath("/admin/settings");
  revalidatePath("/admin/branches");
  return { ok: true };
}

// ------------------------------------------------------------- add a branch

export async function createBranch(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name_en = String(formData.get("name_en") ?? "").trim();
  const name_ar = String(formData.get("name_ar") ?? "").trim();

  if (!/^[A-Z0-9]{2,8}$/.test(code)) {
    return { ok: false, error: "Use 2–8 letters or digits for the code, for example BR11." };
  }
  if (!name_en || !name_ar) return { ok: false, error: "Both names are required." };

  const { data, error } = await db()
    .from("branches")
    .insert({ code, name_en, name_ar, is_active: true })
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "That branch code already exists." : error.message,
    };
  }

  // A branch with no QR points cannot receive anything, so seed the usual three.
  const branchId = (data as { id: string }).id;
  await db().from("qr_locations").insert([
    { branch_id: branchId, code: "REC", label_en: "Reception", label_ar: "الاستقبال" },
    { branch_id: branchId, code: "TR1", label_en: "Treatment Room", label_ar: "غرفة العلاج" },
    { branch_id: branchId, code: "WA1", label_en: "Waiting Area", label_ar: "منطقة الانتظار" },
  ]);

  await audit("branch_added", adminUser(), { detail: `${code} — ${name_en}` });
  revalidatePath("/admin/branches");
  revalidatePath("/admin/qr");
  revalidatePath("/admin/settings");
  revalidatePath("/start");
  return { ok: true };
}

// ------------------------------------------------------------ intake links

export async function saveIntakeCodes(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const clean = (v: unknown) => String(v ?? "").trim().replace(/[^A-Za-z0-9_-]/g, "");
  const codes: IntakeCodes = {
    branch: clean(formData.get("branch")),
    "call-center": clean(formData.get("callcenter")),
  };

  await writeJson(INTAKE_KEY, codes);
  await ensureInternalLocations();
  await audit("intake_codes", adminUser(), {
    detail:
      codes.branch && codes["call-center"]
        ? "Both intake links protected"
        : "One or both intake links left unguarded",
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}

// ------------------------------------------------------- delete one case

/**
 * Removes a single case outright — for a test entry, a duplicate or spam.
 * Unlike archiving there is no export first, so it is administrator-only,
 * needs the archive password, and asks for the reference to be typed out:
 * the point is that it cannot happen by a mis-click on the wrong row.
 */
export async function deleteOneCase(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const typedRef = String(formData.get("confirm_ref") ?? "").trim().toUpperCase();

  if (!masterPasswordOk(String(formData.get("master") ?? ""))) {
    return { ok: false, error: "That is not the archive password." };
  }
  if (!id) return { ok: false, error: "Missing case." };

  const c = await getCase(id);
  if (!c) return { ok: false, error: "That case no longer exists." };

  if (typedRef !== c.ref.toUpperCase()) {
    return { ok: false, error: `Type ${c.ref} exactly to confirm you mean this case.` };
  }

  await deleteCases([id]);
  await audit("case_deleted", adminUser(), {
    branch: c.branches?.name_en ?? null,
    detail: `${c.ref} — ${c.patient_name} — permanently removed`,
  });

  revalidatePath("/admin/cases");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

// ------------------------------------------------- log a complaint in-app

export type LoggedResult = { ok: true; ref: string } | { ok: false; error: string };

/**
 * A complaint raised by staff rather than by the patient. A branch may only
 * raise one against itself; the call centre and the administrator may pick any
 * branch. The case then follows the ordinary cycle.
 */
export async function logComplaint(formData: FormData): Promise<LoggedResult> {
  const session = await requireSession();

  const wantedBranch = String(formData.get("branchCode") ?? "").trim().toUpperCase();
  const category = String(formData.get("category") ?? "");
  if (!CATEGORIES.includes(category as Category)) {
    return { ok: false, error: "Choose what the complaint is about." };
  }

  let branchCode = wantedBranch;
  let locationCode: string;

  if (session.role === "branch") {
    // Ignore whatever was posted: a branch raises against itself, full stop.
    branchCode = session.branchCode;
    locationCode = MANAGER_CODE;
  } else if (session.role === "call_center") {
    locationCode = CALLCENTER_CODE;
  } else {
    locationCode = String(formData.get("channel") ?? "") === "cc" ? CALLCENTER_CODE : MANAGER_CODE;
  }

  if (!branchCode) return { ok: false, error: "Choose the branch this concerns." };

  try {
    await ensureInternalLocations();
    const { ref, id } = await createCase({
      branchCode,
      locationCode,
      category: category as Category,
      description: String(formData.get("description") ?? "").slice(0, 4000),
      patientName: String(formData.get("patientName") ?? "").slice(0, 120),
      mobile: String(formData.get("mobile") ?? ""),
      preferredLang: String(formData.get("preferredLang") ?? "en") === "ar" ? "ar" : "en",
      contactMethod:
        String(formData.get("contactMethod") ?? "call") === "whatsapp" ? "whatsapp" : "call",
      preferredTime: (["morning", "afternoon", "evening"].includes(
        String(formData.get("preferredTime") ?? "")
      )
        ? String(formData.get("preferredTime"))
        : "morning") as "morning" | "afternoon" | "evening",
      voice: null,
    });

    await addEvent(id, "note", `Raised by ${session.username} on the patient's behalf.`);
    await audit("case_logged", session.username, {
      branch: session.role === "branch" ? session.branchName : branchCode,
      detail: `${ref} raised on a patient's behalf`,
    });

    revalidatePath("/admin/cases");
    revalidatePath("/admin/logged");
    revalidatePath("/admin/dashboard");
    return { ok: true, ref };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "FAILED";
    const friendly: Record<string, string> = {
      INVALID_BRANCH: "That branch is not available.",
      INVALID_MOBILE: "Enter a valid UAE mobile, for example 050 123 4567.",
      INVALID_NAME: "Enter the patient's name.",
      EMPTY_DETAILS: "Write down what the patient told you.",
    };
    return { ok: false, error: friendly[msg] ?? "Could not save it. Try again." };
  }
}

export async function createCallCentreLogin(): Promise<LoginsResult> {
  await requireAdmin();
  const { username, password } = await generateCallCentreLogin();
  await audit("branch_logins", adminUser(), { detail: "Call centre login issued" });
  revalidatePath("/admin/settings");
  return {
    ok: true,
    logins: [{ branchCode: "CC", branchName: "Call centre", username, password }],
  };
}


// ------------------------------------------------------------- follow-ups

/** Push a case out to a new date, from the follow-up view. */
export async function rescheduleFollowUp(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  await assertCaseInScope(id);

  const at = String(formData.get("follow_up_at") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) return { ok: false, error: "Choose a date." };
  if (new Date(`${at}T00:00:00.000+04:00`).getTime() < clinicDayStart().getTime()) {
    return { ok: false, error: "Choose today or a date after it." };
  }
  if (!note) return { ok: false, error: "Say what still needs checking." };

  const rec = await setFollowUp(id, { at, note, setBy: session.username });
  await db().from("cases").update({ status: "follow_up", closed_at: null }).eq("id", id);
  await addEvent(id, "note", `Follow-up moved to ${at} (round ${rec.round}). ${note}`);
  await audit("follow_up_set", session.username, { detail: `${at} — round ${rec.round}` });

  refresh(id);
  revalidatePath("/admin/follow-up");
  return { ok: true };
}

/** Nothing further needed — the case is finished for good. */
export async function closePermanently(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!id) return { ok: false, error: "Missing case." };
  if (!note) return { ok: false, error: "Say what the follow-up found." };

  const { error } = await db()
    .from("cases")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await clearFollowUp(id);
  await addEvent(id, "closed", `Follow-up complete, closed for good. ${note}`);

  const fresh = await getCase(id);
  if (fresh) void notifyClosed(fresh, note, Number(fresh.satisfaction ?? 0)).catch(() => {});

  refresh(id);
  revalidatePath("/admin/follow-up");
  return { ok: true };
}

// ---------------------------------------------------------- manual reminder

export type ReminderResult =
  | { ok: true; summary: string }
  | { ok: false; error: string };

/**
 * A nudge sent by hand when a case has gone quiet. Administrator only — a
 * branch chasing itself is not a reminder, and management is copied, so this
 * is not something to fire off casually.
 */
export async function sendCaseReminder(formData: FormData): Promise<ReminderResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const message = String(formData.get("message") ?? "").trim().slice(0, 1000);
  if (!id) return { ok: false, error: "Missing case." };

  const c = await getCase(id);
  if (!c) return { ok: false, error: "That case no longer exists." };

  const res = await notifyReminder(c, message, adminUser());
  if (!res.ok) return { ok: false, error: res.error ?? "Could not send the reminder." };

  await addEvent(id, "note", `Reminder emailed by ${adminUser()}.${message ? ` ${message}` : ""}`);
  await audit("reminder_sent", adminUser(), {
    branch: c.branches?.name_en ?? null,
    detail: `${c.ref} — ${res.to.length} recipient${res.to.length === 1 ? "" : "s"}${
      res.cc.length ? `, ${res.cc.length} copied` : ""
    }`,
  });

  refresh(id);
  const ccNote = res.cc.length ? `, copying ${res.cc.length} management address${res.cc.length === 1 ? "" : "es"}` : "";
  return { ok: true, summary: `Reminder sent to ${res.to.join(", ")}${ccNote}.` };
}
