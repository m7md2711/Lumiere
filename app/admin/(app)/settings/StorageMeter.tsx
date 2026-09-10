import type { StorageStats } from "@/lib/archive";
import { BYTES_PER_VOICE_MINUTE, DB_LIMIT_BYTES, STORAGE_LIMIT_BYTES } from "@/lib/archive";

const mb = (b: number) => b / 1024 ** 2;

function fmtBytes(b: number): string {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  if (b >= 1024 ** 2) return `${mb(b).toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}

function Bar({ pct }: { pct: number }) {
  // Amber past two thirds, red past ninety percent — the point is to notice.
  const tone = pct >= 90 ? "bg-rose-500" : pct >= 66 ? "bg-amber-400" : "bg-clinic-600";
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-300">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(1.5, pct)}%` }} />
    </div>
  );
}

export function StorageMeter({ stats }: { stats: StorageStats }) {
  const hours = Math.floor(stats.minutesRemaining / 60);
  const mins = Math.round(stats.minutesRemaining % 60);

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Storage</h2>

      <div className="mt-4 rounded-2xl bg-clinic-50 p-4 ring-1 ring-clinic-200">
        <div className="text-xs font-medium uppercase tracking-wide text-clinic-700">
          Recording space left
        </div>
        <div className="tabular mt-1 text-2xl font-bold text-clinic-800">
          {hours > 0 ? `${hours} h ${mins} min` : `${mins} min`}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          about {Math.floor(stats.minutesRemaining)} more one-minute voice notes
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-slate-800">Voice notes</span>
            <span className="tabular text-slate-500">
              {fmtBytes(stats.voiceBytes)} of {fmtBytes(STORAGE_LIMIT_BYTES)}
            </span>
          </div>
          <Bar pct={stats.storageUsedPct} />
          <div className="tabular mt-1.5 text-xs text-slate-500">
            {stats.voiceCount} recordings · {Math.round(stats.minutesStored)} minutes stored ·{" "}
            {stats.storageUsedPct.toFixed(1)}% used
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-slate-800">Case data</span>
            <span className="tabular text-slate-500">
              ~{fmtBytes(stats.dbEstimateBytes)} of {fmtBytes(DB_LIMIT_BYTES)}
            </span>
          </div>
          <Bar pct={stats.dbUsedPct} />
          <div className="tabular mt-1.5 text-xs text-slate-500">
            {stats.caseCount} cases · {stats.eventCount} timeline entries · estimated from row sizes
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Recordings fill the free allowance long before case data does — one minute of audio is
        about {Math.round(BYTES_PER_VOICE_MINUTE / 1024)} KB. Archiving closed cases frees that
        space for new ones.
      </p>
    </section>
  );
}
