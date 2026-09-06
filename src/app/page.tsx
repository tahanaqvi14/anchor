import Link from "next/link";
import { ArrowRight, Mic, Quote } from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Reveal } from "@/components/motion/reveal";
import { PERSONA_LIST } from "@/lib/personas";

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-paper">
      <SiteHeader />
      <main>
        <Hero />
        <Opponents />
        <ReportSection />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="text-[15px] text-ink">
          <Wordmark />
        </Link>

        <nav className="ml-4 hidden items-center gap-6 text-sm text-ink-muted md:flex">
          <a href="#opponents" className="transition-colors hover:text-ink">
            Opponents
          </a>
          <a href="#report" className="transition-colors hover:text-ink">
            The report
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden px-2 text-sm text-ink-muted transition-colors hover:text-ink sm:block"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-85"
          >
            Start practising
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-8 sm:pb-28 sm:pt-20">
      <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <Reveal>
            <p className="eyebrow">Negotiation rehearsal</p>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="display mt-5 text-[clamp(2.6rem,7vw,4.4rem)] font-semibold text-balance">
              Practice the conversation before it costs you.
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink-muted text-pretty">
              Anchor puts you across the table from an opponent that actually
              pushes back — one that anchors low, stalls, manufactures
              deadlines, and will walk away from you. Then it shows you,
              message by message, exactly where you gave ground you didn&rsquo;t
              have to.
            </p>
          </Reveal>

          <Reveal delay={0.18}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 rounded-full bg-brass px-5 py-3 text-sm font-medium text-[#14120f] transition-transform hover:-translate-y-px"
              >
                Start a negotiation
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </Link>
              <a
                href="#report"
                className="inline-flex items-center gap-2 rounded-full border border-rule-strong px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-paper-sunken"
              >
                See a sample report
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.24}>
            <p className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-faint">
              <span>Free to use</span>
              <Dot />
              <span>Four opponents</span>
              <Dot />
              <span className="inline-flex items-center gap-1.5">
                <Mic className="size-3.5" strokeWidth={1.75} />
                Text or voice
              </span>
            </p>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <Reveal delay={0.14} y={20}>
            <TranscriptSpecimen />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Dot() {
  return <span className="text-rule-strong">&middot;</span>;
}

/* ------------------------------------------------------------------ */

/**
 * A worked specimen rather than a screenshot or an abstract illustration.
 * It shows the Professional's actual tactic — validate the ask, decline the
 * money, substitute a non-monetary sweetener — which explains the product
 * faster than any feature list could.
 */
