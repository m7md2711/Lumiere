"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin/cases", label: "Cases", icon: "📋" },
  { href: "/admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/admin/branches", label: "Branches", icon: "🏥" },
  { href: "/admin/qr", label: "QR", icon: "🔳" },
];

export default function NavLinks({ variant }: { variant: "sidebar" | "tabs" }) {
  const path = usePathname();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  if (variant === "tabs") {
    return (
      <div className="grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={[
              "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
              isActive(it.href) ? "text-clinic-700" : "text-slate-400",
            ].join(" ")}
          >
            <span aria-hidden className="text-lg leading-none">{it.icon}</span>
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
          <span aria-hidden>{it.icon}</span>
          {it.label}
        </Link>
      ))}
    </div>
  );
}
