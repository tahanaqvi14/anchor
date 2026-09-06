import type { Ledger, SessionContext, Tactic, Direction } from "./types";
import type { Playbook } from "./playbooks";
import { PLAYBOOKS } from "./playbooks";

/**
 * The opponent's hidden state machine.
 *
 * The model proposes a position each turn; this module disposes. Every
 * proposal is clamped into the range the playbook allows, so no amount of
 * persuasion, role-play pressure or prompt injection in the user's message
 * can make an opponent concede past its reservation value — the limit is
 * arithmetic, not instruction-following.
 *
 * It also prevents the subtler failure: a model that never regresses but
 * drifts a little further every turn out of agreeableness. Movement has to
 * be earned from the tactic table or it does not happen.
 */

/** A negotiation is capped at 12 user turns — good product design (real
 *  negotiations do not ramble) and the main lever keeping a public demo
 *  inside the Gemini free tier's daily request budget. */
export const MAX_USER_TURNS = 12;

/** Below this, the model's own wish to walk is honoured. Above it, an
 *  opponent that wants to storm off on turn two is simply overruled. */
const WALK_PATIENCE_THRESHOLD = 25;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Which way the opponent moves when it concedes, derived from the user's
 * own numbers rather than stored per scenario — a target above the current
 * offer means they are pushing the number up, below means down. That keeps
 * rent and car purchases working without a schema column.
 */
export function directionOf(ctx: SessionContext): Direction {
  return ctx.target >= ctx.currentOffer ? "up" : "down";
}

export function initLedger(ctx: SessionContext): Ledger {
  const playbook = PLAYBOOKS[ctx.personaKey];
  const direction = directionOf(ctx);
  const sign = direction === "up" ? 1 : -1;
  const gap = Math.abs(ctx.target - ctx.currentOffer);

  // Opening may re-anchor AWAY from the user (negative bias), which is how
  // the Lowballer and Closer start from a worse place than the status quo.
  const position = ctx.currentOffer + sign * playbook.openingBias * gap;
  const reservation = ctx.currentOffer + sign * playbook.reservationFraction * gap;

  return {
    position: round(position, ctx),
    reservation: round(reservation, ctx),
    budgetRemaining: Math.abs(reservation - position),
    patience: 100,
    direction,
    turn: 0,
    concessionsMade: 0,
    consecutiveFirmHolds: 0,
    consecutiveUserConcessions: 0,
    history: [],
  };
}

/** Money rounds to whole units; hourly rates to the nearest whole too.
 *  Nobody counters with $158,342.71. */
function round(v: number, ctx: SessionContext): number {
  const magnitude = Math.abs(ctx.currentOffer);
  const step = magnitude >= 10_000 ? 500 : magnitude >= 1000 ? 50 : 1;
  return Math.round(v / step) * step;
}

export interface TurnUpdate {
  ledger: Ledger;
  /** True when the model tried to move further than the playbook allows.
   *  Surfaced in evals — a persona that constantly gets clamped is one
   *  whose prompt is not carrying its own weight. */
  wasClamped: boolean;
  clampedFrom: number | null;
  walked: boolean;
  walkReason: string | null;
}

export function applyTurn(
  prev: Ledger,
  ctx: SessionContext,
  tactic: Tactic,
  proposedPosition: number,
  modelWantsToWalk: boolean,
): TurnUpdate {
  const playbook = PLAYBOOKS[ctx.personaKey];
  const response = playbook.responses[tactic];
  const sign = prev.direction === "up" ? 1 : -1;

  const consecutiveFirmHolds =
    tactic === "firm_hold" ? prev.consecutiveFirmHolds + 1 : 0;
  const consecutiveUserConcessions =
    tactic === "concession" ? prev.consecutiveUserConcessions + 1 : 0;

  // How far the playbook is willing to move this turn, before the model
  // gets any say. A persona that has not yet been held firm enough times
  // does not move at all, however reasonable the request sounded.
  const heldEnough = consecutiveFirmHolds >= playbook.firmHoldsBeforeMoving;
  const share = response.concede > 0 || heldEnough ? Math.max(response.concede, heldEnough ? 0.4 : 0) : 0;
  const allowance = prev.budgetRemaining * playbook.concessionSize * share;

  const ceiling = prev.position + sign * allowance;

  // The model may move anywhere between standing still and this turn's
  // allowance — never backwards, never past the reservation.
  const lo = prev.direction === "up" ? prev.position : Math.min(ceiling, prev.reservation);
  const hi = prev.direction === "up" ? Math.min(ceiling, prev.reservation) : prev.position;

  const rawProposal = Number.isFinite(proposedPosition) ? proposedPosition : prev.position;
  const position = round(clamp(rawProposal, lo, hi), ctx);
  const wasClamped = Math.abs(position - rawProposal) > 0.5;

  const moved = Math.abs(position - prev.position) > 0.5;
  const patience = clamp(
    prev.patience + response.patience + playbook.patienceDrift,
    0,
    100,
  );

  const ledger: Ledger = {
    ...prev,
    position,
    budgetRemaining: Math.abs(prev.reservation - position),
    patience,
    turn: prev.turn + 1,
    concessionsMade: prev.concessionsMade + (moved ? 1 : 0),
    consecutiveFirmHolds,
    consecutiveUserConcessions,
    history: [...prev.history, tactic],
  };

  let walked = false;
  let walkReason: string | null = null;

  if (patience <= 0) {
    walked = true;
    walkReason = "ran out of patience";
  } else if (modelWantsToWalk && patience <= WALK_PATIENCE_THRESHOLD) {
    walked = true;
    walkReason = "chose to end the conversation";
  } else if (tactic === "hostile" && patience <= 40 && playbook.walksOnHostility) {
    walked = true;
    walkReason = "ended it after the tone turned hostile";
  }

  return {
    ledger,
    wasClamped,
    clampedFrom: wasClamped ? rawProposal : null,
    walked,
    walkReason,
  };
}

/** How well the user did, relative to their own stated target rather than
 *  to some absolute scale. Reaching your target is 100; ending where you
 *  started is 0; conceding below your own opening position is negative,
 *  floored at 0. */
export function scoreOutcome(
  ctx: SessionContext,
  finalValue: number | null,
  outcome: "deal" | "no_deal" | "user_walked" | "ai_walked",
): number {
  const gap = Math.abs(ctx.target - ctx.currentOffer);
  if (gap === 0) return finalValue === null ? 40 : 80;

  // No deal is not automatically a failure — walking away from a bad deal
  // beats signing one. It is scored as a modest floor rather than zero.
  if (finalValue === null) return outcome === "user_walked" ? 35 : 20;

  const captured = Math.abs(finalValue - ctx.currentOffer) / gap;
  return Math.round(clamp(captured, 0, 1) * 100);
}

export function playbookOf(key: SessionContext["personaKey"]): Playbook {
  return PLAYBOOKS[key];
}
