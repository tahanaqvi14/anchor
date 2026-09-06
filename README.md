# Anchor

**Practice the conversation before it costs you.**

A negotiation simulator that puts you across the table from an AI opponent that
actually pushes back — one that anchors low, stalls, manufactures deadlines, and
will walk away from you. When it's over, it hands you a report that quotes your
own messages back to you and tells you exactly where you gave ground you didn't
have to.

Built with Next.js 16, Supabase and Gemini, running entirely on free tiers.

---

## The problem

Negotiation is a skill you almost only practise live, in the situations where
getting it wrong is most expensive. There is no low-stakes rehearsal for asking
for a raise. Worse, the feedback loop is broken at both ends: you rarely find
out what the other side would have accepted, and generic advice ("be confident",
"anchor high") is impossible to act on in the moment.

Two things had to be true for this to be worth building:

1. **The opponent must be genuinely hard to beat.** An LLM asked to role-play a
   tough negotiator is agreeable by default. It concedes because conceding is
   what helpful assistants do. If the AI folds, the practice is worthless.
2. **The feedback must be specific to what you actually said.** "You could have
   anchored higher" teaches nothing. "At message 4 you said *I could probably
   come down to $165,000* — you gave away $10,000 before they had asked" teaches
   something.

Everything below follows from those two constraints.

---

## How it works

### The opponent cannot decide to concede

Each turn, the model returns structured JSON: its reply, the tactic it read in
your message, and the position it *wants* to move to. Application code then
clamps that position into a range the persona's playbook allows.

```
model proposes  →  ledger clamps  →  user sees the clamped number
```

Conceding past the reservation value is arithmetically impossible rather than
merely discouraged. No amount of persuasion — or instruction-shaped text pasted
into a message — moves an opponent further than its budget permits.

Two things are deliberately withheld from the model:

- **its own reservation value.** A model that knows its floor will eventually
  allude to it, drift toward it, or hand it over when asked nicely. It is told
  only how far it may move *this turn*.
- **your walk-away number**, which you enter privately during setup.

### Four opponents that differ mechanically, not tonally

Tone alone produces four models that cave at the same rate in different words.
The real differentiation lives in [`playbooks.ts`](src/lib/negotiation/playbooks.ts)
as numbers the model never sees: how far each will ever move, what makes it
move, what it does when *you* concede, and what makes it leave.

Measured across a 4-turn scripted replay:

| user behaviour | Lowballer | Staller | Professional | Closer |
|---|---|---|---|---|
| holds firm, no justification | 0% | 0% | 0% | **walks** |
| concedes unprompted each turn | 0% | 0% | 0% | 0% |
| brings verifiable evidence | **15%** | **7%** | **8%** | **25%** |
| turns hostile | walks | *stalls on* | walks | walks |

The teaching signal falls straight out of that table: **evidence is the only
thing that moves anyone.** Repeating your number moves nobody. Conceding
unprompted is never reciprocated.

The Friendly-but-Firm Professional is the difficulty-4 opponent, not the
aggressive one — it has the smallest concession budget of the four. Losing to
someone pleasant feels like winning, which is exactly what makes it hard.

### The report has to cite its sources

The report generator is given the transcript with explicit `[#n]` markers, and
its output schema *requires* a `message_seq` and a verbatim `quote` on every
observation. Then every citation is verified against the transcript:

- quote found in the cited message → kept
- quote found in a *different* message → re-pointed at the real one
- quote found nowhere → **discarded**

If too few survive, the whole report is regenerated with the failures named. A
model cannot bluff a citation past this, which is what makes the report worth
reading rather than merely well-written.

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase Postgres with RLS |
| Auth | Supabase Auth — email/password + Google OAuth |
| AI | Gemini (`3.5-flash-lite` for turns, `3.8-flash` for reports) |
| Charts | Recharts |
| Motion | Motion (Framer Motion) |
| Voice | Web Speech API — no external service |
| Hosting | Vercel |

Type: **Fraunces** (display), **Instrument Sans** (body), **IBM Plex Mono** —
every figure renders in tabular mono so offers and deltas align down the page.
Colour carries meaning rather than decoration: **brass is you**, **steel is the
opponent who has not moved.**

---

## Key technical decisions

**Multi-tenancy is enforced by Postgres, not by application code.** Every table
has RLS enabled and every policy is scoped to `auth.uid()`. Server routes are
built on the *publishable* key plus the user's own cookie, not the secret key —
so server-side reads pass through the same policies the browser does. The secret
key never touches a request path.

