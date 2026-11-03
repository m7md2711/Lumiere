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
export const IconAnalysis = (p: P) => box(<><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>, p);
export const IconEye = (p: P) => box(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>, p);
export const IconQr = (p: P) => box(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M20 20v.01M17 20v.01" /></>, p);
export const IconMic = (p: P) => box(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>, p);

export const categoryIconMap: Record<string, (p: P) => React.ReactElement> = {
  appointment: IconCalendar,
  staff: IconChat,
  concern: IconStethoscope,
  payment: IconReceipt,
  facility: IconBuilding,
  suggestion: IconBulb,
  appreciation: IconHeart,
  other: IconNote,
};

export const IconGear = (p: P) => box(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>, p);

export const IconClock = (p: P) => box(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, p);
export const IconCheckCircle = (p: P) => box(<><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>, p);
export const IconCalendarCheck = (p: P) => box(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4" /></>, p);
export const IconArrows = (p: P) => box(<><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" /></>, p);
export const IconSmile = (p: P) => box(<><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></>, p);
export const IconDoc = (p: P) => box(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>, p);
export const IconRepeat = (p: P) => box(<><path d="M17 2l3 3-3 3M20 5H8a4 4 0 0 0-4 4v1M7 22l-3-3 3-3M4 19h12a4 4 0 0 0 4-4v-1" /></>, p);
export const IconBell = (p: P) => box(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>, p);
export const IconSearch = (p: P) => box(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, p);
export const IconMenu = (p: P) => box(<path d="M4 6h16M4 12h16M4 18h16" />, p);
export const IconPlus = (p: P) => box(<path d="M12 5v14M5 12h14" />, p);
export const IconChevronsLeft = (p: P) => box(<path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />, p);
export const IconKey = (p: P) => box(<><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2" /></>, p);
export const IconLogout = (p: P) => box(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>, p);
export const IconPulse = (p: P) => box(<path d="M3 12h4l3-8 4 16 3-8h4" />, p);
export const IconAlert = (p: P) => box(<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>, p);
