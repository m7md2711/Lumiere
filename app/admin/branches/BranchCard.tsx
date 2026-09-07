"use client";

import { useState, useTransition } from "react";
import { addLocation, deleteLocation, saveBranch, saveLocation, type ActionResult } from "../actions";
import type { Branch, QrLocation } from "@/lib/types";

export default function BranchCard({
  branch, locations,
}: {
  branch: Branch;
  locations: QrLocation[];
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit =
    (action: (fd: FormData) => Promise<ActionResult>, reset = false) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setMessage(null);
      const form = e.currentTarget;
      const fd = new FormData(form);
      startTransition(async () => {
        const res = await action(fd);
        setMessage(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
        if (res.ok && reset) form.reset();
      });
    };

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 p-4 text-start"
        aria-expanded={open}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="tabular text-sm font-bold text-clinic-700">{branch.code}</span>
            <span className="text-sm font-medium text-slate-800">{branch.name_en}</span>
            {!branch.is_active ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                Inactive
              </span>
            ) : null}
          </div>
          <div dir="rtl" className="mt-0.5 text-xs text-slate-500">{branch.name_ar}</div>
        </div>
        <span className="text-slate-400">
          {locations.length} location{locations.length === 1 ? "" : "s"} {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <div className="space-y-5 border-t border-slate-100 p-4">
          <form onSubmit={submit(saveBranch)} className="space-y-3">
            <input type="hidden" name="id" value={branch.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Name (English)</label>
                <input name="name_en" className="field" defaultValue={branch.name_en} required />
              </div>
              <div>
                <label className="label">Name (Arabic)</label>
                <input
                  name="name_ar" className="field" dir="rtl"
                  defaultValue={branch.name_ar} required
                />
              </div>
            </div>
            <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
              <input
                type="checkbox" name="is_active" className="h-4 w-4 accent-clinic-600"
                defaultChecked={branch.is_active}
              />
              Active — patients can submit from this branch
            </label>
            <button className="btn btn-primary" disabled={pending}>Save branch</button>
          </form>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">QR locations</h3>
            <div className="space-y-3">
              {locations.map((l) => (
                <div key={l.id} className="rounded-xl bg-slate-50 p-3">
                  <form onSubmit={submit(saveLocation)} className="space-y-2">
                    <input type="hidden" name="id" value={l.id} />
                    <div className="grid gap-2 sm:grid-cols-[80px_1fr_1fr_auto]">
                      <div className="tabular flex items-center text-sm font-bold text-clinic-700">
                        {l.code}
                      </div>
                      <input
                        name="label_en" className="field py-2 text-sm"
                        defaultValue={l.label_en} required
                      />
                      <input
                        name="label_ar" className="field py-2 text-sm" dir="rtl"
                        defaultValue={l.label_ar} required
                      />
                      <button className="btn btn-ghost py-2 text-xs" disabled={pending}>Save</button>
                    </div>
                  </form>
                  <form onSubmit={submit(deleteLocation)} className="mt-2">
                    <input type="hidden" name="id" value={l.id} />
                    <button className="text-xs font-medium text-rose-600 hover:underline" disabled={pending}>
                      Remove this location
                    </button>
                  </form>
                </div>
              ))}
            </div>

            <form
              onSubmit={submit(addLocation, true)}
              className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[100px_1fr_1fr_auto]"
            >
              <input type="hidden" name="branch_id" value={branch.id} />
              <input
                name="code" className="field py-2 text-sm uppercase"
                placeholder="TR2" maxLength={8} required
              />
              <input name="label_en" className="field py-2 text-sm" placeholder="Laser Room" required />
              <input
                name="label_ar" className="field py-2 text-sm" dir="rtl"
                placeholder="غرفة الليزر" required
              />
              <button className="btn btn-primary py-2 text-xs" disabled={pending}>Add</button>
            </form>
          </div>

          {message ? (
            <p
              role="status"
              className={`rounded-xl px-4 py-3 text-sm ${
                message.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
