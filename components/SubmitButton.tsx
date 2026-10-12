"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "./Spinner";

/**
 * A button that shows it is working. The app was never actually slow — it just
 * said nothing between the click and the answer, so people clicked again.
 *
 * Inside a <form action={...}> it reads the pending state itself; elsewhere
 * pass `pending` from the caller's own transition.
 */
export function SubmitButton({
  children,
  pendingLabel,
  pending: pendingProp,
  className = "btn btn-primary",
  ...rest
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  pending?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  const status = useFormStatus();
  const busy = pendingProp ?? status.pending;

  return (
    <button
      {...rest}
      className={className}
      disabled={busy || rest.disabled}
      aria-busy={busy}
      data-busy={busy ? "true" : undefined}
    >
      {busy ? <Spinner /> : null}
      <span>{busy ? pendingLabel ?? children : children}</span>
    </button>
  );
}
