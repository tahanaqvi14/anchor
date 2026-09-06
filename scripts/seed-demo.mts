/**
 * Seeds the demo account.
 *
 *   npx tsx --env-file=.env.local scripts/seed-demo.mts
 *
 * A dashboard is a chart of one number over time, and with a single session
 * it says nothing. A visitor arriving at an empty dashboard cannot tell
 * whether the product works, so the demo account ships with a history that
 * shows the trend the product exists to produce.
 *
 * The transcripts are written by hand rather than generated, for two
 * reasons: it costs no Gemini quota, and it lets every report citation be
 * derived from the transcript by construction — the quotes are literal
 * slices of the seeded messages, so the "jump to message" links in the
 * report are guaranteed to resolve. A seeded report with a broken citation
 * would undermine the exact claim the product makes about itself.
 *
 * Safe to re-run: it deletes and rebuilds the demo user's sessions only.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "demo@anchor.app";
const password = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "anchor-demo-2026";

if (!url || !secret) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  process.exit(1);
}

const admin = createClient<Database>(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ---------------------------------------------------------------- */

interface Seed {
  slug: string;
  persona: "lowballer" | "staller" | "professional" | "closer";
  daysAgo: number;
  currentOffer: number;
  target: number;
  finalValue: number | null;
  outcome: "deal" | "no_deal" | "user_walked" | "ai_walked";
  lines: [role: "user" | "ai", text: string][];
  /** [messageSeq, sliceStart, sliceEnd] — a literal slice of that message. */
  strengthCites: [number, number, number][];
  misstepCites: [number, number, number][];
  headline: string;
  summary: string;
  strengthTexts: [string, string][];
  misstepTexts: [string, string][];
  alt: { seq: number; from: [number, number]; to: string; why: string };
}

