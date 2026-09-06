"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Small entrance primitive used across static pages.
 *
 * Deliberately animates on MOUNT rather than on scroll. An earlier version
 * used whileInView, which gates visibility on IntersectionObserver firing —
 * and anything that renders the page offscreen or without a live viewport
 * (crawlers, screenshot services, embedded webviews) then leaves the whole
 * page stuck at opacity 0. Content should never be invisible because an
 * observer did not run. The page is short enough that staggered mount
 * animation reads the same to a human and cannot fail open.
 *
 * Motion is confined to opacity and a few pixels of travel, and
 * prefers-reduced-motion renders the final state with no animation at all.
 */
export function Reveal({
  children,
  delay = 0,
  y = 12,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
