import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Swords, TrendingUp } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { PERSONAS, isPersonaKey } from "@/lib/personas";
import { ProgressChart } from "@/components/dashboard/progress-chart";
import type { ProgressPoint } from "@/components/dashboard/progress-chart";
import { EmptyState, LinkButton, money } from "@/components/ui/primitives";

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
          <p className="eyebrow">Your progress</p>
          <h1 className="display mt-2 text-[clamp(1.9rem,4.5vw,2.6rem)] font-semibold">
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
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Stat label="Average score" value={average} />
            <Stat label="Best" value={best} />
            <Stat label="Deals closed" value={deals} suffix={` / ${completed.length}`} />
          </div>

          <section className="mt-6 rounded-xl border border-rule bg-paper-raised p-5 sm:p-6">
            <h2 className="eyebrow mb-4">Score over time</h2>
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
        <h2 className="eyebrow mb-4">History</h2>

        {rows.length === 0 ? (
          <p className="text-[14px] text-ink-muted">Nothing here yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-rule">
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
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 bg-paper-raised px-4 py-3.5 transition-colors hover:bg-paper-sunken sm:px-5 ${
                    i > 0 ? "border-t border-rule" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-medium text-ink">
                      {scenario?.title ?? "Negotiation"}
                    </p>
                    <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">
                      {isPersonaKey(s.persona_key)
                        ? PERSONAS[s.persona_key].title
                        : s.persona_key}
                      {" · "}
                      {new Date(s.started_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {active ? (
                    <span className="rounded-full bg-brass-wash px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brass">
                      In progress
                    </span>
                  ) : (
                    <>
                      <div className="hidden text-right sm:block">
                        <p className="text-[12.5px] text-ink-muted">
                          {OUTCOME_LABEL[s.outcome ?? ""] ?? "—"}
                        </p>
                        {s.final_value !== null && (
                          <p className="tnum text-[12.5px] text-ink-faint">
                            {money(s.final_value, scenario?.unit ?? "USD", scenario?.unit_suffix)}
                          </p>
                        )}
                      </div>
                      <span className="tnum w-10 text-right text-[17px] font-medium text-ink">
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
    <div className="rounded-xl border border-rule bg-paper-raised p-5">
      <p className="eyebrow">{label}</p>
      <p className="tnum mt-1.5 text-[1.9rem] font-medium leading-none text-ink">
        {value ?? "—"}
        {suffix && <span className="text-[1rem] text-ink-faint">{suffix}</span>}
      </p>
    </div>
  );
}
