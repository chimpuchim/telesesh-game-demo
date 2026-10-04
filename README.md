# TeleSesh Game Demo

A real-time, data-driven **Memory Matching** game for telehealth speech-therapy sessions.
A therapist and a student open the same session from two browsers (or two devices) and see
exactly the same board, animations and score, live. Built with **Phaser 3 + TypeScript + Vite**
on the client and **Node.js + Express + Socket.IO** on the server.

## Overview

This demo proves the five things a production game platform for therapy sessions needs:

| Requirement | How the demo shows it |
| --- | --- |
| Runs in the browser, no install | Vite-served Phaser 3 client, works on laptop and tablet, touch friendly |
| Real-time shared state | Server-authoritative session state broadcast over Socket.IO rooms |
| Data-driven content | Theme, items, board size and timings come from JSON served by `GET /api/games/:gameId` |
| Reusable game template | One `MemoryTemplate` runs both the **Animals** and **Space** games with zero gameplay changes |
| Therapist control | Reset Game / New Round / switch content; students never see these controls |

Extras that make it feel like a product rather than a prototype: flip, match and deal
animations, synthesized sound effects (no copyrighted assets), connection indicator with
automatic reconnect + resync, presence dots (who is in the room), a child-friendly completion
screen with score / pairs / time / Play Again, a crisp hi-DPI canvas, and a unit-test suite
for the game rules and session layer (`npm test`, 25 tests, zero extra dependencies).

## Architecture

```
client/                      Phaser 3 + DOM UI (no framework)
  main.ts                    bootstrap: URL params -> config API -> session -> Phaser
  game/
    GameHost.ts              owns Phaser.Game, hi-DPI sizing, starts the right template scene
    templates/
      TemplateScene.ts       the scene interface GameHost drives (applyState / handleEvent)
      registry.ts            template id -> Phaser scene
      memory/
        MemoryScene.ts       renders MemoryState, reports taps, plays MATCH/MISMATCH effects
        CardView.ts          one card: flip / hover / pop / shake animations
        boardLayout.ts       pure grid-fitting math
    services/
      SessionClient.ts       Socket.IO wrapper: join, resync on reconnect, version guard, server clock
      GameConfigService.ts   fetches /api/games
      SoundService.ts        WebAudio synthesized effects
      urlParams.ts           ?session=&role=&game= parsing with safe defaults
  ui/                        HeaderBar, StatsBar, TherapistPanel, CompletionOverlay, Toaster, LoadingScreen
  styles/app.css             theme colours arrive as CSS variables from the game config

server/
  index.ts                   Express + Socket.IO bootstrap; serves dist/client in production
  api/
    gamesRouter.ts           GET /api/games, GET /api/games/:gameId
    gameRepository.ts        reads + validates data/games/*.json (stand-in for the customer backend)
  sessions/
    SessionStore.ts          sessionId -> GameSession; isolates sessions, expires idle ones
    GameSession.ts           holds authoritative state, applies actions, runs scheduled effects
  socket/
    registerSocketHandlers.ts  validates client messages, rooms, join/leave/action, rate limit
    RateLimiter.ts           per-socket fixed-window limiter
  templates/
    GameTemplate.ts          the template interface: pure `createInitialState` + `reduce`
    memory/MemoryTemplate.ts memory-matching rules (flip, match, mismatch, reset, new round)

shared/types/                contracts used by both sides
  templates.ts               TemplateContracts: one entry per template -> all shared unions
  gameConfig.ts              JSON content schema
  memoryState.ts             MemorySettings + MemoryState + MemoryAction
  protocol.ts                Socket.IO events, SessionSnapshot, GameEvent

data/games/                  memory-animals.json, memory-space.json
tests/                       node:test suites for the reducer, GameSession, RateLimiter, layout
```

### Authoritative server state

Clients never mutate game state. They send **actions** (`FLIP_CARD`, `RESET_GAME`, `NEW_ROUND`)
and render whatever **snapshot** the server broadcasts.

```
Student tap ──FLIP_CARD──▶ GameSession.dispatch
                              │ role check + MemoryTemplate.reduce (pure, validated)
                              │ ok?  commit state, version++, schedule effects
                              ▼
                        io.to(room).emit('session:state', snapshot)   ← both browsers
                        io.to(room).emit('session:event', MATCH | MISMATCH | COMPLETED | RESET)
```

* `GameSession` keeps `cards`, `flippedCards`, `matchedCards`, `score`, `moves`, `status`,
  `startedAt`, `completedAt`, `round` and a monotonic `version`.
