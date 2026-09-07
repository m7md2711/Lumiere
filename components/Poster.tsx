import { LogoMark } from "./Logo";

/**
 * A5 poster. The sizing is in millimetres so a print lands at true A5 whatever
 * the screen it was laid out on.
 */
export function Poster({
  qr, branchEn, branchAr, locEn, locAr, url,
}: {
  qr: string;
  branchEn: string;
  branchAr: string;
  locEn: string;
  locAr: string;
  url: string;
}) {
  return (
    <div
      className="poster mx-auto flex flex-col items-center justify-between bg-white p-[12mm] text-center"
      style={{ width: "148mm", height: "210mm" }}
    >
      <div className="flex flex-col items-center gap-2">
        <span className="text-clinic-700"><LogoMark size={44} /></span>
        <div className="text-[11pt] font-semibold tracking-wide text-clinic-800">
          Lumiere Skin Clinic
        </div>
      </div>

      <div className="w-full">
        <h1 className="text-[20pt] font-bold uppercase leading-tight tracking-wide text-clinic-800">
          Your experience matters
        </h1>
        <p className="mt-2 text-[10.5pt] leading-snug text-slate-600">
          Share your feedback, suggestion, or concern with us. | Scan here
        </p>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qr}
        alt={`QR code for ${branchEn} ${locEn}`}
        style={{ width: "62mm", height: "62mm" }}
      />

      <div className="w-full" dir="rtl">
        <h2 className="text-[20pt] font-bold leading-tight text-clinic-800">تجربتكم تهمنا</h2>
        <p className="mt-2 text-[10.5pt] leading-snug text-slate-600">
          شاركونا ملاحظاتكم أو اقتراحاتكم أو ما يشغلكم — امسحوا الرمز هنا
        </p>
      </div>

      <div className="w-full border-t border-slate-200 pt-3">
        <div className="text-[10pt] font-semibold text-slate-700">
          {branchEn} · {locEn}
        </div>
        <div dir="rtl" className="text-[9pt] text-slate-500">
          {branchAr} · {locAr}
        </div>
        <div className="mt-1 break-all text-[7pt] text-slate-400">{url}</div>
      </div>
    </div>
  );
}
