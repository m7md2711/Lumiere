import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { getBranches } from "@/lib/cases";
import { db } from "@/lib/supabase";
import { computeSummary, TARGET_CLOSE_HOURS, TARGET_RESPONSE_HOURS, type Kpi } from "@/lib/metrics";
import { serviceDetailsFor, tally } from "@/lib/service-detail";
import { SERVICE_CONCERN } from "@/lib/types";
import AppLink from "@/components/AppLink";
import { Delta, Donut, Meter, NumberRoll, Rings, ScoreGauge, Sparkline } from "@/components/viz";
import {
  IconAlert, IconAnalysis, IconArrows, IconBuilding, IconCalendarCheck, IconCheckCircle, IconClock,
  IconDoc, IconPlus, IconPulse, IconRepeat, IconSmile, IconList,
} from "@/components/Icons";
import DashboardFilters from "./DashboardFilters";

export const dynamic = "force-dynamic";

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

const kpiIcon: Record<string, (p: { className?: string }) => React.ReactElement> = {
  response_time: IconClock,
  close_time: IconCheckCircle,
  opened_on_time: IconCalendarCheck,
  clearance: IconArrows,
  satisfaction: IconSmile,
  resolved_at_branch: IconBuilding,
  signed_form: IconDoc,
  answered_first_time: IconRepeat,
};

const statusColour: Record<string, string> = {
  new: "rgb(var(--info-fg))",
  opened: "rgb(var(--c-600))",
  under_review: "rgb(var(--warn-fg))",
  solved: "rgb(var(--hint-fg))",
  escalated: "rgb(var(--crit-fg))",
  follow_up: "rgb(var(--s-500))",
};

