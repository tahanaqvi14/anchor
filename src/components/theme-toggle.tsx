"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "anchor-theme";

/**
 * The theme lives on <html> as a class, applied by the pre-paint script in
 * the root layout. That makes it external state, so it is read with
 * useSyncExternalStore rather than mirrored into useState from an effect —
 * which would cause a cascading render and drift if anything else ever
 * changed the class.
 *
 * getServerSnapshot returning false is what keeps hydration clean: React
 * renders the light-mode label on the server, then re-reads the real DOM
 * value immediately after hydrating, with no attribute mismatch warning.
 */
function subscribe(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private mode or blocked storage — the theme still applies to this
      // page view, it just will not be remembered.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      className={`grid size-9 place-items-center rounded-full border border-rule text-ink-muted transition-colors hover:border-rule-strong hover:text-ink ${className}`}
    >
      {/* Both icons are always in the DOM; the dark: variant decides which
          one paints, so the button is correct on first paint even before
          React has hydrated. */}
      <Sun className="size-4 dark:hidden" strokeWidth={1.75} />
      <Moon className="hidden size-4 dark:block" strokeWidth={1.75} />
    </button>
  );
}
