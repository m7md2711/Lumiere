"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/Spinner";
import { formatLongDateTime } from "@/lib/time";
import { removeViewer, saveViewer } from "../actions";

type Existing = { username: string; updatedAt: string };

/**
 * View-only logins for management: everything the administrator sees, across
 * every branch, plus the analysis page — and nothing they can change. The
 * admin picks the password here; it is stored only as a hash.
 */
export default function ViewerLogins({ existing }: { existing: Existing[] }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        View-only logins
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        For management. A viewer sees every branch, every case, the dashboard and the
        analysis page, and can export — but cannot change a status, add a note, raise a
        complaint, upload or delete anything, or open settings. Opening a case as a viewer
        does not mark it as opened.
      </p>

      {existing.length ? (
        <ul className="mt-4 divide-y divide-slate-200 text-sm">
          {existing.map((u) => (
            <li key={u.username} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <div className="tabular text-slate-800">{u.username}</div>
                <div className="text-xs text-slate-500">Password set {formatLongDateTime(u.updatedAt)}</div>
              </div>
              <button
                type="button"
                className="text-xs text-[rgb(var(--crit-fg))] hover:underline disabled:opacity-50"
                disabled={removing !== null}
                aria-busy={removing === u.username}
                onClick={() => {
                  if (!confirm(`Remove the view-only login "${u.username}"? It is signed out at once.`)) return;
                  setError(null);
                  setDone(null);
                  setRemoving(u.username);
                  const fd = new FormData();
                  fd.set("username", u.username);
                  startTransition(async () => {
                    const res = await removeViewer(fd);
                    setRemoving(null);
                    if (!res.ok) setError(res.error);
                  });
                }}
              >
                {removing === u.username ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm italic text-slate-400">No view-only logins yet.</p>
      )}

      <form
        className="mt-5 space-y-3 border-t border-slate-200 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setDone(null);
          const form = e.currentTarget;
          const fd = new FormData(form);
          const name = String(fd.get("username") ?? "").trim().toLowerCase();
          const isReset = existing.some((u) => u.username === name);
          startTransition(async () => {
            const res = await saveViewer(fd);
            if (res.ok) {
              setDone(isReset ? `New password set for "${name}".` : `View-only login "${name}" created.`);
              form.reset();
            } else {
              setError(res.error);
            }
          });
        }}
      >
        <p className="text-sm text-slate-600">
          Add a viewer, or enter an existing username to give it a new password.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="v-user">Username</label>
            <input
              id="v-user" name="username" className="field" required autoComplete="off"
              autoCapitalize="none" spellCheck={false} placeholder="e.g. management"
              pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,31}"
            />
          </div>
          <div>
            <label className="label" htmlFor="v-pass">Password</label>
            <input
              id="v-pass" name="password" type="password" className="field" required
              minLength={10} autoComplete="new-password"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">At least 10 characters, with a letter and a number.</p>
        {error ? <p className="alert-error">{error}</p> : null}
        {done ? <p className="alert-ok">{done}</p> : null}
        <button className="btn btn-primary" disabled={pending} aria-busy={pending}>
          {pending && removing === null ? <Spinner /> : null}
          Save view-only login
        </button>
      </form>
    </section>
  );
}
