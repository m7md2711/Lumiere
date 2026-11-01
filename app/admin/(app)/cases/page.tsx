import AppLink from "@/components/AppLink";
import { getBranches, repeatCounts, searchSnippets, type CaseFilters, filterList } from "@/lib/cases";
import { listCasesScoped, isAdminSession } from "@/lib/scope";
import { categoryLabel, priorityLabel, statusLabel } from "@/lib/i18n";
import { CATEGORIES, PRIORITIES, STATUSES, isOverdue } from "@/lib/types";
import type { CaseWithBranch } from "@/lib/types";
import { OverduePill, PriorityPill, StatusPill, shortDate } from "@/components/Pills";
import { IconMic } from "@/components/Icons";
import { sourceOf, sourceShort } from "@/lib/sources";
import { evidencePresence } from "@/lib/evidence";
import Filters from "./Filters";

export const dynamic = "force-dynamic";

type Style = React.CSSProperties & Record<`--${string}`, string | number>;
type Snip = Record<string, { where: string; text: string }>;

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
    source: searchParams.source,
  };

  const [branches, cases, admin] = await Promise.all([
    getBranches(),
    listCasesScoped(filters),
    isAdminSession(),
  ]);
  const [repeats, withForm, snippets] = await Promise.all([
    repeatCounts(cases.map((c) => c.mobile)),
    evidencePresence(cases.filter((c) => c.status === "solved").map((c) => c.id)),
    filters.q ? searchSnippets(filters.q, cases) : Promise.resolve({} as Snip),
  ]);
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][]
  ).toString();

  // Work that still needs someone sits on top; finished work drops below and
  // folds away, so the list opens on what matters today.
  const open = cases.filter((c) => c.status !== "closed" && c.status !== "follow_up");
  const following = cases.filter((c) => c.status === "follow_up");
  const closed = cases.filter((c) => c.status === "closed");

  // Folding closed cases away must not hide what someone just asked for.
  const statuses = filterList(filters.status);
  const closedOpen = Boolean(filters.q) || statuses.includes("closed") || open.length + following.length === 0;
  const overdueCount = open.filter(isOverdue).length;

  const ctx = { repeats, withForm, snippets };

  return (
    <div className="space-y-4">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="title-shine text-2xl uppercase tracking-[0.2em] text-slate-900 sm:text-3xl">Cases</h1>
          <p className="mt-2 text-sm text-slate-500">
            {open.length} open
            {overdueCount ? <span className="text-[rgb(var(--crit-fg))]"> · {overdueCount} overdue</span> : null}
            {following.length ? ` · ${following.length} awaiting follow-up` : ""}
            {` · ${closed.length} closed`}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/admin/cases/export?${qs}`} className="btn btn-ghost">CSV</a>
          <a href={`/admin/cases/export?${qs}${qs ? "&" : ""}format=zip`} className="btn btn-primary"
             title="CSV plus every voice note and signed form, as a zip file">
            CSV + files
          </a>
        </div>
      </div>

      <div className="rise" style={{ "--i": 1 } as Style}>
        <Filters
          branches={admin ? branches.map((b) => ({ id: b.id, name: b.name_en, code: b.code })) : []}
          statuses={STATUSES.map((s) => ({ v: s, label: statusLabel(s) }))}
          categories={CATEGORIES.map((c) => ({ v: c, label: categoryLabel(c, "en") }))}
          priorities={PRIORITIES.map((p) => ({ v: p, label: priorityLabel(p) }))}
          sources={[
            { v: "patient", label: "Patient (QR or link)" },
            { v: "MGR", label: "Branch manager" },
            { v: "CC", label: "Call centre" },
          ]}
        />
      </div>

      {cases.length === 0 ? (
        <p className="card p-8 text-center text-sm text-slate-500">No cases match these filters.</p>
      ) : null}

      {/* ------------------------------------------------------------ open */}
      {open.length > 0 ? (
        <section className="rise space-y-3" style={{ "--i": 2 } as Style}>
          <GroupHeading tone="gold" title="Open" count={open.length} hint="Still needs someone" />
          <CaseGroup rows={open} {...ctx} />
        </section>
      ) : cases.length > 0 ? (
        <p className="card rise p-6 text-center text-sm text-slate-500" style={{ "--i": 2 } as Style}>
          Nothing open here — every matching case is closed or awaiting follow-up.
        </p>
      ) : null}

      {/* ------------------------------------------------------- follow-up */}
      {following.length > 0 ? (
        <details open className="group/fold rise" style={{ "--i": 3 } as Style}>
          <summary className="cursor-pointer list-none">
            <GroupHeading tone="teal" title="Awaiting follow-up" count={following.length}
                          hint="Closed for now, coming back on a date" foldable />
          </summary>
          <div className="mt-3"><CaseGroup rows={following} {...ctx} /></div>
        </details>
      ) : null}

      {/* ---------------------------------------------------------- closed */}
      {closed.length > 0 ? (
        <details open={closedOpen} className="group/fold rise" style={{ "--i": 4 } as Style}>
          <summary className="cursor-pointer list-none">
            <GroupHeading tone="green" title="Closed" count={closed.length}
                          hint={closedOpen ? "Tap to fold away" : "Tap to show"} foldable />
          </summary>
          <div className="mt-3"><CaseGroup rows={closed} {...ctx} /></div>
        </details>
      ) : null}
    </div>
  );
}

function GroupHeading({
  title, count, hint, tone, foldable,
}: {
  title: string; count: number; hint: string; tone: "gold" | "teal" | "green"; foldable?: boolean;
}) {
  const dot = tone === "gold" ? "rgb(var(--p1))" : tone === "teal" ? "rgb(var(--p7))" : "rgb(var(--p4))";
  return (
    <div className="flex items-center gap-3 rounded-2xl px-1 py-1">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} aria-hidden />
      <h2 className="text-sm uppercase tracking-[0.2em] text-slate-900">{title}</h2>
      <span className="tabular rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{count}</span>
      <span className="hidden text-xs text-slate-500 sm:inline">{hint}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" aria-hidden />
      {foldable ? (
        <span className="text-slate-400 transition-transform duration-300 group-open/fold:rotate-180" aria-hidden>▾</span>
      ) : null}
    </div>
  );
}

function CaseGroup({
  rows, repeats, withForm, snippets,
}: {
  rows: CaseWithBranch[];
  repeats: Record<string, number>;
  withForm: Set<string>;
  snippets: Snip;
}) {
  const repeatOf = (m: string) => repeats[m] ?? 1;
  const dim = (s: string) => (s === "closed" ? "opacity-70 hover:opacity-100 transition-opacity" : "");

  const badges = (c: CaseWithBranch) => (
    <>
      <PriorityPill priority={c.priority} />
      {isOverdue(c) ? <OverduePill /> : null}
      {repeatOf(c.mobile) > 1 ? <span className="pill t-warn">{repeatOf(c.mobile)}× patient</span> : null}
      {sourceOf(c.qr_locations?.code) !== "patient" ? (
        <span className="pill t-gold">{sourceShort[sourceOf(c.qr_locations?.code)]}</span>
      ) : null}
      {c.status === "solved" && !withForm.has(c.id) ? (
        <span className="pill t-warn" title="Marked solved with no signed form on file">No form</span>
      ) : null}
      {c.voice_url ? (
        <span className="chip" title="Has a voice note"><IconMic className="h-3.5 w-3.5" /> Voice</span>
      ) : null}
    </>
  );

  const snippet = (c: CaseWithBranch) =>
    snippets[c.id] ? (
      <p className="mt-2 rounded-lg bg-slate-200/60 px-2.5 py-1.5 text-xs text-slate-600" dir="auto">
        <span className="me-1 uppercase tracking-label text-clinic-700">{snippets[c.id].where}</span>
        {snippets[c.id].text}
      </p>
    ) : null;

  return (
    <>
      {/* Phones: cards */}
      <div className="space-y-3 lg:hidden">
        {rows.map((c) => (
          <AppLink key={c.id} href={`/admin/cases/${c.id}`} className={`card lift block p-4 ${dim(c.status)}`}>
            <div className="flex items-start justify-between gap-3">
              <span className="tabular text-sm text-clinic-800">{c.ref}</span>
              <StatusPill status={c.status} />
            </div>
            <div className="mt-1.5 text-sm text-slate-800" dir="auto">{c.patient_name}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {categoryLabel(c.category, "en")} · {c.branches?.name_en ?? "—"}
            </div>
            {snippet(c)}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {badges(c)}
              <span className="ms-auto text-xs text-slate-400">{shortDate(c.created_at)}</span>
            </div>
          </AppLink>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="card hidden overflow-hidden lg:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-label text-slate-500">
            <tr>
              {["Reference", "Patient", "Branch", "Topic", "Status", "Created"].map((h) => (
                <th key={h} className="px-4 py-3 text-start font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((c) => (
              <tr key={c.id} className={`hover:bg-slate-200/40 ${dim(c.status)}`}>
                <td className="px-4 py-3 align-top">
                  <AppLink href={`/admin/cases/${c.id}`} className="tabular text-clinic-700 hover:underline">
                    {c.ref}
                  </AppLink>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="text-slate-800" dir="auto">{c.patient_name}</div>
                  <div className="tabular text-xs text-slate-500">{c.mobile}</div>
                </td>
                <td className="px-4 py-3 align-top text-slate-600">{c.branches?.name_en ?? "—"}</td>
                <td className="px-4 py-3 align-top text-slate-600">
                  {categoryLabel(c.category, "en")}
                  {snippet(c)}
                  <div className="mt-1.5 flex flex-wrap gap-1">{badges(c)}</div>
                </td>
                <td className="px-4 py-3 align-top"><StatusPill status={c.status} /></td>
                <td className="px-4 py-3 align-top text-xs text-slate-500">{shortDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
