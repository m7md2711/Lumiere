"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { endNav, startNav } from "./nav-progress";

/**
 * A link that knows it was clicked. Next renders these pages on demand, so
 * between the tap and the new screen there was nothing at all — the app read
 * as slow when it was simply quiet. This holds a pending state for as long as
 * the navigation actually takes, rather than guessing with a timer.
 *
 * Modified clicks (new tab, download, middle button) fall through to the
 * browser untouched.
 */
export default function AppLink({
  href,
  children,
  className = "",
  busyClassName = "is-navigating",
  ...rest
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  busyClassName?: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className">) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Symmetric by construction: the cleanup runs when pending clears or the
  // link unmounts, so the counter cannot drift.
  useEffect(() => {
    if (!pending) return;
    startNav();
    return endNav;
  }, [pending]);

  return (
    <Link
      {...rest}
      href={href}
      className={`${className} ${pending ? busyClassName : ""}`}
      aria-busy={pending || undefined}
      onClick={(e) => {
        rest.onClick?.(e);
        if (e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        startTransition(() => router.push(href));
      }}
    >
      {children}
    </Link>
  );
}
