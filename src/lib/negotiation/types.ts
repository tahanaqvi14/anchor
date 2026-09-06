import type { PersonaKey } from "../personas";

/**
 * The move the opponent read in the user's last message. The model
 * classifies this as part of its structured turn output, and the ledger
 * rules react to it — which is what makes personas respond differently to
 * the same user behaviour rather than merely sounding different.
 */
export const TACTICS = [
  "firm_hold", // restated their number without moving or over-justifying
  "concession", // moved their own number toward the opponent
  "question", // asked something instead of countering
  "new_information", // introduced leverage, a comparable, a constraint
  "ultimatum", // threatened to walk or issued a deadline
  "silence", // said nothing substantive; deferred, hedged, filled air
  "hostile", // insulting or aggressive rather than firm
] as const;

export type Tactic = (typeof TACTICS)[number];

/** Which way the user is trying to move the number, derived from their own
 *  context rather than stored per scenario: a target above the current
 *  offer means they are pushing up, below means down. */
export type Direction = "up" | "down";

/**
 * The opponent's private state. None of this is ever sent to the client
 * mid-session — it is the negotiation's hidden information, and revealing
 * it would be like showing the other side's walk-away number.
 */
export interface Ledger {
  /** What they have currently offered. Public — it appears in the chat. */
  position: number;
  /** The furthest they will EVER go. Private, and enforced in code. */
  reservation: number;
  /** How much movement remains before they hit reservation. */
  budgetRemaining: number;
  /** 0–100. Drops with pressure; reaching 0 triggers walk-away. */
  patience: number;
  /** Which way a concession moves the number for this scenario. */
  direction: Direction;
  turn: number;
  concessionsMade: number;
  /** Consecutive turns the user has held firm without new justification. */
  consecutiveFirmHolds: number;
  /** Consecutive turns the user has conceded — rewards exploitation. */
  consecutiveUserConcessions: number;
  history: Tactic[];
}

/** What the model must return each turn. Validated with zod before use. */
export interface TurnOutput {
  reply: string;
  userTactic: Tactic;
  /** The position the model WANTS to move to. Clamped by the ledger before
   *  it is ever shown — the model proposes, code disposes. */
  proposedPosition: number;
  /** The model's own read on whether it is done. Advisory only: the ledger
   *  can overrule in both directions. */
  wantsToWalk: boolean;
  /** One line of hidden reasoning, stored for the feedback report to draw
   *  on later. Never rendered to the user during the session. */
  internalNote: string;
}

export interface SessionContext {
  scenarioTitle: string;
  userRole: string;
  aiRole: string;
  unit: string;
  unitSuffix: string | null;
  currentOffer: number;
  target: number;
  /** The user's private floor. Never sent to the model — the opponent must
   *  not know what the user will settle for. */
  walkAway: number | null;
  leverage: string | null;
  personaKey: PersonaKey;
}
