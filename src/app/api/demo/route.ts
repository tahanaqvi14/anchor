import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  demoCredentials,
  findDemoUserId,
  pruneDemoVisitorData,
  restoreDemoCredentials,
} from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo-account housekeeping, called by the one-click demo sign-in.
 *
 *   POST {}                 tidy: clear visitor sessions older than a day
 *   POST { restore: true }  also put the published credentials back if a
 *                           previous visitor changed them
 *
 * Unauthenticated on purpose: it acts only on the single is_demo account
 * and only ever sets it to credentials that are already public.
 */
export async function POST(request: Request) {
  if (!demoCredentials() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "The demo account is not configured" }, { status: 503 });
  }

  let restore = false;
  try {
    restore = Boolean((await request.json())?.restore);
  } catch {
    // An empty body is a plain tidy-up.
  }

  const admin = createAdminClient();
  const demoId = await findDemoUserId(admin);
  if (!demoId) {
    return NextResponse.json({ error: "The demo account has not been seeded" }, { status: 404 });
  }

  if (restore && !(await restoreDemoCredentials(admin, demoId))) {
    return NextResponse.json({ error: "The demo account could not be restored" }, { status: 502 });
  }

  try {
    await pruneDemoVisitorData(admin, demoId);
  } catch (e) {
    // Tidying is best-effort; it must never stand between a visitor and the demo.
    console.error("[demo] prune failed:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true });
}
