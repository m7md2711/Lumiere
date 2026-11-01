import { NextResponse } from "next/server";
import { verifyApiKey, type ApiKey } from "./apikeys";
import { getBranches } from "./cases";
import { categoryLabel, statusLabel } from "./i18n";
import { isOverdue, normalizeCategory } from "./types";
import { sourceOf } from "./sources";
import type { CaseWithBranch } from "./types";

export const API_VERSION = "1";

/** Every response shares one envelope, so a consumer parses one shape. */
export function ok(data: unknown, meta: Record<string, unknown> = {}) {
  return NextResponse.json(
    { data, meta: { version: API_VERSION, generatedAt: new Date().toISOString(), ...meta } },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export function fail(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message }, meta: { version: API_VERSION } },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Accepts `Authorization: Bearer <key>` or `X-Api-Key: <key>`. Returns the key
 * record, or a ready-made 401 to return as-is.
 */
export async function authorize(req: Request): Promise<{ key: ApiKey } | { response: NextResponse }> {
  const auth = req.headers.get("authorization") ?? "";
  const secret = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : (req.headers.get("x-api-key") ?? "").trim();

  if (!secret) {
    return { response: fail(401, "missing_key", "Send the key as `Authorization: Bearer <key>`.") };
  }
  const key = await verifyApiKey(secret);
  if (!key) return { response: fail(401, "invalid_key", "That key is not valid or has been revoked.") };
  return { key };
}

/**
 * The branch a request may see. A branch-bound key cannot widen itself with a
 * query parameter — its own branch always wins, exactly as for a branch login.
 */
export async function scopeFor(
  key: ApiKey,
  requestedCodes: string | null
): Promise<{ branchIds: string[] | null } | { error: NextResponse }> {
  if (key.branchId) return { branchIds: [key.branchId] };
  if (!requestedCodes) return { branchIds: null };

  const wanted = requestedCodes.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  const all = await getBranches();
  const ids = all.filter((b) => wanted.includes(b.code)).map((b) => b.id);
  if (ids.length === 0) return { error: fail(400, "unknown_branch", `No branch matches ${requestedCodes}.`) };
  return { branchIds: ids };
}

/** The stable public shape of a case. Internal ids stay internal. */
export function serializeCase(c: CaseWithBranch) {
  const cat = normalizeCategory(c.category);
  return {
    ref: c.ref,
    status: c.status,
    statusLabel: statusLabel(c.status),
    priority: c.priority,
    category: cat,
    categoryLabel: categoryLabel(cat, "en"),
    source: sourceOf(c.qr_locations?.code),
    branch: c.branches ? { code: c.branches.code, name: c.branches.name_en, nameAr: c.branches.name_ar } : null,
    location: c.qr_locations ? { code: c.qr_locations.code, label: c.qr_locations.label_en } : null,
    patient: {
      name: c.patient_name,
      mobile: c.mobile,
      preferredLanguage: c.preferred_lang,
      contactMethod: c.contact_method,
      preferredTime: c.preferred_time,
    },
    description: c.description,
    voiceNoteUrl: c.voice_url,
    createdAt: c.created_at,
    responseDueAt: c.sla_due_at,
    overdue: isOverdue(c),
    closedAt: c.closed_at,
    resolutionNote: c.resolution_note,
    closureReason: c.closure_reason,
    satisfaction: c.satisfaction,
    refund: c.refund_amount ? { amount: Number(c.refund_amount), status: c.refund_status } : null,
  };
}
