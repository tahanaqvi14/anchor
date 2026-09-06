import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Create a custom scenario.
 *
 * The user describes their situation in free text; we derive the two roles
 * from it rather than asking them to fill in a form they should not have to
 * think about. RLS enforces that is_preset stays false and user_id is
 * theirs — the policy would reject anything else regardless of what is sent.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  const title = (body.title ?? "").trim().slice(0, 400);
  if (title.length < 10) {
    return NextResponse.json(
      { error: "Describe the situation in a sentence or two." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("scenarios")
    .insert({
      user_id: user.id,
      is_preset: false,
      slug: null,
      title: title.length > 70 ? `${title.slice(0, 67)}...` : title,
      summary: title,
      user_role: `the person described here: ${title}`,
      ai_role: `the counterparty in this situation: ${title}. Infer who they are and what their interests would realistically be, and hold those interests firmly`,
      unit: "USD",
      unit_suffix: null,
      context_fields: [],
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not save that scenario" }, { status: 500 });
  }

  return NextResponse.json({ scenarioId: data.id });
}
