import { useEffect, useMemo, useState } from "react";
import { socket } from "./socket";
import type { GameState } from "./types";

type Screen = "home" | "lobby" | "game";

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [name, setName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState("");
  const [slapMessage, setSlapMessage] = useState("");

  const me = useMemo(
    () => game?.players.find((p) => p.id === socket.id),
    [game]
  );

  useEffect(() => {
    const onState = (state: GameState) => {
      setGame(state);
      setError("");

      if (state.status === "lobby") setScreen("lobby");
      else setScreen("game");
    };

    const onError = (message: string) => setError(message);

    const onSlapResult = (result: {
      playerId: string;
      valid: boolean;
      reasons: string[];
      claimed?: boolean;
    }) => {
      // Someone else already claimed this slap opportunity.
      // Do not display an invalid-slap message.
      if (result.claimed) {
        return;
      }
    
      const playerName =
        game?.players.find((p) => p.id === result.playerId)?.name ?? "Someone";
    
      if (result.valid) {
        setSlapMessage(`${playerName} slapped! ${result.reasons.join(", ")}`);
      } else {
        setSlapMessage(`${playerName} made an invalid slap.`);
      }
    
      window.setTimeout(() => setSlapMessage(""), 1200);
    };

    socket.on("game:state", onState);
    socket.on("game:error", onError);
    socket.on("game:slap-result", onSlapResult);

    return () => {
      socket.off("game:state", onState);
      socket.off("game:error", onError);
      socket.off("game:slap-result", onSlapResult);
    };
  }, [game?.players]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen !== "game") return;

      if (event.code === "Space") {
        event.preventDefault();
        socket.emit("game:play-card");
      }

      if (event.code === "Enter") {
        event.preventDefault();
        socket.emit("game:slap");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen]);

  function createRoom() {
    if (!name.trim()) {
      setError("Enter your name first.");
      return;
    }

    socket.emit(
      "room:create",
      { name },
      (response: { ok: boolean; error?: string }) => {
        if (!response.ok) setError(response.error ?? "Could not create room.");
      }
    );
  }

  function joinRoom() {
    if (!name.trim()) {
      setError("Enter your name first.");
      return;
    }

    if (!roomInput.trim()) {
      setError("Enter a room code.");
      return;
    }

    socket.emit(
      "room:join",
      { name, roomCode: roomInput },
      (response: { ok: boolean; error?: string }) => {
        if (!response.ok) setError(response.error ?? "Could not join room.");
      }
    );
  }

  if (screen === "home") {
    return (
      <main className="home">
        <section className="home-card">
          <h1>Slap</h1>

          <label>
            Your name
            <input
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <button className="primary" onClick={createRoom}>
            CREATE GAME
          </button>

          <div className="divider">or</div>

          <label>
            Room code
            <input
              value={roomInput}
              maxLength={5}
              onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
            />
          </label>

          <button onClick={joinRoom}>JOIN GAME</button>

          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  if (!game) return null;

  if (screen === "lobby") {
    const isHost = game.hostId === socket.id;

    return (
      <main className="lobby">
        <section className="lobby-card">
          <h1>Slap</h1>
          <div className="room-code">{game.roomCode}</div>
          <p>Share this code with your friends.</p>

          <div className="players-list">
            {game.players.map((player) => (
              <div className="player-row" key={player.id}>
                <span>{player.name}</span>
                {player.id === game.hostId && <small>HOST</small>}
              </div>
            ))}
          </div>

          {isHost ? (
            <button
              className="primary"
              disabled={game.players.length < 2}
              onClick={() => socket.emit("game:start")}
            >
              START GAME
            </button>
          ) : (
            <p>Waiting for the host to start...</p>
          )}

          {game.players.length < 2 && (
            <p className="muted">Waiting for at least one more player.</p>
          )}

          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  const currentPlayer =
    game.players.find((p) => p.id === game.currentPlayerId)?.name ?? "Nobody";
  const isMyTurn = game.currentPlayerId === socket.id;
  const isChallengeWinner = game.challengeResult?.winnerId === socket.id;
  const isChallengeLoser = game.challengeResult?.loserId === socket.id;

  return (
    <main className="game">
      <header className="game-header">
        <div>
          <strong>Room {game.roomCode}</strong>
        </div>
        <div className="controls">
          <span><kbd>SPACE</kbd> Play card</span>
          <span><kbd>ENTER</kbd> Slap</span>
        </div>
      </header>

      <section className="table">
        <div className="players">
          {game.players.map((player) => (
            <div
              className={`player ${
                player.id === game.currentPlayerId ? "active" : ""
              } ${!player.connected ? "offline" : ""}`}
              key={player.id}
            >
              <strong>{player.name}</strong>
              <span>{player.cardCount} cards</span>
              {player.id === socket.id && <small>YOU</small>}
            </div>
          ))}
        </div>

        <div className="center">
          <div className="turn">
            {isMyTurn ? "YOUR TURN" : `${currentPlayer}'s turn`}
          </div>

          <div className="pile">
            {game.pileCount > 0 ? (
              <CenterPile cards={game.pile} />
            ) : (
              <div className="empty-pile">PILE</div>
            )}
          </div>

          <div className="pile-count">
            {game.pileCount} cards in pile
          </div>

          {game.challenge && (
            <div className="challenge">
              {game.challenge.remainingAttempts} attempt
              {game.challenge.remainingAttempts !== 1 ? "s" : ""} left
            </div>
          )}

          {isChallengeWinner && <div className="challenge-result winner">Yesss</div>}
          {isChallengeLoser && <div className="challenge-result loser">Womp Womp</div>}
          {slapMessage && <div className="slap-message">{slapMessage}</div>}
        </div>

        <div className="your-hand">
          <span className="hand-label">
            Your cards: {game.yourCardCount}
          </span>
          {game.yourCardCount > 0 ? (
            <CardStack count={game.yourCardCount} compact />
          ) : (
            <div className="empty-hand">No cards</div>
          )}
        </div>
      </section>

      {game.status === "finished" && game.winnerId && (
        <div className="winner-overlay">
          <div>
            <h2>
              {game.players.find((p) => p.id === game.winnerId)?.name ?? "Player"} wins!
            </h2>
            {game.hostId === socket.id ? (
              <button
                className="primary"
                onClick={() => socket.emit("game:rematch")}
              >
                REMATCH
              </button>
            ) : (
              <p>Waiting for host to start a rematch…</p>
            )}
          </div>
        </div>
      )}

      {error && <div className="toast error">{error}</div>}
    </main>
  );
}

function CenterPile({ cards }: { cards: GameState["pile"] }) {
  const visibleLayers = Math.min(Math.max(cards.length - 1, 0), 5);
  const topCard = cards[cards.length - 1];

  return (
    <div className="card-stack center-pile">
      {Array.from({ length: visibleLayers }, (_, index) => {
        const offset = (index - (visibleLayers - 1) / 2) * 3;
        const rotation = (index - (visibleLayers - 1) / 2) * 1.2;
        return (
          <div
            className="card-back"
            key={index}
            style={{
              transform: `translate(${offset}px, ${Math.abs(offset) * 0.12}px) rotate(${rotation}deg)`,
              zIndex: index
            }}
          >
            <div className="card-back-inner" />
          </div>
        );
      })}
      {topCard && <PlayingCard card={topCard} />}
    </div>
  );
}

function PlayingCard({ card }: { card: GameState["pile"][number] }) {
  const suitSymbol = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠"
  }[card.suit];
  const isRed = card.suit === "hearts" || card.suit === "diamonds";

  return (
    <div className={`playing-card ${isRed ? "red" : "black"}`}>
      <div className="card-corner">
        <span>{card.rank}</span>
        <span>{suitSymbol}</span>
      </div>
      <div className="card-suit">{suitSymbol}</div>
      <div className="card-corner bottom">
        <span>{card.rank}</span>
        <span>{suitSymbol}</span>
      </div>
    </div>
  );
}

function CardStack({ count, compact = false }: { count: number; compact?: boolean }) {
  const visibleLayers = Math.min(count, compact ? 5 : 9);
  return (
    <div className={`card-stack ${compact ? "compact" : ""}`}>
      {Array.from({ length: visibleLayers }, (_, index) => {
        const offset = (index - (visibleLayers - 1) / 2) * 3;
        const rotation = (index - (visibleLayers - 1) / 2) * 1.2;
        return (
          <div
            className="card-back"
            key={index}
            style={{
              transform: `translate(${offset}px, ${Math.abs(offset) * 0.12}px) rotate(${rotation}deg)`,
              zIndex: index
            }}
          >
            <div className="card-back-inner" />
          </div>
        );
      })}
      <span className="stack-count">{count}</span>
    </div>
  );
}

export default App;
