/**
 * Shaped like the case page rather than the list, so the layout does not jump
 * when the real thing arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Opening the case…</span>
      <div className="pulse-soft h-4 w-24 rounded bg-slate-200" />

      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="pulse-soft h-5 w-48 rounded bg-slate-200" />
            <div className="pulse-soft h-3 w-64 rounded bg-slate-200" />
          </div>
          <div className="pulse-soft h-6 w-24 rounded-full bg-slate-200" />
        </div>
        <div className="mt-4 flex gap-2">
          <div className="pulse-soft h-9 w-36 rounded-full bg-slate-200" />
          <div className="pulse-soft h-9 w-28 rounded-full bg-slate-200" />
        </div>
      </div>

      <div className="card p-5">
        <div className="pulse-soft h-3 w-20 rounded bg-slate-200" />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="pulse-soft h-2.5 w-14 rounded bg-slate-200" />
              <div className="pulse-soft h-3.5 w-24 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-3 p-5">
        <div className="pulse-soft h-3 w-40 rounded bg-slate-200" />
        <div className="pulse-soft h-3 w-full rounded bg-slate-200" />
        <div className="pulse-soft h-3 w-4/5 rounded bg-slate-200" />
      </div>
    </div>
  );
}
