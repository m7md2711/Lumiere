import { getBranchByCode, getLocations } from "@/lib/cases";
import { LogoMark } from "@/components/Logo";
import FeedbackForm from "./FeedbackForm";

export const dynamic = "force-dynamic";

export default async function PatientFormPage({
  params,
  searchParams,
}: {
  params: { branchCode: string };
  searchParams: { loc?: string };
}) {
  const branch = await getBranchByCode(params.branchCode).catch(() => null);

  if (!branch || !branch.is_active) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <LogoMark size={44} />
        <h1 className="text-lg font-semibold text-slate-900">This code is not valid</h1>
        <p className="text-sm text-slate-600">
          The link or QR code seems out of date. Please ask our reception team for help.
        </p>
        <p dir="rtl" className="text-sm text-slate-600">
          يبدو أن الرابط أو رمز الاستجابة السريعة غير محدث. يرجى طلب المساعدة من فريق الاستقبال.
        </p>
      </main>
    );
  }

  const locations = await getLocations(branch.id);
  const loc = searchParams.loc
    ? locations.find((l) => l.code.toUpperCase() === searchParams.loc!.toUpperCase()) ?? null
    : null;

  return (
    <FeedbackForm
      branch={{
        code: branch.code,
        name_en: branch.name_en,
        name_ar: branch.name_ar,
      }}
      location={
        loc ? { code: loc.code, label_en: loc.label_en, label_ar: loc.label_ar } : null
      }
    />
  );
}
