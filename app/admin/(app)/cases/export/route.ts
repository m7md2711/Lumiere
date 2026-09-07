import { casesToCsv, listCases, type CaseFilters } from "@/lib/cases";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await requireAdmin();

  const p = new URL(req.url).searchParams;
  const filters: CaseFilters = {
    branch: p.get("branch") ?? undefined,
    status: p.get("status") ?? undefined,
    category: p.get("category") ?? undefined,
    priority: p.get("priority") ?? undefined,
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    q: p.get("q") ?? undefined,
    overdue: p.get("overdue") ?? undefined,
  };

  const csv = casesToCsv(await listCases(filters, 5000));
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lumiere-cases-${stamp}.csv"`,
    },
  });
}