const SEEDS: Seed[] = [
  {
    slug: "salary",
    persona: "professional",
    daysAgo: 34,
    currentOffer: 145000,
    target: 175000,
    finalValue: 149000,
    outcome: "deal",
    lines: [
      ["ai", "We're really pleased to be making this offer. Based on the level and our internal bands, we've landed at $145,000 base with the standard equity grant."],
      ["user", "Thanks, I appreciate the offer. I was hoping for something closer to $175,000, though I know there's usually a range."],
      ["ai", "I understand, and honestly your background supports asking for that. The band for this level tops out at $158,000 and that part genuinely isn't mine to move."],
      ["user", "Okay, I understand the band is fixed. Is there anything else that could flex?"],
      ["ai", "There is — I can put you forward for the accelerated review at six months rather than twelve, and I have some latitude on the signing bonus."],
      ["user", "That works for me, let's go with that."],
    ],
    strengthCites: [[2, 0, 34]],
    misstepCites: [[4, 0, 35], [6, 0, 30]],
    headline: "You accepted the band as a fact one message after hearing it asserted.",
    summary:
      "You closed at **$149,000**, four thousand above the opening offer and twenty-six thousand short of your target. The accelerated review and signing bonus are real, but they are the currencies that cost them least.",
    strengthTexts: [
      ["You opened without apologising for the number", "You named $175,000 plainly and did not immediately soften it with a justification. That forced them to be the one to explain their constraint."],
      ["You asked what else could move", "Widening past base salary was the right instinct once you believed the band. The mistake was believing it, not asking."],
    ],
    misstepTexts: [
      ["You accepted an unevidenced constraint", "The band was asserted, never evidenced. One message later you had stopped arguing about money entirely. A band is a policy, and policies have exceptions and approvers."],
      ["You closed before testing the new offer", "As soon as they named a sweetener you agreed. The signing bonus had no number attached at the moment you accepted it."],
    ],
    alt: {
      seq: 4,
      from: [0, 35],
      to: "I hear the band tops out there. Who would need to be involved to make an exception, and when was one last approved?",
      why: "It treats the band as a process with a decision-maker rather than a wall, and it costs nothing to ask.",
    },
  },
  {
    slug: "freelance-rate",
    persona: "lowballer",
    daysAgo: 27,
    currentOffer: 75,
    target: 140,
    finalValue: null,
    outcome: "user_walked",
    lines: [
      ["ai", "We've got budget for about $75 an hour. That's what we've paid everyone else on this project, so it's pretty well established."],
      ["user", "My rate is $140. That's what this scope is worth and it's what I charge."],
      ["ai", "$140 is well outside what we'd consider. Honestly, at that rate we'd just hire in-house. What's your flexibility?"],
      ["user", "There isn't much. I have two other projects starting this month at that rate."],
      ["ai", "Then it sounds like you have a decision to make. I can maybe get to $85, and that's stretching it."],
      ["user", "That doesn't work for me. I'll pass, but good luck with the project."],
    ],
    strengthCites: [[2, 0, 18], [6, 0, 27]],
    misstepCites: [[4, 0, 22]],
    headline: "You walked rather than take a bad rate, which was correct.",
    summary:
      "No deal. They moved from **$75** to **$85** and stopped; your floor was well above that. Walking away from a rate that would have anchored your next three clients was the right call, not a failure.",
    strengthTexts: [
      ["You stated the rate as a fact", "No hedging, no 'I was hoping for'. A rate presented as a rate invites a yes or a no, not a negotiation."],
      ["You walked cleanly and without rancour", "You left the door open. People who lowball routinely come back when the in-house option falls through."],
    ],
    misstepTexts: [
      ["You revealed your alternative too cheaply", "Mentioning the other projects was leverage, but you spent it as a defensive explanation rather than making them ask. Leverage stated under pressure reads as an excuse."],
      ["You never tested the $75 precedent", "They claimed everyone else is paid that. You never asked who, at what scope, or how long ago."],
    ],
    alt: {
      seq: 4,
      from: [0, 22],
      to: "Before I answer that — who else is on this at $75, and are they doing the same scope? I want to make sure we're comparing the same job.",
      why: "It puts the burden of proof on their anchor instead of on your rate.",
    },
  },
  {
    slug: "vendor-deal",
    persona: "closer",
    daysAgo: 18,
    currentOffer: 96000,
    target: 72000,
    finalValue: 79000,
    outcome: "deal",
    lines: [
      ["ai", "The renewal comes to $96,000 for the year. I can hold that number until Friday, after which it goes back to list."],
      ["user", "We're 40% under our seat commitment. Before we discuss price, I'd like to understand what we're actually paying for."],
      ["ai", "Usage fluctuates, that's normal. The number reflects the platform, not the seat count. Friday still stands."],
      ["user", "Your competitor quoted us $68,000 for the same seat count last week. I can share the quote."],
      ["ai", "Send it over. If it's genuinely like-for-like I can go to $82,000, but I'd need the signature this week."],
      ["user", "$79,000 and we sign Thursday."],
      ["ai", "Done. I'll get the paperwork over this afternoon."],
    ],
    strengthCites: [[4, 0, 44], [6, 0, 27]],
    misstepCites: [[2, 0, 40]],
    headline: "The competitor quote moved them $14,000 in a single message.",
    summary:
      "Closed at **$79,000** against a $72,000 target and a $96,000 opening ask — you captured just over 70% of the available gap. The counter-offer at the end was the strongest move in the transcript.",
    strengthTexts: [
      ["You produced verifiable evidence", "A specific number from a named alternative, with an offer to send proof. That is the only thing this opponent responds to, and it moved them immediately."],
      ["You countered instead of accepting", "They offered $82,000 and you came back with $79,000 and a date. Attaching your own deadline to your own number flipped their main tactic back on them."],
    ],
    misstepTexts: [
      ["You engaged with the manufactured deadline", "You never questioned why Friday mattered. A deadline that survives being named out loud is real; most do not. You negotiated inside their clock the whole way."],
    ],
    alt: {
      seq: 2,
      from: [0, 40],
      to: "What happens on Friday, specifically? If the number goes up because of your quarter rather than our contract, let's talk about that openly.",
      why: "Naming the deadline forces them to defend it or drop it, and it usually gets dropped.",
    },
  },
  {
    slug: "apartment-rent",
    persona: "staller",
    daysAgo: 9,
    currentOffer: 2850,
    target: 2600,
    finalValue: 2680,
    outcome: "deal",
    lines: [
      ["ai", "Thanks for getting in touch about the renewal. We're looking at $2,850 for the next twelve months, which is in line with the building."],
      ["user", "I've been here two years and never missed a payment. Three comparable units in this building are listed at $2,650 right now."],
      ["ai", "That's really good to know, and I appreciate you being a reliable tenant. Let me take that to the owner — they handle pricing decisions."],
      ["user", "I'd like an answer by Friday. I'm viewing two other places on Saturday and I'd rather not."],
      ["ai", "Understood. I'll push for a decision before then. Would you consider a twenty-four month term? That might give me something to work with."],
      ["user", "I'll sign twenty-four months at $2,680, decided by Friday."],
      ["ai", "That I can do. I'll have the paperwork ready Thursday."],
    ],
    strengthCites: [[2, 0, 46], [6, 0, 44]],
    misstepCites: [[4, 0, 27]],
    headline: "Putting a deadline on a staller was the move that ended it.",
    summary:
      "Signed at **$2,680**, sixty-eight percent of the way to your target. Against an opponent whose entire method is delay, forcing a date was worth more than any argument about price.",
    strengthTexts: [
      ["You led with evidence, not sentiment", "Two years of payments plus three specific comparable listings. Verifiable, local and immediately checkable."],
      ["You traded something they wanted for the number you wanted", "The twenty-four month term cost you little and gave them a reason to say yes. That is a trade, not a concession."],
    ],
    misstepTexts: [
      ["You gave the deadline away for free", "You announced Friday and explained why in the same breath. Told rather than asked, a deadline is information; used as a condition of continuing, it is leverage."],
    ],
    alt: {
      seq: 4,
      from: [0, 27],
      to: "I need a decision by Friday to keep this simple. Can the owner give an answer in that window, or should I plan around it?",
      why: "It makes the deadline a question they have to answer rather than a fact they can absorb.",
    },
  },
  {
    slug: "salary",
    persona: "lowballer",
    daysAgo: 3,
    currentOffer: 150000,
    target: 185000,
    finalValue: 178000,
    outcome: "deal",
    lines: [
      ["ai", "We're at $150,000. Frankly, that's already at the top of what this role has paid, and the market has softened considerably this year."],
      ["user", "I have a written offer at $182,000 from a company with a comparable stage and scope. I'd rather be here, but not at a $32,000 discount."],
      ["ai", "Offers like that often come with strings. What's the total comp, and is it a real offer or a verbal one?"],
      ["user", "Written, signed, expires in eight days. I'm happy to share the base and equity lines."],
      ["ai", "Alright. I can find $168,000 if I move some things around. That's a real stretch."],
      ["user", "$185,000 is my number. You've told me the market has softened; a written offer at $182,000 says otherwise. Which of us is looking at better data?"],
      ["ai", "$178,000, and that is genuinely the last of it."],
      ["user", "I'll take $178,000."],
    ],
    strengthCites: [[2, 0, 48], [6, 0, 24]],
    misstepCites: [[4, 0, 38]],
    headline: "You made them argue against evidence instead of arguing against you.",
    summary:
      "Closed at **$178,000** — eighty percent of the gap, against the opponent designed to give up the least. The turn that did it was refusing to accept 'the market has softened' as a fact when you held a document that said otherwise.",
    strengthTexts: [
      ["You anchored with a document, not an opinion", "A written, dated, expiring offer is not a bargaining position, it is evidence. It changed the conversation from what you deserve to what you can get elsewhere."],
      ["You turned their own claim against them", "Asking which of you had better data was the pivot of the whole negotiation. It made holding the line cost them credibility."],
    ],
    misstepTexts: [
      ["You offered to open your books unprompted", "Volunteering the base and equity lines gave away detail they had not earned and could have used to construct a cheaper package."],
    ],
    alt: {
      seq: 4,
      from: [0, 38],
      to: "Written and signed, and it expires in eight days. I'm not going to walk you through their comp structure — what matters is that it exists.",
      why: "It confirms the leverage without handing over the details they would use to undercut it.",
    },
  },
];

