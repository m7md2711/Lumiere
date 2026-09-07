import Link from "next/link";
import { notFound } from "next/navigation";
import { getCase, getEvents, toWhatsApp } from "@/lib/cases";
import { categoryLabel } from "@/lib/i18n";
import { isOverdue } from "@/lib/types";
import { OverduePill, PriorityPill, StatusPill, shortDate } from "@/components/Pills";
import CaseActions from "./CaseActions";

export const dynamic = "force-dynamic";

export default async function CaseDetail({ params }: { params: { id: string } }) {
  const c = await getCase(params.id);
  if (!c) notFound();

  const events = await getEvents(c.id);
  const wa = toWhatsApp(c.mobile);

  return (
    <div className="space-y-4">
      <Link href="/admin/cases" className="text-sm font-medium text-clinic-700 hover:underline">
        ← All cases
      </Link>

      <header className="card p-5">
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

      <CaseActions
        id={c.id}
        status={c.status}
        priority={c.priority}
        refundStatus={c.refund_status}
        contactMethod={c.contact_method}
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
