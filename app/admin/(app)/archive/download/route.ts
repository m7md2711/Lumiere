import { requireAdmin } from "@/lib/auth";
import { buildZip, getPending, markDownloaded } from "@/lib/archive";
import { listCases } from "@/lib/cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  await requireAdmin();

  const pending = await getPending();
  if (!pending) {
    return new Response("Nothing is prepared for archiving.", { status: 400 });
  }

  // Re-read by id so the ZIP reflects the rows as they stand right now.
  const all = await listCases({}, 5000);
  const ids = new Set(pending.caseIds);
  const rows = all.filter((c) => ids.has(c.id));

  const { buffer } = await buildZip(rows);
  await markDownloaded();

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="lumiere-archive-${stamp}.zip"`,
      "Content-Length": String(buffer.length),
    },
  });
}
