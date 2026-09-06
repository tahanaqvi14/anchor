"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, Quote, RefreshCw, Target } from "lucide-react";

import { Button, ErrorNote, LinkButton, money } from "@/components/ui/primitives";
import type {
  FeedbackReportRow,
  ReportAlternative,
  ReportCitation,
} from "@/lib/supabase/database.types";
import type { RoomMessage } from "./negotiation-room";

/** Prose fields go through Markdown so emphasis and lists survive, but the
 *  element set is deliberately tiny — a report is not a document. */
function Prose({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-[14.5px] leading-relaxed text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="text-pretty">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          code: ({ children }) => (
            <code className="tnum rounded bg-paper-sunken px-1 py-0.5 text-[13px]">{children}</code>
          ),
          a: ({ children }) => <span>{children}</span>,
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}

export function ReportView({
  report,
  messages,
  scenarioTitle,
  personaTitle,
  unit,
  unitSuffix,
  target,
  finalValue,
  outcome,
}: {
  report: FeedbackReportRow;
  messages: RoomMessage[];
  scenarioTitle: string;
  personaTitle: string;
  unit: string;
  unitSuffix: string | null;
  target: number;
  finalValue: number | null;
  outcome: string | null;
}) {
  const reduced = useReducedMotion();
  const rise = (i: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] as const },
        };

  function jumpTo(seq: number) {
    const el = document.getElementById(`t-${seq}`);
    if (!el) return;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    el.classList.add("ring-2", "ring-brass");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-brass"), 1600);
  }

  const outcomeLabel =
    outcome === "deal"
      ? finalValue !== null
        ? `Deal at ${money(finalValue, unit, unitSuffix)}`
        : "Deal agreed"
      : outcome === "user_walked"
        ? "You walked away"
        : outcome === "ai_walked"
          ? "They walked away"
          : "No deal";

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      {/* Verdict */}
      <motion.header {...rise(0)}>
        <p className="eyebrow">
          {scenarioTitle} &middot; {personaTitle}
        </p>
        <h1 className="display mt-3 text-[clamp(1.8rem,4.5vw,2.6rem)] font-semibold text-balance">
          {report.headline}
        </h1>
      </motion.header>

      <motion.div
        {...rise(1)}
        className="mt-7 flex flex-wrap items-end gap-x-10 gap-y-5 rounded-xl border border-rule bg-paper-raised p-6"
      >
        <div>
          <p className="eyebrow">Outcome</p>
          <p className="display mt-1.5 text-[1.5rem] font-semibold">{outcomeLabel}</p>
          {report.target_delta !== null && (
            <p
              className={`tnum mt-1 text-[13px] ${
                report.target_delta >= 0 ? "text-deal" : "text-walk"
              }`}
            >
              {report.target_delta >= 0 ? "+" : "−"}
              {money(Math.abs(report.target_delta), unit, unitSuffix)} against your target
            </p>
          )}
        </div>

        <div className="ml-auto flex items-end gap-6">
          <div className="text-right">
            <p className="eyebrow">Target</p>
            <p className="tnum mt-1 text-[15px] text-ink-muted">
              {money(target, unit, unitSuffix)}
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">Score</p>
            <p className="tnum mt-1 text-[2.4rem] font-medium leading-none text-ink">
              {report.score}
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div {...rise(2)} className="mt-6">
        <Prose>{report.outcome_summary}</Prose>
      </motion.div>

      {/* Missteps first — that is the part worth reading. */}
      {report.missteps.length > 0 && (
        <Section title="What cost you" index={3} rise={rise}>
          {report.missteps.map((m, i) => (
            <Citation key={i} item={m} tone="walk" onJump={jumpTo} />
          ))}
        </Section>
      )}

      {report.alternative_phrasings.length > 0 && (
        <Section title="What to say instead" index={4} rise={rise}>
          {report.alternative_phrasings.map((a, i) => (
            <Alternative key={i} item={a} onJump={jumpTo} />
          ))}
        </Section>
      )}

      {report.strengths.length > 0 && (
        <Section title="What worked" index={5} rise={rise}>
          {report.strengths.map((s, i) => (
            <Citation key={i} item={s} tone="deal" onJump={jumpTo} />
          ))}
        </Section>
      )}

      <motion.div {...rise(6)} className="mt-10 flex flex-wrap gap-3">
        <LinkButton href="/practice">
          Run it again
          <ArrowRight className="size-4" strokeWidth={2} />
        </LinkButton>
        <LinkButton href="/dashboard" variant="outline">
          See your progress
        </LinkButton>
      </motion.div>

      {/* Full transcript, the target of every citation link. */}
      <motion.section {...rise(7)} className="mt-14">
        <h2 className="eyebrow">Full transcript</h2>
        <div className="mt-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.seq}
              id={`t-${m.seq}`}
              className="scroll-mt-24 rounded-lg px-3 py-2 transition-shadow"
            >
              <div className="mb-1 flex items-baseline gap-2">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider ${
                    m.role === "user" ? "text-brass" : "text-steel"
                  }`}
                >
                  {m.role === "user" ? "You" : "Them"}
                </span>
                <span className="tnum text-[10.5px] text-ink-faint">#{m.seq}</span>
              </div>
              <p className="text-[14px] leading-relaxed text-ink-muted">{m.content}</p>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}

function Section({
  title,
  index,
  rise,
  children,
}: {
  title: string;
  index: number;
  rise: (i: number) => object;
  children: React.ReactNode;
}) {
  return (
    <motion.section {...rise(index)} className="mt-10">
      <h2 className="eyebrow">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </motion.section>
  );
}

function Citation({
  item,
  tone,
  onJump,
}: {
  item: ReportCitation;
  tone: "walk" | "deal";
  onJump: (seq: number) => void;
}) {
  return (
    <article className="rounded-xl border border-rule bg-paper-raised p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider ${
            tone === "walk" ? "bg-walk-wash text-walk" : "bg-deal-wash text-deal"
          }`}
        >
          {tone === "walk" ? "Misstep" : "Worked"}
        </span>
        <button
          onClick={() => onJump(item.message_seq)}
          className="tnum text-[12px] text-ink-faint underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
        >
          Message #{item.message_seq}
        </button>
      </div>

      <h3 className="mt-3.5 text-[15.5px] font-semibold text-ink text-pretty">{item.title}</h3>

      <blockquote className="mt-3 flex gap-3 border-l-2 border-rule-strong pl-4">
        <Quote className="mt-1 size-3.5 shrink-0 text-ink-faint" strokeWidth={2} />
        <p className="text-[14px] italic leading-relaxed text-ink-muted">{item.quote}</p>
      </blockquote>

      <div className="mt-3.5">
        <Prose>{item.detail}</Prose>
      </div>
    </article>
  );
}

