import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expectOk, findPairAndOdd, makeConfig, reduce, template } from './helpers.js';

describe('MemoryTemplate.validateConfig', () => {
  it('accepts an even board with enough items', () => {
    assert.doesNotThrow(() => template.validateConfig(makeConfig({ rows: 4, columns: 4 })));
  });
  it('rejects an odd number of cells', () => {
    assert.throws(() => template.validateConfig(makeConfig({ rows: 3, columns: 3 })), /must be even/);
  });
  it('rejects too few items for the board', () => {
    assert.throws(() => template.validateConfig(makeConfig({ rows: 4, columns: 4 }, 3)), /at least 8 items/);
  });
});

describe('MemoryTemplate.createInitialState', () => {
  it('deals every item exactly twice, all hidden, nothing started', () => {
    const state = template.createInitialState(makeConfig({ rows: 4, columns: 4 }), 1);
    assert.equal(state.cards.length, 16);
    assert.equal(state.totalPairs, 8);
    const counts = new Map<string, number>();
    for (const card of state.cards) {
      assert.equal(card.face, 'hidden');
      counts.set(card.itemId, (counts.get(card.itemId) ?? 0) + 1);
    }
    assert.ok([...counts.values()].every((n) => n === 2));
    assert.equal(state.status, 'ready');
    assert.equal(state.startedAt, null);
    assert.equal(state.round, 1);
  });
  it('indexes cards row-major from 0', () => {
    const state = template.createInitialState(makeConfig(), 1);
    assert.deepEqual(state.cards.map((c) => c.index), [0, 1, 2, 3]);
  });
});

describe('FLIP_CARD', () => {
  it('flips a hidden card, starts the timer and the round', () => {
    const s0 = template.createInitialState(makeConfig(), 1);
    const s1 = expectOk(reduce(s0, { type: 'FLIP_CARD', cardIndex: 0 }, { now: 5000 })).state;
    assert.equal(s1.cards[0]?.face, 'flipped');
    assert.deepEqual(s1.flippedCards, [0]);
    assert.equal(s1.status, 'playing');
    assert.equal(s1.startedAt, 5000);
  });
  it('rejects out-of-range and non-integer indexes', () => {
    const s0 = template.createInitialState(makeConfig(), 1);
    assert.equal(reduce(s0, { type: 'FLIP_CARD', cardIndex: 99 }).ok, false);
    assert.equal(reduce(s0, { type: 'FLIP_CARD', cardIndex: -1 }).ok, false);
    assert.equal(reduce(s0, { type: 'FLIP_CARD', cardIndex: 1.5 }).ok, false);
  });
  it('rejects flipping a card that is already face up', () => {
    const s0 = template.createInitialState(makeConfig(), 1);
    const s1 = expectOk(reduce(s0, { type: 'FLIP_CARD', cardIndex: 0 })).state;
    assert.match((reduce(s1, { type: 'FLIP_CARD', cardIndex: 0 }) as { reason: string }).reason, /already face up/);
  });
  it('matching pair stays open, scores, and emits MATCH', () => {
    const s0 = template.createInitialState(makeConfig(), 1);
    const { pair } = findPairAndOdd(s0);
    const s1 = expectOk(reduce(s0, { type: 'FLIP_CARD', cardIndex: pair[0] })).state;
    const r2 = expectOk(reduce(s1, { type: 'FLIP_CARD', cardIndex: pair[1] }));
    assert.equal(r2.state.cards[pair[0]]?.face, 'matched');
    assert.equal(r2.state.cards[pair[1]]?.face, 'matched');
    assert.deepEqual(r2.state.flippedCards, []);
    assert.equal(r2.state.score, 10);
    assert.equal(r2.state.moves, 1);
    assert.equal(r2.state.status, 'playing');
    assert.equal(r2.events[0]?.type, 'MATCH');
    assert.equal(r2.effects.length, 0);
  });
  it('mismatch locks the board and schedules RESOLVE_MISMATCH with the configured delay', () => {
    const s0 = template.createInitialState(makeConfig({ mismatchRevealMs: 777 }), 1);
    const { pair, odd } = findPairAndOdd(s0);
    const s1 = expectOk(reduce(s0, { type: 'FLIP_CARD', cardIndex: pair[0] })).state;
    const r2 = expectOk(reduce(s1, { type: 'FLIP_CARD', cardIndex: odd }, { config: makeConfig({ mismatchRevealMs: 777 }) }));
    assert.equal(r2.state.status, 'resolving');
    assert.equal(r2.state.score, 0);
    assert.equal(r2.events[0]?.type, 'MISMATCH');
    assert.deepEqual(r2.effects, [{ delayMs: 777, action: { type: 'RESOLVE_MISMATCH', round: 1 } }]);
    // A third flip while resolving is refused: this is the anti-spam guarantee.
    const r3 = reduce(r2.state, { type: 'FLIP_CARD', cardIndex: pair[1] });
    assert.equal(r3.ok, false);
  });
  it('completing the last pair marks the round completed with a completion time', () => {
    const s0 = template.createInitialState(makeConfig(), 1);
    const { pair } = findPairAndOdd(s0);
    const other = s0.cards.filter((c) => !pair.includes(c.index)).map((c) => c.index) as [number, number];
    let s = expectOk(reduce(s0, { type: 'FLIP_CARD', cardIndex: pair[0] })).state;
    s = expectOk(reduce(s, { type: 'FLIP_CARD', cardIndex: pair[1] })).state;
    s = expectOk(reduce(s, { type: 'FLIP_CARD', cardIndex: other[0] })).state;
    const last = expectOk(reduce(s, { type: 'FLIP_CARD', cardIndex: other[1] }, { now: 9999 }));
    assert.equal(last.state.status, 'completed');
    assert.equal(last.state.completedAt, 9999);
    assert.equal(last.state.score, 20);
    assert.deepEqual(last.events.map((e) => e.type), ['MATCH', 'COMPLETED']);
    assert.equal(reduce(last.state, { type: 'FLIP_CARD', cardIndex: 0 }).ok, false);
  });
});

