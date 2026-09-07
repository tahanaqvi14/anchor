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
import { PositionTrack } from "@/components/position-track";

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
  openingAnchor,
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
  openingAnchor: number | null;
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
        <div className="flex items-center gap-3">
          <span className="index">RPT</span>
          <span className="h-px w-8 bg-rule-strong" />
          <span className="label">
            {scenarioTitle} &middot; {personaTitle}
          </span>
        </div>
        <h1 className="display-xl mt-6 text-[clamp(2rem,5.5vw,3.6rem)] text-balance">
          {report.headline}
        </h1>
      </motion.header>

      <motion.div
        {...rise(1)}
        className="mt-8 flex flex-wrap items-end gap-x-10 gap-y-5 border-y-2 border-rule-strong py-6"
      >
        <div>
          <p className="label">Outcome</p>
          <p className="display mt-2 text-[1.8rem] font-semibold">{outcomeLabel}</p>
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

        <div className="ml-auto flex items-end gap-8">
          <div className="text-right">
            <p className="label">Target</p>
            <p className="tnum mt-1.5 text-[15px] text-ink-muted">
              {money(target, unit, unitSuffix)}
            </p>
          </div>
          <div className="text-right">
            <p className="label">Score</p>
            <p className="tnum mt-1 text-[3.4rem] font-medium leading-none text-ink">
              {report.score}
            </p>
          </div>
        </div>
      </motion.div>

      {/* The same axis the negotiation was fought on, now settled. Seeing
          how little of the gap closed lands harder than the score does. */}
      {openingAnchor !== null && (
        <motion.div {...rise(2)} className="mt-8">
          <PositionTrack
            anchor={openingAnchor}
            current={finalValue ?? openingAnchor}
            target={target}
            unit={unit}
            unitSuffix={unitSuffix}
            size="lg"
          />
        </motion.div>
      )}

      <motion.div {...rise(3)} className="mt-8">
        <Prose>{report.outcome_summary}</Prose>
      </motion.div>

      {/* Missteps first — that is the part worth reading. */}
      {report.missteps.length > 0 && (
        <Section title="What cost you" index={4} rise={rise}>
          {report.missteps.map((m, i) => (
            <Citation key={i} item={m} tone="walk" onJump={jumpTo} />
          ))}
        </Section>
      )}

      {report.alternative_phrasings.length > 0 && (
        <Section title="What to say instead" index={5} rise={rise}>
          {report.alternative_phrasings.map((a, i) => (
            <Alternative key={i} item={a} onJump={jumpTo} />
          ))}
        </Section>
      )}

      {report.strengths.length > 0 && (
        <Section title="What worked" index={6} rise={rise}>
          {report.strengths.map((s, i) => (
            <Citation key={i} item={s} tone="deal" onJump={jumpTo} />
          ))}
        </Section>
      )}

      <motion.div {...rise(7)} className="mt-12 flex flex-wrap gap-3">
        <LinkButton href="/practice">
          Run it again
          <ArrowRight className="size-4" strokeWidth={2} />
        </LinkButton>
        <LinkButton href="/dashboard" variant="outline">
          See your progress
        </LinkButton>
      </motion.div>

      {/* Full transcript, the target of every citation link. */}
      <motion.section {...rise(8)} className="mt-16">
        <h2 className="label label-strong border-b border-rule-strong pb-2.5">Full transcript</h2>
        <div className="mt-5 space-y-5">
          {messages.map((m) => (
            <div
              key={m.seq}
              id={`t-${m.seq}`}
              className="flex scroll-mt-24 gap-4 py-1 transition-shadow"
            >
              <div className="w-11 shrink-0 pt-0.5 text-right">
                <div className="index">{String(m.seq).padStart(2, "0")}</div>
                <div className={`label mt-1 ${m.role === "user" ? "text-brass" : "text-steel"}`}>
                  {m.role === "user" ? "You" : "Them"}
                </div>
              </div>
              <p
                className={`min-w-0 flex-1 border-l-2 pl-4 text-[14px] leading-[1.6] text-ink-muted ${
                  m.role === "user" ? "border-brass" : "border-rule"
                }`}
              >
                {m.content}
              </p>
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
    <motion.section {...rise(index)} className="mt-12">
      <h2 className="label label-strong border-b border-rule-strong pb-2.5">{title}</h2>
      <div className="mt-5 space-y-5">{children}</div>
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
    <article className="border-b border-rule pb-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`label px-2 py-1 ${
            tone === "walk" ? "bg-walk-wash text-walk" : "bg-deal-wash text-deal"
          }`}
        >
          {tone === "walk" ? "Misstep" : "Worked"}
        </span>
        <button
          onClick={() => onJump(item.message_seq)}
          className="label transition-colors hover:text-ink"
        >
          Message {String(item.message_seq).padStart(2, "0")} &rarr;
        </button>
      </div>

      <h3 className="mt-4 text-[16.5px] font-semibold text-ink text-pretty">{item.title}</h3>

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
    <article className="border-b border-rule pb-6">
      <button
        onClick={() => onJump(item.message_seq)}
        className="label transition-colors hover:text-ink"
      >
        Message {String(item.message_seq).padStart(2, "0")} &rarr;
      </button>

      <p className="label mt-4">You said</p>
      <p className="mt-1 text-[14px] italic leading-relaxed text-ink-muted">
        &ldquo;{item.you_said}&rdquo;
      </p>

      <div className="mt-4 border-l-2 border-brass bg-brass-wash p-4">
        <p className="label flex items-center gap-1.5 text-brass">
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
