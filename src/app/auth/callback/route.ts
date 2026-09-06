import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth and email-confirmation landing point. Exchanges the one-time code
 * for a session cookie, then forwards the user on.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/practice";

  // Only same-site paths, so a crafted link cannot bounce a freshly
  // authenticated user off to somewhere else.
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/practice";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${base(request, origin)}/login?error=auth_failed`);
  }

  return NextResponse.redirect(`${base(request, origin)}${destination}`);
}

/**
 * Behind Vercel's proxy, `new URL(request.url).origin` is the internal
 * upstream address rather than the public domain, so redirecting to it sends
 * the user somewhere that does not exist publicly. The forwarded host is the
 * domain the browser actually asked for.
 */
function base(request: Request, origin: string): string {
  if (process.env.NODE_ENV === "development") return origin;
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (!forwardedHost) return origin;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${forwardedHost}`;
}
