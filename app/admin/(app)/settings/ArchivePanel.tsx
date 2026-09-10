"use client";

import { useState, useTransition } from "react";
import { cancelArchive, confirmArchiveDelete, prepareArchive } from "../actions";
import type { ArchiveEntry, PendingBatch } from "@/lib/archive";

const fmtBytes = (b: number) =>
  b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

export default function ArchivePanel({
  pending, log,
}: {
  pending: PendingBatch | null;
  log: ArchiveEntry[];
}) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingTx, startTransition] = useTransition();
  const [downloaded, setDownloaded] = useState(Boolean(pending?.downloadedAt));

  const run =
    (action: (fd: FormData) => Promise<{ ok: true } | { ok: false; error: string }>, okText: string) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setMessage(null);
      const form = e.currentTarget;
      const fd = new FormData(form);
      startTransition(async () => {
        const res = await action(fd);
        setMessage(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error });
        if (res.ok) form.reset();
      });
    };

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Archive &amp; free up space
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Packages cases into a zip file — every field as a spreadsheet, plus the voice recordings —
        then removes them here so new recordings have room. Nothing is deleted until you have
        downloaded the file.
      </p>

      {!pending ? (
        <form className="mt-5 space-y-4" onSubmit={run(prepareArchive, "Archive prepared.")}>
          <div>
            <label className="label" htmlFor="scope">What to archive</label>
            <select id="scope" name="scope" className="field" defaultValue="closed">
              <option value="closed">Closed and resolved cases only (recommended)</option>
              <option value="all">Every case, including open ones</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="before">Only cases created on or before</label>
            <input id="before" name="before" type="date" className="field" />
            <p className="mt-1.5 text-xs text-slate-500">Leave empty to include all of them.</p>
          </div>

          <div>
            <label className="label" htmlFor="master">Archive password</label>
            <input
              id="master" name="master" type="password" className="field"
              autoComplete="off" required
            />
          </div>

          <button className="btn btn-primary" disabled={pendingTx}>
            {pendingTx ? "Preparing…" : "Prepare archive"}
          </button>
        </form>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-clinic-50 p-4 ring-1 ring-clinic-200">
            <div className="text-sm font-semibold text-clinic-800">Ready to download</div>
            <dl className="tabular mt-2 grid grid-cols-2 gap-2 text-sm text-slate-700">
              <div><dt className="text-xs text-slate-500">Cases</dt><dd>{pending.count}</dd></div>
              <div><dt className="text-xs text-slate-500">Voice notes</dt><dd>{pending.voiceCount}</dd></div>
              <div><dt className="text-xs text-slate-500">Audio size</dt><dd>{fmtBytes(pending.voiceBytes)}</dd></div>
              <div><dt className="text-xs text-slate-500">Scope</dt><dd className="text-xs">{pending.scope}</dd></div>
            </dl>
            {pending.refs.length ? (
              <div className="tabular mt-2 text-xs text-slate-500">
                {pending.refs[0]} … {pending.refs[pending.refs.length - 1]}
              </div>
            ) : null}
          </div>

          <a
            href="/admin/archive/download"
            className="btn btn-primary btn-lg"
            onClick={() => setDownloaded(true)}
          >
            Download archive (.zip)
          </a>

          {downloaded ? (
            <form
              className="space-y-3 border-t border-slate-200 pt-4"
              onSubmit={run(confirmArchiveDelete, "Archived and removed.")}
            >
              <p className="text-sm text-slate-600">
                Check the zip opens and the recordings play. Then remove these {pending.count} cases
                from the system — this cannot be undone.
              </p>
              <div>
                <label className="label" htmlFor="confirm">Type DELETE to confirm</label>
                <input id="confirm" name="confirm" className="field" placeholder="DELETE" required />
              </div>
              <div>
                <label className="label" htmlFor="master2">Archive password</label>
                <input
                  id="master2" name="master" type="password" className="field"
                  autoComplete="off" required
                />
              </div>
              <button className="btn bg-rose-600 text-slate-950 hover:bg-rose-500" disabled={pendingTx}>
                {pendingTx ? "Removing…" : `Delete ${pending.count} archived cases`}
              </button>
            </form>
          ) : (
            <p className="text-xs text-slate-500">
              The delete step appears once you have downloaded the file.
            </p>
          )}

          <form onSubmit={run(cancelArchive, "Cancelled.")}>
            <button className="text-xs font-medium text-slate-500 hover:text-clinic-700" disabled={pendingTx}>
              Cancel this archive
            </button>
          </form>
        </div>
      )}

      {message ? (
        <p
          role="status"
          className={`mt-4 rounded-xl px-4 py-3 text-sm ring-1 ${
            message.ok
              ? "bg-emerald-950/60 text-emerald-300 ring-emerald-900"
              : "bg-rose-950/60 text-rose-300 ring-rose-900"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {log.length ? (
        <div className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Archive history
          </h3>
          <ul className="mt-3 space-y-3">
            {log.map((e, i) => (
              <li key={i} className="rounded-xl bg-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-800">
                    {e.caseCount} cases · {e.voiceCount} recordings
                  </span>
                  <span className="tabular text-xs text-slate-500">
                    {new Date(e.at).toLocaleString("en-GB", {
                      timeZone: "Asia/Dubai", day: "2-digit", month: "short",
                      year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="tabular mt-1 text-xs text-slate-500">
                  {e.refFirst} … {e.refLast} · {fmtBytes(e.bytesFreed)} freed · {e.scope}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
