import { NextResponse } from "next/server";
import { createCase } from "@/lib/cases";
import { clientIp, sharedHit, submitAllowedForIp, submitAllowedForMobile } from "@/lib/ratelimit";
import { CATEGORIES } from "@/lib/types";
import type { Category, ContactMethod, Lang, PreferredTime } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 60 seconds of Opus is well under a megabyte; the base64 body of an mp4 from
// iOS is the worst case. Anything past this is not a genuine submission.
const MAX_VOICE_BASE64 = 6 * 1024 * 1024;

export async function POST(req: Request) {
  // Cheap checks first, so a flood is turned away before any work is done.
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_VOICE_BASE64 + 64 * 1024) {
    return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
  }
  const limited = submitAllowedForIp(clientIp());
  if (!limited.ok) {
    return NextResponse.json(
      { error: "TOO_MANY_REQUESTS" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  // A field people never see. Only a bot filling every input sets it; it gets
  // an answer that looks like success so it has no reason to try again.
  if (String(body.website ?? "").trim()) {
    return NextResponse.json({ ref: "LSC-RECEIVED" });
  }

  // Shared across every server instance, so many instances cannot each let
  // the same address through: 10 cases per address per 10 minutes overall.
  if (
    !(await sharedHit(`submit:${clientIp()}`, 10, 10 * 60_000)) ||
    !(await submitAllowedForMobile(String(body.mobile ?? "")))
  ) {
    return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
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
