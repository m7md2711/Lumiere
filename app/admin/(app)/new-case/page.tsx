import { currentSession } from "@/lib/auth";
import { getBranches } from "@/lib/cases";
import { ensureInternalLocations } from "@/lib/sources";
import LogComplaintForm from "./LogComplaintForm";

export const dynamic = "force-dynamic";

/**
 * Raising a complaint a patient made in person or by phone. A branch raises
 * against itself; the call centre and the administrator choose the branch.
 */
export default async function NewCasePage() {
  const session = await currentSession();
  if (!session) return null;

  await ensureInternalLocations();
  const branches = (await getBranches()).filter((b) => b.is_active);

  const fixed = session.role === "branch"
    ? { code: session.branchCode, name: session.branchName }
    : null;

  return (
    <LogComplaintForm
      role={session.role}
      fixedBranch={fixed}
      branches={branches.map((b) => ({ code: b.code, name: b.name_en }))}
    />
  );
}
