import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { findDemoUserId, pruneDemoVisitorData } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Keeps the Supabase project awake.
 *
 * Free-tier projects are paused after seven days without database activity,
 * and a paused project takes a manual restore from the dashboard to come
 * back. For a portfolio link that is the difference between a working demo
 * and a dead one, so a scheduled job touches the database on a cadence well
 * inside that window. See .github/workflows/keepalive.yml.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(request.url).searchParams.get("secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  try {
    // A trivial read is enough to reset the inactivity timer.
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("scenarios")
      .select("id", { count: "exact", head: true })
      .eq("is_preset", true);

    if (error) throw error;

    // While here, keep the shared demo's history curated even on days no
    // one opens /demo. Best-effort: it must never fail the keepalive.
    let demoPruned: { sessions: number; scenarios: number } | null = null;
    try {
      const demoId = await findDemoUserId(supabase);
      if (demoId) demoPruned = await pruneDemoVisitorData(supabase, demoId);
    } catch (e) {
      console.error("[keepalive] demo prune failed:", e instanceof Error ? e.message : e);
    }

    return NextResponse.json({
      ok: true,
      presets: count,
      demoPruned,
      at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Database unreachable" }, { status: 503 });
  }
}
