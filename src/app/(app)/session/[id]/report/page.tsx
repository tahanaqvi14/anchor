import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { PERSONAS, isPersonaKey } from "@/lib/personas";
import { ReportRetry, ReportView } from "@/components/session/report-view";
import type { RoomMessage } from "@/components/session/negotiation-room";

export const metadata: Metadata = { title: "Your report" };

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!session) notFound();

  const [{ data: report }, { data: scenario }, { data: rows }] = await Promise.all([
    supabase.from("feedback_reports").select("*").eq("session_id", id).maybeSingle(),
    supabase.from("scenarios").select("*").eq("id", session.scenario_id).maybeSingle(),
    supabase
      .from("messages")
      .select("seq, role, content")
      .eq("session_id", id)
      .order("seq", { ascending: true }),
  ]);

  if (!report) {
    return <ReportRetry sessionId={id} outcome={session.outcome ?? "no_deal"} />;
  }

  const messages: RoomMessage[] = (rows ?? []).map((m) => ({
    seq: m.seq,
    role: m.role,
    content: m.content,
  }));

  const personaTitle = isPersonaKey(session.persona_key)
    ? PERSONAS[session.persona_key].title
    : session.persona_key;

  return (
    <ReportView
      report={report}
      messages={messages}
      scenarioTitle={scenario?.title ?? "Negotiation"}
      personaTitle={personaTitle}
      unit={scenario?.unit ?? "USD"}
      unitSuffix={scenario?.unit_suffix ?? null}
      target={session.target_value ?? 0}
      finalValue={session.final_value}
      outcome={session.outcome}
    />
  );
}
