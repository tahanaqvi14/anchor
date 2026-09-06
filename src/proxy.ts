import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session on every request and guards the private
 * routes. Named `proxy` in src/proxy.ts: Next 16 deprecated the `middleware`
 * file convention in favour of this one. Server Components cannot write cookies, so without this the auth
 * token would silently expire mid-session and reads would start coming back
 * empty rather than erroring — the confusing failure mode this prevents.
 */

const PROTECTED = ["/practice", "/dashboard", "/session"];
const AUTH_ROUTES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  // Supabase appends ?code=... to the project's configured Site URL, which
  // is the site ROOT — not to /auth/callback where our exchange handler
  // lives. A confirmation or OAuth link therefore lands on "/" holding a
  // code that nothing consumes, and the user sees the landing page (or, if
  // Site URL is still localhost, a connection error) instead of being signed
  // in. Forwarding any stray code to the handler makes the flow work
  // regardless of exactly how the Supabase URL settings are configured.
  const q = request.nextUrl.searchParams;
  // A rejected or cancelled provider sign-in comes back the same way but
  // carrying ?error=... instead of a code, so both have to be forwarded or
  // the failure lands on the landing page and looks like nothing happened.
  // error_description/error_code are what distinguish an OAuth bounce from
  // some other page that merely has an "error" query param.
  const isAuthBounce =
    q.has("code") || (q.has("error") && (q.has("error_description") || q.has("error_code")));

  if (isAuthBounce && !request.nextUrl.pathname.startsWith("/auth/callback")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser revalidates against the auth server; getSession would trust a
  // cookie the client could have tampered with.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_ROUTES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/practice";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /* Everything except static assets and image files. */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
