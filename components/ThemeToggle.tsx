"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";
export const THEME_KEY = "lsc_theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let saved: Theme = "system";
    try {
      const v = localStorage.getItem(THEME_KEY);
      if (v === "dark" || v === "light" || v === "system") saved = v;
    } catch {
      /* private mode — system is a fine default */
    }
    setTheme(saved);
    setReady(true);
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* the choice still holds for this page */
    }
  }

  // Render the control only once the stored choice is known, so it never shows
  // the wrong option selected for a frame.
  if (!ready) return <div className={compact ? "h-8 w-20" : "h-9 w-28"} aria-hidden />;

  const options: { v: Theme; label: string; icon: React.ReactNode }[] = [
    { v: "light", label: "Light", icon: <Sun /> },
    { v: "dark", label: "Dark", icon: <Moon /> },
    { v: "system", label: "Auto", icon: <Auto /> },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-100 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={theme === o.v}
          title={o.label}
          onClick={() => choose(o.v)}
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs transition-colors",
            theme === o.v
              ? "bg-clinic-600 text-ink"
              : "text-slate-500 hover:text-slate-800",
          ].join(" ")}
        >
          {o.icon}
          {!compact ? <span className="hidden sm:inline">{o.label}</span> : null}
        </button>
      ))}
    </div>
  );
}

const ico = "h-3.5 w-3.5";
const Sun = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const Moon = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);
const Auto = () => (
  <svg className={ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2.5" y="4" width="19" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);
