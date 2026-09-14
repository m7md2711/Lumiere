import { currentSession, requireSession, sessionBranchId } from "./auth";
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
  const branchId = await sessionBranchId();
  return branchId ? { ...f, branch: branchId } : f;
}

export async function listCasesScoped(f: CaseFilters, limit = 300): Promise<CaseWithBranch[]> {
  return listCases(await scopedFilters(f), limit);
}

/** Null for a case belonging to another branch, so the page 404s as if absent. */
export async function getCaseScoped(id: string): Promise<CaseWithBranch | null> {
  const c = await getCase(id);
  if (!c) return null;
  const branchId = await sessionBranchId();
  if (branchId && c.branch_id !== branchId) return null;
  return c;
}

/** Guard for server actions that mutate a single case. */
export async function assertCaseInScope(caseId: string): Promise<void> {
  await requireSession();
  const branchId = await sessionBranchId();
  if (!branchId) return;

  const c = await getCase(caseId);
  if (!c || c.branch_id !== branchId) {
    throw new Error("That case belongs to another branch.");
  }
}

export async function isAdminSession(): Promise<boolean> {
  return (await currentSession())?.role === "admin";
}
