import type { Server, Socket } from 'socket.io';
import { GAME_ID_PATTERN, SESSION_ID_PATTERN } from '../../shared/types/protocol.js';
import type {
  ClientAction,
  ClientToServerEvents,
  JoinSessionRequest,
  Role,
  ServerToClientEvents,
} from '../../shared/types/protocol.js';
import { loadGameConfig } from '../api/gameRepository.js';
import type { SessionListener } from '../sessions/GameSession.js';
import { SessionStore } from '../sessions/SessionStore.js';

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const ROLES: ReadonlySet<string> = new Set<Role>(['therapist', 'student']);
const CLIENT_ACTIONS: ReadonlySet<string> = new Set<ClientAction['type']>(['FLIP_CARD', 'RESET_GAME', 'NEW_ROUND']);

function roomFor(sessionId: string): string {
  return `session:${sessionId}`;
}

function validateJoin(req: unknown): JoinSessionRequest | string {
  const r = req as Partial<JoinSessionRequest> | null;
  if (!r || typeof r !== 'object') return 'Malformed join request';
  if (typeof r.sessionId !== 'string' || !SESSION_ID_PATTERN.test(r.sessionId)) return 'Invalid session id';
  if (typeof r.role !== 'string' || !ROLES.has(r.role)) return 'Invalid role';
  if (typeof r.gameId !== 'string' || !GAME_ID_PATTERN.test(r.gameId)) return 'Invalid game id';
  return { sessionId: r.sessionId, role: r.role as Role, gameId: r.gameId };
}

function isClientAction(action: unknown): action is ClientAction {
  const a = action as { type?: unknown; cardIndex?: unknown; gameId?: unknown } | null;
  if (!a || typeof a !== 'object' || typeof a.type !== 'string' || !CLIENT_ACTIONS.has(a.type)) return false;
  if (a.type === 'FLIP_CARD') return typeof a.cardIndex === 'number';
  if (a.type === 'NEW_ROUND' && a.gameId !== undefined) {
    return typeof a.gameId === 'string' && GAME_ID_PATTERN.test(a.gameId);
  }
  return true;
}

export function registerSocketHandlers(io: GameServer): SessionStore {
  const listenerFor = (sessionId: string): SessionListener => ({
    onState: (snapshot, events) => {
      const room = io.to(roomFor(sessionId));
      room.emit('session:state', snapshot);
      for (const event of events) room.emit('session:event', event);
    },
    onRejected: (socketId, action, reason) => {
      io.to(socketId).emit('session:rejected', { action, reason });
    },
  });
  const store = new SessionStore(listenerFor);

  io.on('connection', (socket: GameSocket) => {
    let joined: { sessionId: string } | null = null;

    socket.on('session:join', async (rawReq, ack) => {
      const req = validateJoin(rawReq);
      if (typeof req === 'string') {
        ack?.({ ok: false, error: req });
        return;
      }
      try {
        const existing = store.get(req.sessionId);
        // The first participant decides the game; late joiners receive whatever the session runs.
        const config = existing ? undefined : await loadGameConfig(req.gameId);
        const session = existing ?? store.getOrCreate(req.sessionId, config!);

        if (joined && joined.sessionId !== req.sessionId) leaveCurrent();
        joined = { sessionId: req.sessionId };
        await socket.join(roomFor(req.sessionId));
        session.join(socket.id, req.role);
        ack?.({ ok: true, snapshot: session.snapshot() });
        console.log(`[socket] ${req.role} joined "${req.sessionId}" (${socket.id})`);
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : 'Failed to join session' });
      }
    });

    socket.on('session:action', async (action) => {
      if (!joined) return;
      const session = store.get(joined.sessionId);
      if (!session) return;
      if (!isClientAction(action)) {
        socket.emit('session:rejected', { action: 'FLIP_CARD', reason: 'Malformed action' });
        return;
      }
      if (action.type !== 'NEW_ROUND') {
        session.dispatch(socket.id, action);
        return;
      }
      // Reload content from the (mock) backend so admin edits reach the running session.
      try {
        session.dispatch(socket.id, action, await loadGameConfig(action.gameId ?? session.gameId));
      } catch (err) {
        socket.emit('session:rejected', { action: action.type, reason: (err as Error).message });
      }
    });

    socket.on('disconnect', () => leaveCurrent());

    function leaveCurrent(): void {
      if (!joined) return;
      store.get(joined.sessionId)?.leave(socket.id);
      joined = null;
    }
  });

  return store;
}
