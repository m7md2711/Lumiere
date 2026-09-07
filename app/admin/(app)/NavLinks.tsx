"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChart, IconList, IconQr, IconBuilding, IconGear } from "@/components/Icons";

const items = [
  { href: "/admin/cases", label: "Cases", Icon: IconList },
  { href: "/admin/dashboard", label: "Dashboard", Icon: IconChart },
  { href: "/admin/branches", label: "Branches", Icon: IconBuilding },
  { href: "/admin/qr", label: "QR", Icon: IconQr },
  { href: "/admin/settings", label: "Settings", Icon: IconGear },
];

export default function NavLinks({ variant }: { variant: "sidebar" | "tabs" }) {
  const path = usePathname();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  if (variant === "tabs") {
    return (
      <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={[
              "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
              isActive(it.href) ? "text-clinic-700" : "text-slate-400",
            ].join(" ")}
          >
            <it.Icon className="h-[22px] w-[22px]" />
            {it.label}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={[
            "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium",
            isActive(it.href)
              ? "bg-clinic-50 text-clinic-800"
              : "text-slate-600 hover:bg-slate-50",
          ].join(" ")}
        >
          <it.Icon className="h-[18px] w-[18px]" />
          {it.label}
        </Link>
      ))}
    </div>
  );
}
