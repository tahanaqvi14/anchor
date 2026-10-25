import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/server";

/**
 * Housekeeping for the shared demo account. Server-only: it uses the secret
 * key, and acts on nothing but the one account marked profiles.is_demo —
 * a flag only the secret key can set (migration 0003).
 *
 * The demo's credentials are public by design, which has two consequences
 * a visitor-facing showcase cannot leave to chance:
 *
 *  1. Anyone signed in to it can change its password or email — Supabase
 *     lets any signed-in user do that to their own account — and lock out
 *     every visitor after them. `restoreDemoCredentials` puts the published
 *     credentials back, but only once a sign-in with them has failed.
 *
 *  2. Every visitor's negotiations land in the same history. Left alone,
 *     whatever one stranger typed is what the next one sees.
 *     `pruneDemoVisitorData` clears sessions visitors played more than a day
 *     ago, keeping the seeded ones. A day, so it never undercuts the daily
 *     per-user session cap, which counts today's sessions.
 */

const VISITOR_DATA_TTL_MS = 24 * 60 * 60 * 1000;

type Admin = ReturnType<typeof createAdminClient>;

export function demoCredentials(): { email: string; password: string } | null {
  const email = process.env.NEXT_PUBLIC_DEMO_EMAIL;
  const password = process.env.NEXT_PUBLIC_DEMO_PASSWORD;
  return email && password ? { email, password } : null;
}

/** The demo account's id, or null unless exactly one account is marked. */
export async function findDemoUserId(admin: Admin): Promise<string | null> {
  const { data, error } = await admin.from("profiles").select("id").eq("is_demo", true).limit(2);
  if (error || !data || data.length !== 1) return null;
  return data[0].id;
}

/** Resets the demo account to the published credentials if — and only if —
 *  they no longer work. Returns whether they work afterwards. */
export async function restoreDemoCredentials(admin: Admin, demoId: string): Promise<boolean> {
  const creds = demoCredentials();
  if (!creds) return false;

  if (await credentialsWork(creds)) return true;

  const { error } = await admin.auth.admin.updateUserById(demoId, {
    email: creds.email,
    password: creds.password,
    email_confirm: true,
  });
  if (error) {
    console.error("[demo] could not restore credentials:", error.message);
    return false;
  }
  return credentialsWork(creds);
}

async function credentialsWork(creds: { email: string; password: string }): Promise<boolean> {
  // A throwaway client that keeps no session: this is a check, not a login.
  const probe = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await probe.auth.signInWithPassword(creds);
  return !error;
}

/** Deletes visitor-played demo sessions (and visitor-created scenarios no
 *  longer used) older than a day. Seeded sessions are recognised by their
 *  report, which seed-demo.mts writes with model "seeded". */
export async function pruneDemoVisitorData(
  admin: Admin,
  demoId: string,
): Promise<{ sessions: number; scenarios: number }> {
  const cutoff = new Date(Date.now() - VISITOR_DATA_TTL_MS).toISOString();

  const { data: seeded, error: seededError } = await admin
    .from("feedback_reports")
    .select("session_id")
    .eq("user_id", demoId)
    .eq("model", "seeded");
  if (seededError) throw seededError;

  let sessions = admin
    .from("sessions")
    .delete({ count: "exact" })
    .eq("user_id", demoId)
    .lt("started_at", cutoff);
  const keep = (seeded ?? []).map((r) => r.session_id);
  if (keep.length) sessions = sessions.not("id", "in", `(${keep.join(",")})`);
  const { count: removedSessions, error: sessionsError } = await sessions;
  if (sessionsError) throw sessionsError;

  // Scenarios are referenced ON DELETE RESTRICT, so skip any still in use.
  const { data: used, error: usedError } = await admin
    .from("sessions")
    .select("scenario_id")
    .eq("user_id", demoId);
  if (usedError) throw usedError;

  let scenarios = admin
    .from("scenarios")
    .delete({ count: "exact" })
    .eq("user_id", demoId)
    .eq("is_preset", false)
    .lt("created_at", cutoff);
  const inUse = [...new Set((used ?? []).map((s) => s.scenario_id))];
  if (inUse.length) scenarios = scenarios.not("id", "in", `(${inUse.join(",")})`);
  const { count: removedScenarios, error: scenariosError } = await scenarios;
  if (scenariosError) throw scenariosError;

  return { sessions: removedSessions ?? 0, scenarios: removedScenarios ?? 0 };
}
