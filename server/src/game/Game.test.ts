import { describe, expect, it } from "vitest";
import { createDeck } from "./cards.js";
import { isValidSlap, slapReasons } from "./rules.js";
import { Game } from "./Game.js";
import type { Card } from "../types.js";

describe("cards", () => {
  it("creates exactly 52 unique cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });
});

function card(rank: Card["rank"], suit: Card["suit"] = "hearts"): Card {
  return { id: `${rank}-${suit}`, rank, suit };
}

describe("slap rules", () => {
  it("detects a double", () => {
    expect(isValidSlap([card("7"), card("7", "spades")])).toBe(true);
  });

  it("detects a sandwich", () => {
    expect(isValidSlap([card("7"), card("3"), card("7", "spades")])).toBe(true);
  });

  it("rejects the old non-double/non-sandwich slap patterns", () => {
    expect(slapReasons([card("K"), card("Q")])).toEqual([]);
    expect(slapReasons([card("6"), card("4", "spades")])).toEqual([]);
    expect(slapReasons([card("7"), card("3"), card("2"), card("7", "spades")])).toEqual([]);
  });

  it("rejects an ordinary pile", () => {
    expect(isValidSlap([card("2"), card("7", "spades")])).toBe(false);
  });
});

describe("game challenge and slap behavior", () => {
  it("puts the invalid slapper's top card on the bottom of the center pile", () => {
    const game = new Game("ROOM1", "p1");
    game.addPlayer("p1", "One");
    game.addPlayer("p2", "Two");
    game.start();

    game.pile = [card("2"), card("7", "spades")];
    game.players[0].cards = [card("9")];
    game.players[1].cards = [card("Q")];

    const result = game.slap("p1");

    expect(result.valid).toBe(false);
    expect(game.pile.map((c) => c.rank)).toEqual(["9", "2", "7"]);
    expect(game.players[0].cards).toHaveLength(0);
  });

  it("does not finish when the last played card is a face card", () => {
    const game = new Game("ROOM1", "p1");
    game.addPlayer("p1", "One");
    game.addPlayer("p2", "Two");
    game.start();

    game.players[0].cards = [card("J")];
    game.players[1].cards = [card("2"), card("3")];
    game.currentPlayerIndex = 0;

    return game.playCard("p1").then(() => {
      expect(game.status).toBe("playing");
      expect(game.winnerId).toBeNull();
      expect(game.challenge?.challengerId).toBe("p1");
    });
  });
});
