import type {
  Card,
  ChallengeState,
  Player,
  PublicGameState
} from "../types.js";
import {
  challengeAttempts,
  createDeck,
  deal,
  isFaceCard,
  shuffle
} from "./cards.js";
import { RULES, isValidSlap, slapReasons } from "./rules.js";

export class Game {
  readonly roomCode: string;
  readonly hostId: string;
  readonly players: Player[] = [];

  status: "lobby" | "playing" | "finished" = "lobby";
  pile: Card[] = [];
  currentPlayerIndex = 0;
  challenge: ChallengeState | null = null;
  winnerId: string | null = null;
  message: string | null = null;
  challengeResult: { winnerId: string; loserId: string } | null = null;
  private resolutionPending = false;
  private slapWindowOpen = false;
  private slapClaimed = false;

  constructor(roomCode: string, hostId: string) {
    this.roomCode = roomCode;
    this.hostId = hostId;
  }

  addPlayer(id: string, name: string): void {
    if (this.status !== "lobby") {
      throw new Error("Game has already started.");
    }

    if (this.players.length >= 6) {
      throw new Error("Room is full.");
    }

    if (this.players.some((p) => p.id === id)) return;

    const cleanName = name.trim().slice(0, 20);
    if (!cleanName) throw new Error("Name is required.");

    this.players.push({
      id,
      name: cleanName,
      cards: [],
      connected: true
    });
  }

  setConnected(id: string, connected: boolean): void {
    const player = this.getPlayer(id);
    if (player) player.connected = connected;
  }

  start(): void {
    if (this.players.length < 2) {
      throw new Error("At least 2 players are required.");
    }

    if (this.status !== "lobby") {
      throw new Error("Game has already started.");
    }

    const deck = shuffle(createDeck());
    const hands = deal(deck, this.players.length);

    this.players.forEach((player, index) => {
      player.cards = hands[index];
    });

    this.status = "playing";
    this.pile = [];
    this.currentPlayerIndex = 0;
    this.challenge = null;
    this.winnerId = null;
    this.message = null;
    this.challengeResult = null;
    this.resolutionPending = false;
    this.slapWindowOpen = false;
    this.slapClaimed = false;
  }

  async playCard(playerId: string, onIntermediateState?: () => void): Promise<void> {
    if (this.status !== "playing") {
      throw new Error("Game is not in progress.");
    }

    if (this.resolutionPending) {
      throw new Error("Please wait for the challenge to resolve.");
    }

    const player = this.getPlayer(playerId);
    if (!player) throw new Error("Player not found.");

    if (this.currentPlayerId !== playerId) {
      throw new Error("It is not your turn.");
    }

    if (player.cards.length === 0) {
      throw new Error("You have no cards.");
    }

    this.challengeResult = null;
    this.message = null;
    this.slapClaimed = false;

    const card = player.cards.shift()!;
    this.pile.push(card);

    if (isFaceCard(card)) {
      this.challenge = {
        challengerId: playerId,
        responderId: this.nextPlayerId(playerId),
        remainingAttempts: challengeAttempts(card)
      };
    } else if (this.challenge) {
      this.challenge.remainingAttempts -= 1;

      if (this.challenge.remainingAttempts <= 0 || player.cards.length === 0) {
        const challenger = this.getPlayer(this.challenge.challengerId)!;

        // Show the final card briefly before resolving the challenge.
        this.resolutionPending = true;
        onIntermediateState?.();
        await new Promise((resolve) => setTimeout(resolve, 850));
        this.resolutionPending = false;

        // If the pile is slapable at this moment, open an extra window so any
        // player can steal the pile before it goes to the challenger.
        if (isValidSlap(this.pile)) {
          // End the challenge first so normal slap rules apply during the window.
          this.challenge = null;
          this.slapWindowOpen = true;
          onIntermediateState?.();
          await new Promise((resolve) => setTimeout(resolve, 2500));
          this.slapWindowOpen = false;

          // If anyone slapped during the window the pile will have been cleared.
          if (this.pile.length === 0) {
            this.checkWinner();
            return;
          }
        }

        // No slap occurred — award the pile to the face-card challenger as normal.
        this.awardPileTo(challenger);
        this.challengeResult = { winnerId: challenger.id, loserId: playerId };
        this.challenge = null;
        this.currentPlayerIndex = this.indexOf(challenger.id);
        this.checkWinner();
        return;
      }
    }

    if (this.challenge) {
      this.currentPlayerIndex = this.indexOf(this.challenge.responderId);
    } else {
      this.advanceTurn();
    }

    this.checkWinner();
  }

