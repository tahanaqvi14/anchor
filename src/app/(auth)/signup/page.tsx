import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { Spinner } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <div>
      <h1 className="display text-[2.1rem] font-semibold text-balance">
        Lose here instead.
      </h1>
      <p className="mt-2 mb-8 text-[15px] leading-relaxed text-ink-muted text-pretty">
        Four opponents, a full transcript, and a report that quotes you back to yourself.
        Free, and it takes a minute.
      </p>
      <Suspense fallback={<Spinner label="Loading" />}>
        <AuthForm mode="signup" />
      </Suspense>
    </div>
  );
}
