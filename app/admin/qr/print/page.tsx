import { getBranches, getLocations } from "@/lib/cases";
import { formUrl, qrDataUrl } from "@/lib/qr";
import { Poster } from "@/components/Poster";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function PrintAllPage() {
  const [branches, locations] = await Promise.all([getBranches(), getLocations()]);
  const active = branches.filter((b) => b.is_active);

  const posters = await Promise.all(
    active.flatMap((b) =>
      locations
        .filter((l) => l.branch_id === b.id)
        .map(async (l) => {
          const url = formUrl(b.code, l.code);
          return {
            key: `${b.code}-${l.code}`,
            url,
            qr: await qrDataUrl(url),
            branchEn: b.name_en,
            branchAr: b.name_ar,
            locEn: l.label_en,
            locAr: l.label_ar,
          };
        })
    )
  );

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <a href="/admin/qr" className="btn btn-ghost">← Back</a>
        <PrintButton />
        <span className="text-sm text-slate-500">
          {posters.length} posters · A5, one per page
        </span>
      </div>

      <div className="space-y-6">
        {posters.map((p) => (
          <div key={p.key} className="card overflow-x-auto p-4 print:border-0 print:p-0 print:shadow-none">
            <Poster {...p} />
          </div>
        ))}
      </div>
    </div>
  );
}
