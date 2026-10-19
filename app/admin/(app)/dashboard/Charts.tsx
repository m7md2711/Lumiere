/**
 * The dashboard's four charts, drawn on the server as plain markup.
 *
 * These were recharts, which shipped about 100 kB of JavaScript to draw four
 * bar and line charts that never change after they render — more than every
 * other page's code combined. Bars here are sized boxes on one shared scale
 * and the trend is a single SVG path, so the page arrives finished and the
 * browser has nothing to run. Colours come from the theme tokens, so both
 * light and dark hold.
 */

type BranchDatum = { name: string; full: string; cases: number; open: number };
type CategoryDatum = { name: string; full: string; cases: number };
type SplitDatum = { name: string; atBranch: number; escalated: number };
type TrendDatum = { name: string; cases: number };

export default function Charts({
  byBranch,
  byCategory,
  resolutionSplit,
  trend,
}: {
  byBranch: BranchDatum[];
  byCategory: CategoryDatum[];
  resolutionSplit: SplitDatum[];
  trend: TrendDatum[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel title="Cases by branch" legend={[["Total", "bg-clinic-600"], ["Open", "bg-clinic-300"]]}>
        <Columns
          data={byBranch.map((b) => ({
            label: b.name,
            title: b.full,
            parts: [
              { value: b.cases, cls: "bg-clinic-600" },
              { value: b.open, cls: "bg-clinic-300" },
            ],
          }))}
          mode="grouped"
        />
      </Panel>

      <Panel title="Cases by topic">
        <Rows data={byCategory.map((c) => ({ label: c.full, value: c.cases }))} />
      </Panel>

      <Panel
        title="Resolved at branch vs escalated"
        legend={[["At branch", "bg-clinic-600"], ["Escalated", "bg-[rgb(var(--crit-fg))]"]]}
      >
        <Columns
          data={resolutionSplit.map((s) => ({
            label: s.name,
            title: s.name,
            parts: [
              { value: s.atBranch, cls: "bg-clinic-600" },
              { value: s.escalated, cls: "bg-[rgb(var(--crit-fg))]" },
            ],
          }))}
          mode="stacked"
        />
      </Panel>

      <Panel title="Last 30 days">
        <Trend data={trend} />
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function Panel({
  title,
  legend,
  children,
}: {
  title: string;
  legend?: [string, string][];
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm text-slate-700">{title}</h2>
        {legend ? (
          <div className="flex flex-wrap gap-3">
            {legend.map(([label, cls]) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`h-2 w-2 rounded-sm ${cls}`} aria-hidden />
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A tick every few units, so the axis reads in round numbers. */
function niceMax(n: number): number {
  if (n <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(n)));
  const top = Math.ceil(n / step) * step;
  return top % 4 === 0 ? top : Math.ceil(top / 4) * 4;
}

function Columns({
  data,
  mode,
}: {
  data: { label: string; title: string; parts: { value: number; cls: string }[] }[];
  mode: "grouped" | "stacked";
}) {
  const peak = Math.max(
    1,
    ...data.map((d) =>
      mode === "stacked"
        ? d.parts.reduce((s, p) => s + p.value, 0)
        : Math.max(...d.parts.map((p) => p.value))
    )
  );
  const max = niceMax(peak);
  const ticks = [max, (max * 3) / 4, max / 2, max / 4, 0];

  return (
    <div className="flex h-56 gap-2">
      {/* y axis — every label is a value the scale reaches */}
      <div className="flex flex-col justify-between pb-5 text-right">
        {ticks.map((t) => (
          <span key={t} className="tabular text-[10px] leading-none text-slate-400">
            {Number.isInteger(t) ? t : t.toFixed(1)}
          </span>
        ))}
      </div>

      <div className="relative flex-1">
        {/* gridlines on the same scale as the ticks */}
        <div className="absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between" aria-hidden>
          {ticks.map((t) => (
            <div key={t} className="border-t border-dashed border-slate-200" />
          ))}
        </div>

        <div className="absolute inset-0 flex items-end gap-1.5">
          {data.map((d) => {
            const total = d.parts.reduce((s, p) => s + p.value, 0);
            return (
              <div key={d.label} className="flex h-full flex-1 flex-col justify-end" title={`${d.title}: ${d.parts.map((p) => p.value).join(" / ")}`}>
                <div
                  className={
                    mode === "stacked"
                      ? "flex flex-col-reverse justify-start overflow-hidden rounded-t-[3px]"
                      : "flex items-end justify-center gap-[2px]"
                  }
                  style={mode === "stacked" ? { height: `calc((100% - 1.25rem) * ${total / max})` } : { height: "calc(100% - 1.25rem)" }}
                >
                  {d.parts.map((p, i) =>
                    mode === "stacked" ? (
                      <div
                        key={i}
                        className={p.cls}
                        style={{ height: total ? `${(p.value / total) * 100}%` : 0 }}
                      />
                    ) : (
                      <div
                        key={i}
                        className={`w-full max-w-[14px] rounded-t-[3px] ${p.cls}`}
                        style={{ height: `${(p.value / max) * 100}%`, minHeight: p.value ? 2 : 0 }}
                      />
                    )
                  )}
                </div>
                <div className="tabular mt-1 h-4 truncate text-center text-[10px] text-slate-400">
                  {d.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Rows({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="text-sm italic text-slate-400">No cases yet.</p>;

  return (
    <ul className="space-y-2.5">
      {data
        .slice()
        .sort((a, b) => b.value - a.value)
        .map((d) => (
          <li key={d.label}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-slate-700">{d.label}</span>
              <span className="tabular text-slate-500">{d.value}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-clinic-600"
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
    </ul>
  );
}

function Trend({ data }: { data: TrendDatum[] }) {
  const W = 600;
  const H = 200;
  const padL = 26;
  const padB = 22;
  const padT = 10;
  const innerW = W - padL - 8;
  const innerH = H - padB - padT;

  const max = niceMax(Math.max(1, ...data.map((d) => d.cases)));
  const x = (i: number) => padL + (data.length <= 1 ? 0 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.cases).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${padT + innerH} L${padL},${padT + innerH} Z`;
  const ticks = [0, max / 2, max];
  const last = data[data.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" role="img" aria-label="Cases per day over the last 30 days">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--c-600))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="rgb(var(--c-600))" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="rgb(var(--s-200))" strokeDasharray="3 4" />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="rgb(var(--s-400))">
            {Number.isInteger(t) ? t : t.toFixed(1)}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#trendFill)" />
      <path d={line} fill="none" stroke="rgb(var(--c-600))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* emphasise today */}
      {last ? (
        <circle cx={x(data.length - 1)} cy={y(last.cases)} r="3.5" fill="rgb(var(--c-600))" stroke="rgb(var(--s-100))" strokeWidth="2" />
      ) : null}

      {data.map((d, i) =>
        i % 6 === 0 || i === data.length - 1 ? (
          <text key={d.name} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--s-400))">
            {d.name}
          </text>
        ) : null
      )}
    </svg>
  );
}
