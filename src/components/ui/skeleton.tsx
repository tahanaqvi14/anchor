import type { CSSProperties, ReactNode } from "react";

/**
 * Loading placeholders.
 *
 * These are shaped like the content they stand in for rather than being
 * generic spinners: a page that resolves into roughly the layout it was
 * already showing feels fast, whereas a centred spinner replaced by a full
 * page reads as two separate waits. Next streams these the instant a
 * navigation starts, so they appear before any server work finishes.
 */

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-rule ${className}`}
      style={{ animationDuration: "1.4s", ...style }}
    />
  );
}

/** Wraps a route skeleton and announces the wait to screen readers, which
 *  get nothing from the visual shimmer. */
export function LoadingRegion({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-rule bg-paper-raised p-5">
      <Skeleton className="h-5 w-2/5" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          // Ragged widths read as prose; equal bars read as a table.
          <Skeleton key={i} className="h-3" style={{ width: `${92 - i * 14}%` }} />
        ))}
      </div>
    </div>
  );
}
