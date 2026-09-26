# Slap

A simple real-time multiplayer Slap game.

## Stack

- React + TypeScript + Vite
- Node.js + TypeScript
- Socket.IO
- In-memory game rooms
- Vitest for game-engine tests

## Requirements

Node.js 20+ is recommended.

## Install

From the project root:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

## Run locally

```bash
npm run dev
```

Open:

http://localhost:5173

Open the page in multiple browser windows/tabs to test multiple players.

The Vite development server proxies `/socket.io` to the Node server at port 3001.

## Controls

- Space = play your next card
- Enter = slap the pile

## Rules

The server is authoritative. Clients only request actions.

The starter implementation includes:

- 52-card deck
- even dealing
- Jack/Queen/King/Ace face-card challenges
- double slap
- sandwich slap
- top-bottom slap
- tens slap
- marriage slap
- four-in-a-row same-suit slap
- basic slap penalty
- players with zero cards can still slap
- winner detection

Rule variants are isolated in `server/src/game/rules.ts`.

Because Slap has many house-rule variations, adjust `RULES` before treating this as the definitive ruleset for your group.

## Production deployment

For the first deployment, the simplest setup is a single Node service that serves the built React app and hosts Socket.IO.

The current starter is optimized for local development. Before production, add a production server entry point that serves `client/dist`, set `PORT`, and deploy the Node process to a host that supports long-lived WebSocket connections.

For a small private game, no database is necessary. Active rooms live in memory, so a server restart ends active games.

## Project structure

```text
slap/
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── socket.ts
│   │   ├── types.ts
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/
│   ├── src/
│   │   ├── game/
│   │   │   ├── Game.ts
│   │   │   ├── cards.ts
│   │   │   └── rules.ts
│   │   ├── index.ts
│   │   └── types.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
└── package.json
```


### Updated card visibility

The game intentionally sends only card counts to each browser. Cards in the pile and in each player's hand are represented as face-down stacks, so players cannot see upcoming cards or inspect the pile contents through the browser state.

When a player wins a face-card challenge and takes the pile, that player becomes the next player to play. The challenge result is shown privately as `Yesss` to the winner and `Womp Womp` to the loser.
