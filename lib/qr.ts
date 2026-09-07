import QRCode from "qrcode";

export function formUrl(branchCode: string, locationCode: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/f/${branchCode}?loc=${locationCode}`;
}

/** A data URL, so posters print without a second network round trip. */
export async function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 640,
    // Dark modules on white: an inverted QR fails on many phone scanners.
    color: { dark: "#0a0806", light: "#ffffff" },
  });
}
