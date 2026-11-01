/**
 * Motion-first data marks: number roll, score gauge, donut, activity rings,
 * sparkline and progress bar.
 *
 * All server-rendered and JavaScript-free. Each animation names only a `from`
 * state in CSS; the element's own inline style is the final state, so the
 * browser animates from zero to the value the server already wrote. Nothing
 * flashes, nothing hydrates, and with reduced motion the final value simply
 * shows.
 */

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

// ---------------------------------------------------------------- numbers

/** Digits that roll into place, like an odometer. Non-digits stay put. */
export function NumberRoll({
  text,
  delay = 0,
  className = "",
}: {
  text: string;
  delay?: number;
  className?: string;
}) {
  const chars = Array.from(text);
  return (
    <span className={`roll ${className}`}>
      {/* What a screen reader announces and what copy-paste picks up. */}
      <span className="sr-only">{text}</span>
      {chars.map((ch, i) =>
        /\d/.test(ch) ? (
          <span
            key={i}
            aria-hidden
            className="roll-col"
            style={{ "--d": Number(ch), "--delay": `${delay + i * 55}ms` } as Style}
          >
            <span className="roll-strip">
              {"0123456789".split("").map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden className="roll-static">
            {ch}
          </span>
        )
      )}
    </span>
  );
}

// ------------------------------------------------------------------ gauge

export function ScoreGauge({
  score,
  size = 168,
  label = "of 100",
}: {
  score: number | null;
  size?: number;
  label?: string;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const v = score ?? 0;
  const offset = c * (1 - v / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="gauge-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--c-800))" />
            <stop offset="55%" stopColor="rgb(var(--c-600))" />
            <stop offset="100%" stopColor="rgb(var(--c-400))" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(var(--s-200))" strokeWidth="9" />
        {score !== null ? (
          <circle
            cx="60" cy="60" r={r} fill="none" stroke="url(#gauge-gold)" strokeWidth="9"
            strokeLinecap="round" strokeDasharray={c}
            className="viz-sweep"
            style={{ strokeDashoffset: offset, "--c": c } as Style}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl text-slate-900">
          {score === null ? "—" : <NumberRoll text={String(score)} delay={200} />}
        </span>
        <span className="mt-0.5 text-xs text-slate-500">{label}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ donut

export const PALETTE = ["--p1", "--p2", "--p3", "--p4", "--p5", "--p6", "--p7", "--p8"];

export function Donut({
  slices,
  center,
  centerLabel,
  size = 150,
  colorOf,
}: {
  slices: { key: string; label: string; count: number }[];
  center: string;
  centerLabel: string;
  size?: number;
  colorOf?: (key: string, i: number) => string;
}) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  const r = 46;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 2.2 : 0;
  let acc = 0;

  const color = (key: string, i: number) =>
    colorOf ? colorOf(key, i) : `rgb(var(${PALETTE[i % PALETTE.length]}))`;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(var(--s-200))" strokeWidth="14" />
          {total > 0
            ? slices.map((s, i) => {
                const len = Math.max(0, (s.count / total) * c - gap);
                const seg = (
                  <circle
                    key={s.key}
                    cx="60" cy="60" r={r} fill="none"
                    stroke={color(s.key, i)} strokeWidth="14"
                    strokeDasharray={`${len} ${c}`}
                    strokeDashoffset={-acc}
                    className="viz-seg"
                    style={{ "--c": c, "--delay": `${150 + i * 90}ms` } as Style}
                  />
                );
                acc += (s.count / total) * c;
                return seg;
              })
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl text-slate-900"><NumberRoll text={center} delay={250} /></span>
          <span className="max-w-[80%] text-[10px] uppercase tracking-label text-slate-500">{centerLabel}</span>
        </div>
      </div>

      <ul className="min-w-[140px] flex-1 space-y-1.5">
        {total === 0 ? <li className="text-sm italic text-slate-400">Nothing in this period.</li> : null}
        {slices.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color(s.key, i) }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-slate-700">{s.label}</span>
            <span className="tabular text-xs text-slate-500">
              {s.count} · {Math.round((s.count / Math.max(1, total)) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------- activity rings

export function Rings({
  rings,
  size = 150,
}: {
  rings: { label: string; value: number | null; display: string; color: string; hint?: string }[];
  size?: number;
}) {
  const stroke = 10;
  const step = 13;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 120 120" style={{ width: size, height: size }} className="-rotate-90 shrink-0" aria-hidden>
        {rings.map((ring, i) => {
          const r = 52 - i * step;
          const c = 2 * Math.PI * r;
          const v = Math.max(0, Math.min(100, ring.value ?? 0));
          return (
            <g key={ring.label}>
              <circle cx="60" cy="60" r={r} fill="none" stroke={ring.color} strokeOpacity="0.16" strokeWidth={stroke} />
              {ring.value !== null ? (
                <circle
                  cx="60" cy="60" r={r} fill="none" stroke={ring.color} strokeWidth={stroke}
                  strokeLinecap="round" strokeDasharray={c}
                  className="viz-sweep"
                  style={{ strokeDashoffset: c * (1 - v / 100), "--c": c, "--delay": `${200 + i * 140}ms` } as Style}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <ul className="min-w-[160px] flex-1 space-y-2.5">
        {rings.map((ring) => (
          <li key={ring.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ring.color }} aria-hidden />
                {ring.label}
              </span>
              <span className="tabular text-sm text-slate-900">{ring.display}</span>
            </div>
            {ring.hint ? <p className="ms-[18px] text-xs text-slate-500">{ring.hint}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// -------------------------------------------------------------- sparkline

export function Sparkline({
  points,
  height = 90,
  labels,
}: {
  points: number[];
  height?: number;
  labels?: [string, string];
}) {
  const W = 300;
  const H = height;
  const pad = 6;
  const max = Math.max(1, ...points);
  const x = (i: number) => pad + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - pad * 2));
  const y = (v: number) => pad + (H - pad * 2) * (1 - v / max);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - pad} L${pad},${H - pad} Z`;
  const last = points.length - 1;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="none" role="img"
           aria-label="Cases received per day">
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--c-600))" stopOpacity="0.32" />
            <stop offset="100%" stopColor="rgb(var(--c-600))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spark-fill)" className="viz-fade" />
        <path d={line} fill="none" stroke="rgb(var(--c-600))" strokeWidth="2" strokeLinejoin="round"
              strokeLinecap="round" pathLength={1} strokeDasharray="1" className="viz-draw"
              vectorEffect="non-scaling-stroke" />
        {points.length ? (
          <circle cx={x(last)} cy={y(points[last])} r="3.5" fill="rgb(var(--c-600))"
                  stroke="rgb(var(--s-100))" strokeWidth="2" className="viz-pop" />
        ) : null}
      </svg>
      {labels ? (
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      ) : null}
    </div>
  );
}

// --------------------------------------------------------- progress / delta

export function Meter({ value, delay = 0 }: { value: number | null; delay?: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
      {value !== null ? (
        <div
          className="viz-grow h-full rounded-full bg-gradient-to-r from-clinic-400 via-clinic-600 to-clinic-800"
          style={{ width: `${Math.max(2, Math.min(100, value))}%`, "--delay": `${delay}ms` } as Style}
        />
      ) : null}
    </div>
  );
}

/** "▲ 12%" in green when better, red when worse, whichever way better runs. */
export function Delta({
  change,
  unit = "%",
  pointsLabel,
}: {
  change: number | null;
  unit?: string;
  pointsLabel?: boolean;
}) {
  if (change === null) {
    return <span className="pill t-flat">— No comparison yet</span>;
  }
  if (change === 0) return <span className="pill t-flat">= Unchanged</span>;
  const good = change > 0;
  return (
    <span className={`pill ${good ? "t-ok" : "t-crit"}`}>
      {good ? "▲" : "▼"} {Math.abs(change)}
      {pointsLabel ? " pts" : unit}
    </span>
  );
}