function Alternative({
  item,
  onJump,
}: {
  item: ReportAlternative;
  onJump: (seq: number) => void;
}) {
  return (
    <article className="rounded-xl border border-rule bg-paper-raised p-5">
      <button
        onClick={() => onJump(item.message_seq)}
        className="tnum text-[12px] text-ink-faint underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
      >
        Message #{item.message_seq}
      </button>

      <p className="mt-3 text-[13px] text-ink-faint">You said</p>
      <p className="mt-1 text-[14px] italic leading-relaxed text-ink-muted">
        &ldquo;{item.you_said}&rdquo;
      </p>

      <div className="mt-4 rounded-lg border border-brass/30 bg-brass-wash p-4">
        <p className="eyebrow flex items-center gap-1.5 text-brass">
          <Target className="size-3" strokeWidth={2.5} />
          Try instead
        </p>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink text-pretty">
          &ldquo;{item.try_instead}&rdquo;
        </p>
      </div>

      <div className="mt-3.5">
        <Prose>{item.why}</Prose>
      </div>
    </article>
  );
}

/** Shown when a session finished but its report could not be generated —
 *  usually the daily quota. The negotiation is safe; only the analysis is
 *  missing, and it can be retried. */
export function ReportRetry({ sessionId, outcome }: { sessionId: string; outcome: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Still could not generate the report.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center">
      <h1 className="display text-[1.7rem] font-semibold">The report is missing</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-muted text-pretty">
        Your negotiation was saved in full — only the analysis failed to generate, usually
        because the daily AI quota ran out. The transcript is intact, so you can try again.
      </p>
      {error && (
        <div className="mt-5 text-left">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <Button className="mt-6" onClick={retry} loading={busy}>
        <RefreshCw className="size-4" strokeWidth={2} />
        Generate it now
      </Button>
    </div>
  );
}
