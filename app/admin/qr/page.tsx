import Link from "next/link";
import { getBranches, getLocations } from "@/lib/cases";
import { formUrl, qrDataUrl } from "@/lib/qr";
import QrGrid from "./QrGrid";

export const dynamic = "force-dynamic";

export default async function QrPage({
  searchParams,
}: {
  searchParams: { branch?: string };
}) {
  const branches = await getBranches();
  const selected =
    branches.find((b) => b.code === searchParams.branch) ?? branches[0] ?? null;

  if (!selected) {
    return <p className="card p-6 text-sm text-slate-500">No branches yet — run the seed SQL.</p>;
  }

  const locations = await getLocations(selected.id);
  const items = await Promise.all(
    locations.map(async (l) => {
      const url = formUrl(selected.code, l.code);
      return {
        key: `${selected.code}-${l.code}`,
        url,
        qr: await qrDataUrl(url),
        branchEn: selected.name_en,
        branchAr: selected.name_ar,
        locEn: l.label_en,
        locAr: l.label_ar,
        filename: `lumiere-${selected.code}-${l.code}.png`,
      };
    })
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">QR codes</h1>
          <p className="text-sm text-slate-500">
            One code per location. Print the poster and display it where patients can see it.
          </p>
        </div>
        <Link href="/admin/qr/print" className="btn btn-ghost">Print all posters</Link>
      </div>

      <div className="card p-3">
        <label className="label">Branch</label>
        <div className="flex flex-wrap gap-2">
          {branches.map((b) => (
            <Link
              key={b.id}
              href={`/admin/qr?branch=${b.code}`}
              className={[
                "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                b.code === selected.code
                  ? "bg-clinic-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              ].join(" ")}
            >
              {b.code}
            </Link>
          ))}
        </div>
      </div>

      <QrGrid items={items} />
    </div>
  );
}
