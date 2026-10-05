"use client";

import { useState, useTransition } from "react";
import { saveIntakeCodes } from "../actions";

type Props = { base: string; codes: { branch: string; callcenter: string } };

export default function IntakeLinks({ base, codes }: Props) {
  const [branch, setBranch] = useState(codes.branch);
  const [cc, setCc] = useState(codes.callcenter);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const link = (path: string, code: string) =>
    `${base}/intake/${path}${code ? `?k=${encodeURIComponent(code)}` : ""}`;

  const rows = [
    { id: "branch", label: "Branch managers", path: "branch", code: branch,
      hint: "For complaints a patient makes in person at the branch." },
    { id: "cc", label: "Call centre", path: "call-center", code: cc,
      hint: "For complaints a patient makes over the phone." },
  ];

  async function copy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* the link is selectable below */
    }
  }

  return (
    <section className="card p-5">
      <h2 className="text-xs uppercase tracking-label text-slate-500">Internal complaint links</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Not every complaint arrives through the QR code. These two links let staff log one on a
        patient&rsquo;s behalf — the case then follows the same cycle, and the dashboard counts it
        apart from the ones patients sent themselves.
      </p>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await saveIntakeCodes(fd);
            setMsg(res.ok ? { ok: true, text: "Links updated." } : { ok: false, text: res.error });
          });
        }}
      >
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm text-slate-800">{r.label}</h3>
              {!r.code ? (
                <span className="text-xs text-amber-300">Unguarded — anyone with the link can log cases</span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-500">{r.hint}</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]">
              <input
                name={r.id === "branch" ? "branch" : "callcenter"}
                className="field py-2 text-sm"
                placeholder="Access code"
                value={r.code}
                onChange={(e) => (r.id === "branch" ? setBranch : setCc)(e.target.value)}
              />
              <code className="flex items-center overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-clinic-700">
                {link(r.path, r.code)}
              </code>
              <button
                type="button"
                className="btn btn-ghost py-2 text-xs"
                onClick={() => copy(link(r.path, r.code), r.id)}
              >
                {copied === r.id ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ))}

        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save intake links"}
        </button>
      </form>

      {msg ? (
        <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm ring-1 ${
          msg.ok ? "bg-emerald-950/60 text-emerald-300 ring-emerald-900"
                 : "bg-rose-950/60 text-rose-300 ring-rose-900"}`}>
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}
