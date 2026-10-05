import { notFound } from "next/navigation";
import { getBranches } from "@/lib/cases";
import { readJson } from "@/lib/settings";
import {
  INTAKE_KEY, channelMeta, defaultIntakeCodes, ensureInternalLocations,
  type Channel, type IntakeCodes,
} from "@/lib/sources";
import { LogoMark } from "@/components/Logo";
import IntakeForm from "./IntakeForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Lumiere — log a patient complaint" };

/**
 * Staff intake. A patient who complains to a branch manager in person, or to
 * the call centre by phone, never touches the patient form — so somebody logs
 * it here on their behalf. The case then follows exactly the same cycle.
 */
export default async function IntakePage({
  params,
  searchParams,
}: {
  params: { channel: string };
  searchParams: { k?: string };
}) {
  const channel = params.channel as Channel;
  if (channel !== "branch" && channel !== "call-center") notFound();

  const codes = await readJson<IntakeCodes>(INTAKE_KEY, defaultIntakeCodes);
  const required = codes[channel];

  if (required && searchParams.k !== required) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <LogoMark size={40} />
        <h1 className="text-lg text-slate-900">This link is not complete</h1>
        <p className="text-sm text-slate-600">
          Use the full link from the administrator — it carries an access code. Ask them to
          send it again if you no longer have it.
        </p>
      </main>
    );
  }

  await ensureInternalLocations();
  const branches = (await getBranches()).filter((b) => b.is_active);

  return (
    <IntakeForm
      channel={channel}
      accessCode={searchParams.k ?? ""}
      meta={channelMeta[channel]}
      branches={branches.map((b) => ({ code: b.code, name: b.name_en }))}
    />
  );
}
