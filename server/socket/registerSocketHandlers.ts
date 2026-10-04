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
import { RateLimiter } from './RateLimiter.js';

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const ROLES: ReadonlySet<string> = new Set<Role>(['therapist', 'student']);
const CLIENT_ACTIONS: ReadonlySet<string> = new Set<ClientAction['type']>(['FLIP_CARD', 'RESET_GAME', 'NEW_ROUND']);
/** Generous for humans, tight enough to stop a scripted flood. */
const ACTION_LIMIT = { maxActions: 20, perMs: 1000 };

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

function actionLabel(action: unknown): ClientAction['type'] | 'UNKNOWN' {
  const type = (action as { type?: unknown } | null)?.type;
  return typeof type === 'string' && CLIENT_ACTIONS.has(type) ? (type as ClientAction['type']) : 'UNKNOWN';
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
    let joinedSessionId: string | null = null;
    let disconnected = false;
    const limiter = new RateLimiter(ACTION_LIMIT.maxActions, ACTION_LIMIT.perMs);

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
        // The socket may have dropped while the config was loading; never add a ghost member.
        if (disconnected) {
          ack?.({ ok: false, error: 'Disconnected while joining' });
          return;
        }
        const session = existing ?? store.getOrCreate(req.sessionId, config!);

        if (joinedSessionId && joinedSessionId !== req.sessionId) leaveCurrent();
        joinedSessionId = req.sessionId;
        await socket.join(roomFor(req.sessionId));
        session.join(socket.id, req.role);
        ack?.({ ok: true, snapshot: session.snapshot() });
        console.log(`[socket] ${req.role} joined "${req.sessionId}" (${socket.id})`);
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : 'Failed to join session' });
      }
    });

    socket.on('session:action', async (action) => {
      if (!joinedSessionId) return;
      const session = store.get(joinedSessionId);
      if (!session) return;
      if (!limiter.allow()) {
        socket.emit('session:rejected', { action: actionLabel(action), reason: 'Too many actions, slow down' });
        return;
      }
      if (!isClientAction(action)) {
        socket.emit('session:rejected', { action: actionLabel(action), reason: 'Malformed action' });
        return;
      }
      // NEW_ROUND re-reads content from the (mock) backend; only do that work for a role allowed to use it.
      if (action.type !== 'NEW_ROUND' || session.roleOf(socket.id) !== 'therapist') {
        session.dispatch(socket.id, action);
        return;
      }
      try {
        const config = await loadGameConfig(action.gameId ?? session.gameId);
        if (!disconnected) session.dispatch(socket.id, action, config);
      } catch (err) {
        socket.emit('session:rejected', { action: action.type, reason: (err as Error).message });
      }
    });

    socket.on('disconnect', () => {
      disconnected = true;
      leaveCurrent();
    });

    function leaveCurrent(): void {
      if (!joinedSessionId) return;
      store.get(joinedSessionId)?.leave(socket.id);
      joinedSessionId = null;
    }
  });

  return store;
}
