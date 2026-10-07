"use client";

import { useState, useTransition } from "react";
import { closePermanently, rescheduleFollowUp } from "../actions";
import { toWhatsApp } from "@/lib/phone";

export default function FollowUpActions({
  id, mobile, isAdmin,
}: {
  id: string;
  mobile: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState<"none" | "again" | "done">("none");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tomorrowPlus = (days: number) =>
    new Date(Date.now() + 4 * 3600_000 + days * 86_400_000).toISOString().slice(0, 10);

  const run = (action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setMsg(null);
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        const res = await action(fd);
        if (res.ok) setOpen("none");
        else setMsg(res.error ?? "Failed.");
      });
    };

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap gap-2">
        <a href={`tel:${mobile}`} className="btn btn-ghost py-2 text-xs">Call</a>
        <a
          href={`https://wa.me/${toWhatsApp(mobile)}`}
          target="_blank" rel="noopener noreferrer"
          className="btn btn-ghost py-2 text-xs"
        >
          WhatsApp
        </a>
        <button type="button" className="btn btn-ghost py-2 text-xs"
                onClick={() => setOpen(open === "again" ? "none" : "again")}>
          Follow up again
        </button>
        {isAdmin ? (
          <button type="button" className="btn btn-primary py-2 text-xs"
                  onClick={() => setOpen(open === "done" ? "none" : "done")}>
            Close permanently
          </button>
        ) : null}
      </div>

      {open === "again" ? (
        <form onSubmit={run(rescheduleFollowUp)} className="mt-3 space-y-2">
          <input type="hidden" name="id" value={id} />
          <div className="grid gap-2 sm:grid-cols-[170px_1fr]">
            <input name="follow_up_at" type="date" className="field py-2 text-sm"
                   min={tomorrowPlus(0)} defaultValue={tomorrowPlus(14)} required />
            <input name="note" className="field py-2 text-sm" required
                   placeholder="What still needs checking?" />
          </div>
          <button className="btn btn-primary py-2 text-xs" disabled={pending}>
            {pending ? "Saving…" : "Move the follow-up"}
          </button>
        </form>
      ) : null}

      {open === "done" && isAdmin ? (
        <form onSubmit={run(closePermanently)} className="mt-3 space-y-2">
          <input type="hidden" name="id" value={id} />
          <input name="note" className="field py-2 text-sm" required
                 placeholder="What did the follow-up find?" />
          <button className="btn btn-primary py-2 text-xs" disabled={pending}>
            {pending ? "Closing…" : "Close for good"}
          </button>
        </form>
      ) : null}

      {msg ? <p role="alert" className="alert-error mt-3">{msg}</p> : null}
    </div>
  );
}
