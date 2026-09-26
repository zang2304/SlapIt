import type { Card, Rank, Suit } from "../types.js";

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

export const RANKS: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "J", "Q", "K", "A"
];

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: `${rank}-${suit}`,
      suit,
      rank
    }))
  );
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

export function deal(deck: Card[], playerCount: number): Card[][] {
  const hands = Array.from({ length: playerCount }, () => [] as Card[]);

  deck.forEach((card, index) => {
    hands[index % playerCount].push(card);
  });

  return hands;
}

export function rankValue(rank: Rank): number {
  if (rank === "A") return 1;
  if (rank === "J") return 11;
  if (rank === "Q") return 12;
  if (rank === "K") return 13;
  return Number(rank);
}

export function isFaceCard(card: Card): boolean {
  return ["J", "Q", "K", "A"].includes(card.rank);
}

export function challengeAttempts(card: Card): number {
  switch (card.rank) {
    case "J": return 1;
    case "Q": return 2;
    case "K": return 3;
    case "A": return 4;
    default: return 0;
  }
}
