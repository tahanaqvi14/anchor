"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui/primitives";

/**
 * Shared sign-in / sign-up form.
 *
 * Supabase can be configured to require email confirmation, so signUp has
 * two distinct successful outcomes — session returned, or "go and check
 * your inbox". Treating the second as an error is a common bug and looks
 * to the user like the account was not created.
 */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/practice";
  // Encoded before being embedded in a query string: an unencoded path
  // carrying its own ?/& would silently truncate the redirect target.
  const nextParam = encodeURIComponent(next);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkInbox, setCheckInbox] = useState(false);

  // The auth callback redirects here with ?error=... when a link fails.
  // Without surfacing it, an expired or already-used confirmation link just
  // returns a blank sign-in page and the user has no idea what went wrong.
  const linkError = params.get("error");
  const linkErrorMessage =
    linkError === "auth_failed"
      ? "That sign-in link did not work — it may have expired or already been used. Sign in below, or request a new one."
      : linkError === "cancelled"
        ? "Sign-in was cancelled. You can try again, or use an email and password."
        : linkError === "provider"
          ? "That sign-in provider is not available right now. Use an email and password instead."
          : linkError === "missing_code"
            ? "That link was incomplete. Try signing in below."
            : null;

  const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL;
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD;

  async function signInWith(mail: string, pass: string, kind: "email" | "demo") {
    setBusy(kind);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: mail,
      password: pass,
    });
    if (error) {
      setError(
        error.message.toLowerCase().includes("invalid")
          ? "That email and password do not match an account."
          : error.message,
      );
      setBusy(null);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter both an email and a password.");
      return;
    }
    if (mode === "login") return signInWith(email.trim(), password, "email");

    setBusy("email");
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${nextParam}` },
    });

    if (error) {
      const raw = error.message.toLowerCase();
      setError(
        raw.includes("least")
          ? "Passwords need to be at least 6 characters."
          : // Supabase's built-in email service allows only a couple of
            // messages per hour, and its raw text ("email rate limit
            // exceeded") reads like the user did something wrong. Point
            // them at the demo account instead of a dead end.
            raw.includes("rate limit") || raw.includes("over_email_send")
            ? "Too many confirmation emails have been sent from this demo in the last hour. Use the demo account below to look around, or try again shortly."
            : raw.includes("already registered") || raw.includes("already been registered")
              ? "There is already an account with that email. Sign in instead."
              : error.message,
      );
      setBusy(null);
      return;
    }

    // No session means the project requires email confirmation.
    if (!data.session) {
      setCheckInbox(true);
      setBusy(null);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function withGoogle() {
    setBusy("google");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${nextParam}` },
    });
    if (error) {
      setError(
        "Google sign-in is not configured for this deployment. Use an email and password instead.",
      );
      setBusy(null);
    }
  }

  if (checkInbox) {
    return (
      <div className="rounded-xl border border-rule bg-paper-raised p-6 text-center">
        <div className="mx-auto mb-4 grid size-11 place-items-center rounded-full bg-brass-wash text-brass">
          <MailCheck className="size-5" strokeWidth={1.75} />
        </div>
        <p className="display text-[1.3rem] font-semibold">Confirm your email</p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          We sent a link to <span className="font-medium text-ink">{email}</span>. Open it and
          you will be signed straight in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(error || linkErrorMessage) && <ErrorNote>{error ?? linkErrorMessage}</ErrorNote>}

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email">
          <input
            type="email"
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </Field>

        <Field
          label="Password"
          help={mode === "signup" ? "At least 6 characters." : undefined}
        >
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" loading={busy === "email"} className="w-full" size="lg">
          {mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-[12px] text-ink-faint">
        <span className="h-px flex-1 bg-rule" />
        or
        <span className="h-px flex-1 bg-rule" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        loading={busy === "google"}
        onClick={withGoogle}
      >
        <GoogleMark />
        Continue with Google
      </Button>

      {demoEmail && demoPassword && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          loading={busy === "demo"}
          onClick={() => signInWith(demoEmail, demoPassword, "demo")}
        >
          Or explore with the demo account
        </Button>
      )}

      <p className="text-center text-[13px] text-ink-muted">
        {mode === "signup" ? "Already have an account? " : "No account yet? "}
        <Link
          href={mode === "signup" ? "/login" : "/signup"}
          className="font-medium text-ink underline underline-offset-4 hover:text-brass"
        >
          {mode === "signup" ? "Sign in" : "Create one"}
        </Link>
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z" />
    </svg>
  );
}
