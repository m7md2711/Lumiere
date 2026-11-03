"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Spinner } from "@/components/Spinner";

export default function DashboardFilters({
  days,
  branch,
  branches,
  basePath = "/admin/dashboard",
  periods = [7, 30, 90],
  defaultDays = 30,
}: {
  days: number;
  branch: string | null;
  branches: { id: string; name: string }[];
  basePath?: string;
  periods?: number[];
  defaultDays?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(next: { days?: number; branch?: string | null }) {
    const p = new URLSearchParams();
    const d = next.days ?? days;
    const b = next.branch === undefined ? branch : next.branch;
    if (d !== defaultDays) p.set("days", String(d));
    if (b) p.set("branch", b);
    startTransition(() => router.push(`${basePath}${p.toString() ? `?${p}` : ""}`));
  }

  return (
    <div className="card flex flex-wrap items-center gap-3 p-3">
      <div role="radiogroup" aria-label="Period" className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
        {periods.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={days === d}
            onClick={() => go({ days: d })}
            className={[
              "rounded-full px-4 py-1.5 text-xs uppercase tracking-brand transition-colors",
              days === d ? "bg-clinic-600 text-ink" : "text-slate-600 hover:text-slate-900",
            ].join(" ")}
          >
            {d === 365 ? "12 months" : `${d} days`}
          </button>
        ))}
      </div>

      {branches.length > 0 ? (
        <select
          aria-label="Branch"
          className="field w-auto min-w-[200px] py-2 text-sm"
          value={branch ?? ""}
          onChange={(e) => go({ branch: e.target.value || null })}
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      ) : null}

      {pending ? (
        <span className="ms-auto inline-flex items-center gap-2 text-xs text-slate-500">
          <Spinner className="h-3.5 w-3.5" /> Updating
        </span>
      ) : null}
    </div>
  );
}
