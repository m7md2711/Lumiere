"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { checkCredentials, adminUser, issueSession, requireAdmin, setAdminPassword } from "@/lib/auth";
import { validateNewPassword } from "@/lib/password";
import { addEvent, slaHoursFor } from "@/lib/cases";
import { statusLabel } from "@/lib/i18n";
import { formatLongDateTime } from "@/lib/time";
import {
  appendArchiveLog, buildZip, clearPending, deleteCases, getPending,
  setPending, voiceBytesFor,
} from "@/lib/archive";
import { listCases } from "@/lib/cases";
import { NOTE_REQUIRED_STATUSES, STATUSES } from "@/lib/types";
import type { Priority, Status } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

function refresh(id: string) {
  revalidatePath(`/admin/cases/${id}`);
  revalidatePath("/admin/cases");
  revalidatePath("/admin/dashboard");
}

// ---------------------------------------------------------------- cases

export async function changeStatus(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as Status;
  const note = String(formData.get("note") ?? "").trim();

  if (!id || !STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  if (NOTE_REQUIRED_STATUSES.includes(status) && !note) {
    return { ok: false, error: `Moving a case to "${statusLabel(status)}" needs a note.` };
  }

  const patch: Record<string, unknown> = { status };
  if (status === "closed" || status === "resolved") {
    if (note) patch.resolution_note = note;
    if (status === "closed") patch.closed_at = new Date().toISOString();
  }

  const { error } = await db().from("cases").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await addEvent(
    id,
    status === "closed" ? "closed" : "status",
    `Status changed to ${statusLabel(status)}.${note ? ` ${note}` : ""}`
  );
  refresh(id);
  return { ok: true };
}

export async function changePriority(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
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
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!id || !note) return { ok: false, error: "Write a note first." };

  await addEvent(id, "note", note);
  refresh(id);
  return { ok: true };
}

export async function logContact(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const method = String(formData.get("method") ?? "call");
  const outcome = String(formData.get("outcome") ?? "").trim();
  if (!id || !outcome) return { ok: false, error: "Describe the outcome of the contact." };

  // First contact moves a case off the assigned pile automatically.
  const { data } = await db().from("cases").select("status").eq("id", id).maybeSingle();
  if ((data as { status: Status } | null)?.status === "assigned") {
    await db().from("cases").update({ status: "in_progress" }).eq("id", id);
  }

  await addEvent(id, "contact", `Contact attempt by ${method}: ${outcome}`);
  refresh(id);
  return { ok: true };
}

export async function escalate(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id || !reason) return { ok: false, error: "Escalation needs a reason." };

  const { error } = await db().from("cases").update({ status: "escalated" }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await addEvent(id, "escalation", `Escalated: ${reason}`);
  refresh(id);
  return { ok: true };
}

export async function approveRefund(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const amount = Number(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!id) return { ok: false, error: "Missing case." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a refund amount." };
  if (!reason) return { ok: false, error: "Refunds need a reason." };

  const { error } = await db()
    .from("cases")
    .update({
      status: "refund_approved",
      refund_amount: amount,
      refund_status: "pending",
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await addEvent(id, "refund", `Refund of AED ${amount.toFixed(2)} approved: ${reason}`);
  refresh(id);
  return { ok: true };
}

export async function markRefundProcessed(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
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
  const note = String(formData.get("resolution_note") ?? "").trim();
  const reason = String(formData.get("closure_reason") ?? "").trim();
  const satisfaction = Number(formData.get("satisfaction"));

  if (!id) return { ok: false, error: "Missing case." };
  if (!note) return { ok: false, error: "A resolution note is required to close." };
  if (!reason) return { ok: false, error: "Choose a closure reason." };
  if (!Number.isInteger(satisfaction) || satisfaction < 1 || satisfaction > 5) {
    return { ok: false, error: "Record the patient's satisfaction from 1 to 5." };
  }

  const { error } = await db()
    .from("cases")
    .update({
      status: "closed",
      resolution_note: note,
      closure_reason: reason,
      satisfaction,
      closed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

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
  await issueSession(pv);

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
    rows = rows.filter((c) => c.status === "closed" || c.status === "resolved");
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

  revalidatePath("/admin/settings");
  revalidatePath("/admin/cases");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}
