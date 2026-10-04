import type { GameConfig, GameItem } from '../../../shared/types/gameConfig.js';
import type { MemoryAction, MemoryCard, MemoryState } from '../../../shared/types/memoryState.js';
import type { GameEvent, Role } from '../../../shared/types/protocol.js';
import type { GameTemplate, ReduceContext, ReduceResult, ScheduledEffect } from '../GameTemplate.js';

const THERAPIST_ONLY: ReadonlySet<MemoryAction['type']> = new Set(['RESET_GAME', 'NEW_ROUND']);

function ok(
  state: MemoryState,
  events: GameEvent[] = [],
  effects: ScheduledEffect<MemoryAction>[] = [],
): ReduceResult<MemoryState, MemoryAction> {
  return { ok: true, state, events, effects };
}

function reject(reason: string): ReduceResult<MemoryState, MemoryAction> {
  return { ok: false, reason };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

function dealCards(config: GameConfig): MemoryCard[] {
  const pairCount = (config.settings.rows * config.settings.columns) / 2;
  const chosen: GameItem[] = shuffle(config.items).slice(0, pairCount);
  const itemIds = shuffle([...chosen, ...chosen].map((item) => item.id));
  return itemIds.map((itemId, index) => ({ index, itemId, face: 'hidden' }));
}

function setFace(cards: MemoryCard[], indexes: number[], face: MemoryCard['face']): MemoryCard[] {
  return cards.map((card) => (indexes.includes(card.index) ? { ...card, face } : card));
}

export class MemoryTemplate implements GameTemplate<MemoryState, MemoryAction> {
  readonly id = 'memory';

  validateConfig(config: GameConfig): void {
    const { rows, columns } = config.settings;
    const cells = rows * columns;
    if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1) {
      throw new Error(`"${config.gameId}": rows/columns must be positive integers`);
    }
    if (cells % 2 !== 0) {
      throw new Error(`"${config.gameId}": rows x columns must be even (got ${cells})`);
    }
    if (config.items.length < cells / 2) {
      throw new Error(`"${config.gameId}": needs at least ${cells / 2} items, has ${config.items.length}`);
    }
  }

  createInitialState(config: GameConfig, round: number): MemoryState {
    const cards = dealCards(config);
    return {
      cards,
      flippedCards: [],
      matchedCards: [],
      score: 0,
      moves: 0,
      totalPairs: cards.length / 2,
      status: 'ready',
      startedAt: null,
      completedAt: null,
      round,
    };
  }

  reduce(state: MemoryState, action: MemoryAction, ctx: ReduceContext): ReduceResult<MemoryState, MemoryAction> {
    if (THERAPIST_ONLY.has(action.type) && ctx.role !== 'therapist' && !this.isPlayAgain(state, action)) {
      return reject('Only the therapist can do that');
    }
    switch (action.type) {
      case 'FLIP_CARD':
        return this.flipCard(state, action.cardIndex, ctx);
      case 'RESOLVE_MISMATCH':
        return this.resolveMismatch(state, action.round, ctx.role);
      case 'RESET_GAME':
      case 'NEW_ROUND':
        return ok(this.createInitialState(ctx.config, state.round + 1), [{ type: 'RESET' }]);
    }
  }

  /** Anyone may restart once the round is finished (the "Play Again" button). */
  private isPlayAgain(state: MemoryState, action: MemoryAction): boolean {
    return action.type === 'RESET_GAME' && state.status === 'completed';
  }

  private flipCard(state: MemoryState, cardIndex: number, ctx: ReduceContext): ReduceResult<MemoryState, MemoryAction> {
    if (state.status === 'completed') return reject('Round is already complete');
    if (state.status === 'resolving') return reject('Wait for the cards to flip back');
    if (state.flippedCards.length >= 2) return reject('Two cards are already flipped');

    const card = Number.isInteger(cardIndex) ? state.cards[cardIndex] : undefined;
    if (!card) return reject(`No card at index ${cardIndex}`);
    if (card.face !== 'hidden') return reject('Card is already face up');

    const flippedCards = [...state.flippedCards, cardIndex];
    let next: MemoryState = {
      ...state,
      cards: setFace(state.cards, [cardIndex], 'flipped'),
      flippedCards,
      status: 'playing',
      startedAt: state.startedAt ?? ctx.now,
    };
    if (flippedCards.length < 2) return ok(next);

    const [firstIndex, secondIndex] = flippedCards as [number, number];
    const first = state.cards[firstIndex];
    next = { ...next, moves: state.moves + 1 };

    if (first && first.itemId === card.itemId) {
      const matchedCards = [...state.matchedCards, firstIndex, secondIndex];
      const completed = matchedCards.length === state.cards.length;
      next = {
        ...next,
        cards: setFace(next.cards, flippedCards, 'matched'),
        flippedCards: [],
        matchedCards,
        score: state.score + ctx.config.settings.pointsPerMatch,
        status: completed ? 'completed' : 'playing',
        completedAt: completed ? ctx.now : null,
      };
      const events: GameEvent[] = [{ type: 'MATCH', cardIndexes: flippedCards, itemId: card.itemId }];
      if (completed) events.push({ type: 'COMPLETED' });
      return ok(next, events);
    }

    next = { ...next, status: 'resolving' };
    return ok(
      next,
      [{ type: 'MISMATCH', cardIndexes: flippedCards }],
      [{ delayMs: ctx.config.settings.mismatchRevealMs, action: { type: 'RESOLVE_MISMATCH', round: state.round } }],
    );
  }

  private resolveMismatch(state: MemoryState, round: number, role: Role | null): ReduceResult<MemoryState, MemoryAction> {
    if (role !== null) return reject('Internal action');
    // A reset may have happened while the timer was pending; ignore stale effects.
    if (round !== state.round || state.status !== 'resolving') return reject('Nothing to resolve');
    return ok({
      ...state,
      cards: setFace(state.cards, state.flippedCards, 'hidden'),
      flippedCards: [],
      status: 'playing',
    });
  }
}
