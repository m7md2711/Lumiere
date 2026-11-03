"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AppLink from "@/components/AppLink";
import ThemeToggle from "@/components/ThemeToggle";
import { LogoMark } from "@/components/Logo";
import {
  IconAnalysis, IconBell, IconBuilding, IconCalendar, IconChart, IconChat, IconChevronsLeft, IconEye, IconGear,
  IconKey, IconList, IconLogout, IconMenu, IconPlus, IconQr, IconSearch,
} from "@/components/Icons";

type Role = "admin" | "branch" | "call_center" | "viewer";
type Counts = { open: number; followDue: number; review: number; overdue: number };

type Item = {
  href: string;
  label: string;
  Icon: (p: { className?: string }) => React.ReactElement;
  badge?: (c: Counts) => number;
  roles: Role[];
};

const groups: { title: string; items: Item[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", Icon: IconChart, roles: ["admin", "branch", "viewer"] },
      { href: "/admin/analysis", label: "Analysis", Icon: IconAnalysis, roles: ["admin", "viewer"] },
    ],
  },
  {
    title: "Cases",
    items: [
      { href: "/admin/cases", label: "All cases", Icon: IconList, badge: (c) => c.open, roles: ["admin", "branch", "viewer"] },
      { href: "/admin/logged", label: "Raised by staff", Icon: IconChat, roles: ["admin", "branch", "call_center", "viewer"] },
      { href: "/admin/follow-up", label: "Follow-up", Icon: IconCalendar, badge: (c) => c.followDue, roles: ["admin", "branch", "viewer"] },
    ],
  },
  {
    title: "Clinic",
    items: [
      { href: "/admin/branches", label: "Branches", Icon: IconBuilding, roles: ["admin"] },
      { href: "/admin/qr", label: "QR codes", Icon: IconQr, roles: ["admin"] },
      { href: "/admin/api", label: "API", Icon: IconKey, roles: ["admin"] },
      { href: "/admin/settings", label: "Settings", Icon: IconGear, roles: ["admin"] },
    ],
  },
];

const SB_COOKIE = "lsc_sb";

