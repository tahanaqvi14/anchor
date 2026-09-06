/**
 * Persona registry.
 *
 * Personas deliberately live in code rather than the database: a system
 * prompt is application logic and belongs somewhere typed, diffable and
 * reviewable. Sessions persist `persona_key` + `persona_version`, so a
 * session run last month stays reproducible against the prompt that
 * actually produced it even after the prompt is revised.
 *
 * This module currently holds the public-facing profile only. The system
 * prompt and the private concession ledger that drives each persona's
 * behaviour are added in Phase 7 as `prompt` and `ledger` fields on the
 * same objects.
 */

export const PERSONA_KEYS = [
  "lowballer",
  "staller",
  "professional",
  "closer",
] as const;

export type PersonaKey = (typeof PERSONA_KEYS)[number];

/** Bumped whenever a persona's system prompt changes materially. */
export const PERSONA_VERSION = 1;

export interface VoiceProfile {
  /** SpeechSynthesis pitch, 0–2. Derived from the tactic, not decoration. */
  pitch: number;
  /** SpeechSynthesis rate, 0.1–10. */
  rate: number;
  /**
   * Voice names preferred in order, matched loosely against whatever the
   * browser actually has. Never assume a named voice exists — availability
   * differs per OS and browser, so we always fall back to the default voice
   * with the pitch/rate deltas still applied.
   */
  preferredVoices: string[];
}

export interface PersonaProfile {
  key: PersonaKey;
  /** The label used throughout the UI. */
  title: string;
  /** Compact form for chips, transcripts and history rows. */
  shortName: string;
  /** 1–4. Reflects how hard a *good outcome* is, not how loud they are. */
  difficulty: 1 | 2 | 3 | 4;
  /** One line: what this opponent does to you. */
  tagline: string;
  /** Observable behaviours — what you will notice in the transcript. */
  tells: string[];
  /** The teaching payload: how you actually beat them. */
  counter: string;
  voice: VoiceProfile;
}

export const PERSONAS: Record<PersonaKey, PersonaProfile> = {
  lowballer: {
    key: "lowballer",
    title: "The Aggressive Lowballer",
    shortName: "Lowballer",
    difficulty: 2,
    tagline:
      "Opens far below anything reasonable and treats your first number as an opening bid to be argued down.",
    tells: [
      "Anchors hard and low in the first message",
      "Answers every ask with a reason it is not possible",
      "Reframes your experience as a liability",
    ],
    counter:
      "Refuse to negotiate against the anchor. Restate your number without justifying it, and make them move first.",
    voice: { pitch: 0.85, rate: 1.08, preferredVoices: ["Daniel", "Google UK English Male", "Microsoft Guy"] },
  },

  staller: {
    key: "staller",
    title: "The Indecisive Staller",
    shortName: "Staller",
    difficulty: 3,
    tagline:
      "Never quite says no. Keeps introducing new conditions and new approvers until you negotiate against yourself.",
    tells: [
      "Defers to an absent decision-maker",
      "Adds a condition you had not discussed",
      "Answers a direct question with a timeline instead of a number",
    ],
    counter:
      "Put a clock on it and make silence expensive. Ask one closed question and stop talking until it is answered.",
    voice: { pitch: 1.0, rate: 0.88, preferredVoices: ["Fiona", "Google UK English Female", "Microsoft Aria"] },
  },

  professional: {
    key: "professional",
    title: "The Friendly-but-Firm Professional",
    shortName: "Professional",
    difficulty: 4,
    tagline:
      "Warm, reasonable, genuinely pleasant — and almost never actually moves. The hardest one to walk away from empty-handed and still notice you lost.",
    tells: [
      "Agrees with your reasoning, then holds the number anyway",
      "Offers non-monetary sweeteners instead of money",
      "Makes you feel that asking again would be rude",
    ],
    counter:
      "Separate the warmth from the terms. Thank them, then repeat the ask verbatim — pleasantness is not a concession.",
    voice: { pitch: 1.05, rate: 1.0, preferredVoices: ["Samantha", "Google US English", "Microsoft Jenny"] },
  },

  closer: {
    key: "closer",
    title: "The Hardball Closer",
    shortName: "Closer",
    difficulty: 3,
    tagline:
      "Manufactures deadlines and forces binary choices. Every offer expires the moment you ask for time to think.",
    tells: [
      "Attaches an expiry to an offer that has no reason to expire",
      "Frames a range as take-it-or-leave-it",
      "Threatens to withdraw rather than counter",
    ],
    counter:
      "Test the deadline out loud. A real constraint survives being named; a manufactured one usually does not.",
    voice: { pitch: 0.9, rate: 1.15, preferredVoices: ["Alex", "Google US English", "Microsoft Guy"] },
  },
};

export const PERSONA_LIST: PersonaProfile[] = PERSONA_KEYS.map((k) => PERSONAS[k]);

export function isPersonaKey(value: string): value is PersonaKey {
  return (PERSONA_KEYS as readonly string[]).includes(value);
}
