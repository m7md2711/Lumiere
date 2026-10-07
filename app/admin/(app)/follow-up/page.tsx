import Link from "next/link";
import { currentSession } from "@/lib/auth";
import { listCasesScoped } from "@/lib/scope";
import { followUpsFor, dueLabel } from "@/lib/followup";
import { categoryLabel } from "@/lib/i18n";
import { sourceOf, sourceShort } from "@/lib/sources";
import { StatusPill, shortDate } from "@/components/Pills";
import FollowUpActions from "./FollowUpActions";

export const dynamic = "force-dynamic";

/**
 * Cases closed with a date to look again. Each carries a summary of what
 * happened, so whoever picks it up in three weeks does not have to reconstruct
 * the story from the timeline.
 */
export default async function FollowUpPage() {
  const session = await currentSession();
  if (!session) return null;

  const cases = await listCasesScoped({ status: "follow_up" }, 500);
  const recs = await followUpsFor(cases.map((c) => c.id));

  const withDates = cases
    .map((c) => ({ c, rec: recs[c.id] }))
    .filter((x) => x.rec)
    .sort((a, b) => a.rec!.at.localeCompare(b.rec!.at));

  const dueNow = withDates.filter((x) => {
    const d = dueLabel(x.rec!.at);
    return d.today || d.overdue;
  }).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl text-slate-900">Follow-up</h1>
        <p className="text-sm text-slate-500">
          {withDates.length} case{withDates.length === 1 ? "" : "s"} to check back on
          {dueNow ? ` · ${dueNow} due now` : ""}
        </p>
      </div>

      {withDates.length === 0 ? (
        <p className="card p-8 text-center text-sm text-slate-500">
          Nothing scheduled. When you close a case you can set a date to look at it again —
          it will appear here, and everyone is emailed that morning.
        </p>
      ) : null}

      <div className="space-y-3">
        {withDates.map(({ c, rec }) => {
          const d = dueLabel(rec!.at);
          return (
            <article
              key={c.id}
              className={[
                "card p-5",
                d.overdue ? "border-rose-900/50" : d.today ? "border-clinic-600" : "",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/admin/cases/${c.id}`} className="tabular text-sm text-clinic-700 hover:underline">
                    {c.ref}
                  </Link>
                  <div className="mt-1 text-sm text-slate-800">{c.patient_name}</div>
                  <div className="text-xs text-slate-500">
                    {categoryLabel(c.category, "en")} · {c.branches?.name_en ?? "—"}
                    {sourceOf(c.qr_locations?.code) !== "patient"
                      ? ` · ${sourceShort[sourceOf(c.qr_locations?.code)]}`
                      : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusPill status={c.status} />
                  <span
                    className={[
                      "tabular text-xs",
                      d.overdue ? "text-rose-300" : d.today ? "text-clinic-700" : "text-slate-500",
                    ].join(" ")}
                  >
                    {rec!.at} · {d.text}
                  </span>
                  {rec!.round > 1 ? (
                    <span className="text-xs text-slate-400">follow-up {rec!.round}</span>
                  ) : null}
                </div>
              </div>

              <dl className="mt-4 grid gap-3 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-400">What the patient said</dt>
                  <dd className="mt-0.5 line-clamp-3 text-slate-700">
                    {c.description || "Voice note only."}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">How it was resolved</dt>
                  <dd className="mt-0.5 line-clamp-3 text-slate-700">
                    {c.resolution_note || "—"}
                    {c.closure_reason ? (
                      <span className="block text-xs text-slate-500">{c.closure_reason}</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">What to check now</dt>
                  <dd className="mt-0.5 text-slate-700">{rec!.note}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Opened · satisfaction</dt>
                  <dd className="mt-0.5 text-slate-700">
                    {shortDate(c.created_at)}
                    {c.satisfaction ? ` · ${c.satisfaction}/5` : ""}
                  </dd>
                </div>
              </dl>

              <FollowUpActions
                id={c.id}
                mobile={c.mobile}
                isAdmin={session.role === "admin"}
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}
