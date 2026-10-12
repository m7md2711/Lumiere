/**
 * Shown while a route's data is on its way. Mirrors the shape of a page rather
 * than spinning in the middle, so the layout does not jump when it arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="pulse-soft h-7 w-44 rounded-lg bg-slate-200" />
      <div className="pulse-soft h-4 w-64 rounded bg-slate-200" />
      <div className="space-y-3 pt-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-4">
            <div className="pulse-soft h-4 w-40 rounded bg-slate-200" />
            <div className="pulse-soft mt-2.5 h-3 w-28 rounded bg-slate-200" />
            <div className="pulse-soft mt-3 h-3 w-56 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
