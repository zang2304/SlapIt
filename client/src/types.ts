export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export interface PublicPlayer {
  id: string;
  name: string;
  cardCount: number;
  connected: boolean;
}

export interface ChallengeState {
  challengerId: string;
  responderId: string;
  remainingAttempts: number;
}

export interface ChallengeResult {
  winnerId: string;
  loserId: string;
}

export interface GameState {
  roomCode: string;
  hostId: string;
  players: PublicPlayer[];
  currentPlayerId: string | null;
  pileCount: number;
  pile: Card[];
  status: "lobby" | "playing" | "finished";
  challenge: ChallengeState | null;
  winnerId: string | null;
  message: string | null;
  challengeResult: ChallengeResult | null;
  yourCardCount: number;
}
