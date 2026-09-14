"use client";

import { useState, useTransition } from "react";
import { createBranchLogins } from "../actions";
import type { GeneratedLogin } from "@/lib/users";

type Existing = { branchCode: string; branchName: string; username: string; updatedAt: string };

export default function BranchLogins({ existing }: { existing: Existing[] }) {
  const [logins, setLogins] = useState<GeneratedLogin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const asText = (rows: GeneratedLogin[]) =>
    rows
      .map((l) => `${l.branchName}\n  username: ${l.username}\n  password: ${l.password}`)
      .join("\n\n");

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Branch logins
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Each branch signs in with its own username and sees only its own cases. Staff cannot
        reach branches, QR codes, settings or archiving.
      </p>

      {existing.length ? (
        <ul className="mt-4 divide-y divide-slate-200 text-sm">
          {existing.map((u) => (
            <li key={u.branchCode} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <div className="font-medium text-slate-800">{u.branchName}</div>
                <div className="tabular text-xs text-slate-500">{u.username}</div>
              </div>
              <span className="tabular text-xs text-slate-400">{u.branchCode}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm italic text-slate-400">No branch logins yet.</p>
      )}

      <form
        className="mt-5 space-y-3 border-t border-slate-200 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setLogins(null);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await createBranchLogins(fd);
            if (res.ok) setLogins(res.logins);
            else setError(res.error);
          });
        }}
      >
        <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
          <input type="checkbox" name="reset" className="h-4 w-4 accent-clinic-600" />
          Reset every branch password, not just the missing ones
        </label>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create / reset branch logins"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="alert-error mt-4">{error}</p>
      ) : null}

      {logins ? (
        <div className="mt-4 rounded-2xl bg-clinic-50 p-4 ring-1 ring-clinic-300">
          <div className="text-sm font-semibold text-clinic-800">
            Shown once — copy these now
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Only the encrypted form is stored. Closing this page loses the passwords, and they
            would have to be reset to see them again.
          </p>
          <ul className="mt-3 space-y-2">
            {logins.map((l) => (
              <li key={l.branchCode} className="rounded-xl bg-slate-200 p-3">
                <div className="text-sm font-medium text-slate-800">{l.branchName}</div>
                <div className="tabular mt-1 grid gap-0.5 text-xs text-slate-600">
                  <span>username: <span className="select-all text-clinic-700">{l.username}</span></span>
                  <span>password: <span className="select-all text-clinic-700">{l.password}</span></span>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-ghost mt-3"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(asText(logins));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* selectable above */
              }
            }}
          >
            {copied ? "Copied" : "Copy all"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