function greeting(): string {
  const h = (new Date().getUTCHours() + 4) % 24; // Gulf time
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { days?: string; branch?: string };
}) {
  const s = await currentSession();
  if (!s) return null;
  // The call centre has no clinic-wide view; it follows what it raised.
  if (s.role === "call_center") redirect("/admin/logged");

  const days = [7, 30, 90].includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  // A branch is always itself, whatever the address bar says.
  const branchId = s.role === "branch" ? s.branchId : searchParams.branch || null;

  const concernQuery = db()
    .from("cases")
    .select("id")
    .in("category", [SERVICE_CONCERN, "treatment", "medical"])
    .gte("created_at", new Date(Date.now() - days * 86_400_000).toISOString());
  const [summary, branches, concernRes] = await Promise.all([
    computeSummary({ branchId, days }),
    getBranches(),
    branchId ? concernQuery.eq("branch_id", branchId) : concernQuery,
  ]);

  const concernIds = ((concernRes.data ?? []) as { id: string }[]).map((r) => r.id);
  const details = concernIds.length ? await serviceDetailsFor(concernIds) : {};
  const byMachine = tally(concernIds.map((id) => details[id]?.device ?? "")).slice(0, 5);
  const byEmployee = tally(concernIds.map((id) => details[id]?.employee ?? "")).slice(0, 5);

  // Admin and view-only accounts both see every branch.
  const isAdmin = s.role === "admin" || s.role === "viewer";
  const who = s.role === "branch" ? `${s.branchName} team` : s.role === "viewer" ? s.username : "Administrator";
  const n = summary.now;

  const k = (key: string) => summary.kpis.find((x) => x.key === key)!;
  const scoreRings = [
    { label: "Opened on time", value: k("opened_on_time").value, display: k("opened_on_time").display,
      color: "rgb(var(--p1))", hint: `within ${TARGET_RESPONSE_HOURS} h` },
    { label: "Time to close", value: k("close_time").score, display: k("close_time").display,
      color: "rgb(var(--p2))", hint: `target ${TARGET_CLOSE_HOURS} h · score ${k("close_time").score ?? "—"}` },
    { label: "Satisfaction", value: k("satisfaction").score, display: k("satisfaction").display,
      color: "rgb(var(--p4))", hint: `${k("satisfaction").items} rated` },
  ];

  const attention = [
    { label: "new, not opened", value: n.new, href: "/admin/cases?status=new", tone: n.new ? "text-clinic-700" : "" },
    { label: "overdue", value: n.overdue, href: "/admin/cases?overdue=1", tone: n.overdue ? "text-[rgb(var(--crit-fg))]" : "" },
    { label: "awaiting review", value: n.awaitingReview, href: "/admin/cases?status=solved", tone: n.awaitingReview ? "text-[rgb(var(--hint-fg))]" : "" },
    { label: "follow-ups due", value: n.followUpDue, href: "/admin/follow-up", tone: n.followUpDue ? "text-[rgb(var(--warn-fg))]" : "" },
    { label: "escalated", value: n.escalated, href: "/admin/cases?status=escalated", tone: n.escalated ? "text-[rgb(var(--warn-fg))]" : "" },
  ];

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- header */}
      <header className="rise flex flex-wrap items-end justify-between gap-4" style={{ "--i": 0 } as Style}>
        <div>
          <h1 className="title-shine text-3xl uppercase tracking-[0.2em] text-slate-900 sm:text-4xl">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            {greeting()}, {who}. Here is what needs your attention.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {s.role === "viewer" ? (
            <AppLink href="/admin/analysis" className="btn btn-primary">
              <IconAnalysis className="h-4 w-4" /> Analysis
            </AppLink>
          ) : (
            <AppLink href="/admin/new-case" className="btn btn-primary">
              <IconPlus className="h-4 w-4" /> Raise a complaint
            </AppLink>
          )}
          <AppLink href="/admin/cases" className="btn btn-ghost">
            <IconList className="h-4 w-4" /> Cases
          </AppLink>
        </div>
      </header>

      {/* ------------------------------------------------ attention strip */}
      <section className="card rise flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4" style={{ "--i": 1 } as Style}>
        <span className="flex items-center gap-2 text-sm text-slate-800">
          <span className="relative flex h-2.5 w-2.5">
            {n.overdue || n.new ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-clinic-600 opacity-60" />
            ) : null}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-clinic-600" />
          </span>
          Right now
        </span>
        <span className="text-sm text-slate-600">
          <span className="text-xl text-slate-900"><NumberRoll text={String(n.open)} /></span> open
        </span>
        {attention.map((a) => (
          <AppLink key={a.label} href={a.href} className="group text-sm text-slate-600 hover:text-slate-900">
            <span className={`text-xl ${a.tone || "text-slate-900"}`}>
              <NumberRoll text={String(a.value)} delay={120} />
            </span>{" "}
            <span className="group-hover:underline">{a.label}</span>
          </AppLink>
        ))}
        <AppLink href="/admin/cases" className="ms-auto text-sm text-clinic-700 hover:underline">
          Open cases →
        </AppLink>
      </section>

      {/* ------------------------------------------------------- filters */}
      <div className="rise" style={{ "--i": 2 } as Style}>
        <DashboardFilters
          days={days}
          branch={branchId}
          branches={isAdmin ? branches.filter((b) => b.is_active).map((b) => ({ id: b.id, name: b.name_en })) : []}
        />
      </div>

      {/* --------------------------------------------------- performance */}
      <div className="rise flex flex-wrap items-baseline justify-between gap-2" style={{ "--i": 3 } as Style}>
        <h2 className="text-lg uppercase tracking-[0.2em] text-slate-900">Performance</h2>
        <span className="text-xs text-slate-500 sm:text-sm">
          Last {days} days compared with the {days} days before
        </span>
      </div>

      <section className="card rise p-5 sm:p-6" style={{ "--i": 4 } as Style}>
        <div className="flex flex-wrap items-center gap-6">
          <ScoreGauge score={summary.score.value} />
          <div className="min-w-[220px] flex-1">
            <div className="text-xs uppercase tracking-label text-slate-500">Performance score</div>
            <div className="mt-1 text-3xl text-slate-900">{summary.score.band}</div>
            <div className="mt-2">
              <Delta change={summary.score.change} pointsLabel />
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
              The average of the measures below. A speed measure scores 100 when it meets its target
              and 50 when it takes twice as long; a percentage scores its own value. Measures with
              nothing to count in the period are left out.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.kpis.map((kp, i) => (
            <KpiCard key={kp.key} kpi={kp} index={i} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- summary */}
      <div className="rise flex flex-wrap items-baseline justify-between gap-2" style={{ "--i": 5 } as Style}>
        <h2 className="text-lg uppercase tracking-[0.2em] text-slate-900">At a glance</h2>
        <span className="text-xs text-slate-500 sm:text-sm">What is coming in, how fast it moves, where it stands</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lift rise p-5" style={{ "--i": 6 } as Style}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-label text-slate-500">
            <IconPulse className="h-4 w-4 text-clinic-600" /> Incoming cases
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl text-slate-900"><NumberRoll text={String(summary.incoming.perDay)} delay={150} /></span>
            <span className="text-sm text-slate-500">a day on average</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{summary.incoming.total} in {days} days · was {summary.incoming.previousTotal}</span>
          </div>
          <div className="mt-4">
            <Sparkline
              points={summary.incoming.trend.map((t) => t.count)}
              labels={[summary.incoming.trend[0]?.label ?? "", "Today"]}
            />
          </div>
        </section>

        <section className="card lift rise p-5" style={{ "--i": 7 } as Style}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-label text-slate-500">
            <IconClock className="h-4 w-4 text-clinic-600" /> Speed and outcome
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500">Avg time to open</div>
              <div className="text-2xl text-slate-900"><NumberRoll text={k("response_time").display} delay={150} /></div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Avg time to close</div>
              <div className="text-2xl text-slate-900"><NumberRoll text={k("close_time").display} delay={220} /></div>
            </div>
          </div>
          <div className="mt-4">
            <Rings rings={scoreRings} size={128} />
          </div>
        </section>

        <section className="card lift rise p-5" style={{ "--i": 8 } as Style}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-label text-slate-500">
            <IconAlert className="h-4 w-4 text-clinic-600" /> Where open cases stand
          </div>
          <div className="mt-4">
            <Donut
              slices={summary.openByStatus}
              center={String(summary.openByStatus.reduce((a, b) => a + b.count, 0))}
              centerLabel="still open"
              colorOf={(key) => statusColour[key] ?? "rgb(var(--p8))"}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card lift rise p-5" style={{ "--i": 9 } as Style}>
          <div className="text-xs uppercase tracking-label text-slate-500">What patients raise</div>
          <div className="mt-4">
            <Donut slices={summary.byCategory} center={String(summary.incoming.total)} centerLabel={`in ${days} days`} />
          </div>
        </section>
        <section className="card lift rise p-5" style={{ "--i": 10 } as Style}>
          <div className="text-xs uppercase tracking-label text-slate-500">How they reached us</div>
          <div className="mt-4">
            <Donut
              slices={summary.bySource}
              center={String(summary.incoming.total)}
              centerLabel="cases"
              colorOf={(key) =>
                key === "patient" ? "rgb(var(--p1))" : key === "branch_manager" ? "rgb(var(--p3))" : "rgb(var(--p2))"
              }
            />
          </div>
        </section>
      </div>

      {/* -------------------------------------------------- by branch */}
      {summary.byBranch.length > 1 ? (
        <section className="card rise p-5" style={{ "--i": 11 } as Style}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-xs uppercase tracking-label text-slate-500">By branch</div>
            <div className="flex gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-clinic-600" /> received</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "rgb(var(--p6))" }} /> open now</span>
            </div>
          </div>
          <ul className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
            {(() => {
              const max = Math.max(1, ...summary.byBranch.map((b) => Math.max(b.received, b.open)));
              return summary.byBranch
                .slice()
                .sort((a, b) => b.received - a.received)
                .map((b, i) => (
                  <li key={b.branchId}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate text-slate-800">{b.name}</span>
                      <span className="tabular text-xs text-slate-500">{b.received} · {b.open} open</span>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div className="viz-grow h-full rounded-full bg-clinic-600"
                             style={{ width: `${(b.received / max) * 100}%`, "--delay": `${200 + i * 40}ms` } as Style} />
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                        <div className="viz-grow h-full rounded-full"
                             style={{ width: `${(b.open / max) * 100}%`, background: "rgb(var(--p6))", "--delay": `${260 + i * 40}ms` } as Style} />
                      </div>
                    </div>
                  </li>
                ));
            })()}
          </ul>
        </section>
      ) : null}

      {/* --------------------------------------- concerns after a service */}
      {concernIds.length > 0 ? (
        <section className="card rise p-5" style={{ "--i": 12 } as Style}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-xs uppercase tracking-label text-slate-500">Concerns after a service</div>
            <span className="text-xs text-slate-500">{concernIds.length} in {days} days · where they cluster</span>
          </div>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {[{ title: "By machine", data: byMachine }, { title: "By employee", data: byEmployee }].map((block) => (
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
        </section>
      ) : null}

      {/* ------------------------------------------------ needs attention */}
      {summary.overdueCases.length > 0 ? (
        <section className="card rise p-5" style={{ "--i": 13 } as Style}>
          <div className="text-xs uppercase tracking-label text-slate-500">Past the 24-hour response time</div>
          <ul className="mt-3 divide-y divide-slate-200">
            {summary.overdueCases.map((c) => (
              <li key={c.id}>
                <AppLink href={`/admin/cases/${c.id}`} className="case-row -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5">
                  <span className="text-sm">
                    <span className="ref tabular text-clinic-700">{c.ref}</span>
                    <span className="ms-2 text-slate-600">{c.branch}</span>
                  </span>
                  <span className="pill t-crit">{c.hoursLate} h late</span>
                </AppLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function KpiCard({ kpi, index }: { kpi: Kpi; index: number }) {
  const Icon = kpiIcon[kpi.key] ?? IconPulse;
  const unit = kpi.better === "lower" ? "%" : kpi.key === "satisfaction" ? "" : " pts";
  return (
    <div
      className="lift rise rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
      style={{ "--i": 5 + index * 0.6 } as Style}
      title={`${kpi.hint}. Target ${kpi.target}.`}
    >
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon className="h-4 w-4 text-clinic-600" />
        {kpi.label}
      </div>
      <div className="mt-2 text-3xl text-slate-900">
        {kpi.value === null ? "—" : <NumberRoll text={kpi.display} delay={300 + index * 70} />}
      </div>
      <div className="mt-0.5 text-xs text-slate-500">was {kpi.previousDisplay}</div>
      <div className="mt-3">
        <Meter value={kpi.score} delay={350 + index * 70} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          score {kpi.score ?? "—"} · {kpi.items} item{kpi.items === 1 ? "" : "s"}
        </span>
        <Delta change={kpi.change} unit={unit} />
      </div>
    </div>
  );
}
