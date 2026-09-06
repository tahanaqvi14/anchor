"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ProgressPoint {
  index: number;
  label: string;
  score: number;
  scenario: string;
  persona: string;
}

/**
 * Score trend across completed sessions.
 *
 * Colours are CSS custom properties rather than literals so the chart
 * follows the theme toggle without re-rendering, and the axis domain is
 * pinned to 0-100 so a run of good scores does not silently rescale and
 * flatten the very trend the chart exists to show.
 */
export function ProgressChart({ data }: { data: ProgressPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
          <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--ink-faint)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--rule)" }}
            minTickGap={16}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fill: "var(--ink-faint)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: "var(--rule-strong)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ProgressPoint;
              return (
                <div className="rounded-lg border border-rule bg-paper-raised px-3 py-2 shadow-[var(--shadow-md)]">
                  <p className="text-[12.5px] font-medium text-ink">{p.scenario}</p>
                  <p className="text-[11.5px] text-ink-muted">vs {p.persona}</p>
                  <p className="tnum mt-1 text-[15px] font-medium text-brass">{p.score}</p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--brass)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--brass)", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "var(--brass)", strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
