"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChart, IconList, IconQr, IconBuilding, IconGear, IconNote, IconChat, IconCalendar } from "@/components/Icons";

const items = [
  { href: "/admin/cases", label: "Cases", Icon: IconList },
  { href: "/admin/logged", label: "By staff", Icon: IconChat },
  { href: "/admin/follow-up", label: "Follow-up", Icon: IconCalendar },
  { href: "/admin/new-case", label: "Raise", Icon: IconNote },
  { href: "/admin/dashboard", label: "Dashboard", Icon: IconChart },
  { href: "/admin/branches", label: "Branches", Icon: IconBuilding },
  { href: "/admin/qr", label: "QR", Icon: IconQr },
  { href: "/admin/settings", label: "Settings", Icon: IconGear },
];

export default function NavLinks({
  variant, role,
}: {
  variant: "sidebar" | "tabs";
  role: "admin" | "branch" | "call_center";
}) {
  const path = usePathname();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  // Branch staff get their cases and their numbers; the rest is clinic-wide.
  const allowed: Record<string, string[]> = {
    admin: items.map((i) => i.href),
    branch: ["/admin/cases", "/admin/logged", "/admin/follow-up", "/admin/new-case", "/admin/dashboard"],
    // The call centre raises complaints and follows the ones it raised.
    call_center: ["/admin/logged", "/admin/new-case"],
  };
  const visible = items.filter((i) => (allowed[role] ?? allowed.branch).includes(i.href));

  if (variant === "tabs") {
    return (
      <div
        className="grid pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0,1fr))` }}
      >
        {visible.map((it) => (
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
      {visible.map((it) => (
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