describe('RESOLVE_MISMATCH', () => {
  function resolvingState() {
    const s0 = template.createInitialState(makeConfig(), 1);
    const { pair, odd } = findPairAndOdd(s0);
    const s1 = expectOk(reduce(s0, { type: 'FLIP_CARD', cardIndex: pair[0] })).state;
    return expectOk(reduce(s1, { type: 'FLIP_CARD', cardIndex: odd })).state;
  }
  it('hides the two cards and unlocks the board', () => {
    const s = resolvingState();
    const r = expectOk(reduce(s, { type: 'RESOLVE_MISMATCH', round: 1 }, { role: null }));
    assert.equal(r.state.status, 'playing');
    assert.deepEqual(r.state.flippedCards, []);
    assert.ok(r.state.cards.every((c) => c.face === 'hidden'));
  });
  it('is ignored when stale (different round) or sent by a client', () => {
    const s = resolvingState();
    assert.equal(reduce(s, { type: 'RESOLVE_MISMATCH', round: 7 }, { role: null }).ok, false);
    assert.equal(reduce(s, { type: 'RESOLVE_MISMATCH', round: 1 }, { role: 'therapist' }).ok, false);
  });
});

describe('RESET_GAME / NEW_ROUND', () => {
  it('therapist resets to a fresh board with round + 1 and emits RESET', () => {
    const s0 = template.createInitialState(makeConfig(), 3);
    const s1 = expectOk(reduce(s0, { type: 'FLIP_CARD', cardIndex: 0 })).state;
    const r = expectOk(reduce(s1, { type: 'RESET_GAME' }, { role: 'therapist' }));
    assert.equal(r.state.round, 4);
    assert.equal(r.state.score, 0);
    assert.equal(r.state.status, 'ready');
    assert.ok(r.state.cards.every((c) => c.face === 'hidden'));
    assert.deepEqual(r.events, [{ type: 'RESET' }]);
  });
  it('student may not reset or start a new round mid-game', () => {
    const s0 = template.createInitialState(makeConfig(), 1);
    assert.equal(reduce(s0, { type: 'RESET_GAME' }, { role: 'student' }).ok, false);
    assert.equal(reduce(s0, { type: 'NEW_ROUND' }, { role: 'student' }).ok, false);
  });
  it('anyone may Play Again once the round is completed', () => {
    const s0 = template.createInitialState(makeConfig(), 1);
    const completed = { ...s0, status: 'completed' as const };
    assert.equal(reduce(completed, { type: 'RESET_GAME' }, { role: 'student' }).ok, true);
    assert.equal(reduce(completed, { type: 'NEW_ROUND' }, { role: 'student' }).ok, false);
  });
  it('NEW_ROUND deals from the config passed in the context (reloaded content)', () => {
    const s0 = template.createInitialState(makeConfig(), 1);
    const bigger = makeConfig({ rows: 4, columns: 4 });
    const r = expectOk(reduce(s0, { type: 'NEW_ROUND' }, { role: 'therapist', config: bigger }));
    assert.equal(r.state.cards.length, 16);
  });
});
