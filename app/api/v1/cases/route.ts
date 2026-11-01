import { authorize, fail, ok, scopeFor, serializeCase } from "@/lib/api";
import { listCases, type CaseFilters } from "@/lib/cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cases, newest first, with the same filters the case list offers. */
export async function GET(req: Request) {
  const auth = await authorize(req);
  if ("response" in auth) return auth.response;

  const p = new URL(req.url).searchParams;
  const limit = Math.min(200, Math.max(1, Number(p.get("limit") ?? 50) || 50));
  const offset = Math.max(0, Number(p.get("offset") ?? 0) || 0);

  for (const d of ["from", "to"]) {
    const v = p.get(d);
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return fail(400, "bad_date", `${d} must be yyyy-mm-dd.`);
  }

  const scope = await scopeFor(auth.key, p.get("branch"));
  if ("error" in scope) return scope.error;

  const filters: CaseFilters = {
    branch: scope.branchIds?.join(",") ?? undefined,
    status: p.get("status") ?? undefined,
    category: p.get("category") ?? undefined,
    priority: p.get("priority") ?? undefined,
    source: p.get("source") ?? undefined,
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    q: p.get("q") ?? undefined,
    overdue: p.get("overdue") ?? undefined,
  };

  const rows = await listCases(filters, 5000);
  const page = rows.slice(offset, offset + limit);
  return ok(page.map(serializeCase), {
    total: rows.length,
    limit,
    offset,
    nextOffset: offset + limit < rows.length ? offset + limit : null,
  });
}
