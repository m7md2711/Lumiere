/* eslint-disable @next/next/no-img-element */

/**
 * The clinic's own wordmark, served from /lumiere-logo.svg. It carries its own
 * gold gradient, so it is used as an image rather than recoloured.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  // The asset is 170×55; keep that ratio and let `size` drive the height.
  return (
    <img
      src="/lumiere-logo.svg"
      alt="Lumiere Clinic & Cosmetix"
      width={Math.round((size * 170) / 55)}
      height={size}
      style={{ height: size, width: "auto" }}
      className="select-none"
    />
  );
}

export function Wordmark({ label, sub }: { label?: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={38} />
      {sub ? (
        <div className="border-s border-slate-300 ps-3 leading-tight">
          <div className="text-xs text-slate-500">{sub}</div>
        </div>
      ) : null}
    </div>
  );
}
