"use client";

import { useState } from "react";
import { Poster } from "@/components/Poster";

type Item = {
  key: string; url: string; qr: string; filename: string;
  branchEn: string; branchAr: string; locEn: string; locAr: string;
};

export default function QrGrid({ items }: { items: Item[] }) {
  const [preview, setPreview] = useState<Item | null>(null);

  if (preview) {
    return (
      <div>
        <div className="no-print mb-4 flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)}>
            ← Back
          </button>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            Print this poster
          </button>
        </div>
        <div className="overflow-x-auto">
          <div className="card p-4">
            <Poster {...preview} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <div key={it.key} className="card p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.qr} alt={`QR for ${it.locEn}`} className="mx-auto h-40 w-40" />
          <div className="mt-3 text-sm font-semibold text-slate-800">{it.locEn}</div>
          <div dir="rtl" className="text-xs text-slate-500">{it.locAr}</div>
          <div className="mt-1 break-all text-[10px] text-slate-400">{it.url}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <a href={it.qr} download={it.filename} className="btn btn-ghost py-2 text-xs">
              Download PNG
            </a>
            <button
              type="button"
              className="btn btn-primary py-2 text-xs"
              onClick={() => setPreview(it)}
            >
              Poster
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
