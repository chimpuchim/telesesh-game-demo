import type { GameConfig } from '../shared/types/gameConfig.js';
import type { MemoryAction, MemoryState } from '../shared/types/memoryState.js';
import type { Role } from '../shared/types/protocol.js';
import type { ReduceResult } from '../server/templates/GameTemplate.js';
import { MemoryTemplate } from '../server/templates/memory/MemoryTemplate.js';

export const template = new MemoryTemplate();

export function makeConfig(overrides: Partial<GameConfig['settings']> = {}, itemCount = 10): GameConfig {
  return {
    gameId: 'memory-test',
    template: 'memory',
    title: 'Test',
    theme: {
      name: 'Test',
      background: '#000',
      primaryColor: '#fff',
      secondaryColor: '#fff',
      cardBackColor: '#000',
      cardFaceColor: '#fff',
      cardBackSymbol: '?',
      textColor: '#fff',
    },
    settings: { rows: 2, columns: 2, mismatchRevealMs: 5, pointsPerMatch: 10, ...overrides },
    items: Array.from({ length: itemCount }, (_, i) => ({ id: `item${i}`, label: `Item ${i}`, emoji: '●' })),
  };
}

export function reduce(
  state: MemoryState,
  action: MemoryAction,
  opts: { config?: GameConfig; role?: Role | null; now?: number } = {},
): ReduceResult<MemoryState, MemoryAction> {
  return template.reduce(state, action, {
    config: opts.config ?? makeConfig(),
    now: opts.now ?? 1000,
    role: opts.role === undefined ? 'student' : opts.role,
  });
}

export function expectOk(result: ReduceResult<MemoryState, MemoryAction>): Extract<typeof result, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok, got rejection: ${result.reason}`);
  return result;
}

/** Indexes of the two cards sharing an item, and of a card with a different item. */
export function findPairAndOdd(state: MemoryState): { pair: [number, number]; odd: number } {
  const byItem = new Map<string, number[]>();
  for (const card of state.cards) byItem.set(card.itemId, [...(byItem.get(card.itemId) ?? []), card.index]);
  const groups = [...byItem.values()];
  const pair = groups[0] as [number, number];
  const odd = (groups[1] as number[])[0] as number;
  return { pair, odd };
}
