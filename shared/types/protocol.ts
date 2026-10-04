import type { GameConfig } from './gameConfig.js';
import type { ClientAction, GameState } from './templates.js';

export type { ClientAction, GameState } from './templates.js';

export type Role = 'therapist' | 'student';

/** Full snapshot of a session. This is the only thing the server ever sends about game state. */
export interface SessionSnapshot {
  sessionId: string;
  gameId: string;
  config: GameConfig;
  state: GameState;
  /** Server clock at send time; clients use it to align timers. */
  serverTime: number;
  /** Monotonic per-session version so clients can drop out-of-order snapshots. */
  version: number;
  participants: Participants;
}

export interface Participants {
  therapist: number;
  student: number;
}

export interface JoinSessionRequest {
  sessionId: string;
  role: Role;
  /** Requested game. Only honoured when the session does not exist yet. */
  gameId: string;
}

export interface ActionRejected {
  /** The action type as sent, or 'UNKNOWN' when the payload was unreadable. */
  action: ClientAction['type'] | 'UNKNOWN';
  reason: string;
}

export interface ClientToServerEvents {
  'session:join': (req: JoinSessionRequest, ack: (res: JoinAck) => void) => void;
  'session:action': (action: ClientAction) => void;
}

export type JoinAck = { ok: true; snapshot: SessionSnapshot } | { ok: false; error: string };

export interface ServerToClientEvents {
  'session:state': (snapshot: SessionSnapshot) => void;
  'session:rejected': (info: ActionRejected) => void;
  /** Fired alongside a state update so clients can play one-shot effects. */
  'session:event': (event: GameEvent) => void;
}

export type GameEvent =
  | { type: 'MATCH'; cardIndexes: number[]; itemId: string }
  | { type: 'MISMATCH'; cardIndexes: number[] }
  | { type: 'COMPLETED' }
  | { type: 'RESET' };

export const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const GAME_ID_PATTERN = /^[a-z0-9-]{1,64}$/;
