import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";

/* Shared primitives. Deliberately small and explicit rather than a
   variant system — there are four buttons and three surfaces in this app,
   and an abstraction layer would cost more than it saves. */

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS = {
  primary: "bg-brass text-[#14120f] hover:-translate-y-px hover:shadow-[var(--shadow-md)]",
  solid: "bg-ink text-paper hover:opacity-85",
  outline: "border border-rule-strong text-ink hover:bg-paper-sunken",
  ghost: "text-ink-muted hover:bg-paper-sunken hover:text-ink",
  danger: "border border-walk/40 text-walk hover:bg-walk-wash",
} as const;

const SIZES = {
  sm: "px-3.5 py-2 text-[13px]",
  md: "px-5 py-2.5",
  lg: "px-6 py-3",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  ...rest
}: ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ComponentProps<typeof Link> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}) {
  return (
    <Link {...rest} className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}>
      {children}
    </Link>
  );
}

export function Field({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[12.5px] text-walk">{error}</span>
      ) : help ? (
        <span className="mt-1.5 block text-[12.5px] leading-snug text-ink-faint">{help}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-rule bg-paper-raised px-3.5 py-2.5 text-[14.5px] text-ink placeholder:text-ink-faint focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20";

/** Inline error banner used for every failed async action. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-walk/30 bg-walk-wash px-4 py-3 text-[13.5px] leading-relaxed text-walk"
    >
      {children}
    </div>
  );
}

/** Shared empty state so "nothing here yet" always looks intentional. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-rule-strong px-6 py-14 text-center">
      <div className="mb-4 grid size-11 place-items-center rounded-full bg-paper-sunken text-ink-faint">
        {icon}
      </div>
      <p className="display text-[1.35rem] font-semibold">{title}</p>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-ink-muted text-pretty">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[13.5px] text-ink-muted">
      <Loader2 className="size-4 animate-spin" strokeWidth={2} />
      {label}
    </div>
  );
}

export function money(value: number, unit: string, suffix?: string | null) {
  const n = Math.round(value).toLocaleString("en-US");
  return `${unit === "USD" ? "$" : ""}${n}${suffix ?? ""}`;
}
