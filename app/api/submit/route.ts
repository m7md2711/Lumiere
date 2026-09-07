import { NextResponse } from "next/server";
import { createCase } from "@/lib/cases";
import { CATEGORIES } from "@/lib/types";
import type { Category, ContactMethod, Lang, PreferredTime } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 60 seconds of Opus is well under a megabyte; the base64 body of an mp4 from
// iOS is the worst case. Anything past this is not a genuine submission.
const MAX_VOICE_BASE64 = 6 * 1024 * 1024;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const category = String(body.category ?? "");
  if (!CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
  }

  const voiceRaw = body.voice as { base64?: string; mime?: string } | null | undefined;
  let voice: { base64: string; mime: string } | null = null;
  if (voiceRaw?.base64) {
    if (voiceRaw.base64.length > MAX_VOICE_BASE64) {
      return NextResponse.json({ error: "VOICE_TOO_LARGE" }, { status: 413 });
    }
    const mime = String(voiceRaw.mime ?? "audio/webm");
    voice = { base64: voiceRaw.base64, mime: mime.startsWith("audio/") ? mime : "audio/webm" };
  }

  const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(v as T) ? (v as T) : fallback;

  try {
    const { ref } = await createCase({
      branchCode: String(body.branchCode ?? ""),
      locationCode: body.locationCode ? String(body.locationCode) : null,
      category: category as Category,
      description: body.description ? String(body.description).slice(0, 4000) : null,
      patientName: String(body.patientName ?? "").slice(0, 120),
      mobile: String(body.mobile ?? ""),
      preferredLang: oneOf<Lang>(body.preferredLang, ["en", "ar"], "en"),
      contactMethod: oneOf<ContactMethod>(body.contactMethod, ["call", "whatsapp"], "call"),
      preferredTime: oneOf<PreferredTime>(
        body.preferredTime, ["morning", "afternoon", "evening"], "morning"
      ),
      voice,
    });
    return NextResponse.json({ ref });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "FAILED";
    const known = ["INVALID_BRANCH", "INVALID_MOBILE", "INVALID_NAME", "EMPTY_DETAILS"];
    if (known.includes(msg)) return NextResponse.json({ error: msg }, { status: 400 });
    console.error("submit failed", e);
    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}
