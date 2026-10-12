"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/Spinner";
import { deleteOneCase } from "../../actions";

/**
 * Deliberately plain and tucked at the foot of the page. Deleting is not part
 * of handling a complaint — it is for a test entry, a duplicate or spam.
 */
export default function DeleteCase({ id, caseRef }: { id: string; caseRef: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border tint t-crit p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs uppercase tracking-label text-[rgb(var(--crit-fg))]">Delete this case</h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Removes the case, its history and any recording or signed form. Nothing is exported
            first and it cannot be undone — archive instead if you may need it later.
          </p>
        </div>
        {!open ? (
          <button type="button" className="btn btn-ghost shrink-0" onClick={() => setOpen(true)}>
            Delete…
          </button>
        ) : null}
      </div>

      {open ? (
        <form
          className="mt-4 space-y-3 border-t border-[rgb(var(--crit-ring))] pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const res = await deleteOneCase(fd);
              if (res.ok) window.location.href = "/admin/cases";
              else setError(res.error);
            });
          }}
        >
          <input type="hidden" name="id" value={id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="confirm_ref">
                Type <span className="tabular text-clinic-700">{caseRef}</span> to confirm
              </label>
              <input id="confirm_ref" name="confirm_ref" className="field tabular" required
                     autoComplete="off" placeholder={caseRef} />
            </div>
            <div>
              <label className="label" htmlFor="master">Archive password</label>
              <input id="master" name="master" type="password" className="field" required
                     autoComplete="off" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={pending} aria-busy={pending}>
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setOpen(false); setError(null); }}>
              Cancel
            </button>
          </div>
          {error ? <p role="alert" className="alert-error">{error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
