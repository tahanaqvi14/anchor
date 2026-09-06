import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { Spinner } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="display text-[2.1rem] font-semibold">Welcome back.</h1>
      <p className="mt-2 mb-8 text-[15px] leading-relaxed text-ink-muted">
        Pick up where you left off, or take on an opponent you have not beaten yet.
      </p>
      {/* useSearchParams needs a Suspense boundary to keep the route static. */}
      <Suspense fallback={<Spinner label="Loading" />}>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
