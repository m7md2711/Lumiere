import { db, VOICE_BUCKET } from "./supabase";
import { categoryLabel } from "./i18n";
import { clinicDateEnd, clinicDateStart, formatForCsv } from "./time";
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
      (c) => !["resolved", "closed"].includes(c.status) && new Date(c.sla_due_at).getTime() < now
    );
  }
  return rows;
}

export async function getCase(id: string): Promise<CaseWithBranch | null> {
  const { data } = await db().from("cases").select(CASE_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as CaseWithBranch) ?? null;
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
  const slaDue = new Date(now.getTime() + slaHoursFor(priority) * 3600_000);

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
      status: "assigned" as Status,
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

  void notifyNewCase({
    ref: row.ref,
    branch: branch.name_en,
    category: categoryLabel(input.category, "en"),
    priority,
    name,
    mobile,
    description: description || "(voice note only)",
    id: row.id,
  });

  return { ref: row.ref, id: row.id };
}

// ------------------------------------------------------------- notify

type NotifyPayload = {
  ref: string; branch: string; category: string; priority: string;
  name: string; mobile: string; description: string; id: string;
};

/** Best-effort email alert. No key configured means no email, and no error. */
async function notifyNewCase(p: NotifyPayload): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  if (!key || !to) return;

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Lumiere Feedback <onboarding@resend.dev>",
        to: to.split(",").map((s) => s.trim()),
        subject: `[${p.priority.toUpperCase()}] ${p.ref} — ${p.branch}`,
        html:
          `<h2>New patient feedback</h2>` +
          `<p><b>Reference:</b> ${p.ref}<br>` +
          `<b>Branch:</b> ${p.branch}<br>` +
          `<b>Category:</b> ${p.category}<br>` +
          `<b>Priority:</b> ${p.priority}<br>` +
          `<b>Patient:</b> ${p.name} — ${p.mobile}</p>` +
          `<p>${p.description}</p>` +
          (base ? `<p><a href="${base}/admin/cases/${p.id}">Open the case</a></p>` : ""),
      }),
    });
  } catch {
    // A down mailer must never fail a patient's submission.
  }
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
      !["resolved", "closed"].includes(c.status) && new Date(c.sla_due_at).getTime() < now
        ? "YES" : "",
      c.patient_name, c.mobile, c.preferred_lang, c.contact_method, c.preferred_time,
      c.description ?? "", c.voice_url ?? "", c.resolution_note ?? "", c.closure_reason ?? "",
      c.refund_amount ?? "", c.refund_status ?? "", c.satisfaction ?? "", formatForCsv(c.closed_at),
    ].map(esc).join(",")
  );

  return "﻿" + [head.join(","), ...lines].join("\r\n");
}

export type { Case };
