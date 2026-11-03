import { redirect } from "next/navigation";
import AppLink from "@/components/AppLink";
import { currentSession } from "@/lib/auth";
import { getBranches } from "@/lib/cases";
import { ANALYSIS_PERIODS, HOUR_BANDS, WEEKDAYS, computeAnalysis, type LeagueRow } from "@/lib/analysis";
import { TARGET_CLOSE_HOURS, TARGET_RESPONSE_HOURS } from "@/lib/metrics";
import { shortDate } from "@/components/Pills";
import { Donut, NumberRoll } from "@/components/viz";
import DashboardFilters from "../dashboard/DashboardFilters";

export const dynamic = "force-dynamic";

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

/** Score bands as the same tints the rest of the app uses for good and bad. */
function bandTint(score: number | null): string {
  if (score === null) return "t-flat";
  if (score >= 80) return "t-ok";
  if (score >= 65) return "t-gold";
  if (score >= 50) return "t-warn";
  return "t-crit";
}

const LEAGUE_COLS: { key: string; label: string; short: string }[] = [
  { key: "response_time", label: "Time to open", short: "Open" },
  { key: "opened_on_time", label: `Opened within ${TARGET_RESPONSE_HOURS} h`, short: "On time" },
  { key: "close_time", label: "Time to close", short: "Close" },
  { key: "clearance", label: "Clearance rate", short: "Clearance" },
  { key: "satisfaction", label: "Patient satisfaction", short: "Satisfaction" },
  { key: "resolved_at_branch", label: "Resolved at branch", short: "At branch" },
  { key: "signed_form", label: "Signed form on file", short: "Form" },
];

/**
 * Comparisons and patterns for management: which branch is doing well, how
 * the year is trending, what patients raise where, when they write in, who
 * keeps coming back. Admin and view-only accounts only — it compares
 * branches, which a branch login must not see.
 */
