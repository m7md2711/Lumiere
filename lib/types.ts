export type Lang = "en" | "ar";
export type ContactMethod = "call" | "whatsapp";
export type PreferredTime = "morning" | "afternoon" | "evening";
export type Priority = "low" | "normal" | "high" | "urgent";
export type Status =
  | "new" | "assigned" | "in_progress" | "escalated"
  | "refund_approved" | "resolved" | "closed";
export type EventType =
  | "created" | "status" | "note" | "contact" | "escalation" | "refund" | "closed";

export const CATEGORIES = [
  "appointment", "staff", "treatment", "medical",
  "payment", "facility", "suggestion", "appreciation", "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES: Status[] = [
  "new", "assigned", "in_progress", "escalated",
  "refund_approved", "resolved", "closed",
];

export const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

/** Statuses that may only be set together with an explanatory note. */
export const NOTE_REQUIRED_STATUSES: Status[] = [
  "escalated", "refund_approved", "resolved", "closed",
];

/** A case stops counting against its SLA once it reaches one of these. */
export const TERMINAL_STATUSES: Status[] = ["resolved", "closed"];

export type Branch = {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  is_active: boolean;
};

export type QrLocation = {
  id: string;
  branch_id: string;
  code: string;
  label_en: string;
  label_ar: string;
};

export type CaseEvent = {
  id: string;
  case_id: string;
  type: EventType;
  message: string;
  created_at: string;
};

export type Case = {
  id: string;
  ref: string;
  branch_id: string;
  qr_location_id: string | null;
  category: Category;
  description: string | null;
  voice_url: string | null;
  patient_name: string;
  mobile: string;
  preferred_lang: Lang;
  contact_method: ContactMethod;
  preferred_time: PreferredTime;
  priority: Priority;
  status: Status;
  assigned_to: string | null;
  sla_due_at: string;
  resolution_note: string | null;
  closure_reason: string | null;
  refund_amount: number | null;
  refund_status: "pending" | "processed" | null;
  satisfaction: number | null;
  closed_at: string | null;
  created_at: string;
};

export type CaseWithBranch = Case & {
  branches: Pick<Branch, "code" | "name_en" | "name_ar"> | null;
  qr_locations: Pick<QrLocation, "code" | "label_en" | "label_ar"> | null;
};

export function isOverdue(c: Pick<Case, "status" | "sla_due_at">): boolean {
  if (TERMINAL_STATUSES.includes(c.status)) return false;
  return new Date(c.sla_due_at).getTime() < Date.now();
}
