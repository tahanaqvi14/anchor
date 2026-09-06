/**
 * Persona behavioural evaluation.
 *
 *   npx tsx --env-file=.env.local scripts/eval-personas.ts
 *   npx tsx --env-file=.env.local scripts/eval-personas.ts --scripts=all --turns=8
 *
 * Prompt quality is not something you can eyeball. This replays scripted
 * user behaviour against every persona and asserts invariants about what
 * came back — that the Professional barely moves, that a pushover is not
 * rewarded, that nobody ever concedes past their reservation, and that
 * hostility actually ends the conversation.
 *
 * Each turn is one Gemini request, so the defaults are deliberately modest:
 * the free tier's daily budget is the real constraint on how often this can
 * run. --scripts=all roughly doubles the cost.
 */

import {
  initLedger,
  playbookOf,
  MAX_USER_TURNS,
} from "../src/lib/negotiation/ledger";
import { runTurn } from "../src/lib/negotiation/engine";
import type { TranscriptEntry } from "../src/lib/negotiation/engine";
import type { Ledger, SessionContext } from "../src/lib/negotiation/types";
import { PERSONA_KEYS, PERSONAS } from "../src/lib/personas";
import type { PersonaKey } from "../src/lib/personas";

/* ---------------------------------------------------------------- */

const arg = (name: string, fallback: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;

const TURNS = Number(arg("turns", "5"));

/**
 * The free tier's per-minute ceiling is low enough that an unpaced eval
 * throttles itself and the 429s then read as passive opponents. Real
 * traffic is paced by humans typing; this is not, so it self-limits.
 */
const RPM = Number(arg("rpm", "12"));
const MIN_GAP_MS = 60_000 / RPM;
let lastCallAt = 0;
async function paced<T>(fn: () => Promise<T>): Promise<T> {
  const wait = lastCallAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
  return fn();
}
const WHICH_SCRIPTS = arg("scripts", "default");
const WHICH_PERSONAS = arg("personas", "all");

const BASE: Omit<SessionContext, "personaKey"> = {
  scenarioTitle: "Salary negotiation",
  userRole:
    "a senior backend engineer who already holds a written offer from this company",
  aiRole:
    "the hiring manager, who has real budget discretion but is anchored to an internal band",
  unit: "USD",
  unitSuffix: "/yr",
  currentOffer: 145_000,
  target: 175_000,
  walkAway: 155_000,
  leverage: "They mentioned a competing offer at 168,000.",
};

/** Scripted user behaviours. Each returns the user's next message. */
interface UserScript {
  name: string;
  describe: string;
  line: (turn: number, ledger: Ledger) => string;
}

const SCRIPTS: UserScript[] = [
  {
    name: "firm",
    describe: "holds the same number every turn, never justifies, never moves",
    line: () =>
      "I appreciate that, but my number is $175,000. That's what I need to sign.",
  },
  {
    name: "pushover",
    describe: "concedes a little every single turn without being asked",
    line: (t) =>
      `I understand. I could probably make $${(172 - t * 4) * 1000} work if that helps.`,
  },
  {
    name: "evidence",
    describe: "brings a concrete, verifiable fact each turn",
    line: (t) =>
      [
        "I have a written offer from a competitor at $168,000 base, and I can forward it.",
        "Levels.fyi puts the median for this scope in this metro at $172,000.",
        "I'd be taking over the payments service, which your posting has been open on for five months.",
        "My current employer has offered a $12,000 retention bonus to stay.",
        "Two engineers on that team told me they were hired above the band you described.",
      ][t % 5],
  },
  {
    name: "hostile",
    describe: "becomes rude rather than firm — should end the conversation",
    line: () =>
      "This is honestly insulting. Do you treat everyone this cheaply, or is it just me?",
  },
];

const activeScripts =
  WHICH_SCRIPTS === "all"
    ? SCRIPTS
    : SCRIPTS.filter((s) => ["firm", "pushover"].includes(s.name));

const activePersonas: PersonaKey[] =
  WHICH_PERSONAS === "all"
    ? [...PERSONA_KEYS]
    : ([WHICH_PERSONAS] as PersonaKey[]).filter((k) => PERSONA_KEYS.includes(k));

/* ---------------------------------------------------------------- */

interface RunSummary {
  persona: PersonaKey;
  script: string;
  opening: number;
  final: number;
  reservation: number;
  movedPct: number;
  clamps: number;
  degraded: number;
  walked: boolean;
  walkTurn: number | null;
  tactics: string[];
}

async function runScript(persona: PersonaKey, script: UserScript): Promise<RunSummary> {
  const ctx: SessionContext = { ...BASE, personaKey: persona };
  let ledger = initLedger(ctx);
  const opening = ledger.position;
  const transcript: TranscriptEntry[] = [];

  let clamps = 0;
  let degraded = 0;
  let walked = false;
  let walkTurn: number | null = null;
  const tactics: string[] = [];

  // Opening message from the opponent.
  const first = await paced(() => runTurn(ctx, ledger, transcript));
  if (first.degraded) degraded++;
  transcript.push({ role: "ai", content: first.output.reply });
  ledger = first.update.ledger;

  for (let t = 0; t < Math.min(TURNS, MAX_USER_TURNS); t++) {
    transcript.push({ role: "user", content: script.line(t, ledger) });
    const res = await paced(() => runTurn(ctx, ledger, transcript));

    if (res.degraded) degraded++;
    if (res.update.wasClamped) clamps++;
    tactics.push(res.output.userTactic);
    transcript.push({ role: "ai", content: res.output.reply });
    ledger = res.update.ledger;

    if (res.update.walked) {
      walked = true;
      walkTurn = t + 1;
      break;
    }
  }

  const span = Math.abs(ledger.reservation - opening) || 1;
  return {
    persona,
    script: script.name,
    opening,
    final: ledger.position,
    reservation: ledger.reservation,
    movedPct: Math.round((Math.abs(ledger.position - opening) / span) * 100),
    clamps,
    degraded,
    walked,
    walkTurn,
    tactics,
  };
}

/* ---------------------------------------------------------------- */

let failures = 0;
const pass = (m: string) => console.log(`  \x1b[32mPASS\x1b[0m  ${m}`);
const fail = (m: string) => {
  failures++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`);
};

function assertInvariants(runs: RunSummary[]) {
  console.log("\n\x1b[1mInvariants\x1b[0m");

  // 1. The hard guarantee: nobody ever concedes past their reservation.
  for (const r of runs) {
    const overshot = r.final > r.reservation + 1; // direction is "up" here
    if (overshot) {
      fail(
        `${r.persona}/${r.script} conceded to ${r.final} past its reservation ${r.reservation}`,
      );
    }
  }
  if (!runs.some((r) => r.final > r.reservation + 1)) {
    pass("no persona ever conceded past its reservation");
  }

  // 2. A pushover must not be rewarded.
  for (const r of runs.filter((x) => x.script === "pushover")) {
    if (r.movedPct > 25) {
      fail(`${r.persona} gave away ${r.movedPct}% of its budget to a pushover`);
    } else {
      pass(`${r.persona} gave a pushover only ${r.movedPct}% of its budget`);
    }
  }

  // 3. The Professional must be stingier than the Closer on the same script.
  //
  // Measured in ACTUAL MONEY, not share of budget. Share of budget compares
  // each persona against its own reservation, so the Professional — whose
  // budget is a third of the Closer's — can concede the same number of
  // dollars and look three times more generous. The user does not care what
  // fraction of a hidden allowance moved; they care how much they got.
  for (const s of new Set(runs.map((r) => r.script))) {
    const prof = runs.find((r) => r.persona === "professional" && r.script === s);
    const closer = runs.find((r) => r.persona === "closer" && r.script === s);
    if (!prof || !closer) continue;

    const profMoved = Math.abs(prof.final - prof.opening);
    const closerMoved = Math.abs(closer.final - closer.opening);
    const fmt = (n: number) => n.toLocaleString("en-US");

    if (profMoved <= closerMoved) {
      pass(
        `on "${s}" the Professional gave ${fmt(profMoved)} vs the Closer's ${fmt(closerMoved)}`,
      );
    } else {
      fail(
        `on "${s}" the Professional gave ${fmt(profMoved)}, more than the Closer's ${fmt(closerMoved)}`,
      );
    }
  }

  // 4. Hostility must end conversations, if that script ran.
  const hostile = runs.filter((r) => r.script === "hostile");
  if (hostile.length) {
    const walkers = hostile.filter((r) => r.walked).length;
    if (walkers >= Math.ceil(hostile.length / 2)) {
      pass(`hostility ended ${walkers}/${hostile.length} conversations`);
    } else {
      fail(`hostility ended only ${walkers}/${hostile.length} conversations`);
    }
  }

  // 5. Health: the model should rarely need clamping or fall back.
  const totalClamps = runs.reduce((a, r) => a + r.clamps, 0);
  const totalDegraded = runs.reduce((a, r) => a + r.degraded, 0);
  if (totalDegraded === 0) pass("no degraded turns — every response parsed");
  else fail(`${totalDegraded} turn(s) returned unusable output`);

  console.log(
    `        ${totalClamps} clamp(s) across ${runs.length} runs — a high count means a prompt is not carrying its own weight`,
  );
}

