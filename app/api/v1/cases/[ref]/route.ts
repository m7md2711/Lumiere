import { authorize, fail, ok, serializeCase } from "@/lib/api";
import { getEvents, relatedOpenCases, repeatCountFor } from "@/lib/cases";
import { db } from "@/lib/supabase";
import { getEvidenceFiles, signedUrlFor } from "@/lib/evidence";
import { getFollowUp } from "@/lib/followup";
import { getServiceDetail } from "@/lib/service-detail";
import type { CaseWithBranch } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT = "*, branches ( code, name_en, name_ar ), qr_locations ( code, label_en, label_ar )";

/** One case in full: the record, its timeline, follow-up, documents and context. */
export async function GET(req: Request, { params }: { params: { ref: string } }) {
  const auth = await authorize(req);
  if ("response" in auth) return auth.response;

  const ref = decodeURIComponent(params.ref).toUpperCase();
  const { data } = await db().from("cases").select(SELECT).eq("ref", ref).maybeSingle();
  const c = data as unknown as CaseWithBranch | null;

  // Another branch's case looks exactly like a missing one to a branch key.
  if (!c || (auth.key.branchId && c.branch_id !== auth.key.branchId)) {
    return fail(404, "not_found", `No case ${ref}.`);
  }

  const [events, follow, files, service, repeat, related] = await Promise.all([
    getEvents(c.id),
    getFollowUp(c.id),
    getEvidenceFiles(c.id),
    getServiceDetail(c.id),
    repeatCountFor(c.mobile, c.id),
    relatedOpenCases(c.mobile, c.id),
  ]);
  const links = await Promise.all(files.map((f) => signedUrlFor(f.path)));

  return ok({
    ...serializeCase(c),
    timeline: events.map((e) => ({ type: e.type, message: e.message, at: e.created_at })),
    followUp:
      c.status === "follow_up" && follow
        ? { dueOn: follow.at, note: follow.note, round: follow.round, setBy: follow.setBy }
        : null,
    // Links last one hour; fetch the case again for fresh ones.
    signedForms: files.map((f, i) => ({ name: f.name, size: f.size, type: f.type, addedAt: f.at, url: links[i] })),
    serviceDetail: service ? { employee: service.employee || null, machine: service.device || null } : null,
    patientCaseCount: repeat,
    otherOpenCases: related.map((r) => ({ ref: r.ref, status: r.status, createdAt: r.created_at })),
  });
}
