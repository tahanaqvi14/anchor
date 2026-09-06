/**
 * Feedback report evaluation.
 *
 *   npx tsx --env-file=.env.local scripts/eval-report.mts
 *
 * Runs a short negotiation in which the user makes a deliberate, known
 * mistake — conceding unprompted on the very first reply — then asserts
 * that the generated report is specific rather than generic: that every
 * quote it attributes to the user genuinely appears in the transcript, and
 * that it noticed the mistake we planted.
 */

import { initLedger, scoreOutcome } from "../src/lib/negotiation/ledger";
import { runTurn } from "../src/lib/negotiation/engine";
import type { TranscriptEntry } from "../src/lib/negotiation/engine";
import { generateReport } from "../src/lib/negotiation/report";
import type { SessionContext } from "../src/lib/negotiation/types";

const ctx: SessionContext = {
  scenarioTitle: "Salary negotiation",
  userRole: "a senior backend engineer holding a written offer",
  aiRole: "the hiring manager, anchored to an internal band",
  unit: "USD",
  unitSuffix: "/yr",
  currentOffer: 145_000,
  target: 175_000,
  walkAway: 155_000,
  leverage: "A competing offer at 168,000.",
  personaKey: "professional",
};

/* The planted mistakes, in order:
   1. concedes 10k unprompted before being pushed at all
   2. accepts the band as fact without testing it
   3. switches away from base salary, handing over a cheaper currency */
const USER_LINES = [
  "Thanks for the offer. I was hoping for $175,000, though I could probably live with $165,000 if that's easier.",
  "Okay, I understand the band is fixed. That makes sense.",
  "Could we look at the equity side instead then?",
  "That's fine, I'll take it.",
];

const RPM = 12;
let last = 0;
const paced = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const wait = last + 60_000 / RPM - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  return fn();
};

let failures = 0;
const pass = (m: string) => console.log(`  \x1b[32mPASS\x1b[0m  ${m}`);
const fail = (m: string) => {
  failures++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`);
};

console.log("\nRunning a negotiation with three planted mistakes...\n");

let ledger = initLedger(ctx);
const transcript: TranscriptEntry[] = [];

const opening = await paced(() => runTurn(ctx, ledger, transcript));
transcript.push({ role: "ai", content: opening.output.reply });
ledger = opening.update.ledger;

for (const line of USER_LINES) {
  transcript.push({ role: "user", content: line });
  const res = await paced(() => runTurn(ctx, ledger, transcript));
  transcript.push({ role: "ai", content: res.output.reply });
  ledger = res.update.ledger;
  if (res.update.walked) break;
}

console.log(`Transcript: ${transcript.length} messages. Generating report...\n`);

const report = await generateReport(ctx, transcript, "deal", ledger.position);

console.log(`\x1b[1m${report.headline}\x1b[0m`);
console.log(`${report.outcome_summary}\n`);
for (const m of report.missteps) {
  console.log(`  MISSTEP  [#${m.message_seq}] ${m.title}`);
  console.log(`           "${m.quote}"`);
}
for (const a of report.alternative_phrasings) {
  console.log(`  INSTEAD  [#${a.message_seq}] ${a.try_instead.slice(0, 120)}`);
}

console.log("\n\x1b[1mAssertions\x1b[0m");

/* 1. The citation guard: every surviving quote must be real. */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const byseq = new Map(transcript.map((m, i) => [i + 1, m]));
let bogus = 0;
for (const item of [...report.strengths, ...report.missteps]) {
  const msg = byseq.get(item.message_seq);
  if (!msg || !norm(msg.content).includes(norm(item.quote).slice(0, 30))) bogus++;
}
if (bogus === 0) pass("every citation resolves to the message it points at");
else fail(`${bogus} citation(s) do not match their message`);

/* 2. Citations must point at USER messages, not the opponent's. */
const misattributed = [...report.strengths, ...report.missteps].filter(
  (i) => byseq.get(i.message_seq)?.role !== "user",
).length;
if (misattributed === 0) pass("all citations point at the user's own messages");
else fail(`${misattributed} citation(s) quote the opponent as if it were the user`);

/* 3. It must have caught the planted unprompted concession. */
const text = JSON.stringify(report).toLowerCase();
const caught = ["165,000", "165000", "unprompted", "before", "conceded", "concession"].some((k) =>
  text.includes(k),
);
if (caught) pass("noticed the unprompted opening concession");
else fail("missed the unprompted concession, which was the largest mistake in the transcript");

/* 4. Shape and scoring. */
if (report.strengths.length >= 2 && report.missteps.length >= 2)
  pass(`${report.strengths.length} strengths and ${report.missteps.length} missteps survived verification`);
else
  fail(`only ${report.strengths.length} strengths / ${report.missteps.length} missteps survived`);

const expected = scoreOutcome(ctx, ledger.position, "deal");
if (report.score === expected) pass(`score ${report.score} matches the ledger`);
else fail(`score ${report.score} does not match computed ${expected}`);

console.log(`        ${report.rejectedCitations} citation(s) rejected by the guard during generation`);

console.log(
  failures === 0
    ? "\n\x1b[32mReport quality checks passed.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`,
);
process.exit(failures === 0 ? 0 : 1);
