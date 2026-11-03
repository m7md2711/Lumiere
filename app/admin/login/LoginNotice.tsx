"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/** The per-visit parts of a static sign-in page: where to go after, and why the last try failed. */
function Notice({ lockMinutes }: { lockMinutes: number }) {
  const params = useSearchParams();
  const e = params.get("e");
  return (
    <>
      <input type="hidden" name="next" value={params.get("next") ?? "/admin/dashboard"} />
      {e ? (
        <p role="alert" className="alert-error">
          {e === "locked"
            ? `Too many sign-in attempts from this connection. Wait ${lockMinutes} minutes and try again.`
            : "Wrong username or password."}
        </p>
      ) : null}
    </>
  );
}

export default function LoginNotice({ lockMinutes }: { lockMinutes: number }) {
  return (
    <Suspense fallback={<input type="hidden" name="next" value="/admin/dashboard" />}>
      <Notice lockMinutes={lockMinutes} />
    </Suspense>
  );
}
