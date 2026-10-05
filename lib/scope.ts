import { currentSession, requireSession, sessionBranchId } from "./auth";
import { CALLCENTER_CODE } from "./sources";
import { getCase, listCases, type CaseFilters } from "./cases";
import type { CaseWithBranch } from "./types";

/**
 * Every read of case data goes through here so branch scoping is applied in one
 * place. A branch session's filter is overwritten, not merged — a crafted
 * ?branch= in the URL cannot widen what that session sees.
 *
 * Lives apart from lib/cases so that module stays free of auth, which would
 * otherwise import it back through lib/users.
 */
export async function scopedFilters(f: CaseFilters): Promise<CaseFilters> {
  const s = await currentSession();
  if (!s) return f;
  // The call centre is not tied to a branch — it sees what it raised.
  if (s.role === "call_center") return { ...f, source: CALLCENTER_CODE };
  if (s.role === "branch") return { ...f, branch: s.branchId };
  return f;
}

export async function listCasesScoped(f: CaseFilters, limit = 300): Promise<CaseWithBranch[]> {
  return listCases(await scopedFilters(f), limit);
}

/** Null for a case belonging to another branch, so the page 404s as if absent. */
export async function getCaseScoped(id: string): Promise<CaseWithBranch | null> {
  const c = await getCase(id);
  if (!c) return null;
  const s = await currentSession();
  if (!s) return null;
  if (s.role === "branch" && c.branch_id !== s.branchId) return null;
  if (s.role === "call_center" && c.qr_locations?.code !== CALLCENTER_CODE) return null;
  return c;
}

/** Guard for server actions that mutate a single case. */
export async function assertCaseInScope(caseId: string): Promise<void> {
  const s = await requireSession();
  if (s.role === "admin") return;

  const c = await getCase(caseId);
  if (!c) throw new Error("That case no longer exists.");

  if (s.role === "branch" && c.branch_id !== s.branchId) {
    throw new Error("That case belongs to another branch.");
  }
  if (s.role === "call_center" && c.qr_locations?.code !== CALLCENTER_CODE) {
    throw new Error("That case was not raised by the call centre.");
  }
}

export async function isAdminSession(): Promise<boolean> {
  return (await currentSession())?.role === "admin";
}
