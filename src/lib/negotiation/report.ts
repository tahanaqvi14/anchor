import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

import type { SessionContext } from "./types";
import type { TranscriptEntry } from "./engine";
import { QuotaExhaustedError, RETRY_DELAYS_MS, classifyGeminiError, sleep } from "./engine";
import { scoreOutcome } from "./ledger";
import type { SessionOutcome, ReportCitation, ReportAlternative } from "../supabase/database.types";

/**
 * Feedback report generation.
 *
 * The failure mode this module exists to prevent is generic praise —
 * "you were confident, try anchoring higher" — which is easy for a model to
 * produce and impossible for a user to act on. Two mechanisms force
 * specificity:
 *
 *  1. The transcript is fed in with explicit [#n] markers, and the output
 *     schema REQUIRES a message_seq and a verbatim quote on every strength
 *     and misstep.
 *  2. Every citation is verified against the transcript after generation.
 *     A quote that does not appear in the message it cites is either
 *     re-pointed at the message it actually came from, or dropped. If too
 *     few survive, the whole report is regenerated once with the failures
 *     named.
 *
 * A model cannot bluff a citation past this, which is what makes the report
 * trustworthy rather than merely well-written.
 */

const CitationSchema = z.object({
  title: z.string().min(1).max(160),
  detail: z.string().min(1).max(900),
  message_seq: z.number().int().positive(),
  quote: z.string().min(3).max(400),
});

const AlternativeSchema = z.object({
  message_seq: z.number().int().positive(),
  you_said: z.string().min(1).max(400),
  try_instead: z.string().min(1).max(600),
  why: z.string().min(1).max(600),
});

const ReportSchema = z.object({
  headline: z.string().min(1).max(160),
  outcome_summary: z.string().min(1).max(1200),
  strengths: z.array(CitationSchema).min(1).max(4),
  missteps: z.array(CitationSchema).min(1).max(4),
  alternative_phrasings: z.array(AlternativeSchema).min(1).max(3),
});

export type GeneratedReport = z.infer<typeof ReportSchema>;

export interface ReportResult {
  headline: string;
  outcome_summary: string;
  strengths: ReportCitation[];
  missteps: ReportCitation[];
  alternative_phrasings: ReportAlternative[];
  score: number;
  target_delta: number | null;
  model: string;
  raw: unknown;
  /** Citations discarded for failing verification. Useful signal: a high
   *  count means the prompt is drifting toward invention. */
  rejectedCitations: number;
}

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: {
      type: Type.STRING,
      description:
        "One specific sentence naming the single thing that most determined this result. Not a grade, not a platitude.",
    },
    outcome_summary: {
      type: Type.STRING,
      description:
        "2-4 sentences: what was actually agreed with the final numbers and terms, or that no deal was reached and why. Reference what happened, not what usually happens.",
    },
    strengths: {
      type: Type.ARRAY,
      minItems: 2,
      maxItems: 3,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Short label for what they did well." },
          detail: {
            type: Type.STRING,
            description: "Why it worked, referring to how the opponent actually responded.",
          },
          message_seq: {
            type: Type.NUMBER,
            description: "The [#n] number of the USER message this refers to.",
          },
          quote: {
            type: Type.STRING,
            description:
              "An exact substring copied character-for-character from that message. Do not paraphrase, do not add ellipses, do not fix typos.",
          },
        },
        required: ["title", "detail", "message_seq", "quote"],
      },
    },
    missteps: {
      type: Type.ARRAY,
      minItems: 2,
      maxItems: 3,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Short label for the mistake." },
          detail: {
            type: Type.STRING,
            description: "What it cost them, tied to what the opponent did next.",
          },
          message_seq: { type: Type.NUMBER, description: "The [#n] of the USER message." },
          quote: {
            type: Type.STRING,
            description: "An exact substring copied character-for-character from that message.",
          },
        },
        required: ["title", "detail", "message_seq", "quote"],
      },
    },
    alternative_phrasings: {
      type: Type.ARRAY,
      minItems: 1,
      maxItems: 2,
      items: {
        type: Type.OBJECT,
        properties: {
          message_seq: { type: Type.NUMBER },
          you_said: { type: Type.STRING, description: "Exact substring of what they wrote." },
          try_instead: {
            type: Type.STRING,
            description: "Specific words they could have used instead. Written to be said aloud.",
          },
          why: { type: Type.STRING, description: "What that change would have done to the opponent." },
        },
        required: ["message_seq", "you_said", "try_instead", "why"],
      },
    },
  },
  required: ["headline", "outcome_summary", "strengths", "missteps", "alternative_phrasings"],
} as const;

