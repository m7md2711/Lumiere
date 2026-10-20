import AppLink from "@/components/AppLink";
import { notFound } from "next/navigation";
import { getEvents, relatedOpenCases, repeatCountFor, toWhatsApp } from "@/lib/cases";
import RelatedCases from "@/components/RelatedCases";
import { getEvidenceFiles, signedUrlFor } from "@/lib/evidence";
import EvidenceUploader from "@/components/EvidenceUploader";
import RemoveEvidenceButton from "@/components/RemoveEvidenceButton";
import { getServiceDetail } from "@/lib/service-detail";
import { SERVICE_CONCERN, normalizeCategory } from "@/lib/types";
import { currentSession } from "@/lib/auth";
import { markOpened } from "../../actions";
import { getCaseScoped } from "@/lib/scope";
import { categoryLabel } from "@/lib/i18n";
import { isOverdue } from "@/lib/types";
import { OverduePill, PriorityPill, StatusPill, isClosed, shortDate } from "@/components/Pills";
import CaseActions from "./CaseActions";
import DeleteCase from "./DeleteCase";

export const dynamic = "force-dynamic";

export default async function CaseDetail({ params }: { params: { id: string } }) {
  const c = await getCaseScoped(params.id);
  if (!c) notFound();

  // Looking at a case is the response, so the clock stops here. No-ops unless
  // the case is still `new`.
  await markOpened(c.id);

  const [events, session, evidence, repeat, service, related] = await Promise.all([
    getEvents(c.id),
    currentSession(),
    getEvidenceFiles(c.id),
    repeatCountFor(c.mobile, c.id),
    getServiceDetail(c.id),
    relatedOpenCases(c.mobile, c.id),
  ]);
  const isServiceConcern = normalizeCategory(c.category) === SERVICE_CONCERN;

  const isAdmin = session?.role === "admin";
  // One signed link per file, fetched together.
  const evidenceLinks = await Promise.all(evidence.map((f) => signedUrlFor(f.path)));
  const wa = toWhatsApp(c.mobile);

  return (
    <div className="space-y-4">
      <AppLink href="/admin/cases" className="text-sm font-medium text-clinic-700 hover:underline">
        ← All cases
      </AppLink>

      <header
        className={`card p-5 ${isClosed(c.status) ? "border-[rgb(var(--ok-ring))]" : ""}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="tabular text-lg font-bold text-clinic-800">{c.ref}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {c.branches?.name_en ?? "—"}
              {c.qr_locations ? ` · ${c.qr_locations.label_en}` : ""} · {shortDate(c.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill status={c.status} />
            <PriorityPill priority={c.priority} />
            {isOverdue(c) ? <OverduePill /> : null}
            {repeat > 1 ? (
              <span
                className="inline-flex rounded-full bg-amber-950/70 px-2.5 py-1 text-xs text-[rgb(var(--warn-fg))] ring-1 ring-amber-900"
                title="This mobile number has contacted us before"
              >
                {repeat} cases from this patient
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`tel:${c.mobile}`} className="btn btn-ghost">Call {c.mobile}</a>
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            WhatsApp
          </a>
        </div>
      </header>

      <RelatedCases cases={related} />

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Patient
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Field label="Name" value={c.patient_name} />
          <Field label="Mobile" value={c.mobile} mono />
          <Field label="Language" value={c.preferred_lang === "ar" ? "Arabic" : "English"} />
          <Field label="Contact by" value={c.contact_method === "whatsapp" ? "WhatsApp" : "Call"} />
          <Field label="Best time" value={cap(c.preferred_time)} />
          <Field label="Assigned to" value={c.assigned_to ?? "—"} />
          <Field label="Category" value={categoryLabel(c.category, "en")} />
          <Field label="SLA due" value={shortDate(c.sla_due_at)} />
          {c.closed_at ? <Field label="Closed" value={shortDate(c.closed_at)} /> : null}
          {c.refund_amount ? (
            <Field
              label="Refund"
              value={`AED ${Number(c.refund_amount).toFixed(2)} · ${c.refund_status ?? "—"}`}
            />
          ) : null}
          {c.satisfaction ? <Field label="Satisfaction" value={`${c.satisfaction} / 5`} /> : null}
          {service?.employee ? <Field label="Employee" value={service.employee} /> : null}
          {service?.device ? <Field label="Machine" value={service.device} /> : null}
        </dl>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          What the patient told us
        </h2>
        {c.description ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {c.description}
          </p>
        ) : (
          <p className="text-sm italic text-slate-400">No written note — voice message only.</p>
        )}
        {c.voice_url ? (
          <div className="mt-4">
            <div className="mb-2 text-xs font-medium text-slate-500">Voice note</div>
            <audio controls src={c.voice_url} className="w-full" />
          </div>
        ) : null}
        {c.resolution_note ? (
          <div className="mt-4 rounded-xl bg-emerald-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Resolution{c.closure_reason ? ` · ${c.closure_reason}` : ""}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">{c.resolution_note}</p>
          </div>
        ) : null}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-xs uppercase tracking-label text-slate-500">
          Signed complaint form{evidence.length > 1 ? ` · ${evidence.length} files` : ""}
        </h2>
        {evidence.length > 0 ? (
          <ul className="divide-y divide-slate-200">
            {evidence.map((f, i) => (
              <li key={f.path} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  {evidenceLinks[i] ? (
                    <a
                      href={evidenceLinks[i]!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm text-clinic-700 hover:underline"
                    >
                      {f.name}
                    </a>
                  ) : (
                    <span className="block truncate text-sm text-slate-500">{f.name}</span>
                  )}
                  <span className="text-xs text-slate-500">
                    {f.size ? `${(f.size / 1024 / 1024).toFixed(1)} MB · ` : ""}
                    {f.by} · {shortDate(f.at)}
                  </span>
                </div>
                {isAdmin ? <RemoveEvidenceButton caseId={c.id} path={f.path} name={f.name} /> : null}
              </li>
            ))}
          </ul>
        ) : c.status === "solved" || c.status === "closed" ? (
          <p className="alert-warn">
            No signed form on file, and this case is already marked{" "}
            {c.status === "solved" ? "solved" : "closed"}. Ask the branch for it if this
            complaint needs one on record.
          </p>
        ) : (
          <p className="text-sm italic text-slate-400">
            Nothing attached yet. Add the form the patient signed whenever you have it — it is
            not required to mark the case solved.
          </p>
        )}

        <EvidenceUploader caseId={c.id} />
      </section>

      <CaseActions
        id={c.id}
        status={c.status}
        priority={c.priority}
        refundStatus={c.refund_status}
        contactMethod={c.contact_method}
        isAdmin={Boolean(isAdmin)}
        hasEvidence={evidence.length > 0}
        isServiceConcern={isServiceConcern}
        service={service ? { employee: service.employee, device: service.device } : null}
        related={related.map((r) => ({ id: r.id, ref: r.ref, status: r.status, created_at: r.created_at }))}
      />

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Timeline
        </h2>
        <ol className="space-y-4">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-clinic-500" />
                <span className="w-px flex-1 bg-slate-200" />
              </div>
              <div className="pb-1">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {e.type} · {shortDate(e.created_at)}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{e.message}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {isAdmin ? <DeleteCase id={c.id} caseRef={c.ref} /> : null}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`mt-0.5 font-medium text-slate-800 ${mono ? "tabular" : ""}`}>{value}</dd>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
