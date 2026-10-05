import { NextResponse } from "next/server";
import { createCase, addEvent } from "@/lib/cases";
import { readJson } from "@/lib/settings";
import {
  INTAKE_KEY, channelCode, channelMeta, defaultIntakeCodes,
  ensureInternalLocations, type Channel, type IntakeCodes,
} from "@/lib/sources";
import { CATEGORIES } from "@/lib/types";
import type { Category, ContactMethod, Lang, PreferredTime } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Staff-logged complaints. Same case, same workflow, same notifications — the
 * intake point is what differs, and that is what lets the dashboard count
 * internal complaints apart from the ones patients sent themselves.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const channel = String(body.channel ?? "") as Channel;
  if (channel !== "branch" && channel !== "call-center") {
    return NextResponse.json({ error: "UNKNOWN_CHANNEL" }, { status: 400 });
  }

  // The access code is re-checked here: guarding only the page would leave the
  // endpoint itself open to anyone who found it.
  const codes = await readJson<IntakeCodes>(INTAKE_KEY, defaultIntakeCodes);
  const required = codes[channel];
  if (required && String(body.accessCode ?? "") !== required) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const category = String(body.category ?? "");
  if (!CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
  }

  const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(v as T) ? (v as T) : fallback;

  try {
    await ensureInternalLocations();

    const takenBy = String(body.takenBy ?? "").trim().slice(0, 80);
    const { ref, id } = await createCase({
      branchCode: String(body.branchCode ?? ""),
      locationCode: channelCode[channel],
      category: category as Category,
      description: String(body.description ?? "").slice(0, 4000),
      patientName: String(body.patientName ?? "").slice(0, 120),
      mobile: String(body.mobile ?? ""),
      preferredLang: oneOf<Lang>(body.preferredLang, ["en", "ar"], "en"),
      contactMethod: oneOf<ContactMethod>(body.contactMethod, ["call", "whatsapp"], "call"),
      preferredTime: oneOf<PreferredTime>(
        body.preferredTime, ["morning", "afternoon", "evening"], "morning"
      ),
      voice: null,
    });

    await addEvent(
      id,
      "note",
      `Logged by ${channelMeta[channel].en}${takenBy ? ` — ${takenBy}` : ""}, on the patient's behalf.`
    );

    return NextResponse.json({ ref });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "FAILED";
    const known = ["INVALID_BRANCH", "INVALID_MOBILE", "INVALID_NAME", "EMPTY_DETAILS"];
    if (known.includes(msg)) return NextResponse.json({ error: msg }, { status: 400 });
    console.error("intake failed", e);
    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}
