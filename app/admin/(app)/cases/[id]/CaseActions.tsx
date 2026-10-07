"use client";

import { useState, useTransition } from "react";
import {
  addNote, approveRefund, changePriority, changeStatus, closeCase,
  escalate, logContact, markRefundProcessed, type ActionResult,
} from "../../actions";
import { statusLabel } from "@/lib/i18n";
import { BRANCH_STATUSES, EVIDENCE_REQUIRED_STATUSES, NOTE_REQUIRED_STATUSES, PRIORITIES, STATUSES } from "@/lib/types";
import type { Priority, Status } from "@/lib/types";

type Tab = "status" | "note" | "contact" | "escalate" | "refund" | "close";

const tabs: { id: Tab; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "note", label: "Note" },
  { id: "contact", label: "Contact" },
  { id: "escalate", label: "Escalate" },
  { id: "refund", label: "Refund" },
  { id: "close", label: "Close" },
];

export default function CaseActions({
  id, status, priority, refundStatus, contactMethod, isAdmin, hasEvidence,
}: {
  id: string;
  status: Status;
  priority: Priority;
  refundStatus: string | null;
  contactMethod: string;
  isAdmin: boolean;
  hasEvidence: boolean;
}) {
  const visibleTabs = isAdmin ? tabs : tabs.filter((x) => x.id !== "close");
  const [tab, setTab] = useState<Tab>("status");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [nextStatus, setNextStatus] = useState<Status>(status);
  const [closeMode, setCloseMode] = useState<"permanent" | "follow_up">("permanent");

  const today = new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);
  // A fortnight is the common case: long enough for a treatment to settle.
  const defaultFollowUp = new Date(Date.now() + 4 * 3600_000 + 14 * 86_400_000)
    .toISOString().slice(0, 10);

  function run(action: (fd: FormData) => Promise<ActionResult>, form: HTMLFormElement) {
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await action(fd);
      if (res.ok) {
        setMessage({ ok: true, text: "Saved." });
        form.reset();
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  const submit =
    (action: (fd: FormData) => Promise<ActionResult>) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setMessage(null);
      run(action, e.currentTarget);
    };

  return (
    <section className="card p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Actions</h2>

      <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto pb-1">
        {visibleTabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => {
              setTab(tb.id);
              setMessage(null);
            }}
            className={[
              "whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              tab === tb.id
                ? "bg-clinic-600 text-ink"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            ].join(" ")}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "status" ? (
        <div className="space-y-5">
          <form onSubmit={submit(changeStatus)} className="space-y-3">
            <input type="hidden" name="id" value={id} />
            <div>
              <label className="label">Move to</label>
              <select
                name="status"
                className="field"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as Status)}
              >
                {(isAdmin ? STATUSES : BRANCH_STATUSES).map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
              {!isAdmin ? (
                <p className="mt-1.5 text-xs text-slate-500">
                  Closing a case is the administrator&rsquo;s step, once they have reviewed it.
                </p>
              ) : null}
            </div>

            {EVIDENCE_REQUIRED_STATUSES.includes(nextStatus) ? (
              <div>
                <label className="label" htmlFor="evidence">
                  Complaint form signed by the patient{hasEvidence ? " (replace)" : " (required)"}
                </label>
                <input
                  id="evidence"
                  name="evidence"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"
                  className="field py-2.5 text-sm file:mr-3 file:rounded-full file:border-0
                             file:bg-clinic-600 file:px-3 file:py-1.5 file:text-xs file:text-ink"
                  required={!hasEvidence}
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  PDF or a photo, up to 10 MB. Stored privately — only staff with a link can open it.
                </p>
              </div>
            ) : null}
            <div>
              <label className="label">
                Note{NOTE_REQUIRED_STATUSES.includes(nextStatus) ? " (required)" : " (optional)"}
              </label>
              <textarea
                name="note"
                className="field min-h-[80px]"
                required={NOTE_REQUIRED_STATUSES.includes(nextStatus)}
                placeholder="What changed and why"
              />
            </div>
            <button className="btn btn-primary" disabled={pending}>Update status</button>
          </form>

          <form onSubmit={submit(changePriority)} className="space-y-3 border-t border-slate-100 pt-4">
            <input type="hidden" name="id" value={id} />
            <div>
              <label className="label">Priority</label>
              <select name="priority" className="field" defaultValue={priority}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-ghost" disabled={pending}>
              Update priority &amp; SLA
            </button>
          </form>
        </div>
      ) : null}

      {tab === "note" ? (
        <form onSubmit={submit(addNote)} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="label">Internal note</label>
            <textarea
              name="note" className="field min-h-[110px]" required
              placeholder="Visible to staff only"
            />
          </div>
          <button className="btn btn-primary" disabled={pending}>Add note</button>
        </form>
      ) : null}

      {tab === "contact" ? (
        <form onSubmit={submit(logContact)} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="label">Method</label>
            <select name="method" className="field" defaultValue={contactMethod}>
              <option value="call">Call</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="in_person">In person</option>
            </select>
          </div>
          <div>
            <label className="label">Outcome</label>
            <textarea
              name="outcome" className="field min-h-[90px]" required
              placeholder="Reached the patient, no answer, left a message…"
            />
          </div>
          <button className="btn btn-primary" disabled={pending}>Log contact attempt</button>
        </form>
      ) : null}

      {tab === "escalate" ? (
        <form onSubmit={submit(escalate)} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="label">Reason for escalation</label>
            <textarea
              name="reason" className="field min-h-[100px]" required
              placeholder="Why this needs to leave the branch"
            />
          </div>
          <button className="btn btn-primary" disabled={pending}>Escalate case</button>
        </form>
      ) : null}

      {tab === "refund" ? (
        <div className="space-y-5">
          <form onSubmit={submit(approveRefund)} className="space-y-3">
            <input type="hidden" name="id" value={id} />
            <div>
              <label className="label">Amount (AED)</label>
              <input
                name="amount" type="number" step="0.01" min="0.01"
                className="field tabular" required placeholder="0.00"
              />
            </div>
            <div>
              <label className="label">Reason</label>
              <textarea name="reason" className="field min-h-[80px]" required />
            </div>
            <button className="btn btn-primary" disabled={pending}>Approve refund</button>
          </form>

          {refundStatus === "pending" ? (
            <form
              onSubmit={submit(markRefundProcessed)}
              className="border-t border-slate-100 pt-4"
            >
              <input type="hidden" name="id" value={id} />
              <button className="btn btn-ghost" disabled={pending}>Mark refund processed</button>
            </form>
          ) : refundStatus === "processed" ? (
            <p className="border-t border-slate-100 pt-4 text-sm text-emerald-700">
              Refund processed.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "close" ? (
        <form onSubmit={submit(closeCase)} className="space-y-3">
          <input type="hidden" name="id" value={id} />

          <div>
            <span className="label">How are we finishing this?</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { v: "permanent", t: "Close permanently", d: "Nothing further needed." },
                { v: "follow_up", t: "Close with a follow-up", d: "Check back on a date." },
              ] as const).map((o) => (
                <label
                  key={o.v}
                  className={[
                    "cursor-pointer rounded-xl border p-3 transition-colors",
                    closeMode === o.v
                      ? "border-clinic-600 bg-clinic-50 ring-1 ring-clinic-300"
                      : "border-slate-300 bg-slate-200 hover:border-clinic-300",
                  ].join(" ")}
                >
                  <input
                    type="radio" name="close_mode" value={o.v} className="sr-only"
                    checked={closeMode === o.v}
                    onChange={() => setCloseMode(o.v)}
                  />
                  <span className="block text-sm text-slate-800">{o.t}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{o.d}</span>
                </label>
              ))}
            </div>
          </div>

          {closeMode === "follow_up" ? (
            <div>
              <label className="label" htmlFor="follow_up_at">Look at this again on</label>
              <input
                id="follow_up_at" name="follow_up_at" type="date" className="field"
                min={today} defaultValue={defaultFollowUp} required
              />
              <p className="mt-1.5 text-xs text-slate-500">
                On that morning the branch and the administrator are both emailed, and the case
                appears under Follow-up.
              </p>
            </div>
          ) : null}
          <div>
            <label className="label">Resolution note</label>
            <textarea
              name="resolution_note" className="field min-h-[100px]" required
              placeholder="What was done for the patient"
            />
          </div>
          <div>
            <label className="label">Closure reason</label>
            <select name="closure_reason" className="field" required defaultValue="">
              <option value="" disabled>Choose one…</option>
              <option value="Resolved at branch">Resolved at branch</option>
              <option value="Resolved after escalation">Resolved after escalation</option>
              <option value="Refund issued">Refund issued</option>
              <option value="Treatment redone">Treatment redone</option>
              <option value="Patient satisfied with explanation">
                Patient satisfied with explanation
              </option>
              <option value="Appreciation shared with the team">
                Appreciation shared with the team
              </option>
              <option value="Suggestion logged for review">Suggestion logged for review</option>
              <option value="No response from patient">No response from patient</option>
            </select>
          </div>
          <div>
            <label className="label">Patient satisfaction</label>
            <select name="satisfaction" className="field" required defaultValue="">
              <option value="" disabled>1 – 5</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" disabled={pending}>
            {closeMode === "follow_up" ? "Close and schedule follow-up" : "Close permanently"}
          </button>
        </form>
      ) : null}

      {message ? (
        <p
          role="status"
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            message.ok ? "bg-emerald-950/60 text-emerald-300 ring-1 ring-emerald-900" : "bg-rose-950/60 text-rose-300 ring-1 ring-rose-900"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
