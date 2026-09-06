"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/brand/wordmark";
import { LinkButton, Spinner } from "@/components/ui/primitives";

/**
 * One-click demo entry.
 *
 * This exists as its own route rather than a button so the URL itself is
 * shareable: /demo can go straight on a CV or portfolio and drops the
 * reader into a populated account with no form, no email, and no decision
 * to make. Account creation is the single biggest drop-off between someone
 * opening a link and seeing whether the work is any good.
 *
 * The credentials are NEXT_PUBLIC by design — the demo account is meant to
 * be shared, every table is RLS-scoped, and a per-user daily session cap
 * bounds what a visitor can spend.
 */
/* Read once at module scope. NEXT_PUBLIC_ values are inlined at build time,
   so whether the demo is configured is a build-time constant rather than
   something to discover in an effect. */
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD;
const CONFIGURED = Boolean(DEMO_EMAIL && DEMO_PASSWORD);

const NOT_CONFIGURED =
  "The demo account is not configured for this deployment. You can still create an account.";

export default function DemoPage() {
  const router = useRouter();
  const [signInError, setSignInError] = useState<string | null>(null);
  const started = useRef(false);

  // Derived, not stateful: setting this from an effect would be a cascading
  // render for a value that cannot change after build.
  const error = CONFIGURED ? signInError : NOT_CONFIGURED;

  useEffect(() => {
    if (!CONFIGURED) return;
    // Guard against the double-invoke of effects in development.
    if (started.current) return;
    started.current = true;

    (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL!,
        password: DEMO_PASSWORD!,
      });
      if (error) {
        setSignInError(
          "The demo account could not be opened just now. Please sign in instead.",
        );
        return;
      }
      // Land on the dashboard: seeded history makes the product legible in
      // one screen, and a finished report is one click away.
      router.replace("/dashboard");
      router.refresh();
    })();
  }, [router]);

  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-5">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center text-[17px] text-ink">
          <Wordmark />
        </div>

        {error ? (
          <>
            <p className="display text-[1.4rem] font-semibold">Demo unavailable</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-muted text-pretty">
              {error}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <LinkButton href="/signup">Create an account</LinkButton>
              <LinkButton href="/login" variant="outline">
                Sign in
              </LinkButton>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <Spinner label="Opening the demo account" />
            </div>
            <p className="mt-4 text-[13px] text-ink-faint">
              No signup required. You are being dropped into an account with
              negotiation history already in it.
            </p>
          </>
        )}

        <p className="mt-10 text-[12.5px] text-ink-faint">
          <Link href="/" className="underline underline-offset-4 hover:text-ink">
            Back to the homepage
          </Link>
        </p>
      </div>
    </div>
  );
}