export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: { days?: string; branch?: string };
}) {
  const s = await currentSession();
  if (!s) return null;
  if (s.role !== "admin" && s.role !== "viewer") redirect("/admin/dashboard");

  const days = (ANALYSIS_PERIODS as readonly number[]).includes(Number(searchParams.days))
    ? Number(searchParams.days)
    : 90;
  const branchId = searchParams.branch || null;

  const [a, branches] = await Promise.all([computeAnalysis({ days, branchId }), getBranches()]);
  const period = days === 365 ? "12 months" : `${days} days`;
  const branchName = branchId ? branches.find((b) => b.id === branchId)?.name_en ?? "" : null;
  const exportQs = new URLSearchParams({ days: String(days), ...(branchId ? { branch: branchId } : {}) });

  const monthMax = Math.max(1, ...a.months.flatMap((m) => [m.received, m.closed]));

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------------- header */}
      <header className="rise flex flex-wrap items-end justify-between gap-4" style={{ "--i": 0 } as Style}>
        <div>
          <h1 className="title-shine text-3xl uppercase tracking-[0.18em] text-slate-900 sm:text-4xl">Analysis</h1>
          <p className="mt-4 text-sm text-slate-600 sm:text-base">
            How branches compare and where complaints come from — last {period}
            {branchName ? `, ${branchName}` : ", all branches"}.
          </p>
        </div>
        <a href={`/admin/analysis/export?${exportQs}`} className="btn btn-ghost">Download CSV</a>
      </header>

      <div className="rise" style={{ "--i": 1 } as Style}>
        <DashboardFilters
          days={days}
          branch={branchId}
          branches={branches.filter((b) => b.is_active).map((b) => ({ id: b.id, name: b.name_en }))}
          basePath="/admin/analysis"
          periods={[...ANALYSIS_PERIODS]}
          defaultDays={90}
        />
      </div>

      {/* --------------------------------------------------- headline row */}
      <section className="rise grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ "--i": 2 } as Style}>
        <Stat label="Group score" value={a.clinic.score === null ? "—" : String(a.clinic.score)} hint={a.clinic.band} />
        <Stat label="Cases received" value={String(a.totals.received)} hint={`in ${period}${branchName ? ` · ${branchName}` : ""}`} />
        <Stat label="Cases closed" value={String(a.totals.closed)} hint={`in ${period}${branchName ? ` · ${branchName}` : ""}`} />
        <Stat
          label="Busiest time"
          value={a.hours.busiest ? a.hours.busiest.day : "—"}
          hint={a.hours.busiest ? `${a.hours.busiest.band} Gulf time` : "Not enough data"}
        />
      </section>

      {/* -------------------------------------------------- branch league */}
      <section className="card rise overflow-hidden" style={{ "--i": 3 } as Style}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-5 pb-3">
          <h2 className="label mb-0">Branch league · last {period}</h2>
          <span className="text-xs text-slate-500">
            Ranked by performance score · targets {TARGET_RESPONSE_HOURS} h to open, {TARGET_CLOSE_HOURS} h to close
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="text-xs uppercase tracking-label text-slate-500">
              <tr className="border-y border-slate-100">
                <th className="px-4 py-2.5 text-start font-normal">#</th>
                <th className="px-4 py-2.5 text-start font-normal">Branch</th>
                <th className="px-4 py-2.5 text-start font-normal">Score</th>
                <th className="px-3 py-2.5 text-end font-normal">Received</th>
                <th className="px-3 py-2.5 text-end font-normal">Open</th>
                <th className="px-3 py-2.5 text-end font-normal">Overdue</th>
                {LEAGUE_COLS.map((c) => (
                  <th key={c.key} className="px-3 py-2.5 text-end font-normal" title={c.label}>{c.short}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {a.league.map((r, i) => (
                <LeagueLine key={r.branchId} row={r} rank={i + 1} highlight={r.branchId === branchId} days={days} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-slate-500">
          Each cell is coloured by its own score: green on target, gold close, amber slipping, red well off.
          A dash means nothing to measure in the period.
        </p>
      </section>

      {/* -------------------------------------------------------- months */}
      <section className="card rise p-5" style={{ "--i": 4 } as Style}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="label mb-0">Twelve months</h2>
          <span className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-clinic-600" /> received</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-500" /> closed</span>
          </span>
        </div>
        <div className="mt-5 grid grid-cols-12 items-end gap-1.5 sm:gap-3" style={{ height: 180 }}>
          {a.months.map((m, i) => (
            <div key={m.key} className="flex h-full items-end justify-center gap-0.5 sm:gap-1" title={`${m.label}: ${m.received} received, ${m.closed} closed${m.avgCloseDays !== null ? `, closed in ${m.avgCloseDays} days on average` : ""}`}>
              <div className="viz-rise w-1/2 max-w-[18px] rounded-t bg-clinic-600"
                   style={{ height: `${Math.max(2, (m.received / monthMax) * 100)}%`, "--delay": `${120 + i * 40}ms` } as Style} />
              <div className="viz-rise w-1/2 max-w-[18px] rounded-t bg-slate-500"
                   style={{ height: `${Math.max(2, (m.closed / monthMax) * 100)}%`, "--delay": `${160 + i * 40}ms` } as Style} />
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-12 gap-1.5 text-center sm:gap-3">
          {a.months.map((m) => (
            <div key={m.key}>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{m.label}</div>
              <div className="tabular text-xs text-slate-900">{m.received}</div>
              <div className="tabular hidden text-[10px] text-slate-500 sm:block">
                {m.avgCloseDays !== null ? `${m.avgCloseDays} d` : "—"}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Figures under each month: cases received, then the average days to close the cases closed that month.
        </p>
      </section>

      {/* ------------------------------------------------- topic x branch */}
      <section className="card rise overflow-hidden" style={{ "--i": 5 } as Style}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-5 pb-3">
          <h2 className="label mb-0">What patients raise, by branch</h2>
          <span className="text-xs text-slate-500">Darker gold = more cases · last {period}</span>
        </div>
        {a.topicGrid.topics.length === 0 ? (
          <p className="px-5 pb-5 text-sm italic text-slate-400">Nothing in this period.</p>
        ) : (
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[640px] border-separate text-sm" style={{ borderSpacing: 4 }}>
              <thead>
                <tr>
                  <th className="text-start text-xs font-normal text-slate-500" />
                  {a.topicGrid.topics.map((t) => (
                    <th key={t.key} className="px-1 pb-1 text-center text-[11px] font-normal leading-tight text-slate-600">{t.label}</th>
                  ))}
                  <th className="px-1 pb-1 text-end text-[11px] font-normal text-slate-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {a.topicGrid.rows.map((r) => (
                  <tr key={r.branchId}>
                    <td className="whitespace-nowrap pe-3 text-slate-800">{r.name}</td>
                    {r.counts.map((n, j) => (
                      <td key={j} className="p-0">
                        <HeatCell n={n} max={a.topicGrid.max} />
                      </td>
                    ))}
                    <td className="tabular pe-1 text-end text-slate-900">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------ day x hour */}
      <section className="card rise overflow-hidden" style={{ "--i": 6 } as Style}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-5 pb-3">
          <h2 className="label mb-0">When complaints arrive</h2>
          <span className="text-xs text-slate-500">Day and time, Gulf time · last {period}</span>
        </div>
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full min-w-[640px] border-separate text-sm" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th />
                {HOUR_BANDS.map((h) => (
                  <th key={h} className="pb-1 text-center text-[10px] font-normal text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((d, i) => (
                <tr key={d}>
                  <td className="pe-2 text-xs text-slate-600">{d}</td>
                  {a.hours.grid[i].map((n, j) => (
                    <td key={j} className="p-0"><HeatCell n={n} max={Math.max(1, a.hours.max)} compact /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ------------------------------------------------ repeat patients */}
        <section className="card rise p-5" style={{ "--i": 7 } as Style}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="label mb-0">Patients who wrote more than once</h2>
            <span className="text-xs text-slate-500">last {period}</span>
          </div>
          {a.repeats.length === 0 ? (
            <p className="mt-4 text-sm italic text-slate-400">No repeat patients in this period.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {a.repeats.map((r) => (
                <li key={r.mobile}>
                  <AppLink href={`/admin/cases?q=${encodeURIComponent(r.mobile)}`}
                           className="case-row -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-slate-900" dir="auto">{r.name}</span>
                      <span className="tabular block text-xs text-slate-500">
                        {r.mobile} · {r.branches.join(", ")} · last {shortDate(r.last)}
                      </span>
                    </span>
                    <span className="pill t-warn shrink-0">{r.cases} cases</span>
                  </AppLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --------------------------------------------- how cases closed */}
        <section className="card rise p-5" style={{ "--i": 8 } as Style}>
          <h2 className="label">How cases were closed · last {period}</h2>
          <div className="mt-3">
            <Donut slices={a.closure} center={String(a.totals.closed)} centerLabel="closed" />
          </div>
          {a.priorities.length ? (
            <>
              <h3 className="label mt-6">Priority of cases received</h3>
              <div className="mt-3">
                <Donut
                  slices={a.priorities}
                  center={String(a.totals.received)}
                  centerLabel="received"
                  colorOf={(k) =>
                    k === "urgent" ? "rgb(var(--crit-fg))"
                    : k === "high" ? "rgb(var(--warn-fg))"
                    : k === "normal" ? "rgb(var(--c-600))"
                    : "rgb(var(--s-500))"}
                />
              </div>
            </>
          ) : null}
        </section>
      </div>

      {/* ------------------------------------- concerns after a service */}
      <section className="card rise p-5" style={{ "--i": 9 } as Style}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="label mb-0">Concerns after a service — who and which machine</h2>
          <span className="text-xs text-slate-500">recorded when the branch closes the case · last {period}</span>
        </div>
        {a.byEmployee.length === 0 ? (
          <p className="mt-4 text-sm italic text-slate-400">No concerns after a service in this period.</p>
        ) : (
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {[{ title: "By employee", data: a.byEmployee }, { title: "By machine", data: a.byMachine }].map((block) => (
              <div key={block.title}>
                <h3 className="mb-2.5 text-xs text-slate-600">{block.title}</h3>
                <ul className="space-y-2">
                  {block.data.map((d, i) => (
                    <li key={d.name}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className={d.name === "Not recorded" ? "text-slate-400" : "text-slate-800"}>{d.name}</span>
                        <span className="tabular text-xs text-slate-500">{d.cases} · {d.share}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`viz-grow h-full rounded-full ${d.name === "Not recorded" ? "bg-slate-300" : "bg-clinic-600"}`}
                          style={{ width: `${Math.max(d.share, 3)}%`, "--delay": `${300 + i * 60}ms` } as Style}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card p-4">
      <div className="label mb-0">{label}</div>
      <div className="mt-2 text-3xl text-slate-900">
        {/^\d+$/.test(value) ? <NumberRoll text={value} delay={150} /> : value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function LeagueLine({ row, rank, highlight, days }: { row: LeagueRow; rank: number; highlight: boolean; days: number }) {
  return (
    <tr className={`case-row ${highlight ? "bg-clinic-50" : ""}`}>
      <td className="tabular px-4 py-3 text-slate-500">{rank}</td>
      <td className="px-4 py-3">
        <AppLink href={`/admin/dashboard?branch=${row.branchId}&days=${[7, 30, 90].includes(days) ? days : 90}`}
                 className="case-link ref text-slate-900">
          {row.name}
        </AppLink>
        <div className="tabular text-[11px] text-slate-500">{row.code}</div>
      </td>
      <td className="px-4 py-3">
        <span className={`pill ${bandTint(row.score)}`}>
          {row.score === null ? "—" : row.score} · {row.band}
        </span>
      </td>
      <td className="tabular px-3 py-3 text-end text-slate-900">{row.received}</td>
      <td className="tabular px-3 py-3 text-end text-slate-700">{row.open}</td>
      <td className={`tabular px-3 py-3 text-end ${row.overdue ? "text-[rgb(var(--crit-fg))]" : "text-slate-500"}`}>{row.overdue}</td>
      {LEAGUE_COLS.map((c) => {
        const k = row.kpis[c.key];
        const has = k && k.items > 0 && k.value !== null;
        return (
          <td key={c.key} className="px-3 py-3 text-end">
            {has ? (
              <span className={`tabular rounded-md px-1.5 py-0.5 text-xs tint ${bandTint(k.score)}`}>{k.display}</span>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function HeatCell({ n, max, compact }: { n: number; max: number; compact?: boolean }) {
  const share = n / max;
  return (
    <div
      className={`flex items-center justify-center rounded-md border tabular ${compact ? "h-7 text-[10px]" : "h-9 text-xs"}`}
      style={{
        background: n ? `rgb(var(--c-600) / ${0.12 + share * 0.78})` : "transparent",
        borderColor: n ? "transparent" : "rgb(var(--l-100))",
        color: share > 0.55 ? "rgb(var(--on-gold))" : "rgb(var(--s-800))",
      }}
      title={`${n} case${n === 1 ? "" : "s"}`}
    >
      {n || ""}
    </div>
  );
}
