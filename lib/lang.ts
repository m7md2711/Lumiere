import { cookies, headers } from "next/headers";
import type { Lang } from "./types";

export const LANG_COOKIE = "lsc_lang";

/**
 * The language to render on the server, so the page arrives filled in rather
 * than blank-until-JavaScript. A choice the patient made before (a cookie)
 * wins; otherwise the browser's own language; otherwise English.
 */
export function serverLang(): Lang {
  try {
    const saved = cookies().get(LANG_COOKIE)?.value;
    if (saved === "ar" || saved === "en") return saved;
    const accept = headers().get("accept-language") ?? "";
    return accept.toLowerCase().trimStart().startsWith("ar") ? "ar" : "en";
  } catch {
    return "en";
  }
}
