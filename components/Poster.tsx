import { LogoMark } from "./Logo";

/**
 * A5 poster in the clinic's gold-on-black brand. Sizing is in millimetres so a
 * print lands at true A5 whatever screen it was laid out on.
 *
 * The QR sits on a white tile rather than the black ground: inverted codes
 * (light modules on dark) fail on a lot of phone scanners, and a poster that
 * will not scan is worthless however good it looks.
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
      className="poster relative mx-auto flex flex-col items-center justify-between overflow-hidden text-center"
      style={{
        width: "148mm",
        height: "210mm",
        background: "#0a0806",
        padding: "11mm",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/* Inset gold rule */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: "5mm",
          border: "0.4mm solid transparent",
          borderImage: "linear-gradient(140deg,#c9a227,#f7e7b0,#c9a227,#6b5520) 1",
        }}
      />

      <div className="relative flex flex-col items-center gap-3">
        <LogoMark size={58} />
        <div
          style={{
            width: "34mm", height: "0.35mm",
            background: "linear-gradient(90deg,transparent,#c9a227,#f7e7b0,#c9a227,transparent)",
          }}
        />
      </div>

      <div className="relative w-full">
        <h1
          style={{
            fontSize: "19pt", fontWeight: 800, lineHeight: 1.15,
            letterSpacing: "0.04em", textTransform: "uppercase",
            background: "linear-gradient(100deg,#f7e7b0,#e3c46a,#c9a227)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}
        >
          Your experience matters
        </h1>
        <p style={{ marginTop: "2.5mm", fontSize: "10pt", lineHeight: 1.45, color: "#c0b39a" }}>
          Share your feedback, suggestion, or concern with us. | Scan here
        </p>
      </div>

      {/* White tile keeps the code scannable on a black poster. */}
      <div
        className="relative"
        style={{ background: "#fff", padding: "4mm", borderRadius: "3mm" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr}
          alt={`QR code for ${branchEn} ${locEn}`}
          style={{ width: "55mm", height: "55mm", display: "block" }}
        />
      </div>

      <div className="relative w-full" dir="rtl">
        <h2
          style={{
            fontSize: "19pt", fontWeight: 800, lineHeight: 1.3,
            background: "linear-gradient(100deg,#f7e7b0,#e3c46a,#c9a227)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}
        >
          تجربتكم تهمنا
        </h2>
        <p style={{ marginTop: "2.5mm", fontSize: "10pt", lineHeight: 1.5, color: "#c0b39a" }}>
          شاركونا ملاحظاتكم أو اقتراحاتكم أو ما يشغلكم — امسحوا الرمز هنا
        </p>
      </div>

      <div className="relative w-full">
        <div
          style={{
            height: "0.3mm", marginBottom: "2.5mm",
            background: "linear-gradient(90deg,transparent,#6b5520,transparent)",
          }}
        />
        <div style={{ fontSize: "9.5pt", fontWeight: 600, color: "#e3c46a" }}>
          {branchEn} · {locEn}
        </div>
        <div dir="rtl" style={{ fontSize: "8.5pt", color: "#a2957e" }}>
          {branchAr} · {locAr}
        </div>
        <div style={{ marginTop: "1mm", fontSize: "6.5pt", color: "#5a5040", wordBreak: "break-all" }}>
          {url}
        </div>
      </div>
    </div>
  );
}
