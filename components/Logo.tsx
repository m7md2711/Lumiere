export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Lumiere Skin Clinic">
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <path
        d="M16 7.5c-3.6 0-6.5 2.9-6.5 6.5 0 4.9 6.5 10.5 6.5 10.5s6.5-5.6 6.5-10.5c0-3.6-2.9-6.5-6.5-6.5Z"
        fill="#fff" opacity="0.16"
      />
      <path d="M16 8.4 17.4 13l4.6 1.4-4.6 1.4-1.4 4.6-1.4-4.6-4.6-1.4 4.6-1.4 1.4-4.6Z" fill="#fff" />
    </svg>
  );
}

export function Wordmark({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-clinic-700">
        <LogoMark size={36} />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-wide text-clinic-800">{label}</div>
        {sub ? <div className="text-xs text-slate-500">{sub}</div> : null}
      </div>
    </div>
  );
}
