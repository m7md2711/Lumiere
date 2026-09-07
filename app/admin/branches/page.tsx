import { getBranches, getLocations } from "@/lib/cases";
import BranchCard from "./BranchCard";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const [branches, locations] = await Promise.all([getBranches(), getLocations()]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Branches</h1>
        <p className="text-sm text-slate-500">
          Names shown to patients, and the QR locations available at each branch.
        </p>
      </div>

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