/* ------------------------------------------------------------------ */

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\w\s'"$.,%-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

interface NumberedMessage {
  seq: number;
  role: "user" | "ai";
  content: string;
}

/**
 * Verifies one citation against the transcript.
 * Returns the citation with a corrected seq, or null if the quote appears
 * nowhere in anything the user actually said.
 */
function verifyCitation<T extends { message_seq: number }>(
  item: T,
  quote: string,
  numbered: NumberedMessage[],
): T | null {
  const needle = normalize(quote);
  if (needle.length < 4) return null;

  const cited = numbered.find((m) => m.seq === item.message_seq);
  if (cited && normalize(cited.content).includes(needle)) return item;

  // The observation may be sound while the pointer is wrong — that is worth
  // repairing rather than discarding.
  const actual = numbered.find(
    (m) => m.role === "user" && normalize(m.content).includes(needle),
  );
  if (actual) return { ...item, message_seq: actual.seq };

  return null;
}

function verifyReport(report: GeneratedReport, numbered: NumberedMessage[]) {
  let rejected = 0;

  const keep = <T extends { message_seq: number }>(arr: T[], q: (x: T) => string) =>
    arr.reduce<T[]>((acc, item) => {
      const ok = verifyCitation(item, q(item), numbered);
      if (ok) acc.push(ok);
      else rejected++;
      return acc;
    }, []);

  return {
    strengths: keep(report.strengths, (x) => x.quote),
    missteps: keep(report.missteps, (x) => x.quote),
    alternative_phrasings: keep(report.alternative_phrasings, (x) => x.you_said),
    rejected,
  };
}

/* ------------------------------------------------------------------ */

