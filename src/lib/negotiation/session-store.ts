import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ScenarioRow, SessionRow } from "../supabase/database.types";
import type { Ledger, SessionContext } from "./types";
import type { TranscriptEntry } from "./engine";
import { isPersonaKey } from "../personas";

/**
 * Loading and persisting a live negotiation.
 *
 * The opponent's ledger is hidden information — it holds the reservation
 * value the user must never see — so it is stored server-side on the
 * session row under a reserved `__ledger` key inside `context`, and
 * stripped before anything is returned to the client. It lives there rather
 * than in its own column so that the schema the user already migrated stays
 * correct; the key is reserved and documented rather than accidental.
 */

const LEDGER_KEY = "__ledger";

/** Sessions a single user may start per day. The Gemini free tier is a
 *  shared, daily-reset resource, so one enthusiastic visitor must not be
 *  able to exhaust the demo for everyone else. */
export const DAILY_SESSION_LIMIT = 12;

export type Client = SupabaseClient<Database>;

export interface LoadedSession {
  session: SessionRow;
  scenario: ScenarioRow;
  ctx: SessionContext;
  ledger: Ledger;
  transcript: TranscriptEntry[];
  nextSeq: number;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Number(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function buildContext(
  scenario: ScenarioRow,
  personaKey: string,
  raw: Record<string, unknown>,
): SessionContext {
  if (!isPersonaKey(personaKey)) throw new Error("Unknown persona");

  const currentOffer = num(raw.currentOffer);
  const target = num(raw.target);
  if (currentOffer === null || target === null) {
    throw new Error("Both a current offer and a target are required");
  }
  if (currentOffer === target) {
    throw new Error("Your target must differ from their current offer");
  }

  const leverage = [raw.leverage, raw.scope]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" ")
    .slice(0, 800);

  return {
    scenarioTitle: scenario.title,
    userRole: scenario.user_role,
    aiRole: scenario.ai_role,
    unit: scenario.unit,
    unitSuffix: scenario.unit_suffix,
    currentOffer,
    target,
    walkAway: num(raw.walkAway),
    leverage: leverage || null,
    personaKey,
  };
}

/** Everything the client is allowed to know about the session. */
export function publicContext(ctx: SessionContext) {
  return {
    scenarioTitle: ctx.scenarioTitle,
    unit: ctx.unit,
    unitSuffix: ctx.unitSuffix,
    currentOffer: ctx.currentOffer,
    target: ctx.target,
    personaKey: ctx.personaKey,
  };
}

export function stripLedger(context: Record<string, unknown>) {
  const rest = { ...context };
  delete rest[LEDGER_KEY];
  return rest;
}

export async function loadSession(
  supabase: Client,
  sessionId: string,
): Promise<LoadedSession | null> {
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return null;

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("*")
    .eq("id", session.scenario_id)
    .maybeSingle();
  if (!scenario) return null;

  const { data: rows } = await supabase
    .from("messages")
    .select("seq, role, content")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });

  const messages = rows ?? [];
  const stored = session.context as Record<string, unknown>;
  const ledger = stored[LEDGER_KEY] as Ledger | undefined;
  if (!ledger) return null;

  return {
    session,
    scenario,
    ctx: buildContext(scenario, session.persona_key, stripLedger(stored)),
    ledger,
    transcript: messages.map((m) => ({ role: m.role, content: m.content })),
    nextSeq: messages.length ? messages[messages.length - 1].seq + 1 : 1,
  };
}

export async function saveLedger(
  supabase: Client,
  session: SessionRow,
  ledger: Ledger,
): Promise<void> {
  const context = stripLedger(session.context as Record<string, unknown>);
  await supabase
    .from("sessions")
    .update({ context: { ...context, [LEDGER_KEY]: ledger } })
    .eq("id", session.id);
}

export async function appendMessage(
  supabase: Client,
  sessionId: string,
  userId: string,
  seq: number,
  role: "user" | "ai",
  content: string,
  inputMode: "text" | "voice" = "text",
) {
  return supabase.from("messages").insert({
    session_id: sessionId,
    user_id: userId,
    seq,
    role,
    content: content.slice(0, 4000),
    input_mode: inputMode,
  });
}

export async function sessionsStartedToday(
  supabase: Client,
  userId: string,
): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("started_at", since.toISOString());
  return count ?? 0;
}
