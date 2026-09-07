import { money } from "@/components/ui/primitives";

/**
 * The Position Track.
 *
 * A negotiation is two numbers and the distance between them, and until now
 * nothing in this interface drew that distance — the product's entire
 * subject was rendered as text in a corner. This is the signature device:
 * one horizontal axis running from where they opened to where you want to
 * be, with ground gained filled in brass and ground still to take left in
 * steel.
 *
 * It is deliberately the same component everywhere — the chat header, the
 * report verdict, every row of history — so the reader learns to parse one
 * shape once and then reads every screen faster. Nothing generic can be
 * substituted for it, because no other product has this axis.
 */
export function PositionTrack({
  anchor,
  current,
  target,
  unit,
  unitSuffix,
  size = "md",
  showLabels = true,
}: {
  /** Where the opponent opened. */
  anchor: number;
  /** Where the opponent stands now. */
  current: number;
  /** What the user is trying to reach. */
  target: number;
  unit: string;
  unitSuffix: string | null;
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
}) {
  const span = Math.abs(target - anchor);
  // A zero span means the setup was degenerate; render an empty axis rather
  // than dividing by zero and producing NaN widths.
  const progress = span === 0 ? 0 : Math.min(1, Math.max(0, Math.abs(current - anchor) / span));
  const pct = Math.round(progress * 100);

  const heights = { sm: "h-1", md: "h-1.5", lg: "h-2" } as const;
  const figures = { sm: "text-[12px]", md: "text-[14px]", lg: "text-[17px]" } as const;

  return (
    <div className="w-full">
      {showLabels && (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="label">Opened</p>
            <p className={`tnum mt-0.5 text-ink-muted ${figures[size]}`}>
              {money(anchor, unit, unitSuffix)}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="label">Target</p>
            <p className={`tnum mt-0.5 font-medium text-brass ${figures[size]}`}>
              {money(target, unit, unitSuffix)}
            </p>
          </div>
        </div>
      )}

      <div className="relative">
        {/* Ground still to take. */}
        <div className={`w-full ${heights[size]} bg-steel/25`} />

        {/* Ground gained, measured from the opening anchor. */}
        <div
          className={`absolute inset-y-0 left-0 ${heights[size]} bg-brass transition-[width] duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />

        {/* The live position. A hard marker, not a soft dot: this is the
            number under negotiation and it should read as a reading on an
            instrument. */}
        <div
          className="absolute -top-1 bottom-[-0.25rem] w-0.5 bg-ink transition-[left] duration-700 ease-out"
          style={{ left: `calc(${pct}% - 1px)` }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className={`tnum font-medium text-ink ${figures[size]}`}>
          {money(current, unit, unitSuffix)}
        </p>
        <p className="label tabular-nums">
          {pct}% of the gap closed
        </p>
      </div>
    </div>
  );
}

/** Compact variant for dense lists — the axis alone, no figures. */
export function PositionTrackMini({
  anchor,
  current,
  target,
}: {
  anchor: number;
  current: number;
  target: number;
}) {
  const span = Math.abs(target - anchor);
  const pct = span === 0 ? 0 : Math.round(Math.min(1, Math.abs(current - anchor) / span) * 100);

  return (
    <div className="relative h-1 w-full min-w-16 bg-steel/25" aria-hidden="true">
      <div className="absolute inset-y-0 left-0 bg-brass" style={{ width: `${pct}%` }} />
    </div>
  );
}
