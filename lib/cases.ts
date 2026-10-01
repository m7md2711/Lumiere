import { db, VOICE_BUCKET } from "./supabase";
import { categoryLabel } from "./i18n";
import { clinicDateEnd, clinicDateStart, formatForCsv } from "./time";
import { notifyNewCase } from "./notify";
import { FIRST_RESPONSE_HOURS } from "./types";
import type {
  Branch, Case, CaseEvent, CaseWithBranch, Category, ContactMethod,
  EventType, Lang, PreferredTime, Priority, QrLocation, Status,
} from "./types";

/** SLA clock: 24h for anything above normal, 48h otherwise. */
export function slaHoursFor(priority: Priority): number {
  return priority === "urgent" || priority === "high" ? 24 : 48;
}

/** A medical concern is never routine — it opens at high priority. */
export function priorityForCategory(category: Category): Priority {
  return category === "medical" ? "high" : "normal";
}

/** 05x xxx xxxx, with or without spaces, and the +971 / 00971 forms. */
export function normalizeMobile(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
  let local: string | null = null;

  if (/^971\d{9}$/.test(digits)) local = "0" + digits.slice(3);
  else if (/^0\d{9}$/.test(digits)) local = digits;
  else if (/^\d{9}$/.test(digits)) local = "0" + digits;

  if (!local) return null;
  // UAE mobile prefixes.
  if (!/^0(50|52|54|55|56|58)\d{7}$/.test(local)) return null;
  return local;
}

/** wa.me wants the international form with no plus sign. */
export function toWhatsApp(local: string): string {
  return "971" + local.replace(/\D/g, "").replace(/^0/, "");
}

// ------------------------------------------------------------- reads

export async function getBranches(): Promise<Branch[]> {
  const { data, error } = await db().from("branches").select("*").order("code");
  if (error) throw error;
  return (data ?? []) as Branch[];
}

export async function getBranchByCode(code: string): Promise<Branch | null> {
  const { data } = await db()
    .from("branches")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  return (data as Branch) ?? null;
}

export async function getLocations(branchId?: string): Promise<QrLocation[]> {
  let q = db().from("qr_locations").select("*").order("code");
  if (branchId) q = q.eq("branch_id", branchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as QrLocation[];
}

const CASE_SELECT =
  "*, branches ( code, name_en, name_ar ), qr_locations ( code, label_en, label_ar )";

export type CaseFilters = {
  branch?: string;
  status?: string;
  category?: string;
  priority?: string;
  from?: string;
  to?: string;
  q?: string;
  overdue?: string;
};

export async function listCases(f: CaseFilters, limit = 300): Promise<CaseWithBranch[]> {
  let q = db().from("cases").select(CASE_SELECT).order("created_at", { ascending: false });

  if (f.branch) q = q.eq("branch_id", f.branch);
  if (f.status) q = q.eq("status", f.status);
  if (f.category) q = q.eq("category", f.category);
  if (f.priority) q = q.eq("priority", f.priority);
  // Date filters mean the clinic's day, not the server's UTC one.
  if (f.from) q = q.gte("created_at", clinicDateStart(f.from).toISOString());
  if (f.to) q = q.lte("created_at", clinicDateEnd(f.to).toISOString());
  if (f.q) {
    const s = f.q.replace(/[%,()]/g, " ").trim();
    if (s) q = q.or(`ref.ilike.%${s}%,patient_name.ilike.%${s}%,mobile.ilike.%${s}%`);
  }

  const { data, error } = await q.limit(limit);
  if (error) throw error;

  let rows = (data ?? []) as unknown as CaseWithBranch[];
  if (f.overdue === "1") {
    const now = Date.now();
    rows = rows.filter(
      (c) => c.status !== "closed" && new Date(c.sla_due_at).getTime() < now
    );
  }
  return rows;
}

export async function getCase(id: string): Promise<CaseWithBranch | null> {
  const { data } = await db().from("cases").select(CASE_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as CaseWithBranch) ?? null;
}

/**
 * How many cases this mobile has raised, including the one in hand. A patient
 * writing in repeatedly is the strongest signal in the system that something
 * was not actually fixed.
 */
export async function repeatCountFor(mobile: string, excludeId?: string): Promise<number> {
  if (!mobile) return 0;
  let q = db().from("cases").select("id", { count: "exact", head: true }).eq("mobile", mobile);
  if (excludeId) q = q.neq("id", excludeId);
  const { count } = await q;
  return (count ?? 0) + (excludeId ? 1 : 0);
}

/** Repeat counts for a whole list, in one query rather than one per row. */
export async function repeatCounts(mobiles: string[]): Promise<Record<string, number>> {
  const unique = Array.from(new Set(mobiles.filter(Boolean)));
  if (unique.length === 0) return {};

  const { data } = await db().from("cases").select("mobile").in("mobile", unique);
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { mobile: string }[]) {
    out[r.mobile] = (out[r.mobile] ?? 0) + 1;
  }
  return out;
}

export async function getEvents(caseId: string): Promise<CaseEvent[]> {
  const { data, error } = await db()
    .from("case_events")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CaseEvent[];
}

