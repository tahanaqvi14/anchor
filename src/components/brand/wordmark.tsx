/**
 * The mark is a position on a number line, not a boat anchor — a range
 * with one point committed to. It is the whole product in eight vectors.
 */
export function AnchorMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* the range */}
      <path
        d="M2 15h20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.35"
      />
      {/* range endpoints */}
      <path d="M2 12v6M22 12v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      {/* the anchored position */}
      <path d="M8.5 6v13" stroke="var(--brass)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="8.5" cy="4.25" r="2.25" fill="var(--brass)" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <AnchorMark className="h-[1.15em] w-[1.15em] shrink-0 text-ink" />
      <span className="display text-[1.15em] font-semibold tracking-[-0.03em]">
        Anchor
      </span>
    </span>
  );
}
