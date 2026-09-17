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
        background: "#080808",
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
          borderImage: "linear-gradient(140deg,#8a7340,#c9a84c,#e4cc8a,#8a7340) 1",
        }}
      />

      <div className="relative flex flex-col items-center gap-3">
        <LogoMark size={58} />
        <div
          style={{
            width: "34mm", height: "0.35mm",
            background: "linear-gradient(90deg,transparent,#8a7340,#c9a84c,#8a7340,transparent)",
          }}
        />
      </div>

      <div className="relative w-full">
        <h1
          style={{
            fontSize: "19pt", fontWeight: 800, lineHeight: 1.15,
            letterSpacing: "0.18em", textTransform: "uppercase",
            background: "linear-gradient(100deg,#e4cc8a,#c9a84c,#8a7340)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}
        >
          Your experience matters
        </h1>
        <p style={{ marginTop: "2.5mm", fontSize: "10pt", lineHeight: 1.45, color: "#a89364" }}>
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
            background: "linear-gradient(100deg,#e4cc8a,#c9a84c,#8a7340)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}
        >
          تجربتكم تهمنا
        </h2>
        <p style={{ marginTop: "2.5mm", fontSize: "10pt", lineHeight: 1.5, color: "#a89364" }}>
          شاركونا ملاحظاتكم أو اقتراحاتكم أو ما يشغلكم — امسحوا الرمز هنا
        </p>
      </div>

      <div className="relative w-full">
        <div
          style={{
            height: "0.3mm", marginBottom: "2.5mm",
            background: "linear-gradient(90deg,transparent,#3a3226,transparent)",
          }}
        />
        <div style={{ fontSize: "9.5pt", fontWeight: 600, color: "#c9a84c" }}>
          {branchEn} · {locEn}
        </div>
        <div dir="rtl" style={{ fontSize: "8.5pt", color: "#8a7340" }}>
          {branchAr} · {locAr}
        </div>
        <div style={{ marginTop: "1mm", fontSize: "6.5pt", color: "#4a4335", wordBreak: "break-all" }}>
          {url}
        </div>
      </div>
    </div>
  );
}
