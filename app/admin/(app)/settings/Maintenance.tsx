"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/Spinner";
import { mergeServiceCategories } from "../actions";

/**
 * One-off jobs. Each is idempotent, so running one twice changes nothing the
 * second time.
 */
export default function Maintenance({ legacyCount }: { legacyCount: number }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="card p-5">
      <h2 className="text-xs uppercase tracking-label text-slate-500">Maintenance</h2>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <div>
          <h3 className="text-sm text-slate-800">Fold the old service topics together</h3>
          <p className="mt-1 text-sm text-slate-600">
            {legacyCount > 0
              ? `${legacyCount} case${legacyCount === 1 ? "" : "s"} still filed under the old
                 "treatment" or "medical" topics. This moves them to "Concern after service".`
              : "Nothing left to move — every case is on the current topics."}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost shrink-0"
          disabled={pending || legacyCount === 0}
          aria-busy={pending}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const res = await mergeServiceCategories();
              setMsg(res.ok
                ? { ok: true, text: "Moved. The list and dashboard now show one topic." }
                : { ok: false, text: res.error });
            });
          }}
        >
          {pending ? <Spinner /> : null}
          {pending ? "Moving…" : "Move them"}
        </button>
      </div>

      {msg ? (
        <p role="status" className={`mt-4 ${msg.ok ? "alert-ok" : "alert-error"}`}>{msg.text}</p>
      ) : null}
    </section>
  );
}
