import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scoreOutcome } from "@/lib/negotiation/ledger";
import { QuotaExhaustedError } from "@/lib/negotiation/engine";
import { generateReport } from "@/lib/negotiation/report";
import { loadSession } from "@/lib/negotiation/session-store";
import type { SessionOutcome } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 60;

const OUTCOMES: SessionOutcome[] = ["deal", "no_deal", "user_walked", "ai_walked"];

/**
 * End a negotiation and write its report.
 *
 * The session is closed first and the report generated second, so a model
 * failure leaves a completed session the user can still see rather than one
 * stuck permanently "active". The report can then be retried.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { outcome?: SessionOutcome; finalValue?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  const outcome = body.outcome;
  if (!outcome || !OUTCOMES.includes(outcome)) {
    return NextResponse.json({ error: "Unknown outcome" }, { status: 400 });
  }

  const loaded = await loadSession(supabase, id);
  if (!loaded) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  if (loaded.transcript.filter((m) => m.role === "user").length === 0) {
    return NextResponse.json(
      { error: "Say something before ending the negotiation." },
      { status: 400 },
    );
  }

  // A deal settles at the opponent's standing position unless the client
  // says otherwise; every other outcome has no agreed number by definition.
  const finalValue =
    outcome === "deal"
      ? typeof body.finalValue === "number" && Number.isFinite(body.finalValue)
        ? body.finalValue
        : loaded.ledger.position
      : null;

  const score = scoreOutcome(loaded.ctx, finalValue, outcome);

  if (loaded.session.status === "active") {
    const { error } = await supabase
      .from("sessions")
      .update({
        status: "completed",
        outcome,
        final_value: finalValue,
        score,
        ended_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Could not close the session" }, { status: 500 });
    }
  }

  // Reports are write-once; if one already exists, hand it back.
  const { data: existing } = await supabase
    .from("feedback_reports")
    .select("id")
    .eq("session_id", id)
    .maybeSingle();
  if (existing) return NextResponse.json({ reportId: existing.id, reused: true });

  try {
    const report = await generateReport(loaded.ctx, loaded.transcript, outcome, finalValue);

    const { data: saved, error } = await supabase
      .from("feedback_reports")
      .insert({
        session_id: id,
        user_id: user.id,
        score: report.score,
        headline: report.headline,
        outcome_summary: report.outcome_summary,
        strengths: report.strengths,
        missteps: report.missteps,
        alternative_phrasings: report.alternative_phrasings,
        target_delta: report.target_delta,
        model: report.model,
        raw: report.raw,
      })
      .select("id")
      .single();

    if (error || !saved) {
      return NextResponse.json({ error: "Could not save the report" }, { status: 500 });
    }

    // Keep the session's score consistent with the report's.
    await supabase.from("sessions").update({ score: report.score }).eq("id", id);

    return NextResponse.json({ reportId: saved.id });
  } catch (e) {
    // Server-side only. A swallowed generation failure is indistinguishable
    // from a quota outage from the client, which makes it undiagnosable.
    console.error("[report] generation failed:", e instanceof Error ? e.message : e);
    if (e instanceof QuotaExhaustedError) {
      return NextResponse.json(
        {
          error:
            "Your negotiation was saved, but the daily AI quota is used up so the report could not be written. Try again after midnight Pacific.",
          code: "quota",
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Your negotiation was saved, but the report could not be generated.", code: "report_failed" },
      { status: 502 },
    );
  }
}