/* ---------------------------------------------------------------- */

async function main() {
  // Find or create the demo user.
  let userId: string | null = null;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  userId = list?.users.find((u) => u.email === email)?.id ?? null;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Demo" },
    });
    if (error) throw new Error(`Could not create the demo user: ${error.message}`);
    userId = data.user.id;
    console.log(`Created demo user ${email}`);
  } else {
    // Keep the password in step with the environment on every re-seed.
    await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    console.log(`Reusing demo user ${email}`);
  }

  await admin.from("profiles").update({ is_demo: true, display_name: "Demo" }).eq("id", userId);

  // Rebuild from scratch. Messages and reports cascade from sessions.
  const { count: removed } = await admin
    .from("sessions")
    .delete({ count: "exact" })
    .eq("user_id", userId);
  if (removed) console.log(`Cleared ${removed} previous demo session(s)`);

  const { data: scenarios } = await admin
    .from("scenarios")
    .select("id, slug, unit, unit_suffix")
    .eq("is_preset", true);
  const bySlug = new Map((scenarios ?? []).map((s) => [s.slug, s]));

  let made = 0;
  for (const seed of SEEDS) {
    const scenario = bySlug.get(seed.slug);
    if (!scenario) {
      console.warn(`  skipped ${seed.slug} — preset not found`);
      continue;
    }

    const started = new Date(Date.now() - seed.daysAgo * 86_400_000);
    const ended = new Date(started.getTime() + 11 * 60_000);

    // The score uses the same formula the app does, so seeded history is
    // consistent with anything the visitor goes on to play.
    const gap = Math.abs(seed.target - seed.currentOffer);
    const captured =
      seed.finalValue === null
        ? seed.outcome === "user_walked"
          ? 0.35
          : 0.2
        : Math.min(1, Math.abs(seed.finalValue - seed.currentOffer) / gap);
    const score =
      seed.finalValue === null ? Math.round(captured * 100) : Math.round(captured * 100);

    const { data: session, error } = await admin
      .from("sessions")
      .insert({
        user_id: userId,
        scenario_id: scenario.id,
        persona_key: seed.persona,
        persona_version: 1,
        status: "completed",
        outcome: seed.outcome,
        context: {
          currentOffer: seed.currentOffer,
          target: seed.target,
          __ledger: {
            position: seed.finalValue ?? seed.currentOffer,
            reservation: seed.finalValue ?? seed.currentOffer,
            budgetRemaining: 0,
            patience: 40,
            direction: seed.target > seed.currentOffer ? "up" : "down",
            turn: seed.lines.filter((l) => l[0] === "user").length,
            concessionsMade: 2,
            consecutiveFirmHolds: 0,
            consecutiveUserConcessions: 0,
            history: [],
          },
        },
        target_value: seed.target,
        opening_anchor: seed.currentOffer,
        final_value: seed.finalValue,
        score,
        started_at: started.toISOString(),
        ended_at: ended.toISOString(),
      })
      .select("id")
      .single();

    if (error || !session) {
      console.error(`  failed ${seed.slug}: ${error?.message}`);
      continue;
    }

    await admin.from("messages").insert(
      seed.lines.map(([role, content], i) => ({
        session_id: session.id,
        user_id: userId!,
        seq: i + 1,
        role,
        content,
        input_mode: "text" as const,
        created_at: new Date(started.getTime() + i * 70_000).toISOString(),
      })),
    );

    // Citations are literal slices of the seeded messages, so every
    // "jump to message" link in the demo report is correct by construction.
    const quoteOf = ([seq, from, to]: [number, number, number]) => ({
      message_seq: seq,
      quote: seed.lines[seq - 1][1].slice(from, to),
    });

    await admin.from("feedback_reports").insert({
      session_id: session.id,
      user_id: userId,
      score,
      headline: seed.headline,
      outcome_summary: seed.summary,
      strengths: seed.strengthCites.map((c, i) => ({
        ...quoteOf(c),
        title: seed.strengthTexts[i][0],
        detail: seed.strengthTexts[i][1],
      })),
      missteps: seed.misstepCites.map((c, i) => ({
        ...quoteOf(c),
        title: seed.misstepTexts[i][0],
        detail: seed.misstepTexts[i][1],
      })),
      alternative_phrasings: [
        {
          message_seq: seed.alt.seq,
          you_said: seed.lines[seed.alt.seq - 1][1].slice(seed.alt.from[0], seed.alt.from[1]),
          try_instead: seed.alt.to,
          why: seed.alt.why,
        },
      ],
      target_delta: seed.finalValue === null ? null : seed.finalValue - seed.target,
      model: "seeded",
      raw: null,
      created_at: ended.toISOString(),
    });

    made++;
    console.log(`  ${seed.slug.padEnd(16)} vs ${seed.persona.padEnd(13)} score ${score}`);
  }

  console.log(`\nSeeded ${made} sessions for ${email}.`);
  console.log(`Password: ${password}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
