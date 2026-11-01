import { authorize, ok } from "@/lib/api";
import { getBranches, getLocations } from "@/lib/cases";
import { INTERNAL_CODES } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await authorize(req);
  if ("response" in auth) return auth.response;

  const [branches, locations] = await Promise.all([getBranches(), getLocations()]);
  const visible = auth.key.branchId ? branches.filter((b) => b.id === auth.key.branchId) : branches;

  return ok(
    visible.map((b) => ({
      code: b.code,
      name: b.name_en,
      nameAr: b.name_ar,
      active: b.is_active,
      qrLocations: locations
        .filter((l) => l.branch_id === b.id && !INTERNAL_CODES.includes(l.code as never))
        .map((l) => ({ code: l.code, label: l.label_en, labelAr: l.label_ar })),
    }))
  );
}
