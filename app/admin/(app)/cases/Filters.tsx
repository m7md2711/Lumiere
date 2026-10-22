"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Spinner } from "@/components/Spinner";

type Opt = { v: string; label: string };

/**
 * Every filter takes several values — two branches, three statuses — held in
 * the URL as comma-separated lists so a filtered view can be bookmarked or
 * sent to someone. Within one filter choices widen the list; across filters
 * they narrow it.
 */
export default function Filters({
  branches, statuses, categories, priorities, sources,
}: {
  branches: { id: string; name: string; code: string }[];
  statuses: Opt[];
  categories: Opt[];
  priorities: Opt[];
  sources: Opt[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  const listOf = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);

  function go(next: URLSearchParams) {
    startTransition(() => router.push(`/admin/cases?${next.toString()}`));
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    go(next);
  }

  function toggle(key: string, value: string) {
    const cur = listOf(key);
    const nextList = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    setParam(key, nextList.join(","));
  }

  const groups: { key: string; title: string; options: Opt[] }[] = [
    ...(branches.length
      ? [{ key: "branch", title: "Branch", options: branches.map((b) => ({ v: b.id, label: b.name })) }]
      : []),
    { key: "status", title: "Status", options: statuses },
    { key: "category", title: "Topic", options: categories },
    { key: "priority", title: "Priority", options: priorities },
    { key: "source", title: "Came in via", options: sources },
  ];

  // Everything currently applied, as removable chips.
  const applied: { key: string; v: string; label: string }[] = [];
  for (const g of groups) {
    for (const v of listOf(g.key)) {
      const opt = g.options.find((o) => o.v === v);
      if (opt) applied.push({ key: g.key, v, label: `${g.title}: ${opt.label}` });
    }
  }
  if (params.get("from")) applied.push({ key: "from", v: "", label: `From ${params.get("from")}` });
  if (params.get("to")) applied.push({ key: "to", v: "", label: `To ${params.get("to")}` });
  if (params.get("overdue") === "1") applied.push({ key: "overdue", v: "", label: "Overdue only" });

  const filterCount = applied.length;

  return (
    <div className="card p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", q.trim());
        }}
        className="flex gap-2"
      >
        <input
          className="field py-2.5"
          placeholder="Search reference, name, mobile or any note"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          dir="auto"
          aria-label="Search cases and their notes"
        />
        <button type="submit" className="btn btn-primary shrink-0" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner /> : null}
          Search
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="btn btn-ghost shrink-0"
          aria-expanded={open}
        >
          Filters{filterCount ? ` · ${filterCount}` : ""}
        </button>
      </form>

      {applied.length > 0 || params.get("q") ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {params.get("q") ? (
            <button
              type="button"
              onClick={() => { setQ(""); setParam("q", ""); }}
              className="pill t-gold hover:opacity-80"
              title="Remove"
            >
              “{params.get("q")}” ×
            </button>
          ) : null}
          {applied.map((a) => (
            <button
              key={`${a.key}:${a.v}`}
              type="button"
              onClick={() => (a.v ? toggle(a.key, a.v) : setParam(a.key, ""))}
              className="pill t-flat hover:opacity-80"
              title="Remove"
            >
              {a.label} ×
            </button>
          ))}
          <button
            type="button"
            className="ms-1 text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            onClick={() => { setQ(""); go(new URLSearchParams()); }}
          >
            Clear all
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="rise mt-3 space-y-4 border-t border-slate-200 pt-4">
          {groups.map((g) => {
            const chosen = listOf(g.key);
            return (
              <fieldset key={g.key}>
                <legend className="label mb-2">
                  {g.title}
                  {chosen.length ? <span className="ms-1 normal-case tracking-normal text-clinic-700">· {chosen.length}</span> : null}
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {g.options.map((o) => {
                    const on = chosen.includes(o.v);
                    return (
                      <button
                        key={o.v}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggle(g.key, o.v)}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs transition-colors",
                          on
                            ? "border-clinic-600 bg-clinic-600 text-ink"
                            : "border-slate-300 bg-slate-100 text-slate-700 hover:border-clinic-300",
                        ].join(" ")}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="f-from">From</label>
              <input id="f-from" type="date" className="field py-2.5" value={params.get("from") ?? ""}
                     onChange={(e) => setParam("from", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="f-to">To</label>
              <input id="f-to" type="date" className="field py-2.5" value={params.get("to") ?? ""}
                     onChange={(e) => setParam("to", e.target.value)} />
            </div>
            <label className="flex items-center gap-2.5 self-end pb-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={params.get("overdue") === "1"}
                onChange={(e) => setParam("overdue", e.target.checked ? "1" : "")}
              />
              Overdue only
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
