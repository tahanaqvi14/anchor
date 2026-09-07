import Link from "next/link";
import { ArrowRight, Mic } from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Reveal } from "@/components/motion/reveal";
import { PositionTrack } from "@/components/position-track";
import { PERSONA_LIST } from "@/lib/personas";

/**
 * Landing page.
 *
 * Built as a document rather than a stack of cards: a ruled editorial grid
 * with an indexed gutter, monospace labels carrying every piece of
 * metadata, and the serif reserved for statements. The specimens are real
 * product output, because the fastest way to explain this is to show the
 * opponent refusing to move.
 */
export default function LandingPage() {
  return (
    <div className="grain min-h-dvh bg-paper">
      <SiteHeader />
      <main>
        <Hero />
        <Opponents />
        <ReportSection />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[78rem] items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="text-[15px] text-ink">
          <Wordmark />
        </Link>

        <nav className="ml-6 hidden items-center gap-7 md:flex">
          <a href="#opponents" className="label transition-colors hover:text-ink">
            Opponents
          </a>
          <a href="#report" className="label transition-colors hover:text-ink">
            The report
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login" className="label hidden transition-colors hover:text-ink sm:block">
            Sign in
          </Link>
          <Link
            href="/demo"
            className="label-strong label border border-rule-strong px-3.5 py-2 transition-all duration-150 hover:bg-ink hover:text-paper active:scale-[0.97]"
          >
            Live demo
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto max-w-[78rem] px-5 sm:px-8">
        <div className="grid gap-0 lg:grid-cols-12">
          {/* Statement column */}
          <div className="border-rule py-14 sm:py-20 lg:col-span-7 lg:border-r lg:pr-14">
            <Reveal>
              <div className="flex items-center gap-3">
                <span className="index">01</span>
                <span className="h-px w-8 bg-rule-strong" />
                <span className="label">Negotiation rehearsal</span>
              </div>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="display-xl mt-8 text-[clamp(2.9rem,8vw,6.2rem)] text-balance">
                Practice the conversation before it costs you.
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-8 max-w-xl text-[17px] leading-[1.65] text-ink-muted text-pretty">
                An opponent that anchors low, stalls, manufactures deadlines and
                will walk away from you. Then a report that quotes your own
                messages back and shows exactly where you gave ground you
                didn&rsquo;t have to.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/demo"
                  className="group inline-flex items-center gap-2.5 bg-brass px-6 py-3.5 text-[14px] font-medium text-[#14120f] transition-all duration-150 hover:bg-brass-bright active:scale-[0.98]"
                >
                  Try it — no signup
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1"
                    strokeWidth={2}
                  />
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 border border-rule-strong px-6 py-3.5 text-[14px] font-medium text-ink transition-all duration-150 hover:bg-ink hover:text-paper active:scale-[0.98]"
                >
                  Create an account
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="label">Free</span>
                <span className="label">Four opponents</span>
                <span className="label inline-flex items-center gap-1.5">
                  <Mic className="size-3" strokeWidth={2} />
                  Text or voice
                </span>
              </div>
            </Reveal>
          </div>

          {/* Specimen column */}
          <div className="flex flex-col justify-center border-t border-rule py-12 lg:col-span-5 lg:border-t-0 lg:py-20 lg:pl-14">
            <Reveal delay={0.14} y={18}>
              <TranscriptSpecimen />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Real product output. It shows the Professional's actual tactic — concede
 * the argument, hold the number, substitute a currency that costs nothing —
 * which explains the product faster than any feature list.
 */
function TranscriptSpecimen() {
  return (
    <figure>
      <div className="flex items-center justify-between gap-3 border-b border-rule-strong pb-2.5">
        <span className="label label-strong">Salary &middot; The Professional</span>
        <span className="index">04:12</span>
      </div>

      <div className="divide-y divide-rule">
        <SpecimenLine
          seq="03"
          who="You"
          mine
          body={
            <>
              I&rsquo;ve looked at what this role pays elsewhere. I was hoping we
              could get to <Fig>$175,000</Fig>.
            </>
          }
        />
        <SpecimenLine
          seq="04"
          who="Them"
          body={
            <>
              That&rsquo;s a completely fair thing to ask, and honestly your
              background supports it. The band tops out at <Fig>$158,000</Fig>{" "}
              though, and that part genuinely isn&rsquo;t mine to move. What I{" "}
              <em>can</em> do is put you up for the six-month review.
            </>
          }
        />
      </div>

      <div className="mt-6 border-t border-rule-strong pt-5">
        <PositionTrack
          anchor={145000}
          current={158000}
          target={175000}
          unit="USD"
          unitSuffix="/yr"
          size="md"
        />
      </div>
    </figure>
  );
}

function Fig({ children }: { children: React.ReactNode }) {
  return <span className="tnum font-medium text-ink">{children}</span>;
}

function SpecimenLine({
  seq,
  who,
  mine = false,
  body,
}: {
  seq: string;
  who: string;
  mine?: boolean;
  body: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 py-4">
      <div className="w-12 shrink-0 pt-0.5">
        <div className="index">{seq}</div>
        <div className={`label mt-1 ${mine ? "text-brass" : "text-steel"}`}>{who}</div>
      </div>
      <p className="min-w-0 flex-1 text-[14px] leading-[1.6] text-ink-muted">{body}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Opponents() {
  return (
    <section id="opponents" className="scroll-mt-14 border-b border-rule">
      <div className="mx-auto max-w-[78rem] px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Reveal>
              <div className="flex items-center gap-3">
                <span className="index">02</span>
                <span className="h-px w-8 bg-rule-strong" />
                <span className="label">Four opponents</span>
              </div>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className="display-xl mt-6 text-[clamp(2rem,4.5vw,3.2rem)] text-balance">
                Each one beats you differently.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-sm text-[15.5px] leading-[1.65] text-ink-muted text-pretty">
                Not one model wearing four adjectives. Each carries its own
                concession budget, its own patience, and its own conditions for
                walking out — so the tactic that works on one loses you money
                against another.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-8">
            <div className="border-t border-rule-strong">
              {PERSONA_LIST.map((p, i) => (
                <Reveal key={p.key} delay={0.04 * i}>
                  <article className="group grid gap-x-8 gap-y-4 border-b border-rule py-7 md:grid-cols-12">
                    <div className="md:col-span-5">
                      <div className="flex items-baseline gap-3">
                        <span className="index">{String(i + 1).padStart(2, "0")}</span>
                        <h3 className="display text-[1.35rem] font-semibold leading-tight text-balance">
                          {p.title}
                        </h3>
                      </div>
                      <div className="mt-3 flex items-center gap-2.5 pl-9">
                        <Difficulty value={p.difficulty} />
                        <span className="label">Difficulty {p.difficulty}/4</span>
                      </div>
                    </div>

                    <div className="md:col-span-7">
                      <p className="text-[14.5px] leading-[1.6] text-ink-muted text-pretty">
                        {p.tagline}
                      </p>
                      <div className="mt-4 border-l-2 border-brass pl-4">
                        <p className="label">How you beat them</p>
                        <p className="mt-1.5 text-[14px] leading-[1.55] text-ink text-pretty">
                          {p.counter}
                        </p>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Difficulty({ value }: { value: number }) {
  return (
    <span className="flex items-end gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          style={{ height: `${4 + n * 3}px` }}
          className={`w-[3px] ${n <= value ? "bg-brass" : "bg-rule"}`}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */

function ReportSection() {
  return (
    <section id="report" className="scroll-mt-14 border-b border-rule">
      <div className="mx-auto max-w-[78rem] px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Reveal>
              <div className="flex items-center gap-3">
                <span className="index">03</span>
                <span className="h-px w-8 bg-rule-strong" />
                <span className="label">After the session</span>
              </div>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className="display-xl mt-6 text-[clamp(2rem,4.5vw,3.2rem)] text-balance">
                It quotes you back to yourself.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-5 space-y-4 text-[15.5px] leading-[1.65] text-ink-muted text-pretty">
                <p>
                  Generic advice is easy to write and impossible to act on.
                  Anchor will not tell you to be more confident.
                </p>
                <p>
                  Every observation is pinned to a numbered message, quoted
                  verbatim, with the words you could have used instead. If a
                  claim can&rsquo;t cite the line it came from, it doesn&rsquo;t
                  make the report.
                </p>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-7">
            <Reveal delay={0.12} y={18}>
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
    <div className="border-t border-rule-strong">
      <div className="grid gap-6 border-b border-rule py-6 sm:grid-cols-2">
        <div>
          <p className="label">Outcome</p>
          <p className="display mt-2 text-[1.7rem] font-semibold">
            Deal at <span className="tnum">$161,000</span>
          </p>
          <p className="tnum mt-1.5 text-[13px] text-walk">
            &minus;$14,000 against target
          </p>
        </div>
        <div className="sm:text-right">
          <p className="label">Score</p>
          <p className="tnum mt-1 text-[3.4rem] font-medium leading-none text-ink">62</p>
        </div>
      </div>

      <article className="border-b border-rule py-7">
        <div className="flex items-center gap-3">
          <span className="label bg-walk-wash px-2 py-1 text-walk">Misstep</span>
          <span className="index">Message 05</span>
        </div>

        <h3 className="mt-4 text-[16px] font-semibold text-ink">
          You accepted the constraint before testing it
        </h3>

        <blockquote className="mt-4 border-l-2 border-rule-strong pl-4 text-[14.5px] italic leading-[1.6] text-ink-muted">
          Okay, I understand the band is fixed. Could we look at the equity side
          instead?
        </blockquote>

        <p className="mt-4 text-[14.5px] leading-[1.6] text-ink-muted text-pretty">
          The band was asserted, never evidenced — and you moved off base salary
          one message after hearing about it. You also introduced equity
          yourself, handing them a cheaper currency to pay you in.
        </p>

        <div className="mt-5 border-l-2 border-brass bg-brass-wash p-4">
          <p className="label text-brass">Try instead</p>
          <p className="mt-2 text-[14.5px] leading-[1.6] text-ink text-pretty">
            &ldquo;I hear the band tops out there. Who would need to be involved
            to make an exception, and when was the last time one was
            approved?&rdquo;
          </p>
        </div>
      </article>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ClosingCta() {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto max-w-[78rem] px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <p className="display-xl max-w-4xl text-[clamp(2.2rem,6vw,4.6rem)] text-balance">
            The next one is real. This one isn&rsquo;t.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <Link
            href="/demo"
            className="group mt-10 inline-flex items-center gap-2.5 bg-brass px-7 py-4 text-[14px] font-medium text-[#14120f] transition-all duration-150 hover:bg-brass-bright active:scale-[0.98]"
          >
            Open the live demo
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-1"
              strokeWidth={2}
            />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto flex max-w-[78rem] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:px-8">
        <Link href="/" className="text-[15px] text-ink">
          <Wordmark />
        </Link>
        <p className="label sm:ml-auto">
          A practice environment &middot; not legal or financial advice
        </p>
      </div>
    </footer>
  );
}
