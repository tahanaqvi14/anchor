import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { loadSession } from "@/lib/negotiation/session-store";
import { MAX_USER_TURNS } from "@/lib/negotiation/ledger";
import { NegotiationRoom } from "@/components/session/negotiation-room";
import type { RoomMessage } from "@/components/session/negotiation-room";
import { isPersonaKey } from "@/lib/personas";

export const metadata: Metadata = { title: "Negotiating" };

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS makes someone else's session indistinguishable from a missing one,
  // which is exactly the behaviour we want.
  const loaded = await loadSession(supabase, id);
  if (!loaded) notFound();

  // A finished negotiation belongs at its report, not back in the room.
  if (loaded.session.status !== "active") redirect(`/session/${id}/report`);

  const { data: rows } = await supabase
    .from("messages")
    .select("seq, role, content")
    .eq("session_id", id)
    .order("seq", { ascending: true });

  const messages: RoomMessage[] = (rows ?? []).map((m) => ({
    seq: m.seq,
    role: m.role,
    content: m.content,
  }));

  const personaKey = isPersonaKey(loaded.session.persona_key)
    ? loaded.session.persona_key
    : "professional";

  return (
    <NegotiationRoom
      sessionId={id}
      personaKey={personaKey}
      scenarioTitle={loaded.scenario.title}
      unit={loaded.scenario.unit}
      unitSuffix={loaded.scenario.unit_suffix}
      currentOffer={loaded.ctx.currentOffer}
      target={loaded.ctx.target}
      initialMessages={messages}
      initialPosition={loaded.ledger.position}
      turnsLeft={Math.max(0, MAX_USER_TURNS - loaded.ledger.turn)}
      alreadyEnded={false}
    />
  );
}