function buildPrompt(
  ctx: SessionContext,
  numbered: NumberedMessage[],
  outcome: SessionOutcome,
  finalValue: number | null,
  retryNote?: string,
): string {
  const money = (n: number) =>
    `${ctx.unit === "USD" ? "$" : ""}${Math.round(n).toLocaleString("en-US")}${ctx.unitSuffix ?? ""}`;

  const transcript = numbered
    .map((m) => `[#${m.seq}] ${m.role === "user" ? "THEM (the person you are coaching)" : "OPPONENT"}: ${m.content}`)
    .join("\n\n");

  const outcomeLine = {
    deal: finalValue !== null ? `They agreed a deal at ${money(finalValue)}.` : "They agreed a deal.",
    no_deal: "The conversation ended with no agreement.",
    user_walked: "They walked away from the table.",
    ai_walked: "The opponent walked away and ended the negotiation.",
  }[outcome];

  return `You are a negotiation coach reviewing a transcript. You are blunt, specific and useful. You are not encouraging for its own sake.

# The situation
${ctx.scenarioTitle}. They were ${ctx.userRole}, negotiating against ${ctx.aiRole}.
They started from ${money(ctx.currentOffer)} and told us their target was ${money(ctx.target)}.
${outcomeLine}

# Transcript
${transcript}

# What to produce
Analyse only what is in this transcript.

Absolute requirement: every strength, every misstep and every alternative phrasing MUST quote a USER message ([#n] marked "THEM") exactly. Copy the words character-for-character from the transcript. Do not paraphrase, do not tidy grammar, do not invent a line that is not there. An observation you cannot quote is one you must not make.

- Strengths: 2-3, each naming something they genuinely did well and what it produced from the opponent.
- Missteps: 2-3. Be specific about the cost: what did the opponent do immediately after that they would not otherwise have done? Concessions given before they were asked for, accepting an unevidenced constraint, revealing flexibility too early, and negotiating against themselves are the ones that matter most.
- Alternative phrasings: 1-2. Give the actual words, written to be spoken out loud.

Do not comment on politeness, tone or confidence unless it demonstrably changed the outcome. Do not pad. If they negotiated badly, say so plainly.${
    retryNote ? `\n\n# Correction required\n${retryNote}` : ""
  }`;
}

export async function generateReport(
  ctx: SessionContext,
  transcript: TranscriptEntry[],
  outcome: SessionOutcome,
  finalValue: number | null,
): Promise<ReportResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  /**
   * The report model is the better one, and it is also the one that gets
   * overloaded: observed returning 503 UNAVAILABLE ("experiencing high
   * demand") repeatedly in production, long enough that a few seconds of
   * backoff does not outlast the spike. Since the report is the whole point
   * of a finished session, an overloaded model must not be the difference
   * between feedback and none.
   *
   * So capacity is treated as a separate axis from retrying: exhaust the
   * preferred model, then fall through to the turn model, which is a
   * different capacity pool. A slightly less incisive report beats a 502.
   * Whichever produced it is recorded on the row.
   */
  const preferred = process.env.GEMINI_REPORT_MODEL ?? "gemini-3.8-flash";
  const fallback = process.env.GEMINI_CHAT_MODEL ?? "gemini-3.5-flash-lite";
  const models = preferred === fallback ? [preferred] : [preferred, fallback];

  const ai = new GoogleGenAI({ apiKey });
  let model = preferred;

  const numbered: NumberedMessage[] = transcript.map((m, i) => ({
    seq: i + 1,
    role: m.role,
    content: m.content,
  }));

  let best: {
    report: GeneratedReport;
    verified: ReturnType<typeof verifyReport>;
    raw: unknown;
    model: string;
  } | null = null;

  let lastError: unknown = null;

  // The whole route runs under a 60s function limit and each call costs
  // 10-20s, so the budget is roughly three calls: two on the preferred
  // model, then one on the fallback.
  outer: for (const [index, candidate] of models.entries()) {
    const attempts = index === 0 ? 2 : 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const retryNote =
        attempt === 0
          ? undefined
          : "Your previous attempt quoted text that does not appear in the transcript. Re-read it and copy quotes exactly, character for character, from messages marked THEM.";

      let parsed: GeneratedReport | null = null;
      let raw: unknown = null;

      try {
        const res = await ai.models.generateContent({
          model: candidate,
          contents: [{ role: "user", parts: [{ text: "Write the report." }] }],
          config: {
            systemInstruction: buildPrompt(ctx, numbered, outcome, finalValue, retryNote),
            responseMimeType: "application/json",
            responseSchema: REPORT_SCHEMA,
            temperature: 0.4, // analysis, not improvisation
            maxOutputTokens: 3000,
          },
        });
        raw = JSON.parse(res.text ?? "{}");
        const result = ReportSchema.safeParse(raw);
        if (result.success) parsed = result.data;
        else if (process.env.ANCHOR_DEBUG || process.env.NODE_ENV !== "production") {
          console.error(
            "[report] schema rejected:",
            result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "),
            "| finish=",
            res.candidates?.[0]?.finishReason,
          );
        }
      } catch (e) {
        lastError = e;
        const kind = classifyGeminiError(e);
        if (kind === "quota") throw new QuotaExhaustedError();

        // Retry the same model only while attempts remain; otherwise fall
        // through to the next model rather than burning the budget waiting
        // on capacity that is not coming back.
        if (kind === "rate" && attempt < attempts - 1) {
          await sleep(RETRY_DELAYS_MS[attempt] + Math.random() * 400);
          continue;
        }
        break;
      }

      if (!parsed) continue;

      const verified = verifyReport(parsed, numbered);
      if (!best || verified.rejected < best.verified.rejected) {
        best = { report: parsed, verified, raw, model: candidate };
      }

      // Good enough: two of each survived verification.
      if (verified.strengths.length >= 2 && verified.missteps.length >= 2) break outer;
    }
  }

  if (!best) throw lastError ?? new Error("Report generation failed on every model");

  model = best.model;

  const score = scoreOutcome(ctx, finalValue, outcome);

  return {
    headline: best.report.headline,
    outcome_summary: best.report.outcome_summary,
    strengths: best.verified.strengths,
    missteps: best.verified.missteps,
    alternative_phrasings: best.verified.alternative_phrasings,
    score,
    target_delta: finalValue !== null ? finalValue - ctx.target : null,
    model,
    raw: best.raw,
    rejectedCitations: best.verified.rejected,
  };
}
