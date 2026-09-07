"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Opt = { v: string; label: string };

export default function Filters({
  branches, statuses, categories, priorities,
}: {
  branches: { id: string; name: string; code: string }[];
  statuses: Opt[];
  categories: Opt[];
  priorities: Opt[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(params.get("q") ?? "");

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/admin/cases?${next.toString()}`);
  }

  const active = ["branch", "status", "category", "priority", "from", "to", "overdue"].filter((k) =>
    params.get(k)
  ).length;

  return (
    <div className="card p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          set("q", q.trim());
        }}
        className="flex gap-2"
      >
        <input
          className="field py-2.5"
          placeholder="Search reference, name or mobile"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="btn btn-primary shrink-0">Search</button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="btn btn-ghost shrink-0"
          aria-expanded={open}
        >
          Filters{active ? ` (${active})` : ""}
        </button>
      </form>

      {open ? (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Branch" value={params.get("branch") ?? ""} onChange={(v) => set("branch", v)}
            options={branches.map((b) => ({ v: b.id, label: `${b.code} · ${b.name}` }))} />
          <Select label="Status" value={params.get("status") ?? ""} onChange={(v) => set("status", v)}
            options={statuses} />
          <Select label="Category" value={params.get("category") ?? ""} onChange={(v) => set("category", v)}
            options={categories} />
          <Select label="Priority" value={params.get("priority") ?? ""} onChange={(v) => set("priority", v)}
            options={priorities} />

          <div>
            <label className="label">From</label>
            <input type="date" className="field py-2.5" value={params.get("from") ?? ""}
              onChange={(e) => set("from", e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="field py-2.5" value={params.get("to") ?? ""}
              onChange={(e) => set("to", e.target.value)} />
          </div>

          <label className="flex items-center gap-2.5 self-end pb-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-clinic-600"
              checked={params.get("overdue") === "1"}
              onChange={(e) => set("overdue", e.target.checked ? "1" : "")}
            />
            Overdue only
          </label>

          <button
            type="button"
            className="btn btn-ghost self-end"
            onClick={() => {
              setQ("");
              router.push("/admin/cases");
            }}
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="field py-2.5" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
