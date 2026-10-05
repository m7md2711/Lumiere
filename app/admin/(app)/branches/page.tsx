import { isAdminSession } from "@/lib/scope";
import { redirect } from "next/navigation";
import { getBranches, getLocations } from "@/lib/cases";
import { INTERNAL_CODES } from "@/lib/sources";
import BranchCard from "./BranchCard";
import AddBranch from "./AddBranch";

export const dynamic = "force-dynamic";

// Branch staff have no business here; the nav hides it, this enforces it.
async function requireAdminPage() {
  if (!(await isAdminSession())) redirect("/admin/cases");
}

export default async function BranchesPage() {
  await requireAdminPage();
  const [branches, allLocations] = await Promise.all([getBranches(), getLocations()]);
  // Branch-manager and call-centre intake are not rooms with a QR on the wall;
  // they exist only to record how a complaint reached us.
  const locations = allLocations.filter((l) => !INTERNAL_CODES.includes(l.code as never));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Branches</h1>
        <p className="text-sm text-slate-500">
          Names shown to patients, and the QR locations available at each branch.
        </p>
      </div>

      <AddBranch />

      <div className="space-y-3">
        {branches.map((b) => (
          <BranchCard
            key={b.id}
            branch={b}
            locations={locations.filter((l) => l.branch_id === b.id)}
          />
        ))}
      </div>
    </div>
  );
}
