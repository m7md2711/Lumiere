"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepareEvidenceUpload, recordEvidenceUpload } from "@/app/admin/(app)/actions";
import { Spinner } from "./Spinner";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;

type Row = {
  file: File;
  progress: number;
  state: "waiting" | "uploading" | "done" | "failed";
  error?: string;
};

/**
 * Several files at once — a signed form is often one photo per page. Each file
 * goes straight from the browser to storage on a signed URL, with its own
 * progress bar, so a slow phone connection shows movement instead of a frozen
 * button. Only files that actually arrive are recorded against the case.
 */
export default function EvidenceUploader({ caseId }: { caseId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function pick(list: FileList | null) {
    setMessage(null);
    if (!list) return;
    const next: Row[] = Array.from(list).map((file) => {
      const tooBig = file.size > MAX_BYTES;
      const wrongType = !ACCEPT.split(",").includes(file.type);
      return {
        file,
        progress: 0,
        state: tooBig || wrongType ? "failed" : "waiting",
        error: tooBig ? "Over 10 MB" : wrongType ? "Not a PDF or photo" : undefined,
      };
    });
    setRows(next);
  }

  function patch(i: number, p: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  }

  /** XHR rather than fetch, because fetch cannot report upload progress. */
  function put(url: string, file: File, onProgress: (n: number) => void): Promise<boolean> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      // Mirrors the Supabase client's own signed upload: multipart, empty field name.
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      xhr.send(body);
    });
  }

  async function upload() {
    const ready = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.state === "waiting");
    if (ready.length === 0) return;
    setBusy(true);
    setMessage(null);

    const prep = await prepareEvidenceUpload(
      caseId,
      ready.map(({ r }) => ({ name: r.file.name, type: r.file.type, size: r.file.size }))
    );
    if (!prep.ok) {
      setMessage({ ok: false, text: prep.error });
      setBusy(false);
      return;
    }

    // Two at a time: quicker than one by one, gentler than all at once on a phone.
    const done: { path: string; name: string; size: number; type: string }[] = [];
    let cursor = 0;
    async function worker() {
      while (cursor < ready.length) {
        const n = cursor++;
        const { r, i } = ready[n];
        const slot = prep.ok ? prep.slots[n] : null;
        if (!slot) continue;
        patch(i, { state: "uploading", progress: 0 });
        const ok = await put(slot.signedUrl, r.file, (p) => patch(i, { progress: p }));
        if (ok) {
          patch(i, { state: "done", progress: 100 });
          done.push({ path: slot.path, name: r.file.name, size: r.file.size, type: r.file.type });
        } else {
          patch(i, { state: "failed", error: "Upload failed" });
        }
      }
    }
    await Promise.all([worker(), worker()]);

    if (done.length > 0) {
      const rec = await recordEvidenceUpload(caseId, done);
      if (rec.ok) {
        const failed = ready.length - rec.count;
        setMessage({
          ok: failed === 0,
          text:
            failed === 0
              ? `${rec.count} file${rec.count === 1 ? "" : "s"} attached.`
              : `${rec.count} attached, ${failed} failed — choose those again to retry.`,
        });
        router.refresh();
      } else {
        setMessage({ ok: false, text: rec.error });
      }
    } else {
      setMessage({ ok: false, text: "Nothing uploaded. Check your connection and try again." });
    }

    setBusy(false);
    if (input.current) input.current.value = "";
  }

  const waiting = rows.filter((r) => r.state === "waiting").length;

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <label className="label" htmlFor={`evidence-${caseId}`}>Add files</label>
      <input
        ref={input}
        id={`evidence-${caseId}`}
        type="file"
        multiple
        accept={ACCEPT}
        disabled={busy}
        onChange={(e) => pick(e.target.files)}
        className="field py-2.5 text-sm file:mr-3 file:rounded-full file:border-0
                   file:bg-clinic-600 file:px-3 file:py-1.5 file:text-xs file:text-ink"
      />
      <p className="mt-1.5 text-xs text-slate-500">
        PDFs or photos, up to 10 MB each, several at once. One photo per page is fine.
      </p>

      {rows.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.file.name}-${i}`} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-slate-800">{r.file.name}</span>
                <span
                  className={[
                    "tabular shrink-0 text-xs",
                    r.state === "failed" ? "text-[rgb(var(--crit-fg))]"
                      : r.state === "done" ? "text-[rgb(var(--ok-fg))]"
                      : "text-slate-500",
                  ].join(" ")}
                >
                  {r.state === "failed" ? r.error
                    : r.state === "done" ? "Attached"
                    : r.state === "uploading" ? `${r.progress}%`
                    : `${(r.file.size / 1024 / 1024).toFixed(1)} MB`}
                </span>
              </div>
              {r.state === "uploading" || r.state === "done" ? (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-clinic-600 transition-[width] duration-200"
                    style={{ width: `${r.progress}%` }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {waiting > 0 ? (
        <button type="button" className="btn btn-primary mt-3" disabled={busy} aria-busy={busy} onClick={upload}>
          {busy ? <Spinner /> : null}
          {busy ? "Uploading…" : `Upload ${waiting} file${waiting === 1 ? "" : "s"}`}
        </button>
      ) : null}

      {message ? (
        <p role="status" className={`mt-3 ${message.ok ? "alert-ok" : "alert-error"}`}>{message.text}</p>
      ) : null}
    </div>
  );
}
