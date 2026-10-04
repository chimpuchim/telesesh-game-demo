import type { GameConfig } from '../../shared/types/gameConfig.js';
import type { GameEvent, Role } from '../../shared/types/protocol.js';

/** An action the template wants the session to feed back to it after a delay. */
export interface ScheduledEffect<A> {
  delayMs: number;
  action: A;
}

export interface ReduceContext {
  config: GameConfig;
  /** Server epoch ms. */
  now: number;
  /** Who asked. `null` for server-scheduled effects. */
  role: Role | null;
}

export type ReduceResult<S, A> =
  | { ok: true; state: S; events: GameEvent[]; effects: ScheduledEffect<A>[] }
  | { ok: false; reason: string };

/**
 * A game template is a pure state machine: no sockets, no timers, no DOM.
 * The session layer owns transport and scheduling, so every future template
 * (word sort, bingo, ...) plugs into the same synchronisation code.
 */
export interface GameTemplate<S, A extends { type: string }> {
  readonly id: string;
  validateConfig(config: GameConfig): void;
  createInitialState(config: GameConfig, round: number): S;
  reduce(state: S, action: A, ctx: ReduceContext): ReduceResult<S, A>;
}
