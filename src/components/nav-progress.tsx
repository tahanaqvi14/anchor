"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Top-of-page navigation progress bar.
 *
 * Route-level loading.tsx covers the body of a page, but there is still a
 * gap between the click and React swapping in that skeleton — long enough
 * on a cold serverless function to read as "nothing happened", which is the
 * feeling this exists to remove.
 *
 * The App Router exposes no router-event API, so this listens for clicks on
 * internal links. Whether the bar shows is DERIVED rather than cleared by an
 * effect, so no effect writes state and the two can never disagree.
 *
 * It tracks the path the click STARTED from, not the path it was aimed at.
 * An earlier version compared against the destination and hung whenever a
 * navigation was redirected — clicking "Create an account" while already
 * signed in is bounced from /signup to /practice, so the bar waited forever
 * for a /signup that never arrived. Leaving the current page is the thing
 * being waited on, and that is what is measured.
 */
export function NavProgress() {
  const pathname = usePathname();

  const [fromPath, setFromPath] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const timers = useRef<number[]>([]);

  // Derived, never assigned from an effect. Still on the page the click
  // started from means the navigation is still in flight; landing anywhere
  // else — including a redirect target — ends it.
  const active = armed && fromPath !== null && pathname === fromPath;

  useEffect(() => {
    function clearTimers() {
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    }

    function onClick(event: MouseEvent) {
      // Leave anything that is not a plain left click on a same-tab internal
      // link to the browser.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // nothing to wait for

      clearTimers();
      setFromPath(window.location.pathname);
      setArmed(false);

      // A short delay keeps instant, prefetched navigations from flashing a
      // bar that appears and vanishes, which reads as a glitch.
      timers.current.push(window.setTimeout(() => setArmed(true), 80));
      // Hard stop, for a navigation that is cancelled or that redirects
      // straight back to where it started. A bar stuck at 90% is worse than
      // no bar at all.
      timers.current.push(
        window.setTimeout(() => {
          setArmed(false);
          setFromPath(null);
        }, 8_000),
      );
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      clearTimers();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 transition-opacity duration-200 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Eases out fast then creeps to 90% and waits: the bar must never
          imply completion the page has not actually reached. */}
      <div
        className={
          active
            ? "h-full bg-brass animate-[nav-progress_2.4s_cubic-bezier(0.2,0.8,0.2,1)_forwards]"
            : "h-full w-0 bg-brass"
        }
      />
    </div>
  );
}