  slap(playerId: string): { valid: boolean; reasons: string[]; claimed?: boolean } {
  // If another player already claimed this slap opportunity,
  // this is not an illegal slap. They were simply slightly slower.
  if (this.slapClaimed) {
    return {
      valid: false,
      reasons: [],
      claimed: true
    };
  }

  if (this.status !== "playing") {
    throw new Error("Game is not in progress.");
  }

  if (this.resolutionPending) {
    throw new Error("Please wait for the challenge to resolve.");
  }

  const player = this.getPlayer(playerId);
  if (!player) throw new Error("Player not found.");

  this.challengeResult = null;

  const reasons = slapReasons(this.pile);

  if (reasons.length > 0) {
    // This player has claimed this slap opportunity.
    // Any subsequent slap for this same pile will be ignored.
    this.slapClaimed = true;

    this.awardPileTo(player);
    this.challenge = null;
    this.currentPlayerIndex = this.indexOf(playerId);
    this.message = `${player.name} slapped: ${reasons.join(", ")}.`;
    this.checkWinner();

    return {
      valid: true,
      reasons
    };
  }

  this.applyInvalidSlapPenalty(player);
  this.message = `${player.name} made an invalid slap.`;
  this.checkWinner();

  return {
    valid: false,
    reasons: []
  };
}

  private applyInvalidSlapPenalty(player: Player): void {
    for (let i = 0; i < RULES.invalidSlapPenalty; i++) {
      const card = player.cards.shift();
      if (card) this.pile.unshift(card);
    }
  }

  private awardPileTo(player: Player): void {
    player.cards.push(...this.pile);
    this.pile = [];
  }

  private advanceTurn(): void {
    if (this.players.length === 0) return;

    for (let i = 1; i <= this.players.length; i++) {
      const index = (this.currentPlayerIndex + i) % this.players.length;
      if (this.players[index].cards.length > 0) {
        this.currentPlayerIndex = index;
        return;
      }
    }
  }

  private checkWinner(): void {
    // A player who just played their last card may still be the challenger
    // in a face-card challenge. They are not eliminated until that challenge
    // is resolved.
    if (this.challenge) return;

    const activePlayers = this.players.filter((p) => p.cards.length > 0);

    if (activePlayers.length <= 1 && this.status === "playing") {
      this.status = "finished";
      this.winnerId = activePlayers[0]?.id ?? null;
      if (activePlayers.length === 1) {
        this.currentPlayerIndex = this.indexOf(activePlayers[0].id);
      }
      return;
    }

    // If it is this player's turn but they have no cards, they lose their
    // turn automatically and the next eligible player takes over.
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (currentPlayer && currentPlayer.cards.length === 0) {
      this.advanceTurn();
    }
  }

  rematch(): void {
    if (this.status !== "finished") {
      throw new Error("Game is not finished yet.");
    }

    const deck = shuffle(createDeck());
    const hands = deal(deck, this.players.length);

    this.players.forEach((player, index) => {
      player.cards = hands[index];
    });

    this.status = "playing";
    this.pile = [];
    this.currentPlayerIndex = 0;
    this.challenge = null;
    this.winnerId = null;
    this.message = null;
    this.challengeResult = null;
    this.resolutionPending = false;
    this.slapWindowOpen = false;
    this.slapClaimed = false;
  }

  get currentPlayerId(): string | null {
    if (this.players.length === 0) return null;
    return this.players[this.currentPlayerIndex]?.id ?? null;
  }

  private nextPlayerId(playerId: string): string {
    const start = this.indexOf(playerId);

    for (let i = 1; i <= this.players.length; i++) {
      const index = (start + i) % this.players.length;
      if (this.players[index].cards.length > 0) {
        return this.players[index].id;
      }
    }

    return playerId;
  }

  private getPlayer(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  private indexOf(id: string): number {
    const index = this.players.findIndex((p) => p.id === id);
    if (index < 0) throw new Error("Player not found.");
    return index;
  }

  publicState(forPlayerId: string): PublicGameState {
    return {
      roomCode: this.roomCode,
      hostId: this.hostId,
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        cardCount: player.cards.length,
        connected: player.connected
      })),
      currentPlayerId: this.currentPlayerId,
      pileCount: this.pile.length,
      pile: this.pile,
      status: this.status,
      challenge: this.challenge,
      winnerId: this.winnerId,
      message: this.message,
      challengeResult: this.challengeResult,
      yourCardCount: this.getPlayer(forPlayerId)?.cards.length ?? 0
    };
  }
}
