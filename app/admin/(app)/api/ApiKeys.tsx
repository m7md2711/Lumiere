"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManagementKey, revokeManagementKey } from "../actions";
import { Spinner } from "@/components/Spinner";

type KeyRow = {
  id: string; name: string; prefix: string; scope: string;
  created: string; lastUsed: string; revoked: boolean;
};

export default function ApiKeys({
  branches, keys,
}: {
  branches: { id: string; name: string; code: string }[];
  keys: KeyRow[];
}) {
  const router = useRouter();
  const [fresh, setFresh] = useState<{ key: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <section className="card rise p-5" style={{ ["--i" as string]: 1 }}>
      <h2 className="text-xs uppercase tracking-label text-slate-500">Keys</h2>

      <form
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const form = e.currentTarget;
          const fd = new FormData(form);
          startTransition(async () => {
            const res = await createManagementKey(fd);
            if (res.ok) {
              setFresh({ key: res.key, name: res.name });
              form.reset();
              router.refresh();
            } else setError(res.error);
          });
        }}
      >
        <input name="name" className="field py-2.5" placeholder="Name, e.g. Management dashboard" required />
        <select name="branch" className="field py-2.5" defaultValue="">
          <option value="">Whole clinic</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>Only {b.name}</option>
          ))}
        </select>
        <button className="btn btn-primary" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner /> : null}
          Create key
        </button>
      </form>

      {error ? <p role="alert" className="alert-error mt-3">{error}</p> : null}

      {fresh ? (
        <div className="tint t-gold mt-4 rounded-2xl p-4">
          <div className="text-sm">Key for {fresh.name} — copy it now</div>
          <p className="mt-1 text-xs opacity-80">
            Only a fingerprint is kept. Once you leave this page the key cannot be shown again;
            if it is lost, revoke it and make another.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 select-all break-all rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-900">
              {fresh.key}
            </code>
            <button
              type="button"
              className="btn btn-ghost py-2 text-xs"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(fresh.key);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* selectable above */
                }
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        {keys.length === 0 ? (
          <p className="text-sm italic text-slate-400">No keys yet.</p>
        ) : (
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-left text-xs uppercase tracking-label text-slate-500">
              <tr>
                <th className="pb-2 font-normal">Name</th>
                <th className="pb-2 font-normal">Key</th>
                <th className="pb-2 font-normal">Sees</th>
                <th className="pb-2 font-normal">Last used</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {keys.map((k) => (
                <tr key={k.id} className={k.revoked ? "opacity-50" : ""}>
                  <td className="py-2.5 text-slate-800">
                    {k.name}
                    <div className="text-xs text-slate-500">created {k.created}</div>
                  </td>
                  <td className="tabular py-2.5 text-xs text-slate-600">{k.prefix}…</td>
                  <td className="py-2.5 text-slate-600">{k.scope}</td>
                  <td className="py-2.5 text-xs text-slate-500">{k.lastUsed}</td>
                  <td className="py-2.5 text-right">
                    {k.revoked ? (
                      <span className="pill t-flat">Revoked</span>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-slate-500 hover:text-[rgb(var(--crit-fg))]"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm(`Revoke "${k.name}"? Anything using it stops working at once.`)) return;
                          const fd = new FormData();
                          fd.set("id", k.id);
                          startTransition(async () => {
                            await revokeManagementKey(fd);
                            router.refresh();
                          });
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