* Mismatch handling is a **scheduled effect**: the reducer returns
  `RESOLVE_MISMATCH` with a delay; the session runs it on a timer and broadcasts again.
  While `status === 'resolving'` every extra `FLIP_CARD` is rejected, so spam-clicking cannot
  corrupt the round. Reset/New Round cancel pending timers; stale effects are ignored by round id.
* Late joiners and refreshed tabs receive the current snapshot in the join acknowledgement.
  After a reconnect the client re-joins and therefore re-syncs automatically.
* Snapshots carry `serverTime`; the timer is computed from server timestamps so both screens
  agree. Out-of-order snapshots are dropped using `version`.
* Sessions are Socket.IO rooms keyed by `sessionId`; `demo123` and `demo456` never share state.
* Every socket has a small action rate limit (20 actions/second); `NEW_ROUND` only reaches the
  content loader for the therapist role, so a student cannot force repeated disk/backend reads.
* A socket that disconnects while its join is still loading content is never added to the
  session, so participant counts stay accurate and empty sessions can expire.

### The template abstraction

`GameTemplate<State, Action>` is a pure state machine with `validateConfig`, `createInitialState`
and `reduce`. It knows nothing about sockets, timers or Phaser, so `GameSession`,
`SessionStore`, `SessionClient` and the socket layer are reusable as-is for the next templates.

Adding a template (say `bingo`) touches exactly these places, and the compiler points at each
one until it is done:

1. `shared/types/bingoState.ts`: its settings, state and action types.
2. `shared/types/templates.ts`: add `bingo: { settings, state, action }` to `TemplateContracts`.
   Every shared union (`GameTemplateId`, `TemplateSettings`, `GameState`, `ClientAction`) derives
   from this map, so nothing else in `shared/` changes.
3. `server/templates/bingo/BingoTemplate.ts` implementing `GameTemplate`, registered in
   `server/templates/registry.ts` (the registry type requires one entry per contract).
4. `client/game/templates/bingo/BingoScene.ts` implementing `TemplateScene`, registered in
   `client/game/templates/registry.ts` (same compile-time guarantee).

`GameSession`, the socket layer, `SessionClient` and `GameHost` are untouched; the action
validator in `registerSocketHandlers.ts` lists the accepted action type names and gets one line.

### JSON / API-driven content

`data/games/*.json` follows `shared/types/gameConfig.ts`:

```json
{
  "gameId": "memory-animals",
  "template": "memory",
  "title": "Animal Match",
  "theme": { "name": "Animals", "background": "linear-gradient(...)", "primaryColor": "#f6c453",
             "secondaryColor": "#f28f3b", "cardBackColor": "#1d6f72", "cardFaceColor": "#fffaf0",
             "cardBackSymbol": "🐾", "textColor": "#ffffff" },
  "settings": { "rows": 4, "columns": 4, "mismatchRevealMs": 900, "pointsPerMatch": 10 },
  "items": [ { "id": "cat", "label": "Cat", "emoji": "🐱" }, ... ]
}
```

