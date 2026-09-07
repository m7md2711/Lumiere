"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { categoryLabel, t } from "@/lib/i18n";
import { categoryIconMap, IconMic } from "@/components/Icons";
import { CATEGORIES } from "@/lib/types";
import type { Category, ContactMethod, Lang, PreferredTime } from "@/lib/types";

type BranchChip = { code: string; name_en: string; name_ar: string };
type LocChip = { code: string; label_en: string; label_ar: string } | null;

const MAX_SECONDS = 60;
const LANG_KEY = "lsc_lang";

export default function FeedbackForm({
  branch,
  location,
}: {
  branch: BranchChip;
  location: LocChip;
}) {
  const [lang, setLang] = useState<Lang>("en");
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0); // 0 category · 1 details · 2 contact · 3 done
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("call");
  const [preferredTime, setPreferredTime] = useState<PreferredTime>("morning");

  const voice = useVoiceRecorder();
  const L = useMemo(() => t(lang), [lang]);
  const rtl = lang === "ar";

  // Browser language on first visit, the saved choice on every visit after.
  useEffect(() => {
    let initial: Lang = navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en";
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "ar" || saved === "en") initial = saved;
    } catch {
      /* private mode — the default is fine */
    }
    setLang(initial);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* nothing to do */
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
  }, [lang, rtl, ready]);

  const branchName = rtl ? branch.name_ar : branch.name_en;
  const locName = location ? (rtl ? location.label_ar : location.label_en) : null;

  function validMobile(v: string): boolean {
    const d = v.replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
    const local = /^971\d{9}$/.test(d) ? "0" + d.slice(3) : /^\d{9}$/.test(d) ? "0" + d : d;
    return /^0(50|52|54|55|56|58)\d{7}$/.test(local);
  }

  function goNext() {
    setError(null);
    if (step === 0) {
      if (!category) return setError(L.errCategory);
      return setStep(1);
    }
    if (step === 1) {
      if (!description.trim() && !voice.blob) return setError(L.errDetails);
      return setStep(2);
    }
  }

  const submit = useCallback(async () => {
    setError(null);
    if (!name.trim()) return setError(L.errName);
    if (!validMobile(mobile)) return setError(L.errMobile);

    setSending(true);
    try {
      let voicePayload: { base64: string; mime: string } | null = null;
      if (voice.blob) {
        voicePayload = { base64: await blobToBase64(voice.blob), mime: voice.blob.type || "audio/webm" };
      }

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchCode: branch.code,
          locationCode: location?.code ?? null,
          category,
          description,
          patientName: name,
          mobile,
          preferredLang: lang,
          contactMethod,
          preferredTime,
          voice: voicePayload,
        }),
      });

      const json = (await res.json()) as { ref?: string; error?: string };
      if (!res.ok || !json.ref) throw new Error(json.error ?? "failed");

      setReference(json.ref);
      setStep(3);
    } catch {
      // Nothing is cleared: the patient can fix their connection and press retry.
      setError(L.errSubmit);
    } finally {
      setSending(false);
    }
  }, [
    name, mobile, voice.blob, branch.code, location, category, description,
    lang, contactMethod, preferredTime, L,
  ]);

  if (!ready) return <div className="min-h-screen bg-slate-50" />;

  // ------------------------------------------------------------ confirmation
  if (step === 3 && reference) {
    return (
      <Shell rtl={rtl} lang={lang} onLang={setLang} L={L} hideToggle>
        <div className="card p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-clinic-50 text-2xl text-clinic-700 ring-1 ring-clinic-300">
            ✓
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{L.thankYouTitle}</h1>
          <p className="mt-2 text-sm text-slate-600">{L.thankYouBody}</p>

          <div className="mt-6 rounded-2xl bg-clinic-50 p-5 ring-1 ring-clinic-300">
            <div className="text-xs font-medium uppercase tracking-wide text-clinic-700">
              {L.yourReference}
            </div>
            <div className="tabular mt-2 select-all break-all text-2xl font-bold text-clinic-800">
              {reference}
            </div>
            <button
              type="button"
              className="btn btn-ghost mt-4"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(reference);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* clipboard blocked — the number is selectable above */
                }
              }}
            >
              {copied ? L.copied : L.copy}
            </button>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-slate-500">{L.privacy}</p>

          <button
            type="button"
            className="btn btn-ghost mt-4"
            onClick={() => {
              setReference(null);
              setCategory(null);
              setDescription("");
              setName("");
              setMobile("");
              voice.reset();
              setStep(0);
            }}
          >
            {L.newSubmission}
          </button>
        </div>
      </Shell>
    );
  }

  // ------------------------------------------------------------------- form
  return (
    <Shell rtl={rtl} lang={lang} onLang={setLang} L={L}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="chip">
          <span className="opacity-60">{L.branch}</span> {branchName}
        </span>
        {locName ? (
          <span className="chip">
            <span className="opacity-60">{L.location}</span> {locName}
          </span>
        ) : null}
      </div>

      <Stepper step={step} L={L} />

      {step === 0 ? (
        <section className="mt-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900">{L.pickCategory}</h2>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {CATEGORIES.map((c) => {
              const active = category === c;
              const Icon = categoryIconMap[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCategory(c);
                    setError(null);
                  }}
                  aria-pressed={active}
                  className={[
                    "flex min-h-[64px] items-center gap-3 rounded-2xl border p-4 text-start transition-colors",
                    active
                      ? "border-clinic-600 bg-clinic-50 ring-2 ring-clinic-200"
                      : "border-slate-200 bg-slate-100 hover:border-clinic-300",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-colors",
                      active
                        ? "bg-clinic-100 text-clinic-700 ring-clinic-300"
                        : "bg-slate-200 text-clinic-600 ring-slate-300",
                    ].join(" ")}
                  >
                    <Icon />
                  </span>
                  <span className="text-sm font-medium leading-snug text-slate-800">
                    {categoryLabel(c, lang)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="mt-5">
          <h2 className="text-base font-semibold text-slate-900">{L.tellUsMore}</h2>
          <p className="mt-1 text-sm text-slate-500">{L.detailsHint}</p>

          <textarea
            className="field mt-4 min-h-[140px] resize-y"
            placeholder={L.writeHere}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setError(null);
            }}
          />

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-800">{L.orRecord}</div>
                <div className="text-xs text-slate-500">{L.maxSeconds}</div>
              </div>
              <div className="tabular text-lg font-semibold text-clinic-700">
                {formatTime(voice.seconds)}
              </div>
            </div>

            {voice.error ? (
              <p className="alert-warn mt-3">
                {voice.error === "unsupported" ? L.micUnsupported : L.micDenied}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!voice.recording && !voice.url ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setError(null);
                    voice.start();
                  }}
                >
                  <IconMic className="h-4 w-4" /> {L.record}
                </button>
              ) : null}

              {voice.recording ? (
                <button type="button" className="btn btn-primary" onClick={voice.stop}>
                  <span aria-hidden>■</span> {L.stop}
                </button>
              ) : null}

              {voice.url && !voice.recording ? (
                <>
                  <audio controls src={voice.url} className="w-full max-w-full sm:w-64" />
                  <button type="button" className="btn btn-ghost" onClick={voice.reset}>
                    {L.rerecord}
                  </button>
                </>
              ) : null}
            </div>

            {voice.recording ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-clinic-700">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
                {L.recording}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="mt-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">{L.yourDetails}</h2>

          <div>
            <label className="label" htmlFor="name">{L.name}</label>
            <input
              id="name"
              className="field"
              value={name}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="mobile">{L.mobile}</label>
            <input
              id="mobile"
              className="field tabular"
              inputMode="tel"
              dir="ltr"
              autoComplete="tel"
              placeholder={L.mobileHint}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>

          <Choice
            label={L.contactMethod}
            value={contactMethod}
            onChange={setContactMethod}
            options={[
              { v: "call" as const, label: L.call },
              { v: "whatsapp" as const, label: L.whatsapp },
            ]}
          />

          <Choice
            label={L.preferredTime}
            value={preferredTime}
            onChange={setPreferredTime}
            options={[
              { v: "morning" as const, label: L.morning },
              { v: "afternoon" as const, label: L.afternoon },
              { v: "evening" as const, label: L.evening },
            ]}
          />

          <Choice
            label={L.preferredLang}
            value={lang}
            onChange={setLang}
            options={[
              { v: "en" as const, label: L.english },
              { v: "ar" as const, label: L.arabic },
            ]}
          />

          <p className="pt-1 text-xs leading-relaxed text-slate-500">{L.privacy}</p>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="alert-error mt-4">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex gap-3 pb-10">
        {step > 0 ? (
          <button
            type="button"
            className="btn btn-ghost px-6 py-4"
            onClick={() => {
              setError(null);
              setStep(step - 1);
            }}
          >
            {L.back}
          </button>
        ) : null}

        {step < 2 ? (
          <button type="button" className="btn btn-primary btn-lg" onClick={goNext}>
            {L.next}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={sending}
            onClick={submit}
          >
            {sending ? L.sending : error ? L.retry : L.submit}
          </button>
        )}
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------------ pieces

function Shell({
  children, rtl, lang, onLang, L, hideToggle,
}: {
  children: React.ReactNode;
  rtl: boolean;
  lang: Lang;
  onLang: (l: Lang) => void;
  L: ReturnType<typeof t>;
  hideToggle?: boolean;
}) {
  return (
    <div dir={rtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-50">
      <header className="border-b border-clinic-200 bg-gradient-to-b from-slate-100 to-slate-50 px-5 pb-8 pt-6">
        <div className="mx-auto flex max-w-lg items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoMark size={30} />
          </div>
          {!hideToggle ? (
            <button
              type="button"
              onClick={() => onLang(lang === "ar" ? "en" : "ar")}
              className="rounded-full border border-clinic-300 px-3.5 py-1.5 text-sm font-medium text-clinic-700 hover:bg-clinic-50"
            >
              {L.langLabel}
            </button>
          ) : null}
        </div>
        <div className="mx-auto mt-6 max-w-lg">
          <h1 className="bg-gradient-to-r from-gold-light via-gold-mid to-gold-deep bg-clip-text text-2xl font-bold leading-snug text-transparent">{L.heroTitle}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{L.heroSub}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 pt-6">
        {children}
      </main>
    </div>
  );
}

function Stepper({ step, L }: { step: number; L: ReturnType<typeof t> }) {
  const labels = [L.step1, L.step2, L.step3];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
        <span>{L.stepOf(step + 1, 3)}</span>
        <span className="text-clinic-700">{labels[step]}</span>
      </div>
      <div className="flex gap-1.5">
        {labels.map((_, i) => (
          <div
            key={i}
            className={[
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= step ? "bg-clinic-600" : "bg-slate-200",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}

function Choice<V extends string>({
  label, value, onChange, options,
}: {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: { v: V; label: string }[];
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="grid grid-cols-3 gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={value === o.v}
            onClick={() => onChange(o.v)}
            className={[
              "min-h-[52px] rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
              value === o.v
                ? "border-clinic-600 bg-clinic-50 text-clinic-800 ring-2 ring-clinic-200"
                : "border-slate-300 bg-slate-200 text-slate-700 hover:border-clinic-300",
            ].join(" ")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- recording

type VoiceState = {
  recording: boolean;
  seconds: number;
  blob: Blob | null;
  url: string | null;
  error: "denied" | "unsupported" | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

function useVoiceRecorder(): VoiceState {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<"denied" | "unsupported" | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stream = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return setError("unsupported");
    }

    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;

      // Safari on iOS has no Opus encoder; mp4/aac is what it will give us.
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (m) => MediaRecorder.isTypeSupported?.(m)
      );

      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      recRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        const b = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        setBlob(b);
        setUrl(URL.createObjectURL(b));
        setRecording(false);
        cleanup();
      };

      rec.start();
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => {
        setSeconds((n) => {
          if (n + 1 >= MAX_SECONDS) {
            // The cap is enforced here rather than trusted to the patient.
            if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
            return MAX_SECONDS;
          }
          return n + 1;
        });
      }, 1000);
    } catch {
      cleanup();
      setError("denied");
    }
  }, [cleanup]);

  const reset = useCallback(() => {
    if (url) URL.revokeObjectURL(url);
    setBlob(null);
    setUrl(null);
    setSeconds(0);
    setError(null);
  }, [url]);

  return { recording, seconds, blob, url, error, start, stop, reset };
}

function formatTime(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(b);
  });
}
