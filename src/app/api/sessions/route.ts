import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initLedger } from "@/lib/negotiation/ledger";
import { runTurn, QuotaExhaustedError } from "@/lib/negotiation/engine";
import {
  appendMessage,
  buildContext,
  DAILY_SESSION_LIMIT,
  sessionsStartedToday,
} from "@/lib/negotiation/session-store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Start a negotiation: create the session, then produce the opponent's
 *  opening message so the user arrives at a conversation already in
 *  progress rather than an empty box. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { scenarioId?: string; personaKey?: string; context?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  const { scenarioId, personaKey, context = {} } = body;
  if (!scenarioId || !personaKey) {
    return NextResponse.json({ error: "Pick a scenario and an opponent" }, { status: 400 });
  }

  // Free-tier protection: Gemini's daily allowance is shared across every
  // visitor, so one person cannot be allowed to spend all of it.
  if ((await sessionsStartedToday(supabase, user.id)) >= DAILY_SESSION_LIMIT) {
    return NextResponse.json(
      {
        error: `You have started ${DAILY_SESSION_LIMIT} negotiations today, which is the daily limit on the free tier. It resets tomorrow.`,
        code: "daily_limit",
      },
      { status: 429 },
    );
  }

  // RLS restricts this to presets and the user's own scenarios.
  const { data: scenario } = await supabase
    .from("scenarios")
    .select("*")
    .eq("id", scenarioId)
    .maybeSingle();
  if (!scenario) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });

  let ctx;
  try {
    ctx = buildContext(scenario, personaKey, context);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid setup" },
      { status: 400 },
    );
  }

  const ledger = initLedger(ctx);

  const { data: session, error: insertError } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      scenario_id: scenario.id,
      persona_key: personaKey,
      persona_version: 1,
      status: "active",
      outcome: null,
      context: { ...context, __ledger: ledger },
      target_value: ctx.target,
      opening_anchor: ledger.position,
      final_value: null,
      score: null,
      ended_at: null,
    })
    .select("*")
    .single();

  if (insertError || !session) {
    return NextResponse.json({ error: "Could not start the session" }, { status: 500 });
  }

  try {
    const opening = await runTurn(ctx, ledger, []);
    await appendMessage(supabase, session.id, user.id, 1, "ai", opening.output.reply);
    await supabase
      .from("sessions")
      .update({
        context: { ...context, __ledger: opening.update.ledger },
        opening_anchor: opening.update.ledger.position,
      })
      .eq("id", session.id);
  } catch (e) {
    // The session row exists but has no opening line; remove it rather than
    // leaving the user with a broken conversation in their history.
    await supabase.from("sessions").delete().eq("id", session.id);
    if (e instanceof QuotaExhaustedError) {
      return NextResponse.json(
        {
          error: "The daily AI quota for this demo has been used up. It resets at midnight Pacific.",
          code: "quota",
        },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: "The opponent could not be reached" }, { status: 502 });
  }

  return NextResponse.json({ sessionId: session.id });
}