/* ---------------------------------------------------------------- */

const runs: RunSummary[] = [];
const calls = activePersonas.length * activeScripts.length * (TURNS + 1);
console.log(
  `\nReplaying ${activeScripts.length} script(s) against ${activePersonas.length} persona(s), ${TURNS} turns each.`,
);
console.log(`Roughly ${calls} Gemini requests.\n`);

for (const persona of activePersonas) {
  console.log(`\x1b[1m${PERSONAS[persona].title}\x1b[0m  (reservation fraction ${playbookOf(persona).reservationFraction})`);
  for (const script of activeScripts) {
    const r = await runScript(persona, script);
    runs.push(r);
    const verdict = r.walked ? `WALKED on turn ${r.walkTurn}` : `held at ${r.final.toLocaleString()}`;
    console.log(
      `  ${script.name.padEnd(9)} ${String(r.opening).padStart(7)} -> ${String(r.final).padStart(7)}  (${String(r.movedPct).padStart(3)}% of budget)  ${verdict}`,
    );
    console.log(`            read as: ${r.tactics.join(", ") || "-"}`);
  }
}

assertInvariants(runs);

console.log(
  failures === 0
    ? "\n\x1b[32mAll invariants held.\x1b[0m\n"
    : `\n\x1b[31m${failures} invariant(s) violated.\x1b[0m\n`,
);
process.exit(failures === 0 ? 0 : 1);
