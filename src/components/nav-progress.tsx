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
 * internal links. Crucially, whether the bar is showing is DERIVED from
 * comparing the pending path against the current one rather than cleared by
 * an effect: when the navigation lands, `pathname` becomes the pending path
 * and the bar switches off on its own. No effect writes state, so there is
 * no cascading render and no way for the two to disagree.
 */
export function NavProgress() {
  const pathname = usePathname();

  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const timers = useRef<number[]>([]);

  // Derived, never assigned from an effect.
  const active = armed && pendingPath !== null && pendingPath !== pathname;

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
      setPendingPath(url.pathname);
      setArmed(false);

      // A short delay keeps instant, prefetched navigations from flashing a
      // bar that appears and vanishes, which reads as a glitch.
      timers.current.push(window.setTimeout(() => setArmed(true), 80));
      // Hard stop. A bar that sticks at 90% because a navigation was
      // cancelled is worse than never showing one at all.
      timers.current.push(
        window.setTimeout(() => {
          setArmed(false);
          setPendingPath(null);
        }, 10_000),
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
