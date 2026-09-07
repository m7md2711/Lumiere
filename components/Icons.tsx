/**
 * Minimal 24px stroke icons. They inherit `currentColor`, so they pick up the
 * gold of whatever they sit inside — colour emoji read as cheap against the
 * brand's gold-on-black.
 */
type P = { className?: string };

const box = (d: React.ReactNode, extra?: P) => (
  <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden
    className={extra?.className ?? "h-5 w-5"}
  >
    {d}
  </svg>
);

export const IconCalendar = (p: P) => box(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>, p);
export const IconChat = (p: P) => box(<><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" /><path d="M9 11h.01M13 11h.01" /></>, p);
export const IconSparkle = (p: P) => box(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" /></>, p);
export const IconStethoscope = (p: P) => box(<><path d="M6 3v5a4 4 0 0 0 8 0V3" /><path d="M4 3h3M13 3h3" /><path d="M10 12v3a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="11" r="2" /></>, p);
export const IconReceipt = (p: P) => box(<><path d="M5 3h14v18l-2.3-1.6L14.4 21l-2.4-1.6L9.6 21l-2.3-1.6L5 21V3Z" /><path d="M9 8h6M9 12h6" /></>, p);
export const IconBuilding = (p: P) => box(<><path d="M3 21h18M5 21V6l7-3 7 3v15" /><path d="M9 10h.01M15 10h.01M9 14h.01M15 14h.01M11 21v-4h2v4" /></>, p);
export const IconBulb = (p: P) => box(<><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v1h6v-1c0-.4.1-.8.5-1.1A6 6 0 0 0 12 3Z" /></>, p);
export const IconHeart = (p: P) => box(<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z" />, p);
export const IconNote = (p: P) => box(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>, p);
export const IconList = (p: P) => box(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></>, p);
export const IconChart = (p: P) => box(<><path d="M4 20h16" /><path d="M7 20v-6M12 20V6M17 20v-9" /></>, p);
export const IconQr = (p: P) => box(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M20 20v.01M17 20v.01" /></>, p);
export const IconMic = (p: P) => box(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>, p);

export const categoryIconMap: Record<string, (p: P) => React.ReactElement> = {
  appointment: IconCalendar,
  staff: IconChat,
  treatment: IconSparkle,
  medical: IconStethoscope,
  payment: IconReceipt,
  facility: IconBuilding,
  suggestion: IconBulb,
  appreciation: IconHeart,
  other: IconNote,
};
