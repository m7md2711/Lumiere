import { categoryLabel } from "@/lib/i18n";
import { StatusPill, shortDate } from "./Pills";
import type { RelatedCase } from "@/lib/cases";

/**
 * Shown on a case when the same patient has other cases still open. Most often
 * that is one complaint sent several times because the first felt unanswered —
 * worth seeing before anyone replies, so the patient is answered once.
 */
export default function RelatedCases({ cases }: { cases: RelatedCase[] }) {
  if (cases.length === 0) return null;
  return (
    <section className="tint t-warn rounded-2xl p-5">
      <h2 className="text-xs uppercase tracking-label">
        Same patient · {cases.length} other open case{cases.length === 1 ? "" : "s"}
      </h2>
      <p className="mt-1.5 text-sm opacity-90">
        Likely the same complaint sent again. When you close this one you can close these with
        it, so the patient is answered once.
      </p>
      <ul className="mt-3 space-y-2">
        {cases.map((c) => (
          <li key={c.id} className="rounded-xl bg-slate-100/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a href={`/admin/cases/${c.id}`} className="tabular text-sm text-clinic-700 hover:underline">
                {c.ref}
              </a>
              <StatusPill status={c.status} />
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {categoryLabel(c.category, "en")} · {shortDate(c.created_at)}
            </div>
            {c.description ? (
              <p className="mt-1.5 line-clamp-2 text-sm text-slate-700" dir="auto">{c.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
