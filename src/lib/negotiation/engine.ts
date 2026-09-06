import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { TACTICS } from "./types";
import type { Ledger, SessionContext, TurnOutput } from "./types";
import { applyTurn } from "./ledger";
import type { TurnUpdate } from "./ledger";
import { buildOpeningPrompt, buildSystemPrompt, TURN_SCHEMA } from "./prompt";

/**
 * One negotiation turn against Gemini.
 *
 * The model's structured output is parsed with zod rather than trusted:
 * responseSchema makes malformed output unlikely, not impossible, and a
 * single bad turn should degrade into "they held their position" rather
 * than crashing a session the user is halfway through.
 */

const TurnOutputSchema = z.object({
  reply: z.string().min(1).max(2000),
  userTactic: z.enum(TACTICS),
  proposedPosition: z.number().finite(),
  wantsToWalk: z.boolean(),
  internalNote: z.string().max(500).default(""),
});

export interface TranscriptEntry {
  role: "user" | "ai";
  content: string;
}

export interface TurnResult {
  output: TurnOutput;
  update: TurnUpdate;
  /** True when the model returned something unusable and we fell back to
   *  holding position. Surfaced in evals rather than hidden. */
  degraded: boolean;
  /** Why the turn degraded, when it did. Shown in evals, never to users. */
  error: string | null;
}

/**
 * Free-tier Gemini enforces a per-minute request ceiling well below what a
 * burst of traffic (or an eval run) produces, and a throttled turn is
 * indistinguishable from a passive opponent unless it is retried. Daily
 * quota exhaustion is a different animal: it will not recover within a
 * request, so it is surfaced immediately rather than retried into a
 * timeout.
 */
const RETRY_DELAYS_MS = [900, 2600, 6500];

export class QuotaExhaustedError extends Error {
  constructor() {
    super("Gemini daily free-tier quota exhausted");
    this.name = "QuotaExhaustedError";
  }
}

function classify(e: unknown): "rate" | "quota" | "fatal" {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  if (msg.includes("per day") || msg.includes("daily limit")) return "quota";
  if (
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded")
  )
    return "rate";
  return "fatal";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export async function runTurn(
  ctx: SessionContext,
  ledger: Ledger,
  transcript: TranscriptEntry[],
): Promise<TurnResult> {
  const isOpening = transcript.length === 0;
  const systemInstruction = isOpening
    ? buildOpeningPrompt(ctx, ledger)
    : buildSystemPrompt(ctx, ledger);

  // The user's messages are conversation content, never instructions to the
  // system. Anything instruction-shaped inside them is handled by the
  // in-character rule in the system prompt.
  const contents = transcript.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.content }],
  }));

  // Gemini requires the first content to be from the user, but our
  // transcripts open with the OPPONENT's message — the whole point is that
  // they anchor first. Without this shim every multi-turn call is rejected
  // and silently degrades to "they held their position", which reads as a
  // working but strangely passive opponent rather than as an error.
  if (contents.length === 0 || contents[0].role === "model") {
    contents.unshift({ role: "user" as const, parts: [{ text: "(begin)" }] });
  }

  let parsed: TurnOutput | null = null;
  let failure: string | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await ai().models.generateContent({
        model: process.env.GEMINI_CHAT_MODEL ?? "gemini-3.5-flash-lite",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: TURN_SCHEMA,
          temperature: 0.9, // negotiators should not be predictable
          maxOutputTokens: 600,
        },
      });
      const candidate = TurnOutputSchema.safeParse(JSON.parse(res.text ?? "{}"));
      if (candidate.success) {
        parsed = candidate.data;
        failure = null;
        break;
      }
      failure = `schema: ${candidate.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")} | finish=${res.candidates?.[0]?.finishReason}`;
      break; // a schema miss will not fix itself on retry
    } catch (e) {
      const kind = classify(e);
      if (kind === "quota") throw new QuotaExhaustedError();
      failure = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
      if (kind !== "rate" || attempt === RETRY_DELAYS_MS.length) break;
      // Jitter so concurrent sessions do not retry in lockstep.
      await sleep(RETRY_DELAYS_MS[attempt] + Math.random() * 400);
    }
  }

  // A swallowed error here degrades into a passive opponent that looks like
  // a design choice rather than a bug, so it must always be recoverable.
  if (failure && process.env.ANCHOR_DEBUG) console.error(`  [turn error] ${failure}`);

  const degraded = parsed === null;
  const output: TurnOutput = parsed ?? {
    reply: "Let's stay where we are for the moment. What else did you want to cover?",
    userTactic: "silence",
    proposedPosition: ledger.position,
    wantsToWalk: false,
    internalNote: "(model output unusable; held position)",
  };

  const update = applyTurn(
    ledger,
    ctx,
    output.userTactic,
    output.proposedPosition,
    output.wantsToWalk,
  );

  return { output, update, degraded, error: failure };
}
