"use client";

import { useState } from "react";
import { LogoMark } from "@/components/Logo";
import { categoryLabel } from "@/lib/i18n";
import { CATEGORIES } from "@/lib/types";
import { categoryIconMap } from "@/components/Icons";
import type { Category, ContactMethod, Lang, PreferredTime } from "@/lib/types";
import type { Channel } from "@/lib/sources";

type Props = {
  channel: Channel;
  accessCode: string;
  meta: { en: string; ar: string; blurb: string };
  branches: { code: string; name: string }[];
};

export default function IntakeForm({ channel, accessCode, meta, branches }: Props) {
  const [branch, setBranch] = useState(branches[0]?.code ?? "");
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("call");
  const [preferredTime, setPreferredTime] = useState<PreferredTime>("morning");
  const [takenBy, setTakenBy] = useState("");

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  function validMobile(v: string): boolean {
    const d = v.replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
    const local = /^971\d{9}$/.test(d) ? "0" + d.slice(3) : /^\d{9}$/.test(d) ? "0" + d : d;
    return /^0(50|52|54|55|56|58)\d{7}$/.test(local);
  }

  async function submit() {
    setError(null);
    if (!branch) return setError("Choose the branch this concerns.");
    if (!category) return setError("Choose what the complaint is about.");
    if (!description.trim()) return setError("Write down what the patient told you.");
    if (!name.trim()) return setError("Enter the patient's name.");
    if (!validMobile(mobile)) return setError("Enter a valid UAE mobile, for example 050 123 4567.");

    setSending(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          accessCode,
          branchCode: branch,
          category,
          description: description.trim(),
          patientName: name.trim(),
          mobile,
          preferredLang: lang,
          contactMethod,
          preferredTime,
          takenBy: takenBy.trim(),
        }),
      });
      const json = (await res.json()) as { ref?: string; error?: string };
      if (!res.ok || !json.ref) throw new Error(json.error ?? "failed");
      setRef(json.ref);
    } catch {
      setError("Could not save it. Check your connection and try again — nothing is lost.");
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setRef(null);
    setCategory(null);
    setDescription("");
    setName("");
    setMobile("");
    setError(null);
  }

  if (ref) {
    return (
      <Shell meta={meta}>
        <div className="card p-6 text-center">
          <h1 className="text-lg text-slate-900">Complaint logged</h1>
          <p className="mt-2 text-sm text-slate-600">
            The branch has been notified and has 24 hours to respond.
          </p>
          <div className="mt-5 rounded-2xl bg-clinic-50 p-5 ring-1 ring-clinic-300">
            <div className="text-xs uppercase tracking-label text-clinic-700">Reference</div>
            <div className="tabular mt-2 select-all text-2xl text-clinic-800">{ref}</div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Give this number to the patient so they can quote it.
          </p>
          <button type="button" className="btn btn-primary mt-5" onClick={reset}>
            Log another
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell meta={meta}>
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="branch">Branch</label>
          <select id="branch" className="field" value={branch} onChange={(e) => setBranch(e.target.value)}>
            {branches.map((b) => (
              <option key={b.code} value={b.code}>{b.code} · {b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <span className="label">What is it about?</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map((c) => {
              const Icon = categoryIconMap[c];
              const on = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => { setCategory(c); setError(null); }}
                  className={[
                    "flex min-h-[54px] items-center gap-3 rounded-xl border p-3 text-start transition-colors",
                    on ? "border-clinic-600 bg-clinic-50 ring-1 ring-clinic-300"
                       : "border-slate-200 bg-slate-100 hover:border-clinic-300",
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
          <label className="label" htmlFor="desc">What the patient told you</label>
          <textarea
            id="desc" className="field min-h-[130px]" value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="In their own words where you can"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pname">Patient name</label>
            <input id="pname" className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="pmob">Patient mobile</label>
            <input
              id="pmob" className="field tabular" dir="ltr" inputMode="tel" placeholder="05X XXX XXXX"
              value={mobile} onChange={(e) => setMobile(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Choice label="Call back by" value={contactMethod} onChange={setContactMethod}
                  options={[{ v: "call" as const, label: "Call" }, { v: "whatsapp" as const, label: "WhatsApp" }]} />
          <Choice label="Best time" value={preferredTime} onChange={setPreferredTime}
                  options={[
                    { v: "morning" as const, label: "Morning" },
                    { v: "afternoon" as const, label: "Afternoon" },
                    { v: "evening" as const, label: "Evening" },
                  ]} />
          <Choice label="Patient speaks" value={lang} onChange={setLang}
                  options={[{ v: "en" as const, label: "English" }, { v: "ar" as const, label: "Arabic" }]} />
        </div>

        <div>
          <label className="label" htmlFor="by">Logged by (your name)</label>
          <input
            id="by" className="field" value={takenBy} onChange={(e) => setTakenBy(e.target.value)}
            placeholder="So the branch knows who to ask"
          />
        </div>

        {error ? <p role="alert" className="alert-error">{error}</p> : null}

        <button type="button" className="btn btn-primary btn-lg" disabled={sending} onClick={submit}>
          {sending ? "Saving…" : "Log this complaint"}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ meta, children }: { meta: { en: string; blurb: string }; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-clinic-200 bg-gradient-to-b from-slate-100 to-slate-50 px-5 pb-7 pt-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <LogoMark size={26} />
          <span className="chip">{meta.en}</span>
        </div>
        <div className="mx-auto mt-5 max-w-2xl">
          <h1 className="text-xl uppercase tracking-brand text-clinic-800">Log a patient complaint</h1>
          <p className="mt-1.5 text-sm text-slate-600">{meta.blurb}</p>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 pb-16 pt-6">{children}</main>
    </div>
  );
}

function Choice<V extends string>({
  label, value, onChange, options,
}: {
  label: string; value: V; onChange: (v: V) => void; options: { v: V; label: string }[];
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
        {options.map((o) => (
          <button
            key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}
            className={[
              "min-h-[44px] rounded-xl border px-2 py-2 text-xs transition-colors",
              value === o.v ? "border-clinic-600 bg-clinic-50 text-clinic-800"
                            : "border-slate-300 bg-slate-200 text-slate-700 hover:border-clinic-300",
            ].join(" ")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
