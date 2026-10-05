import { db } from "./supabase";
import { getBranches } from "./cases";

/**
 * Where a case came in. A patient scanning the QR at reception is one route;
 * a complaint made face to face to a branch manager, or by phone to the call
 * centre, is another — same workflow, but worth counting apart, because an
 * internally logged complaint never reached the patient-facing form at all.
 *
 * Intake points are modelled as qr_locations with reserved codes rather than a
 * new column: the branch/location relationship already exists, filtering and
 * the case detail view already understand it, and it needs no migration
 * against a live database. These two never get a printed QR poster.
 */
export const MANAGER_CODE = "MGR";
export const CALLCENTER_CODE = "CC";

export const INTERNAL_CODES = [MANAGER_CODE, CALLCENTER_CODE] as const;

export type Channel = "branch" | "call-center";

export type Source = "patient" | "branch_manager" | "call_center";

export const channelCode: Record<Channel, string> = {
  branch: MANAGER_CODE,
  "call-center": CALLCENTER_CODE,
};

export const channelMeta: Record<Channel, { en: string; ar: string; blurb: string }> = {
  branch: {
    en: "Branch manager",
    ar: "مدير الفرع",
    blurb: "A patient raised this in person at the branch.",
  },
  "call-center": {
    en: "Call centre",
    ar: "مركز الاتصال",
    blurb: "A patient raised this by phone.",
  },
};

export function sourceOf(locationCode: string | null | undefined): Source {
  if (locationCode === MANAGER_CODE) return "branch_manager";
  if (locationCode === CALLCENTER_CODE) return "call_center";
  return "patient";
}

export function isInternal(locationCode: string | null | undefined): boolean {
  return sourceOf(locationCode) !== "patient";
}

export const sourceLabels: Record<Source, string> = {
  patient: "Patient — scanned or linked",
  branch_manager: "Logged by a branch manager",
  call_center: "Logged by the call centre",
};

export const sourceShort: Record<Source, string> = {
  patient: "Patient",
  branch_manager: "Branch manager",
  call_center: "Call centre",
};

/**
 * Makes sure every active branch has the two internal intake points. Safe to
 * call repeatedly — existing rows are left alone.
 */
export async function ensureInternalLocations(): Promise<void> {
  const branches = (await getBranches()).filter((b) => b.is_active);
  if (branches.length === 0) return;

  const rows = branches.flatMap((b) => [
    {
      branch_id: b.id,
      code: MANAGER_CODE,
      label_en: "Branch manager",
      label_ar: "مدير الفرع",
    },
    {
      branch_id: b.id,
      code: CALLCENTER_CODE,
      label_en: "Call centre",
      label_ar: "مركز الاتصال",
    },
  ]);

  // onConflict leaves anything already there untouched.
  await db().from("qr_locations").upsert(rows, {
    onConflict: "branch_id,code",
    ignoreDuplicates: true,
  });
}

// ------------------------------------------------------------ access codes

export const INTAKE_KEY = "intake_codes";

export type IntakeCodes = { branch: string; "call-center": string };

export const defaultIntakeCodes: IntakeCodes = { branch: "", "call-center": "" };

/**
 * These links create real cases, so they are not left wide open. A blank code
 * means the link is unguarded, which the settings page says plainly.
 */
export function intakeLinkFor(channel: Channel, code: string): string {
  const b = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  const q = code ? `?k=${encodeURIComponent(code)}` : "";
  return `${b}/intake/${channel}${q}`;
}
