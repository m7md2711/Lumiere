import { casesToCsv, type CaseFilters } from "@/lib/cases";
import { requireSession } from "@/lib/auth";
import { listCasesScoped } from "@/lib/scope";
import { audit } from "@/lib/audit";
import { buildZip } from "@/lib/archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await requireSession();

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

  const rows = await listCasesScoped(filters, 5000);
  const stamp = new Date().toISOString().slice(0, 10);
  const wantsZip = p.get("format") === "zip";

  await audit("export", session.username, {
    branch: session.role === "branch" ? session.branchName : null,
    detail: `${rows.length} case${rows.length === 1 ? "" : "s"} as ${wantsZip ? "a zip with audio" : "CSV"}`,
  });

  // format=zip packages the voice notes alongside the CSV, so the export is
  // self-contained rather than a spreadsheet full of links that stop working
  // once the recordings are archived away.
  if (wantsZip) {
    const { buffer } = await buildZip(rows);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="lumiere-cases-${stamp}.zip"`,
        "Content-Length": String(buffer.length),
      },
    });
  }

  return new Response(casesToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lumiere-cases-${stamp}.csv"`,
    },
  });
}
