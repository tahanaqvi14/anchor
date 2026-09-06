import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_USER_TURNS } from "@/lib/negotiation/ledger";
import { runTurn, QuotaExhaustedError } from "@/lib/negotiation/engine";
import { appendMessage, loadSession, saveLedger } from "@/lib/negotiation/session-store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** One exchange: persist what the user said, get the opponent's reply,
 *  persist that too. The ledger update is authoritative — the client is
 *  told the opponent's public position and nothing else. */
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

  let body: { content?: string; inputMode?: "text" | "voice" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  const content = (body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "Say something first" }, { status: 400 });
  if (content.length > 4000) {
    return NextResponse.json({ error: "That message is too long" }, { status: 400 });
  }

  // RLS means a session belonging to someone else simply is not found.
  const loaded = await loadSession(supabase, id);
  if (!loaded) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (loaded.session.status !== "active") {
    return NextResponse.json({ error: "This negotiation has ended" }, { status: 409 });
  }
  if (loaded.ledger.turn >= MAX_USER_TURNS) {
    return NextResponse.json(
      { error: "You have reached the end of this negotiation.", code: "turn_limit" },
      { status: 409 },
    );
  }

  const userSeq = loaded.nextSeq;
  const { error: writeError } = await appendMessage(
    supabase,
    id,
    user.id,
    userSeq,
    "user",
    content,
    body.inputMode === "voice" ? "voice" : "text",
  );
  if (writeError) {
    return NextResponse.json({ error: "Could not save your message" }, { status: 500 });
  }

  try {
    const result = await runTurn(loaded.ctx, loaded.ledger, [
      ...loaded.transcript,
      { role: "user", content },
    ]);

    await appendMessage(supabase, id, user.id, userSeq + 1, "ai", result.output.reply);
    await saveLedger(supabase, loaded.session, result.update.ledger);

    const turnsLeft = MAX_USER_TURNS - result.update.ledger.turn;

    return NextResponse.json({
      reply: result.output.reply,
      seq: userSeq + 1,
      position: result.update.ledger.position,
      walked: result.update.walked,
      walkReason: result.update.walkReason,
      turnsLeft,
      degraded: result.degraded,
    });
  } catch (e) {
    if (e instanceof QuotaExhaustedError) {
      return NextResponse.json(
        {
          error: "The daily AI quota for this demo has been used up. It resets at midnight Pacific.",
          code: "quota",
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "The opponent did not respond. Try sending that again." },
      { status: 502 },
    );
  }
}
