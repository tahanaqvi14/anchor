import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Server client for Server Components and Route Handlers.
 *
 * Deliberately built on the PUBLISHABLE key plus the user's own cookie, not
 * the secret key. Every server-side read and write therefore passes through
 * the same RLS policies as the browser would — which is what makes the
 * multi-tenancy claim true of the whole application rather than just the
 * client. The secret key never touches a user's data path.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Middleware refreshes the session instead, so this is safe.
          }
        },
      },
    },
  );
}

/**
 * Admin client. Bypasses RLS entirely, so it is confined to two narrow,
 * non-user paths: the keepalive cron, and demo-account housekeeping
 * (src/lib/demo.ts), which only ever acts on the single is_demo account.
 * Never use it to read or write data on behalf of a signed-in user.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
