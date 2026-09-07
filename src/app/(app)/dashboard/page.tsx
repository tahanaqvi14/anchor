import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Swords, TrendingUp } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PERSONAS, isPersonaKey } from "@/lib/personas";
import { ProgressChart } from "@/components/dashboard/progress-chart";
import type { ProgressPoint } from "@/components/dashboard/progress-chart";
import { EmptyState, LinkButton, money } from "@/components/ui/primitives";
import { PositionTrackMini } from "@/components/position-track";

export const metadata: Metadata = { title: "Your progress" };

const OUTCOME_LABEL: Record<string, string> = {
  deal: "Deal",
  no_deal: "No deal",
  user_walked: "You walked",
  ai_walked: "They walked",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*, scenarios(title, unit, unit_suffix)")
    .order("started_at", { ascending: false })
    .limit(60);

  const rows = sessions ?? [];
  const completed = rows.filter((s) => s.status !== "active" && s.score !== null);

  // Oldest first, so the trend reads left to right the way a reader expects.
  const points: ProgressPoint[] = [...completed]
    .reverse()
    .map((s, i) => ({
      index: i,
      label: new Date(s.started_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      score: s.score ?? 0,
      scenario:
        (s.scenarios as { title?: string } | null)?.title ?? "Negotiation",
      persona: isPersonaKey(s.persona_key)
        ? PERSONAS[s.persona_key].shortName
        : s.persona_key,
    }));

  const average = completed.length
    ? Math.round(completed.reduce((a, s) => a + (s.score ?? 0), 0) / completed.length)
    : null;
  const best = completed.length ? Math.max(...completed.map((s) => s.score ?? 0)) : null;
  const deals = completed.filter((s) => s.outcome === "deal").length;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="index">LOG</span>
            <span className="h-px w-8 bg-rule-strong" />
            <span className="label">Your progress</span>
          </div>
          <h1 className="display-xl mt-5 text-[clamp(2rem,5vw,3.2rem)]">
            {completed.length === 0
              ? "Nothing to measure yet."
              : `${completed.length} negotiation${completed.length === 1 ? "" : "s"} behind you.`}
          </h1>
        </div>
        <LinkButton href="/practice">
          <Swords className="size-4" strokeWidth={1.75} />
          New negotiation
        </LinkButton>
      </div>

      {completed.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<TrendingUp className="size-5" strokeWidth={1.75} />}
            title="Your first result goes here"
            body="Finish a negotiation and this becomes a score trend. The point is to watch it move — one session tells you very little, six tell you what you keep doing wrong."
            action={<LinkButton href="/practice">Start your first one</LinkButton>}
          />
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <Stat label="Average score" value={average} />
            <Stat label="Best" value={best} />
            <Stat label="Deals closed" value={deals} suffix={` / ${completed.length}`} />
          </div>

          <section className="mt-10 border-t border-rule pt-6">
            <h2 className="label label-strong mb-5">Score over time</h2>
            {points.length === 1 ? (
              <p className="py-10 text-center text-[13.5px] text-ink-muted">
                One result is a data point, not a trend. Run a couple more and this becomes
                useful.
              </p>
            ) : (
              <ProgressChart data={points} />
            )}
          </section>
        </>
      )}

      <section className="mt-10">
        <h2 className="label label-strong mb-5 border-b border-rule-strong pb-2.5">History</h2>

        {rows.length === 0 ? (
          <p className="text-[14px] text-ink-muted">Nothing here yet.</p>
        ) : (
          <div className="border-b border-rule">
            {rows.map((s, i) => {
              const scenario = s.scenarios as {
                title?: string;
                unit?: string;
                unit_suffix?: string | null;
              } | null;
              const active = s.status === "active";
              return (
                <Link
                  key={s.id}
                  href={active ? `/session/${s.id}` : `/session/${s.id}/report`}
                  className={`group flex flex-wrap items-center gap-x-5 gap-y-2 py-4 transition-colors hover:bg-paper-sunken ${
                    i > 0 ? "border-t border-rule" : ""
                  }`}
                >
                  <span className="index w-8 shrink-0">
                    {String(rows.length - i).padStart(2, "0")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink">
                      {scenario?.title ?? "Negotiation"}
                    </p>
                    <p className="label mt-1 truncate">
                      {isPersonaKey(s.persona_key)
                        ? PERSONAS[s.persona_key].shortName
                        : s.persona_key}
                      {" · "}
                      {new Date(s.started_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* The same axis as everywhere else, so a row of history
                      reads at a glance as ground taken versus ground left. */}
                  {!active && s.opening_anchor !== null && s.target_value !== null && (
                    <div className="hidden w-28 shrink-0 md:block">
                      <PositionTrackMini
                        anchor={s.opening_anchor}
                        current={s.final_value ?? s.opening_anchor}
                        target={s.target_value}
                      />
                    </div>
                  )}

                  {active ? (
                    <span className="label bg-brass-wash px-2 py-1 text-brass">In progress</span>
                  ) : (
                    <>
                      <div className="hidden text-right sm:block">
                        <p className="label">
                          {OUTCOME_LABEL[s.outcome ?? ""] ?? "—"}
                        </p>
                        {s.final_value !== null && (
                          <p className="tnum text-[12.5px] text-ink-faint">
                            {money(s.final_value, scenario?.unit ?? "USD", scenario?.unit_suffix)}
                          </p>
                        )}
                      </div>
                      <span className="tnum w-11 text-right text-[20px] font-medium text-ink">
                        {s.score ?? "—"}
                      </span>
                    </>
                  )}
                  <ArrowUpRight className="size-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | null;
  suffix?: string;
}) {
  return (
    <div className="border-t-2 border-rule-strong pt-4">
      <p className="label">{label}</p>
      <p className="tnum mt-3 text-[2.6rem] font-medium leading-none text-ink">
        {value ?? "—"}
        {suffix && <span className="text-[1rem] text-ink-faint">{suffix}</span>}
      </p>
    </div>
  );
}
