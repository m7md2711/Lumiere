import Link from "next/link";
import { currentSession } from "@/lib/auth";
import { listCasesScoped } from "@/lib/scope";
import { repeatCounts } from "@/lib/cases";
import { categoryLabel } from "@/lib/i18n";
import { isOverdue } from "@/lib/types";
import { sourceOf, sourceShort } from "@/lib/sources";
import { OverduePill, PriorityPill, StatusPill, shortDate } from "@/components/Pills";

export const dynamic = "force-dynamic";

/**
 * Complaints staff raised on a patient's behalf, kept apart from the ones
 * patients sent themselves — a different intake route, and a different signal.
 */
export default async function LoggedPage({
  searchParams,
}: {
  searchParams: { source?: string };
}) {
  const session = await currentSession();
  if (!session) return null;

  const source = searchParams.source || "internal";
  const cases = await listCasesScoped({ source });
  const repeats = await repeatCounts(cases.map((c) => c.mobile));
  const overdue = cases.filter(isOverdue).length;

  const canFilter = session.role === "admin";
  const tabs = [
    { v: "internal", label: "Both" },
    { v: "MGR", label: "Branch manager" },
    { v: "CC", label: "Call centre" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl text-slate-900">Raised by staff</h1>
          <p className="text-sm text-slate-500">
            {cases.length} case{cases.length === 1 ? "" : "s"}
            {overdue ? ` · ${overdue} overdue` : ""} · logged on a patient&rsquo;s behalf
          </p>
        </div>
        <Link href="/admin/new-case" className="btn btn-primary">Raise a complaint</Link>
      </div>

      {canFilter ? (
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.v}
              href={`/admin/logged?source=${t.v}`}
              className={[
                "rounded-full px-3.5 py-2 text-xs uppercase tracking-brand transition-colors",
                source === t.v ? "bg-clinic-600 text-ink" : "bg-slate-200 text-slate-600 hover:bg-slate-300",
              ].join(" ")}
            >
              {t.label}
            </Link>
          ))}
        </div>
      ) : null}

      {cases.length === 0 ? (
        <p className="card p-8 text-center text-sm text-slate-500">
          Nothing raised by staff yet. Use <span className="text-clinic-700">Raise a complaint</span>{" "}
          when a patient tells you something in person or over the phone.
        </p>
      ) : null}

      <div className="space-y-3">
        {cases.map((c) => (
          <Link key={c.id} href={`/admin/cases/${c.id}`} className="card block p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <span className="tabular text-sm text-clinic-700">{c.ref}</span>
              <StatusPill status={c.status} />
            </div>
            <div className="mt-1.5 text-sm text-slate-800">{c.patient_name}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {categoryLabel(c.category, "en")} · {c.branches?.name_en ?? "—"}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex rounded-full bg-clinic-50 px-2.5 py-1 text-xs text-clinic-700 ring-1 ring-clinic-300">
                {sourceShort[sourceOf(c.qr_locations?.code)]}
              </span>
              <PriorityPill priority={c.priority} />
              {isOverdue(c) ? <OverduePill /> : null}
              {(repeats[c.mobile] ?? 1) > 1 ? (
                <span className="inline-flex rounded-full bg-amber-950/70 px-2.5 py-1 text-xs text-amber-300 ring-1 ring-amber-900">
                  {repeats[c.mobile]}× patient
                </span>
              ) : null}
              <span className="ms-auto text-xs text-slate-400">{shortDate(c.created_at)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