**Transcripts and reports are append-only at the database level.** No
`UPDATE`/`DELETE` policy exists on either. A transcript you can edit after the
fact makes the feedback report meaningless, so the database refuses rather than
trusting the app.

**`messages` carries a denormalised `user_id`** so its RLS predicate is an
indexed equality instead of a subquery into `sessions` on every row. It cannot
drift, because a **composite foreign key** to `sessions(id, user_id)` makes a
mismatched value physically unwritable. `scripts/verify-setup.mjs` proves this:
a cross-tenant write fails with `23503`, a foreign key violation, *before* RLS is
even consulted.

**Personas live in code, not the database.** A system prompt is application
logic and belongs somewhere typed and diffable. Sessions store `persona_key` +
`persona_version`, so an old session stays reproducible against the prompt that
actually produced it.

**Scenario setup forms are declarative.** Each scenario carries a
`context_fields` JSON spec that drives its form, so adding a scenario is a data
change rather than a code change.

**Concession direction is derived, not stored.** A target above the current
offer means you're pushing the number up; below means down. Rent and car
purchases work without a schema column.

---

## Testing

Prompt quality is not something you can eyeball, so both AI paths have eval
harnesses that assert behaviour rather than inspect it.

```bash
node --env-file=.env.local scripts/verify-setup.mjs        # schema + RLS isolation
npx tsx --env-file=.env.local scripts/eval-personas.mts    # persona invariants
npx tsx --env-file=.env.local scripts/eval-report.mts      # report specificity
```

`verify-setup` creates two throwaway users, has them attack each other, and
deletes them — asserting that one cannot read or write the other's rows, and
that nobody can rewrite a transcript.

`eval-personas` replays scripted user behaviour (a pushover, a hardballer, one
that only brings evidence, one that turns hostile) and asserts the invariants in
the table above.

`eval-report` runs a negotiation with three *planted* mistakes and asserts the
report caught them and that every quote it produced genuinely appears in the
transcript.

These caught three bugs that were invisible by inspection — most notably that
Gemini rejects a `contents` array whose first entry has role `model`, which our
transcripts always have because the opponent anchors first. Every multi-turn call
was silently failing and degrading into "they held their position", which reads
as a passive opponent rather than an outage.

---

## Running it

```bash
npm install
cp .env.example .env.local     # then fill it in
```

Create a Supabase project and run the two migrations in `supabase/migrations/`
through the SQL editor, in order. Get a Gemini key from
[aistudio.google.com](https://aistudio.google.com). Then:

```bash
npx tsx --env-file=.env.local scripts/seed-demo.mts   # optional demo history
npm run dev
```

---

## Free-tier constraints

Everything runs at zero cost, but three limits are real and are designed around
rather than ignored:

**Supabase pauses free projects after 7 days of inactivity.** For a portfolio
link this is the biggest threat — not cost, *availability*. A visitor arriving
two weeks after the last commit would find a dead app. A GitHub Actions cron
(`.github/workflows/keepalive.yml`) touches the database twice a week. It runs on
Actions rather than Vercel Cron because it's free, independent of the Vercel
plan, and doesn't consume a Hobby cron slot.

**Gemini's daily request allowance is shared across every visitor.** One
negotiation is 8–20 turn calls plus one report call. Mitigations: a hard 24-turn
cap per negotiation (also better product design — real negotiations don't
ramble), a per-user daily session cap, the cheap model for turns and the better
one reserved for reports, and an explicit "daily quota reached" state instead of
a 500.

**The per-minute ceiling is around 12–15 requests.** Transient `429`s and `503`s
are retried with jittered exponential backoff; daily exhaustion is treated as
immediately fatal, since it will not recover within a request.

Vercel Hobby forbids commercial use, which a portfolio piece does not run into.

---

## Known limitations

- **`SpeechRecognition` is unsupported in Firefox** and needs a secure context.
  The mic button is feature-detected and simply absent where unavailable; every
  recognition error falls back to the text input, which is always the primary
  path.
- **Google OAuth shows an "unverified app" warning** until the consent screen is
  verified, so the one-click demo account is the primary call to action instead.
- **Persona voices** are preferences rather than requirements — available voices
  differ by OS and browser, so an unmatched name falls through to the default
  voice with the persona's pitch and rate still applied.
- The report costs one Gemini call, so ending many negotiations quickly can hit
  the daily cap before the turn budget runs out.