export async function addEvent(caseId: string, type: EventType, message: string): Promise<void> {
  const { error } = await db().from("case_events").insert({ case_id: caseId, type, message });
  if (error) throw error;
}

// ------------------------------------------------------------- create

export type NewCaseInput = {
  branchCode: string;
  locationCode?: string | null;
  category: Category;
  description?: string | null;
  patientName: string;
  mobile: string;
  preferredLang: Lang;
  contactMethod: ContactMethod;
  preferredTime: PreferredTime;
  voice?: { base64: string; mime: string } | null;
};

export async function createCase(input: NewCaseInput): Promise<{ ref: string; id: string }> {
  const sb = db();

  const branch = await getBranchByCode(input.branchCode);
  if (!branch || !branch.is_active) throw new Error("INVALID_BRANCH");

  let locationId: string | null = null;
  if (input.locationCode) {
    const { data } = await sb
      .from("qr_locations")
      .select("id")
      .eq("branch_id", branch.id)
      .eq("code", input.locationCode.toUpperCase())
      .maybeSingle();
    locationId = (data as { id: string } | null)?.id ?? null;
  }

  const mobile = normalizeMobile(input.mobile);
  if (!mobile) throw new Error("INVALID_MOBILE");

  const name = input.patientName.trim();
  const description = (input.description ?? "").trim();
  if (!name) throw new Error("INVALID_NAME");
  if (!description && !input.voice) throw new Error("EMPTY_DETAILS");

  const priority = priorityForCategory(input.category);
  const now = new Date();
  // One clock for everyone: the branch has 24 hours to pick a case up.
  const slaDue = new Date(now.getTime() + FIRST_RESPONSE_HOURS * 3600_000);

  const period =
    String(now.getUTCFullYear()).slice(2) + String(now.getUTCMonth() + 1).padStart(2, "0");
  const { data: refData, error: refErr } = await sb.rpc("next_case_ref", {
    p_branch_code: branch.code,
    p_period: period,
  });
  if (refErr) throw refErr;
  const ref = refData as string;

  // Upload the voice note first: a case row with a dangling voice_url would be
  // worse than a submission that fails cleanly and can be retried.
  let voiceUrl: string | null = null;
  if (input.voice) {
    const ext = input.voice.mime.includes("mp4") ? "mp4" : "webm";
    const path = `${branch.code}/${ref}.${ext}`;
    const bytes = Buffer.from(input.voice.base64, "base64");
    const { error: upErr } = await sb.storage
      .from(VOICE_BUCKET)
      .upload(path, bytes, { contentType: input.voice.mime, upsert: true });
    if (upErr) throw upErr;
    voiceUrl = sb.storage.from(VOICE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const { data: inserted, error } = await sb
    .from("cases")
    .insert({
      ref,
      branch_id: branch.id,
      qr_location_id: locationId,
      category: input.category,
      description: description || null,
      voice_url: voiceUrl,
      patient_name: name,
      mobile,
      preferred_lang: input.preferredLang,
      contact_method: input.contactMethod,
      preferred_time: input.preferredTime,
      priority,
      status: "new" as Status,
      assigned_to: branch.name_en,
      sla_due_at: slaDue.toISOString(),
    })
    .select("id, ref")
    .single();
  if (error) throw error;

  const row = inserted as { id: string; ref: string };
  await addEvent(
    row.id,
    "created",
    `Case created from ${branch.name_en}${input.locationCode ? ` · ${input.locationCode}` : ""} and assigned to ${branch.name_en}.`
  );

  // Fire and forget: a mail server being slow must not hold up a patient.
  void (async () => {
    const full = await getCase(row.id);
    if (!full) return;
    const repeat = await repeatCountFor(mobile);
    await notifyNewCase(full, repeat);
  })().catch(() => {});

  return { ref: row.ref, id: row.id };
}

// ------------------------------------------------------------- csv

export function casesToCsv(rows: CaseWithBranch[]): string {
  const head = [
    "Reference", "Created (GST)", "Branch", "Location", "Category", "Priority", "Status",
    "Assigned to", "SLA due (GST)", "Overdue", "Patient", "Mobile", "Language", "Contact method",
    "Preferred time", "Description", "Voice note", "Resolution note", "Closure reason",
    "Refund amount", "Refund status", "Satisfaction", "Closed at (GST)",
  ];
  const now = Date.now();

  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = rows.map((c) =>
    [
      c.ref, formatForCsv(c.created_at), c.branches?.name_en ?? "", c.qr_locations?.label_en ?? "",
      c.category, c.priority, c.status, c.assigned_to ?? "", formatForCsv(c.sla_due_at),
      c.status !== "closed" && new Date(c.sla_due_at).getTime() < now
        ? "YES" : "",
      c.patient_name, c.mobile, c.preferred_lang, c.contact_method, c.preferred_time,
      c.description ?? "", c.voice_url ?? "", c.resolution_note ?? "", c.closure_reason ?? "",
      c.refund_amount ?? "", c.refund_status ?? "", c.satisfaction ?? "", formatForCsv(c.closed_at),
    ].map(esc).join(",")
  );

  return "﻿" + [head.join(","), ...lines].join("\r\n");
}

export type { Case };
