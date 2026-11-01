import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/scope";
import { listApiKeys } from "@/lib/apikeys";
import { getBranches } from "@/lib/cases";
import { formatLongDateTime } from "@/lib/time";
import ApiKeys from "./ApiKeys";

export const dynamic = "force-dynamic";

const endpoints = [
  {
    path: "/api/v1/summary",
    what: "Performance score, the eight measures with last period's values, live counts, incoming trend, and cases by status, topic, source and branch.",
    query: [["days", "1–365, default 30"], ["branch", "branch code — clinic-wide keys only"]],
  },
  {
    path: "/api/v1/cases",
    what: "Cases, newest first. Every filter takes several values separated by commas.",
    query: [
      ["status", "new, opened, under_review, solved, escalated, follow_up, closed"],
      ["category", "appointment, staff, concern, payment, facility, suggestion, appreciation, other"],
      ["priority", "low, normal, high, urgent"],
      ["source", "patient, MGR, CC"],
      ["branch", "branch codes"],
      ["from / to", "yyyy-mm-dd, Gulf time"],
      ["q", "searches names, mobiles, references and every note"],
      ["overdue", "1 for overdue only"],
      ["limit / offset", "page size up to 200"],
    ],
  },
  {
    path: "/api/v1/cases/{ref}",
    what: "One case in full: record, timeline, follow-up, signed forms (links valid for an hour), employee and machine, and the patient's other open cases.",
    query: [],
  },
  { path: "/api/v1/branches", what: "Branches and their QR points.", query: [] },
];

export default async function ApiPage() {
  if (!(await isAdminSession())) redirect("/admin/dashboard");
  const [keys, branches] = await Promise.all([listApiKeys(), getBranches()]);
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  const nameOf = new Map(branches.map((b) => [b.id, b.name_en]));

  return (
    <div className="space-y-5">
      <header className="rise">
        <h1 className="text-2xl uppercase tracking-[0.18em] text-slate-900">Management API</h1>
        <p className="mt-1 text-sm text-slate-500">
          Read-only access for the clinic&rsquo;s management system — summaries and full case detail.
        </p>
      </header>

      <ApiKeys
        branches={branches.map((b) => ({ id: b.id, name: b.name_en, code: b.code }))}
        keys={keys
          .slice()
          .reverse()
          .map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.prefix,
            scope: k.branchId ? nameOf.get(k.branchId) ?? "One branch" : "Whole clinic",
            created: formatLongDateTime(k.createdAt),
            lastUsed: k.lastUsedAt ? formatLongDateTime(k.lastUsedAt) : "Never",
            revoked: Boolean(k.revokedAt),
          }))}
      />

      <section className="card rise p-5" style={{ ["--i" as string]: 2 }}>
        <h2 className="text-xs uppercase tracking-label text-slate-500">How to call it</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-800 ring-1 ring-slate-200">
{`curl ${base}/api/v1/summary?days=30 \\
  -H "Authorization: Bearer lsc_…"`}
        </pre>
        <p className="mt-3 text-sm text-slate-600">
          Every response is <code className="text-clinic-700">{"{ data, meta }"}</code>; errors are{" "}
          <code className="text-clinic-700">{"{ error: { code, message } }"}</code> with a matching
          HTTP status. A key bound to one branch only ever sees that branch, whatever it asks for.
          Times are ISO 8601 in UTC; date filters are read as Gulf calendar days.
        </p>
      </section>

      <section className="card rise p-5" style={{ ["--i" as string]: 3 }}>
        <h2 className="text-xs uppercase tracking-label text-slate-500">Endpoints</h2>
        <div className="mt-3 divide-y divide-slate-200">
          {endpoints.map((e) => (
            <div key={e.path} className="py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="pill t-ok">GET</span>
                <code className="text-sm text-clinic-700">{e.path}</code>
              </div>
              <p className="mt-1.5 text-sm text-slate-600">{e.what}</p>
              {e.query.length ? (
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[140px_1fr]">
                  {e.query.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-mono text-slate-800">{k}</dt>
                      <dd className="text-slate-500">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
