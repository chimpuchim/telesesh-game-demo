import type { GameConfig } from '../../shared/types/gameConfig.js';
import { GameSession, type SessionListener } from './GameSession.js';

const EMPTY_SESSION_TTL_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * In-memory registry of sessions keyed by sessionId. Each session is fully
 * isolated. Empty sessions are kept for a while so a refresh or a brief
 * disconnect restores the same board.
 */
export class SessionStore {
  private readonly sessions = new Map<string, GameSession>();
  private readonly sweeper: ReturnType<typeof setInterval>;

  constructor(private readonly listenerFor: (sessionId: string) => SessionListener) {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweeper.unref();
  }

  get(sessionId: string): GameSession | undefined {
    return this.sessions.get(sessionId);
  }

  getOrCreate(sessionId: string, config: GameConfig): GameSession {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new GameSession(sessionId, config, this.listenerFor(sessionId));
      this.sessions.set(sessionId, session);
      console.log(`[sessions] created "${sessionId}" with game "${config.gameId}"`);
    }
    return session;
  }

  private sweep(): void {
    for (const [id, session] of this.sessions) {
      const idle = session.idleMs;
      if (idle !== null && idle > EMPTY_SESSION_TTL_MS) {
        session.dispose();
        this.sessions.delete(id);
        console.log(`[sessions] expired "${id}"`);
      }
    }
  }
}
