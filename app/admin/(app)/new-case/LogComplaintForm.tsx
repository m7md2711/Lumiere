"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { logComplaint } from "../actions";
import { categoryLabel } from "@/lib/i18n";
import { CATEGORIES } from "@/lib/types";
import { categoryIconMap } from "@/components/Icons";
import type { Category } from "@/lib/types";

type Props = {
  role: "admin" | "branch" | "call_center";
  fixedBranch: { code: string; name: string } | null;
  branches: { code: string; name: string }[];
};

export default function LogComplaintForm({ role, fixedBranch, branches }: Props) {
  const [category, setCategory] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="space-y-4">
        <div className="card p-6 text-center">
          <h1 className="text-lg text-slate-900">Complaint raised</h1>
          <p className="mt-2 text-sm text-slate-600">
            {fixedBranch ? "It is on your branch's list now." : "The branch has been notified."}{" "}
            They have 24 hours to respond.
          </p>
          <div className="mt-5 rounded-2xl bg-clinic-50 p-5 ring-1 ring-clinic-300">
            <div className="text-xs uppercase tracking-label text-clinic-700">Reference</div>
            <div className="tabular mt-2 select-all text-2xl text-clinic-800">{done}</div>
          </div>
          <p className="mt-4 text-xs text-slate-500">Give this number to the patient.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => { setDone(null); setCategory(null); }}>
              Raise another
            </button>
            <Link href="/admin/logged" className="btn btn-ghost">See logged cases</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl text-slate-900">Raise a complaint</h1>
        <p className="text-sm text-slate-500">
          {fixedBranch
            ? `For a patient who spoke to someone at ${fixedBranch.name}.`
            : "For a patient who called or spoke to staff rather than using the form."}
        </p>
      </div>

      <form
        className="card space-y-5 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          if (!category) return setError("Choose what the complaint is about.");
          fd.set("category", category);
          startTransition(async () => {
            const res = await logComplaint(fd);
            if (res.ok) setDone(res.ref);
            else setError(res.error);
          });
        }}
      >
        {fixedBranch ? (
          <div>
            <span className="label">Branch</span>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="tabular text-xs text-clinic-600">{fixedBranch.code}</span>
              <span className="text-sm text-slate-800">{fixedBranch.name}</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="branchCode">Branch this concerns</label>
              <select id="branchCode" name="branchCode" className="field" required defaultValue="">
                <option value="" disabled>Choose a branch…</option>
                {branches.map((b) => (
                  <option key={b.code} value={b.code}>{b.code} · {b.name}</option>
                ))}
              </select>
            </div>
            {role === "admin" ? (
              <div>
                <label className="label" htmlFor="channel">Reached us through</label>
                <select id="channel" name="channel" className="field" defaultValue="mgr">
                  <option value="mgr">Branch manager</option>
                  <option value="cc">Call centre</option>
                </select>
              </div>
            ) : null}
          </div>
        )}

        <div>
          <span className="label">What is it about?</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map((c) => {
              const Icon = categoryIconMap[c];
              const on = category === c;
              return (
                <button
                  key={c} type="button" aria-pressed={on}
                  onClick={() => { setCategory(c); setError(null); }}
                  className={[
                    "flex min-h-[54px] items-center gap-3 rounded-xl border p-3 text-start transition-colors",
                    on ? "border-clinic-600 bg-clinic-50 ring-1 ring-clinic-300"
                       : "border-slate-200 bg-slate-50 hover:border-clinic-300",
                  ].join(" ")}
                >
                  <span className="text-clinic-600"><Icon className="h-5 w-5" /></span>
                  <span className="text-sm leading-snug text-slate-800">{categoryLabel(c, "en")}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="description">What the patient told you</label>
          <textarea id="description" name="description" className="field min-h-[120px]" required
                    placeholder="In their own words where you can" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="patientName">Patient name</label>
            <input id="patientName" name="patientName" className="field" required />
          </div>
          <div>
            <label className="label" htmlFor="mobile">Patient mobile</label>
            <input id="mobile" name="mobile" className="field tabular" dir="ltr" inputMode="tel"
                   placeholder="05X XXX XXXX" required />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="contactMethod">Call back by</label>
            <select id="contactMethod" name="contactMethod" className="field">
              <option value="call">Call</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="preferredTime">Best time</label>
            <select id="preferredTime" name="preferredTime" className="field">
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="preferredLang">Patient speaks</label>
            <select id="preferredLang" name="preferredLang" className="field">
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </div>
        </div>

        {error ? <p role="alert" className="alert-error">{error}</p> : null}

        <button className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? "Saving…" : "Raise this complaint"}
        </button>
      </form>
    </div>
  );
}
