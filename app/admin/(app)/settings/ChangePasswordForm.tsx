"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/Spinner";
import { changePassword } from "../actions";

export default function ChangePasswordForm() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Change password
      </h2>

      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          const form = e.currentTarget;
          const fd = new FormData(form);
          startTransition(async () => {
            const res = await changePassword(fd);
            if (res.ok) {
              setMessage({ ok: true, text: "Password changed. Other devices have been signed out." });
              form.reset();
            } else {
              setMessage({ ok: false, text: res.error });
            }
          });
        }}
      >
        <div>
          <label className="label" htmlFor="current_password">Current password</label>
          <input
            id="current_password" name="current_password" type="password"
            className="field" autoComplete="current-password" required
          />
        </div>

        <div>
          <label className="label" htmlFor="new_password">New password</label>
          <input
            id="new_password" name="new_password" type="password"
            className="field" autoComplete="new-password" required minLength={10}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            At least 10 characters, including a letter and a number.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="confirm_password">Confirm new password</label>
          <input
            id="confirm_password" name="confirm_password" type="password"
            className="field" autoComplete="new-password" required minLength={10}
          />
        </div>

        <button className="btn btn-primary" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Change password"}
        </button>

        {message ? (
          <p
            role="status"
            className={`rounded-xl px-4 py-3 text-sm ring-1 ${
              message.ok
                ? "tint t-ok"
                : "tint t-crit"
            }`}
          >
            {message.text}
          </p>
        ) : null}
      </form>
    </section>
  );
}
