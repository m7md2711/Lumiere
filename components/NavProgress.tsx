"use client";

import { useSyncExternalStore } from "react";
import { navSnapshot, subscribeNav } from "./nav-progress";

/**
 * A thin gold bar across the top while a page is on its way. It creeps rather
 * than filling, because the real duration is unknown and a bar that reaches
 * the end and waits is worse than no bar at all.
 */
export default function NavProgress() {
  const busy = useSyncExternalStore(subscribeNav, navSnapshot, () => false);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
      style={{ opacity: busy ? 1 : 0, transition: "opacity .25s ease .1s" }}
    >
      <div
        className="h-full bg-gradient-to-r from-clinic-400 via-clinic-600 to-clinic-800"
        style={{
          width: busy ? "92%" : "0%",
          transition: busy ? "width 9s cubic-bezier(.08,.82,.17,1)" : "width .2s ease",
        }}
      />
    </div>
  );
}
