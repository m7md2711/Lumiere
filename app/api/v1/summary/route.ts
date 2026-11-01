import { authorize, fail, ok, scopeFor } from "@/lib/api";
import { computeSummary } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The same performance picture the dashboard shows, from the same engine. */
export async function GET(req: Request) {
  const auth = await authorize(req);
  if ("response" in auth) return auth.response;

  const p = new URL(req.url).searchParams;
  const days = Number(p.get("days") ?? 30);
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return fail(400, "bad_days", "days must be between 1 and 365.");
  }

  const scope = await scopeFor(auth.key, p.get("branch"));
  if ("error" in scope) return scope.error;
  if (scope.branchIds && scope.branchIds.length > 1) {
    return fail(400, "one_branch", "A summary covers the whole clinic or a single branch.");
  }

  const summary = await computeSummary({ branchId: scope.branchIds?.[0] ?? null, days });
  return ok(summary, { scope: auth.key.branchId ? "branch" : "clinic" });
}
