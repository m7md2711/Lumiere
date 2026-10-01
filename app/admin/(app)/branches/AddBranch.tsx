"use client";

import { useState, useTransition } from "react";
import { createBranch } from "../actions";

export default function AddBranch() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs uppercase tracking-label text-slate-500">Add a branch</h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Reception, treatment room and waiting area codes are created with it, so its QR
            posters are ready straight away.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(!open)}>
          {open ? "Cancel" : "New branch"}
        </button>
      </div>

      {open ? (
        <form
          className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-[110px_1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            const form = e.currentTarget;
            const fd = new FormData(form);
            startTransition(async () => {
              const res = await createBranch(fd);
              if (res.ok) {
                setMsg({ ok: true, text: "Branch added, with its three QR points." });
                form.reset();
              } else {
                setMsg({ ok: false, text: res.error });
              }
            });
          }}
        >
          <input name="code" className="field py-2 text-sm uppercase" placeholder="BR11"
                 maxLength={8} required />
          <input name="name_en" className="field py-2 text-sm" placeholder="Branch name" required />
          <input name="name_ar" className="field py-2 text-sm" dir="rtl" placeholder="اسم الفرع" required />
          <button className="btn btn-primary py-2 text-xs" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </button>
        </form>
      ) : null}

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
