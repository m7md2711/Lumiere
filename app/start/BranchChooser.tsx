"use client";

import { useEffect, useMemo, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

type B = { code: string; name_en: string; name_ar: string };

const LANG_KEY = "lsc_lang";

const copy = {
  en: {
    pick: "Which branch did you visit?",
    hint: "Choose your branch and we will take you to the right form.",
    search: "Search for your branch",
    none: "No branch matches that name.",
    go: "Continue",
  },
  ar: {
    pick: "أي فرع قمتم بزيارته؟",
    hint: "اختاروا الفرع وسننتقل بكم إلى النموذج المناسب.",
    search: "ابحثوا عن الفرع",
    none: "لا يوجد فرع بهذا الاسم.",
    go: "متابعة",
  },
} as const;

export default function BranchChooser({ branches }: { branches: B[] }) {
  const [lang, setLang] = useState<Lang>("en");
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");

  const L = useMemo(() => t(lang), [lang]);
  const C = copy[lang];
  const rtl = lang === "ar";

  useEffect(() => {
    let initial: Lang = navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en";
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "ar" || saved === "en") initial = saved;
    } catch {
      /* private mode */
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

  const shown = branches.filter((b) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return b.name_en.toLowerCase().includes(s) || b.name_ar.includes(q.trim());
  });

  if (!ready) return <div className="min-h-screen bg-slate-50" />;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-50">
      <header className="border-b border-clinic-200 bg-gradient-to-b from-slate-100 to-slate-50 px-5 pb-9 pt-7">
        <div className="mx-auto flex max-w-lg items-start justify-between gap-4">
          <LogoMark size={30} />
          <button
            type="button"
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="rounded-full border border-clinic-300 px-3.5 py-1.5 text-sm text-clinic-700 hover:bg-clinic-50"
          >
            {L.langLabel}
          </button>
        </div>
        <div className="mx-auto mt-7 max-w-lg">
          <h1 className="bg-gradient-to-r from-gold-light via-gold-mid to-gold-deep bg-clip-text text-2xl font-normal uppercase leading-snug tracking-brand text-transparent">
            {L.heroTitle}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{L.heroSub}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 pb-16 pt-7">
        <h2 className="text-base text-slate-900">{C.pick}</h2>
        <p className="mt-1 text-sm text-slate-500">{C.hint}</p>

        {branches.length > 6 ? (
          <input
            className="field mt-4"
            placeholder={C.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={C.search}
          />
        ) : null}

        <div className="mt-4 grid gap-2.5">
          {shown.map((b) => (
            <a
              key={b.code}
              href={`/f/${b.code}?loc=REC`}
              className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-100 p-4
                         transition-colors hover:border-clinic-600 hover:bg-clinic-50"
            >
              <span className="tabular text-xs text-clinic-600">{b.code}</span>
              <span className="flex-1">
                <span className="block text-sm text-slate-800">{rtl ? b.name_ar : b.name_en}</span>
                <span className="block text-xs text-slate-500" dir={rtl ? "ltr" : "rtl"}>
                  {rtl ? b.name_en : b.name_ar}
                </span>
              </span>
              <span aria-hidden className="text-clinic-600">
                {rtl ? "‹" : "›"}
              </span>
            </a>
          ))}
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{C.none}</p>
          ) : null}
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-slate-500">{L.privacy}</p>
      </main>
    </div>
  );
}
