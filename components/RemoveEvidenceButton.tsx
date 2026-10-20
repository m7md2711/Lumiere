"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeEvidence } from "@/app/admin/(app)/actions";
import { Spinner } from "./Spinner";

export default function RemoveEvidenceButton({
  caseId, path, name,
}: {
  caseId: string;
  path: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[rgb(var(--crit-fg))]"
      onClick={() => {
        // A patient's signed document — worth one deliberate confirmation.
        if (!confirm(`Remove "${name}" from this case? This cannot be undone.`)) return;
        const fd = new FormData();
        fd.set("id", caseId);
        fd.set("path", path);
        startTransition(async () => {
          const res = await removeEvidence(fd);
          if (res.ok) router.refresh();
          else alert(res.error);
        });
      }}
    >
      {pending ? <Spinner className="h-3 w-3" /> : null}
      Remove
    </button>
  );
}
