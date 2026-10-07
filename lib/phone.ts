/**
 * Pure string helpers, safe to import from a client component. They live apart
 * from lib/cases because that module reaches the mailer, which must never be
 * pulled into a browser bundle.
 */

/** 05x xxx xxxx, with or without spaces, and the +971 / 00971 forms. */
export function normalizeMobile(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
  let local: string | null = null;

  if (/^971\d{9}$/.test(digits)) local = "0" + digits.slice(3);
  else if (/^0\d{9}$/.test(digits)) local = digits;
  else if (/^\d{9}$/.test(digits)) local = "0" + digits;

  if (!local) return null;
  // UAE mobile prefixes.
  if (!/^0(50|52|54|55|56|58)\d{7}$/.test(local)) return null;
  return local;
}

/** wa.me wants the international form with no plus sign. */
export function toWhatsApp(local: string): string {
  return "971" + local.replace(/\D/g, "").replace(/^0/, "");
}