function TranscriptSpecimen() {
  return (
    <figure className="overflow-hidden rounded-xl border border-rule bg-paper-raised shadow-[var(--shadow-lg)]">
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule px-5 py-3.5">
        <span className="eyebrow">Salary negotiation</span>
        <span className="text-rule-strong">/</span>
        <span className="text-[13px] font-medium text-steel">
          The Friendly-but-Firm Professional
        </span>
        <span className="tnum ml-auto text-[11px] text-ink-faint">04:12</span>
      </figcaption>

      <div className="divide-y divide-rule">
        <SpecimenLine
          seq={3}
          speaker="You"
          side="you"
          body={
            <>
              I&rsquo;ve looked at what this role is paying elsewhere, and I was
              hoping we could get to{" "}
              <span className="tnum font-medium text-ink">$175,000</span>.
            </>
          }
        />
        <SpecimenLine
          seq={4}
          speaker="Hiring manager"
          side="them"
          body={
            <>
              That&rsquo;s a completely fair thing to ask, and honestly your
              background supports it — I&rsquo;m not going to pretend otherwise.
              The band for this level tops out at{" "}
              <span className="tnum font-medium text-ink">$158,000</span>,
              though, and that part genuinely isn&rsquo;t mine to move. What I{" "}
              <em>can</em> do is put you forward for the accelerated review at
              six months.
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule bg-paper-sunken px-5 py-3.5">
        <span className="eyebrow">Their position</span>
        <span className="tnum text-[15px] font-medium text-ink">$158,000</span>
        <span className="ml-auto inline-flex items-center gap-2 text-[12px] text-ink-muted">
          <span className="size-1.5 rounded-full bg-steel" />
          Unmoved across 4 messages
        </span>
      </div>
    </figure>
  );
}

function SpecimenLine({
  seq,
  speaker,
  side,
  body,
}: {
  seq: number;
  speaker: string;
  side: "you" | "them";
  body: React.ReactNode;
}) {
  const you = side === "you";
  return (
    <div className="flex gap-3 px-5 py-4 sm:gap-4">
      <div className="flex w-14 shrink-0 flex-col items-start gap-1 pt-0.5">
        <span className="tnum text-[11px] text-ink-faint">#{seq}</span>
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider ${
            you ? "text-brass" : "text-steel"
          }`}
        >
          {speaker === "You" ? "You" : "Them"}
        </span>
      </div>
      <p className="min-w-0 flex-1 text-[14.5px] leading-relaxed text-ink-muted">
        {body}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Opponents() {
  return (
    <section
      id="opponents"
      className="scroll-mt-20 border-t border-rule bg-paper-sunken"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="max-w-2xl">
          <Reveal>
            <p className="eyebrow">Four opponents</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="display mt-4 text-[clamp(1.9rem,4.5vw,2.9rem)] font-semibold text-balance">
              Each one beats you differently.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-muted text-pretty">
              They are not one model wearing four adjectives. Each carries its
              own concession budget, its own patience, and its own conditions
              for walking out on you — so the tactic that works on one will
              lose you money against another.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {PERSONA_LIST.map((p, i) => (
            <Reveal key={p.key} delay={0.05 * i}>
              <article className="flex h-full flex-col rounded-xl border border-rule bg-paper-raised p-6 transition-colors hover:border-rule-strong">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="display text-[1.4rem] font-semibold leading-tight text-balance">
                    {p.title}
                  </h3>
                  <DifficultyMeter value={p.difficulty} />
                </div>

                <p className="mt-3 text-[14.5px] leading-relaxed text-ink-muted text-pretty">
                  {p.tagline}
                </p>

                <ul className="mt-5 space-y-2">
                  {p.tells.map((t) => (
                    <li
                      key={t}
                      className="flex gap-2.5 text-[13.5px] leading-snug text-ink-muted"
                    >
                      <span className="mt-[0.5em] size-1 shrink-0 rounded-full bg-steel" />
                      {t}
                    </li>
                  ))}
                </ul>

                {/* mt-auto pins the counter to the bottom so it lines up
                    across cards of unequal height; the pt-6 on the outer
                    element guarantees breathing room even when the tells
                    fill the card and mt-auto collapses to zero. */}
                <div className="mt-auto pt-6">
                  <div className="border-t border-rule pt-4">
                    <p className="eyebrow">How you beat them</p>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-ink text-pretty">
                      {p.counter}
                    </p>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function DifficultyMeter({ value }: { value: number }) {
  return (
    <span
      className="flex shrink-0 items-end gap-[3px] pt-1.5"
      title={`Difficulty ${value} of 4`}
    >
      <span className="sr-only">Difficulty {value} of 4</span>
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          style={{ height: `${5 + n * 3}px` }}
          className={`w-[3px] rounded-full ${
            n <= value ? "bg-brass" : "bg-rule-strong"
          }`}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */

function ReportSection() {
  return (
    <section id="report" className="scroll-mt-20 border-t border-rule">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="eyebrow">After the session</p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className="display mt-4 text-[clamp(1.9rem,4.5vw,2.9rem)] font-semibold text-balance">
                It quotes you back to yourself.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-5 space-y-4 text-[16px] leading-relaxed text-ink-muted text-pretty">
                <p>
                  Generic advice is easy to write and impossible to act on.
                  Anchor will not tell you to be more confident.
                </p>
                <p>
                  Every observation in the report is pinned to a numbered
                  message in your transcript, quoted verbatim, with the words
                  you could have used instead. If a claim can&rsquo;t cite the
                  line it came from, it doesn&rsquo;t make the report.
                </p>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-7">
            <Reveal delay={0.12} y={20}>
              <ReportSpecimen />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReportSpecimen() {
  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded-xl border border-rule bg-paper-raised p-6 shadow-[var(--shadow-md)]">
        <div>
          <p className="eyebrow">Outcome</p>
          <p className="display mt-1.5 text-[1.6rem] font-semibold">
            Deal at <span className="tnum">$161,000</span>
          </p>
          <p className="tnum mt-1 text-[13px] text-walk">
            &minus;$14,000 against your target
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="eyebrow">Score</p>
          <p className="tnum mt-1 text-[2.6rem] font-medium leading-none text-ink">
            62
          </p>
        </div>
      </div>

      {/* One misstep, shown in full */}
      <div className="rounded-xl border border-rule bg-paper-raised p-6 shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2.5">
          <span className="rounded-full bg-walk-wash px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-walk">
            Misstep
          </span>
          <span className="tnum text-[12px] text-ink-faint">Message #5</span>
        </div>

        <h3 className="mt-4 text-[16px] font-semibold text-ink">
          You accepted the constraint before testing it
        </h3>

        <blockquote className="mt-4 flex gap-3 border-l-2 border-rule-strong pl-4">
          <Quote className="mt-1 size-3.5 shrink-0 text-ink-faint" strokeWidth={2} />
          <p className="text-[14.5px] italic leading-relaxed text-ink-muted">
            Okay, I understand the band is fixed. Could we look at the equity
            side instead?
          </p>
        </blockquote>

        <p className="mt-4 text-[14.5px] leading-relaxed text-ink-muted text-pretty">
          The band was asserted, never evidenced — and you moved off base
          salary one message after hearing about it. You also introduced equity
          yourself, which handed them a cheaper currency to pay you in.
        </p>

        <div className="mt-5 rounded-lg border border-brass/30 bg-brass-wash p-4">
          <p className="eyebrow text-brass">Try instead</p>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink text-pretty">
            &ldquo;I hear the band tops out there. Who would need to be involved
            to make an exception, and when was the last time one was
            approved?&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SiteFooter() {
  return (
    <footer className="border-t border-rule bg-paper-sunken">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:px-8">
        <Link href="/" className="text-[15px] text-ink">
          <Wordmark />
        </Link>
        <p className="text-[13px] text-ink-faint sm:ml-auto">
          A practice environment. Not legal, financial or career advice.
        </p>
      </div>
    </footer>
  );
}
