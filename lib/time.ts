/**
 * All timestamps are stored as UTC (Postgres timestamptz) and every render
 * happens on Vercel, whose functions run with TZ=UTC. Left alone, the admin
 * would therefore show every time four hours behind the clinic. Formatting and
 * day boundaries are pinned to Gulf Standard Time here instead.
 */
export const CLINIC_TZ = "Asia/Dubai";

/** The UAE is UTC+4 the whole year round — it has never observed DST. */
const OFFSET_MS = 4 * 60 * 60 * 1000;

const base = { timeZone: CLINIC_TZ } as const;

/** "07 Sept, 10:02" — the list and timeline format. */
export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("en-GB", {
    ...base, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** "07 Sept 2026, 10:02" — where the year matters. */
export function formatLongDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("en-GB", {
    ...base, day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** "07 Sept" — chart axis labels. */
export function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { ...base, day: "2-digit", month: "short" });
}

/** Sorts as text and still reads as a date — for CSV opened in Excel. */
export function formatForCsv(iso: string | Date | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    ...base, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}

// --------------------------------------------------------------- boundaries

/** The instant the clinic's day containing `d` began. */
export function clinicDayStart(d: Date = new Date()): Date {
  const shifted = new Date(d.getTime() + OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - OFFSET_MS);
}

/** The instant the clinic's month containing `d` began. */
export function clinicMonthStart(d: Date = new Date()): Date {
  const shifted = new Date(d.getTime() + OFFSET_MS);
  shifted.setUTCDate(1);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - OFFSET_MS);
}

/** A yyyy-mm-dd filter value read as the clinic's day, not the server's. */
export function clinicDateStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000+04:00`);
}

export function clinicDateEnd(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999+04:00`);
}
