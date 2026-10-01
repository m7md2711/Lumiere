export type Lang = "en" | "ar";
export type ContactMethod = "call" | "whatsapp";
export type PreferredTime = "morning" | "afternoon" | "evening";
export type Priority = "low" | "normal" | "high" | "urgent";
/**
 * The case workflow. A branch carries a case from new to solved; only the
 * administrator may close it, after reviewing the trail and the signed form.
 * `escalated` sits outside the sequence as the route up when a branch cannot
 * resolve something itself.
 */
export type Status =
  | "new" | "opened" | "under_review" | "solved" | "escalated" | "closed";

export type EventType =
  | "created" | "status" | "note" | "contact" | "escalation"
  | "refund" | "evidence" | "closed";

export const CATEGORIES = [
  "appointment", "staff", "treatment", "medical",
  "payment", "facility", "suggestion", "appreciation", "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES: Status[] = [
  "new", "opened", "under_review", "solved", "escalated", "closed",
];

/** What a branch may set. Closing is the administrator's alone. */
export const BRANCH_STATUSES: Status[] = ["opened", "under_review", "solved", "escalated"];

/** Solving requires the patient's signed complaint form to be attached. */
export const EVIDENCE_REQUIRED_STATUSES: Status[] = ["solved"];

/** The branch has this long to move a case off `new`. */
export const FIRST_RESPONSE_HOURS = 24;

export const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

/** Statuses that may only be set together with an explanatory note. */
export const NOTE_REQUIRED_STATUSES: Status[] = [
  "under_review", "solved", "escalated", "closed",
];

/** A case stops counting against its SLA once it reaches one of these. */
export const TERMINAL_STATUSES: Status[] = ["closed"];

export type Branch = {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  is_active: boolean;
};

/** A case whose first response is still outstanding past the 24-hour mark. */
export function awaitingFirstResponse(c: Pick<Case, "status">): boolean {
  return c.status === "new";
}

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

/** Repeat contact from the same patient, by mobile. */
export type RepeatInfo = { total: number; isRepeat: boolean };
