import { getBranches } from "@/lib/cases";
import BranchChooser from "./BranchChooser";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lumiere Skin Clinic — Share your experience",
  description: "Choose your branch and tell us about your visit.",
};

/**
 * The link the call centre sends to patients. They pick their branch and land
 * on that branch's reception form — the same place the QR code on the desk
 * would have taken them.
 */
export default async function StartPage() {
  const branches = (await getBranches()).filter((b) => b.is_active);
  return (
    <BranchChooser
      branches={branches.map((b) => ({
        code: b.code,
        name_en: b.name_en,
        name_ar: b.name_ar,
      }))}
    />
  );
}
