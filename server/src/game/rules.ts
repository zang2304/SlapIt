import type { Card } from "../types.js";

export const RULES = {
  double: true,
  sandwich: true,
  topBottom: false,
  tens: false,
  marriage: false,
  fourSameSuit: false,

  // Number of cards added to the pile as the penalty for an invalid slap.
  invalidSlapPenalty: 1
};

export type SlapReason =
  | "double"
  | "sandwich"
  | "top-bottom"
  | "tens"
  | "marriage"
  | "four-same-suit";

export function slapReasons(pile: Card[]): SlapReason[] {
  if (pile.length === 0) return [];

  const reasons: SlapReason[] = [];
  const top = pile[pile.length - 1];

  if (RULES.double && pile.length >= 2) {
    const previous = pile[pile.length - 2];
    if (previous.rank === top.rank) reasons.push("double");
  }

  if (RULES.sandwich && pile.length >= 3) {
    const twoBack = pile[pile.length - 3];
    if (twoBack.rank === top.rank) reasons.push("sandwich");
  }

  return reasons;
}

export function isValidSlap(pile: Card[]): boolean {
  return slapReasons(pile).length > 0;
}
