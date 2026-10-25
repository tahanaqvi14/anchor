import type { SupabaseClient } from "@supabase/supabase-js";

/* NEXT_PUBLIC_ values are inlined at build time, so whether the demo is
   configured is a build-time constant. */
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD;

export const DEMO_CONFIGURED = Boolean(DEMO_EMAIL && DEMO_PASSWORD);

/**
 * Signs the browser in to the shared demo account. Resolves true on success.
 *
 * The credentials are public, so a previous visitor may have changed them
 * (any signed-in user can change their own password). If the sign-in fails,
 * the server restores the published credentials and it is retried once —
 * one stranger cannot take the demo down for everyone who follows.
 */
export async function signInToDemo(supabase: SupabaseClient): Promise<boolean> {
  if (!DEMO_CONFIGURED) return false;

  // Clears old visitor sessions in the background; best-effort by design.
  void fetch("/api/demo", { method: "POST" }).catch(() => {});

  const attempt = () =>
    supabase.auth.signInWithPassword({ email: DEMO_EMAIL!, password: DEMO_PASSWORD! });

  let { error } = await attempt();
  if (error) {
    const restored = await fetch("/api/demo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ restore: true }),
    }).catch(() => null);
    if (restored?.ok) ({ error } = await attempt());
  }
  return !error;
}