The server re-reads the file on every request and on every **New Round**, so editing a JSON file
(or, later, an admin saving content in the customer's CMS) changes the next round without a
restart. Items may carry an `image` URL instead of an `emoji`; the card renders the image when
present (the two demo themes use emoji so the demo has no external asset dependencies).

## Running locally

Requirements: Node.js 20+ (tested on Node 22).

```bash
npm install
npm run dev
```

This starts both processes with prefixed logs:

* `[server]` API + Socket.IO on **http://localhost:3001**
* `[client]` Vite dev server on **http://localhost:5173** (proxies `/api` and `/socket.io` to 3001)

Other scripts:

```bash
npm test            # unit tests (node:test + tsx): game rules, session timers, rate limiter, layout
npm run typecheck   # strict TypeScript for client, server and tests
npm run build       # typecheck + tests, Vite production build, compile server to dist/
npm start           # serve the production build from a single Node process on :3001
```

### Tests

`tests/memoryTemplate.test.ts` covers the rules (dealing, flip validation, match, mismatch lock,
stale `RESOLVE_MISMATCH`, role gating, Play Again, completion). `tests/gameSession.test.ts`
covers the session layer with real timers (mismatch flip-back, reset cancelling a pending timer,
atomic config swap on `NEW_ROUND`, template switch refusal). The reducer is pure, so new rules
are a few lines of test each.

## Testing real-time sync

Opening the bare URL (no `?session=`) shows a landing page that generates a session code, lets
you pick the content, opens the therapist view and gives you the matching student link to open in
a second tab, on a tablet or to send to a colleague. The explicit URLs below do the same thing.

1. Run `npm run dev`.
2. **Browser window 1 (Therapist):**
   `http://localhost:5173/?session=demo123&role=therapist`
3. **Browser window 2 (Student):**
   `http://localhost:5173/?session=demo123&role=student`
   Put the windows side by side. The header shows `In room ● T ● S` when both are connected.
4. In the student window tap a card: it flips in both windows.
5. Tap a second card: a match stays open with a burst animation and the score updates in
   both windows; a mismatch shows both cards briefly, then flips them back in both windows.
6. In the therapist window press **Reset Game**: the student board, score and timer reset instantly.
7. Refresh either window: it rejoins and shows the current board, including flipped cards and
   the running timer.
8. Open `http://localhost:5173/?session=demo456&role=student` in a third window: a separate,
   untouched game.
9. Finish all 8 pairs: both windows show the completion screen with score, pairs, time and
   **Play Again** (anyone may press it once the round is complete).

Tip for a second device (tablet) on the same Wi-Fi: use the `Network:` URL that Vite prints
instead of `localhost`.

## Data-driven templates

* `http://localhost:5173/?session=demo123&role=therapist&game=memory-animals`
* `http://localhost:5173/?session=demo777&role=therapist&game=memory-space`

Both URLs run the identical `MemoryTemplate` / `MemoryScene`; only the JSON differs
(background gradient, accent colours, card back glyph, the 10 items the 8 pairs are drawn from).
The first participant to join a session decides which game it runs; later joiners receive that
session's config, so the therapist and student do not need to agree on the `game` parameter.

The therapist panel also has a **Game content** selector: choosing *Space Match* and pressing
**New Round** switches the whole room to the other content live, which is the same code path an
admin-driven backend would use.

## Deploying a public demo link

The server is a single Node process that also serves the built client, so any host with Node and
WebSocket support works. A Render Blueprint is included:

1. Push the repo to GitHub (done: `chimpuchim/telesesh-game-demo`).
2. Open <https://render.com/deploy?repo=https://github.com/chimpuchim/telesesh-game-demo>,
   sign in with GitHub and approve the blueprint. `render.yaml` sets the build
   (`npm ci && npm run build`), start (`npm start`), health check (`/healthz`) and `NODE_ENV`.
3. A few minutes later the service answers at `https://<service-name>.onrender.com`. Share the
   bare URL: visitors land on the start page and can play straight away.

Notes: the free plan sleeps after 15 idle minutes (first load then takes 30-50 s; a paid instance
or an external uptime ping on `/healthz` avoids that), and because state is in memory the service
must run as one instance, which is the default.

## Production considerations

Deliberately **not** implemented in the demo, but the architecture leaves clear seams for them:

* **Authentication / session authorization.** Today `role` comes from the URL. In production the
  join request would carry a signed session token issued by the telehealth platform; the server
  would derive `sessionId` and `role` from it instead of trusting the client.
* **Persistent / shared state.** `SessionStore` is in-memory. Back it with Redis (state +
  pub/sub, using the Socket.IO Redis adapter) to survive restarts and scale horizontally;
  the `GameSession`/`GameTemplate` boundary already keeps state serialisable JSON.
* **Rate limiting & abuse protection.** A per-socket limiter exists; production adds per-IP
  limits at the edge, connection caps per session and payload size limits.
* **Backend integration.** Replace `gameRepository.ts` with calls to the customer's content API
  (and cache responses). The JSON contract in `shared/types/gameConfig.ts` is the integration point.
* **Asset CDN.** Item `image` URLs and theme backgrounds would point at a CDN; Phaser preloads
  them per scene.
* **Monitoring / error reporting.** Structured logs, metrics for sessions and action rejections,
  and client error reporting (Sentry or similar).
* **Hardening.** HTTPS/WSS, CORS allow-list, CSP, and session TTL tuned to real session lengths.

## Known limitations

* State lives in server memory: restarting the server clears sessions (clients reconnect and
  start a fresh round).
* Roles are trusted from the URL (see above). The server does enforce that only the therapist
  may Reset / New Round, but it trusts the declared role.
* The two demo themes use emoji; the `image` URL path of items is implemented but not exercised
  by the shipped content.
* Both roles may flip cards (handy for a solo demo). Making flips student-only is a one-line
  change in `MemoryTemplate.reduce`.
* Sound effects are synthesized with WebAudio and start after the first tap, per browser policy.

## License

Demo code, provided as-is for evaluation.