export default function Shell({
  role,
  name,
  roleLabel,
  counts,
  collapsedInitially,
  signOut,
  children,
}: {
  role: Role;
  name: string;
  roleLabel: string;
  counts: Counts;
  collapsedInitially: boolean;
  signOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(collapsedInitially);
  const [drawer, setDrawer] = useState(false);

  // Close the drawer whenever the page changes.
  useEffect(() => setDrawer(false), [path]);

  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  const visible = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) }))
    .filter((g) => g.items.length);

  const attention = role === "admin" || role === "viewer" ? counts.overdue + counts.review + counts.followDue : counts.overdue + counts.followDue;
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "LC";

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SB_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  const nav = (compact: boolean) => (
    <nav className="space-y-5">
      {visible.map((g) => (
        <div key={g.title}>
          {!compact ? (
            <div className="mb-1.5 px-3 text-[10px] uppercase tracking-[0.24em] text-slate-400">{g.title}</div>
          ) : (
            <div className="mx-auto mb-2 h-px w-6 bg-slate-200" />
          )}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const on = isActive(it.href);
              const n = it.badge ? it.badge(counts) : 0;
              return (
                <li key={it.href}>
                  <AppLink
                    href={it.href}
                    title={compact ? it.label : undefined}
                    className={[
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                      compact ? "justify-center" : "",
                      on
                        ? "bg-clinic-50 text-clinic-800 ring-1 ring-clinic-300"
                        : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900",
                    ].join(" ")}
                  >
                    {on ? <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-clinic-600" aria-hidden /> : null}
                    <it.Icon className={`h-[18px] w-[18px] shrink-0 ${on ? "text-clinic-600" : ""}`} />
                    {!compact ? <span className="flex-1 truncate">{it.label}</span> : null}
                    {n > 0 ? (
                      <span
                        className={[
                          "tabular inline-flex min-w-[20px] items-center justify-center rounded-full bg-clinic-600 px-1.5 text-[11px] text-ink",
                          compact ? "absolute -right-0.5 -top-0.5 h-4 min-w-[16px] text-[9px]" : "h-5",
                        ].join(" ")}
                      >
                        {n > 99 ? "99+" : n}
                      </span>
                    ) : null}
                  </AppLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const cta = (compact: boolean) => role === "viewer" ? (
    <div
      title={compact ? "View only" : undefined}
      className={`flex items-center justify-center gap-2 rounded-full border border-clinic-300 py-2.5 text-xs uppercase tracking-brand text-clinic-700 ${compact ? "px-0" : "px-4"}`}
    >
      <IconEye className="h-4 w-4" />
      {!compact ? "View only" : null}
    </div>
  ) : (
    <AppLink
      href="/admin/new-case"
      title={compact ? "Raise a complaint" : undefined}
      className={`btn btn-primary w-full ${compact ? "px-0" : ""}`}
    >
      <IconPlus className="h-4 w-4" />
      {!compact ? "Raise a complaint" : null}
    </AppLink>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:flex lg:gap-4 lg:p-4">
      {/* ------------------------------------------------ desktop sidebar */}
      <aside
        className={[
          "no-print sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 flex-col rounded-3xl border border-slate-200 bg-slate-100 shadow-gold transition-[width] duration-300 lg:flex",
          collapsed ? "w-[84px]" : "w-64",
        ].join(" ")}
      >
        <div className={`px-5 pt-6 ${collapsed ? "px-3 text-center" : ""}`}>
          <AppLink href={role === "call_center" ? "/admin/logged" : "/admin/dashboard"} className="inline-block">
            <LogoMark size={collapsed ? 22 : 40} />
          </AppLink>
          {!collapsed ? (
            <div className="mt-3 text-[10px] uppercase tracking-[0.32em] text-clinic-700">Patient feedback</div>
          ) : null}
        </div>

        <div className={`px-4 pt-5 ${collapsed ? "px-3" : ""}`}>{cta(collapsed)}</div>

        <div className={`flex-1 overflow-y-auto px-4 pt-6 ${collapsed ? "px-3" : ""}`}>{nav(collapsed)}</div>

        <div className={`border-t border-slate-200 px-4 py-3 ${collapsed ? "px-3" : ""}`}>
          <button
            type="button"
            onClick={toggleCollapse}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[11px] uppercase tracking-[0.24em] text-slate-500 hover:text-slate-800 ${collapsed ? "justify-center" : ""}`}
            aria-label={collapsed ? "Expand the menu" : "Collapse the menu"}
          >
            <IconChevronsLeft className={`h-4 w-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed ? "Collapse" : null}
          </button>
          {!collapsed ? (
            <div className="mt-2 px-2 text-[11px] text-slate-400">Lumiere Clinic &amp; Cosmetix</div>
          ) : null}
        </div>
      </aside>

      {/* ------------------------------------------------------- main */}
      <div className="min-w-0 flex-1 pb-24 lg:pb-0">
        <TopBar
          name={name}
          roleLabel={roleLabel}
          initials={initials}
          attention={attention}
          signOut={signOut}
          onMenu={() => setDrawer(true)}
          home={role === "call_center" ? "/admin/logged" : "/admin/dashboard"}
        />
        <main className="mx-auto max-w-7xl px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>

      {/* ------------------------------------------------- mobile drawer */}
      {drawer ? (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-label="Close the menu"
                  onClick={() => setDrawer(false)} />
          <div className="drawer-in absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col overflow-y-auto border-r border-slate-200 bg-slate-100 p-5">
            <LogoMark size={36} />
            <div className="mt-3 text-[10px] uppercase tracking-[0.32em] text-clinic-700">Patient feedback</div>
            <div className="mt-5">{cta(false)}</div>
            <div className="mt-6 flex-1">{nav(false)}</div>
            <form action={signOut} className="mt-6 border-t border-slate-200 pt-4">
              <button className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
                <IconLogout className="h-4 w-4" /> Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* -------------------------------------------- mobile bottom bar */}
      <MobileBar role={role} counts={counts} isActive={isActive} onMore={() => setDrawer(true)} />
    </div>
  );
}

function TopBar({
  name, roleLabel, initials, attention, signOut, onMenu, home,
}: {
  name: string; roleLabel: string; initials: string; attention: number;
  signOut: () => Promise<void>; onMenu: () => void; home: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");

  // ⌘K / Ctrl-K puts the cursor in the search box from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-slate-50/85 backdrop-blur-md lg:top-4 lg:mx-6 lg:rounded-2xl lg:border lg:bg-slate-100/80">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onMenu} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-200 lg:hidden" aria-label="Open the menu">
          <IconMenu className="h-5 w-5" />
        </button>
        <AppLink href={home} className="lg:hidden">
          <LogoMark size={22} />
        </AppLink>

        <form
          className="hidden flex-1 md:block"
          onSubmit={(e) => {
            e.preventDefault();
            const v = q.trim();
            router.push(v ? `/admin/cases?q=${encodeURIComponent(v)}` : "/admin/cases");
          }}
        >
          <label className="flex max-w-xl items-center gap-2.5 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-500 focus-within:border-clinic-600">
            <IconSearch className="h-4 w-4 shrink-0" />
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search cases, patients, notes…"
              className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
              dir="auto"
              aria-label="Search cases"
            />
            <kbd className="hidden rounded-md border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline">⌘K</kbd>
          </label>
        </form>

        <div className="ms-auto flex items-center gap-2 sm:gap-3">
          <ThemeToggle compact />
          <AppLink href={home} className="relative rounded-full border border-slate-200 bg-slate-100 p-2 text-slate-600 hover:text-slate-900" aria-label={`${attention} items need attention`}>
            <IconBell className="h-[18px] w-[18px]" />
            {attention > 0 ? (
              <span className="tabular absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-clinic-600 px-1 text-[10px] text-ink">
                {attention > 99 ? "99+" : attention}
              </span>
            ) : null}
          </AppLink>
          <div className="hidden items-center gap-2.5 sm:flex">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-clinic-300 bg-clinic-50 text-xs tracking-wider text-clinic-700">
              {initials}
            </span>
            <span className="hidden leading-tight md:block">
              <span className="block max-w-[160px] truncate text-sm text-slate-900">{name}</span>
              <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-500">{roleLabel}</span>
            </span>
          </div>
          <form action={signOut} className="hidden lg:block">
            <button className="rounded-full p-2 text-slate-500 hover:text-slate-900" aria-label="Sign out" title="Sign out">
              <IconLogout className="h-[18px] w-[18px]" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function MobileBar({
  role, counts, isActive, onMore,
}: {
  role: Role;
  counts: Counts;
  isActive: (href: string) => boolean;
  onMore: () => void;
}) {
  const items =
    role === "call_center"
      ? [
          { href: "/admin/logged", label: "My cases", Icon: IconChat, n: 0 },
          { href: "/admin/new-case", label: "Raise", Icon: IconPlus, n: 0 },
        ]
      : role === "viewer"
      ? [
          { href: "/admin/dashboard", label: "Dashboard", Icon: IconChart, n: 0 },
          { href: "/admin/cases", label: "Cases", Icon: IconList, n: counts.open },
          { href: "/admin/analysis", label: "Analysis", Icon: IconAnalysis, n: 0 },
          { href: "/admin/follow-up", label: "Follow-up", Icon: IconCalendar, n: counts.followDue },
        ]
      : [
          { href: "/admin/dashboard", label: "Dashboard", Icon: IconChart, n: 0 },
          { href: "/admin/cases", label: "Cases", Icon: IconList, n: counts.open },
          { href: "/admin/new-case", label: "Raise", Icon: IconPlus, n: 0 },
          { href: "/admin/follow-up", label: "Follow-up", Icon: IconCalendar, n: counts.followDue },
        ];

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-slate-100/95 backdrop-blur-md lg:hidden">
      <div className="grid pb-[env(safe-area-inset-bottom)]" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0,1fr))` }}>
        {items.map((it) => {
          const on = isActive(it.href);
          return (
            <AppLink key={it.href} href={it.href}
                     className={`relative flex flex-col items-center gap-1 py-2.5 text-[10px] uppercase tracking-wider ${on ? "text-clinic-700" : "text-slate-500"}`}>
              <it.Icon className="h-[22px] w-[22px]" />
              {it.label}
              {it.n > 0 ? (
                <span className="tabular absolute right-[calc(50%-20px)] top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-clinic-600 px-1 text-[9px] text-ink">
                  {it.n > 99 ? "99+" : it.n}
                </span>
              ) : null}
            </AppLink>
          );
        })}
        <button type="button" onClick={onMore} className="flex flex-col items-center gap-1 py-2.5 text-[10px] uppercase tracking-wider text-slate-500">
          <IconMenu className="h-[22px] w-[22px]" />
          More
        </button>
      </div>
    </nav>
  );
}
