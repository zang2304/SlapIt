import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { randomBytes } from "node:crypto";
import { Game } from "./game/Game.js";

const PORT = Number(process.env.PORT) || 8080;

const app = express();
app.use(cors());
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173"
  }
});

const games = new Map<string, Game>();
const socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();

function makeRoomCode(): string {
  let code = "";
  do {
    code = randomBytes(3).toString("hex").slice(0, 5).toUpperCase();
  } while (games.has(code));
  return code;
}

function playerIdFor(socketId: string): string {
  return socketId;
}

function broadcastGame(roomCode: string): void {
  const game = games.get(roomCode);
  if (!game) return;

  for (const player of game.players) {
    const socket = io.sockets.sockets.get(player.id);
    if (socket) {
      socket.emit("game:state", game.publicState(player.id));
    }
  }
}

function sendError(socketId: string, message: string): void {
  io.to(socketId).emit("game:error", message);
}

io.on("connection", (socket) => {
  socket.on(
    "room:create",
    (payload: { name: string }, callback?: (response: unknown) => void) => {
      try {
        const roomCode = makeRoomCode();
        const playerId = playerIdFor(socket.id);
        const game = new Game(roomCode, playerId);

        game.addPlayer(playerId, payload?.name ?? "");
        games.set(roomCode, game);

        socket.join(roomCode);
        socketToPlayer.set(socket.id, { roomCode, playerId });

        callback?.({ ok: true, roomCode, playerId });
        broadcastGame(roomCode);
      } catch (error) {
        callback?.({ ok: false, error: error instanceof Error ? error.message : "Failed to create room." });
      }
    }
  );

  socket.on(
    "room:join",
    (
      payload: { roomCode: string; name: string },
      callback?: (response: unknown) => void
    ) => {
      try {
        const roomCode = payload.roomCode.trim().toUpperCase();
        const game = games.get(roomCode);

        if (!game) throw new Error("Room not found.");

        const playerId = playerIdFor(socket.id);
        game.addPlayer(playerId, payload.name);

        socket.join(roomCode);
        socketToPlayer.set(socket.id, { roomCode, playerId });

        callback?.({ ok: true, roomCode, playerId });
        broadcastGame(roomCode);
      } catch (error) {
        callback?.({ ok: false, error: error instanceof Error ? error.message : "Failed to join room." });
      }
    }
  );

  socket.on("game:start", () => {
    const identity = socketToPlayer.get(socket.id);
    if (!identity) return;

    const game = games.get(identity.roomCode);
    if (!game) return;

    try {
      if (game.hostId !== identity.playerId) {
        throw new Error("Only the host can start the game.");
      }

      game.start();
      broadcastGame(identity.roomCode);
    } catch (error) {
      sendError(socket.id, error instanceof Error ? error.message : "Could not start game.");
    }
  });

  socket.on("game:play-card", async () => {
    const identity = socketToPlayer.get(socket.id);
    if (!identity) return;

    const game = games.get(identity.roomCode);
    if (!game) return;

    try {
      await game.playCard(identity.playerId, () => broadcastGame(identity.roomCode));
      broadcastGame(identity.roomCode);
    } catch (error) {
      sendError(socket.id, error instanceof Error ? error.message : "Could not play card.");
    }
  });

  socket.on("game:slap", () => {
    const identity = socketToPlayer.get(socket.id);
    if (!identity) return;

    const game = games.get(identity.roomCode);
    if (!game) return;

    try {
      const result = game.slap(identity.playerId);

      io.to(identity.roomCode).emit("game:slap-result", {
        playerId: identity.playerId,
        ...result
      });

      broadcastGame(identity.roomCode);
    } catch (error) {
      sendError(socket.id, error instanceof Error ? error.message : "Could not slap.");
    }
  });

  socket.on("game:rematch", () => {
    const identity = socketToPlayer.get(socket.id);
    if (!identity) return;

    const game = games.get(identity.roomCode);
    if (!game) return;

    try {
      if (game.hostId !== identity.playerId) {
        throw new Error("Only the host can start a rematch.");
      }

      game.rematch();
      broadcastGame(identity.roomCode);
    } catch (error) {
      sendError(socket.id, error instanceof Error ? error.message : "Could not start rematch.");
    }
  });

  socket.on("disconnect", () => {
    const identity = socketToPlayer.get(socket.id);
    if (!identity) return;

    const game = games.get(identity.roomCode);
    if (!game) return;

    game.setConnected(identity.playerId, false);
    socketToPlayer.delete(socket.id);
    broadcastGame(identity.roomCode);
  });
});


httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Slap server running on port ${PORT}`);
});
