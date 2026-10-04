import type { GameConfig } from '../../shared/types/gameConfig.js';
import type { ClientAction, GameEvent, Participants, Role, SessionSnapshot } from '../../shared/types/protocol.js';
import type { GameTemplate } from '../templates/GameTemplate.js';
import { getTemplate } from '../templates/registry.js';

export interface SessionListener {
  onState(snapshot: SessionSnapshot, events: GameEvent[]): void;
  onRejected(socketId: string, action: ClientAction['type'], reason: string): void;
}

/**
 * One authoritative game session. Holds the state, applies actions through the
 * template's pure reducer, runs the template's scheduled effects, and notifies
 * the transport layer. Knows nothing about Socket.IO.
 */
export class GameSession {
  private readonly template: GameTemplate<unknown, ClientAction>;
  private state: unknown;
  private version = 0;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly members = new Map<string, Role>();
  private emptySince: number | null = Date.now();

  constructor(
    public readonly sessionId: string,
    private config: GameConfig,
    private readonly listener: SessionListener,
  ) {
    this.template = getTemplate(config);
    this.state = this.template.createInitialState(config, 1);
  }

  get gameId(): string {
    return this.config.gameId;
  }

  get memberCount(): number {
    return this.members.size;
  }

  /** How long the room has been empty, or null while someone is connected. */
  get idleMs(): number | null {
    return this.emptySince === null ? null : Date.now() - this.emptySince;
  }

  join(socketId: string, role: Role): void {
    this.members.set(socketId, role);
    this.emptySince = null;
    this.version++;
    this.listener.onState(this.snapshot(), []);
  }

  leave(socketId: string): void {
    if (!this.members.delete(socketId)) return;
    if (this.members.size === 0) this.emptySince = Date.now();
    this.version++;
    this.listener.onState(this.snapshot(), []);
  }

  /**
   * Apply a client action. `nextConfig` (NEW_ROUND) is freshly loaded content;
   * it only becomes the session's config if the template accepts the action.
   */
  dispatch(socketId: string, action: ClientAction, nextConfig?: GameConfig): void {
    const role = this.members.get(socketId);
    if (!role) {
      this.listener.onRejected(socketId, action.type, 'Join the session first');
      return;
    }
    if (action.type === 'RESOLVE_MISMATCH') {
      this.listener.onRejected(socketId, action.type, 'Internal action');
      return;
    }
    if (nextConfig && nextConfig.template !== this.config.template) {
      this.listener.onRejected(socketId, action.type, `Cannot switch to template "${nextConfig.template}" mid-session`);
      return;
    }
    const config = nextConfig ?? this.config;
    const result = this.template.reduce(this.state, action, { config, now: Date.now(), role });
    if (!result.ok) {
      this.listener.onRejected(socketId, action.type, result.reason);
      return;
    }
    if (action.type === 'RESET_GAME' || action.type === 'NEW_ROUND') this.clearTimers();
    this.config = config;
    this.commit(result.state, result.events, result.effects);
  }

  snapshot(): SessionSnapshot {
    return {
      sessionId: this.sessionId,
      gameId: this.config.gameId,
      config: this.config,
      state: this.state as SessionSnapshot['state'],
      serverTime: Date.now(),
      version: this.version,
      participants: this.participants(),
    };
  }

  dispose(): void {
    this.clearTimers();
  }

  private commit(state: unknown, events: GameEvent[], effects: { delayMs: number; action: ClientAction }[]): void {
    this.state = state;
    this.version++;
    this.listener.onState(this.snapshot(), events);
    for (const effect of effects) this.schedule(effect.delayMs, effect.action);
  }

  private schedule(delayMs: number, action: ClientAction): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      const result = this.template.reduce(this.state, action, { config: this.config, now: Date.now(), role: null });
      if (result.ok) this.commit(result.state, result.events, result.effects);
    }, delayMs);
    this.timers.add(timer);
  }

  private clearTimers(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  private participants(): Participants {
    const counts: Participants = { therapist: 0, student: 0 };
    for (const role of this.members.values()) counts[role]++;
    return counts;
  }
}
