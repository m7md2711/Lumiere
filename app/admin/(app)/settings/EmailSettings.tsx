"use client";

import { useState, useTransition } from "react";
import { saveSmtpSettings, sendTestEmail, saveBranchEmail } from "../actions";

type Props = {
  smtp: {
    host: string; port: number; secure: boolean; user: string;
    fromName: string; fromEmail: string; adminEmail: string;
    enabled: boolean; hasPassword: boolean;
  };
  branches: { code: string; name: string; email: string }[];
};

export default function EmailSettings({ smtp, branches }: Props) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setMsg(null);
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        const res = await action(fd);
        setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Failed." });
      });
    };

  return (
    <section className="card p-5">
      <h2 className="text-xs uppercase tracking-label text-slate-500">Email notifications</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        A branch is told when a patient writes in. You are told when a case is ready to review,
        and when anything goes past its 24-hour response time. Both of you are told when a case
        closes.
      </p>

      <form onSubmit={run(saveSmtpSettings, "Settings saved.")} className="mt-5 space-y-4">
        <label className="flex items-center gap-2.5 text-sm text-slate-800">
          <input type="checkbox" name="enabled" className="h-4 w-4" defaultChecked={smtp.enabled} />
          Send notifications
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="host">SMTP server</label>
            <input id="host" name="host" className="field" defaultValue={smtp.host} required />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <label className="label" htmlFor="port">Port</label>
              <input id="port" name="port" type="number" className="field tabular" defaultValue={smtp.port} />
            </div>
            <label className="flex items-center gap-2 self-end pb-3 text-sm text-slate-800">
              <input type="checkbox" name="secure" className="h-4 w-4" defaultChecked={smtp.secure} />
              SSL
            </label>
          </div>
          <div>
            <label className="label" htmlFor="user">Username</label>
            <input id="user" name="user" className="field" defaultValue={smtp.user} autoComplete="off" />
          </div>
          <div>
            <label className="label" htmlFor="pass">Password</label>
            <input
              id="pass" name="pass" type="password" className="field" autoComplete="new-password"
              placeholder={smtp.hasPassword ? "•••••••• saved — leave blank to keep" : "App password"}
            />
          </div>
          <div>
            <label className="label" htmlFor="fromName">From name</label>
            <input id="fromName" name="fromName" className="field" defaultValue={smtp.fromName} />
          </div>
          <div>
            <label className="label" htmlFor="fromEmail">From address</label>
            <input id="fromEmail" name="fromEmail" type="email" className="field" defaultValue={smtp.fromEmail} required />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="adminEmail">Administrator address</label>
          <input id="adminEmail" name="adminEmail" className="field" defaultValue={smtp.adminEmail}
                 placeholder="you@clinic.ae — separate several with commas" />
        </div>

        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save email settings"}
        </button>
      </form>

      <form onSubmit={run(sendTestEmail, "Test message sent.")} className="mt-5 border-t border-slate-200 pt-4">
        <label className="label" htmlFor="to">Send a test to</label>
        <div className="flex gap-2">
          <input id="to" name="to" type="email" className="field" placeholder="someone@clinic.ae" />
          <button className="btn btn-ghost shrink-0" disabled={pending}>Send test</button>
        </div>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <h3 className="text-xs uppercase tracking-label text-slate-500">Where each branch is reached</h3>
        <p className="mt-1.5 text-sm text-slate-600">
          A branch with no address here still sees its cases when staff sign in — it just will
          not be emailed about them.
        </p>
        <div className="mt-3 space-y-2">
          {branches.map((b) => (
            <form key={b.code} onSubmit={run(saveBranchEmail, `${b.name} updated.`)}
                  className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
              <input type="hidden" name="code" value={b.code} />
              <div className="flex items-center gap-2 text-sm text-slate-800">
                <span className="tabular text-xs text-clinic-600">{b.code}</span>
                {b.name}
              </div>
              <input name="email" type="email" className="field py-2 text-sm"
                     defaultValue={b.email} placeholder="branch@clinic.ae" />
              <button className="btn btn-ghost py-2 text-xs" disabled={pending}>Save</button>
            </form>
          ))}
        </div>
      </div>

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
