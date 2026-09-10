import Link from "next/link";
import { getBranches, listCases, type CaseFilters } from "@/lib/cases";
import { categoryLabel, priorityLabel, statusLabel } from "@/lib/i18n";
import { CATEGORIES, PRIORITIES, STATUSES, isOverdue } from "@/lib/types";
import { OverduePill, PriorityPill, StatusPill, shortDate } from "@/components/Pills";
import { IconMic } from "@/components/Icons";
import Filters from "./Filters";

export const dynamic = "force-dynamic";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const filters: CaseFilters = {
    branch: searchParams.branch, status: searchParams.status,
    category: searchParams.category, priority: searchParams.priority,
    from: searchParams.from, to: searchParams.to,
    q: searchParams.q, overdue: searchParams.overdue,
  };

  const [branches, cases] = await Promise.all([getBranches(), listCases(filters)]);
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][]
  ).toString();

  const overdueCount = cases.filter(isOverdue).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cases</h1>
          <p className="text-sm text-slate-500">
            {cases.length} shown
            {overdueCount ? ` · ${overdueCount} overdue` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/admin/cases/export?${qs}`} className="btn btn-ghost">
            CSV
          </a>
          <a
            href={`/admin/cases/export?${qs}${qs ? "&" : ""}format=zip`}
            className="btn btn-primary"
            title="CSV plus every voice note, as a zip file"
          >
            CSV + audio
          </a>
        </div>
      </div>

      <Filters
        branches={branches.map((b) => ({ id: b.id, name: b.name_en, code: b.code }))}
        statuses={STATUSES.map((s) => ({ v: s, label: statusLabel(s) }))}
        categories={CATEGORIES.map((c) => ({ v: c, label: categoryLabel(c, "en") }))}
        priorities={PRIORITIES.map((p) => ({ v: p, label: priorityLabel(p) }))}
      />

      {cases.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-sm text-slate-500">
          No cases match these filters.
        </p>
      ) : null}

      {/* Mobile cards */}
      <div className="mt-4 space-y-3 lg:hidden">
        {cases.map((c) => (
          <Link key={c.id} href={`/admin/cases/${c.id}`} className="card block p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="tabular text-sm font-semibold text-clinic-800">{c.ref}</span>
              <StatusPill status={c.status} />
            </div>
            <div className="mt-1.5 text-sm font-medium text-slate-800">{c.patient_name}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {categoryLabel(c.category, "en")} · {c.branches?.name_en ?? "—"}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <PriorityPill priority={c.priority} />
              {isOverdue(c) ? <OverduePill /> : null}
              {c.voice_url ? (
                <span className="chip" title="Has a voice note"><IconMic className="h-3.5 w-3.5" /> Voice</span>
              ) : null}
              <span className="ms-auto text-xs text-slate-400">{shortDate(c.created_at)}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <div className="card mt-4 hidden overflow-hidden lg:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {["Reference", "Patient", "Branch", "Category", "Priority", "Status", "Created"].map(
                (h) => (
                  <th key={h} className="px-4 py-3 text-start font-semibold">{h}</th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/cases/${c.id}`}
                    className="tabular font-semibold text-clinic-700 hover:underline"
                  >
                    {c.ref}
                  </Link>
                  {isOverdue(c) ? <div className="mt-1"><OverduePill /></div> : null}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{c.patient_name}</div>
                  <div className="tabular text-xs text-slate-500">{c.mobile}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{c.branches?.name_en ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {categoryLabel(c.category, "en")}
                  {c.voice_url ? (
                    <span title="Has a voice note" className="ms-1 inline-block align-text-bottom text-clinic-600">
                      <IconMic className="h-4 w-4" />
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3"><PriorityPill priority={c.priority} /></td>
                <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                <td className="px-4 py-3 text-xs text-slate-500">{shortDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
