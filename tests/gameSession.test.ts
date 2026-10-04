import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { GameSession, type SessionListener } from '../server/sessions/GameSession.js';
import type { GameEvent, SessionSnapshot } from '../shared/types/protocol.js';
import type { MemoryState } from '../shared/types/memoryState.js';
import { findPairAndOdd, makeConfig } from './helpers.js';

function recorder() {
  const snapshots: SessionSnapshot[] = [];
  const events: GameEvent[] = [];
  const rejections: { socketId: string; action: string; reason: string }[] = [];
  const listener: SessionListener = {
    onState: (s, e) => {
      snapshots.push(s);
      events.push(...e);
    },
    onRejected: (socketId, action, reason) => rejections.push({ socketId, action, reason }),
  };
  const last = () => snapshots[snapshots.length - 1]!;
  const state = () => last().state as MemoryState;
  return { listener, snapshots, events, rejections, last, state };
}

describe('GameSession', () => {
  it('joins broadcast a snapshot with participants and increasing versions', () => {
    const r = recorder();
    const session = new GameSession('s1', makeConfig(), r.listener);
    session.join('t', 'therapist');
    session.join('s', 'student');
    assert.deepEqual(r.last().participants, { therapist: 1, student: 1 });
    assert.equal(r.snapshots[1]!.version > r.snapshots[0]!.version, true);
    session.leave('s');
    assert.deepEqual(r.last().participants, { therapist: 1, student: 0 });
    assert.equal(session.idleMs, null);
    session.leave('t');
    assert.ok((session.idleMs ?? -1) >= 0);
  });

  it('rejects actions from sockets that never joined', () => {
    const r = recorder();
    const session = new GameSession('s1', makeConfig(), r.listener);
    session.dispatch('ghost', { type: 'FLIP_CARD', cardIndex: 0 });
    assert.equal(r.rejections[0]?.reason, 'Join the session first');
  });

  it('runs the mismatch timer and broadcasts the flip-back', async () => {
    const r = recorder();
    const session = new GameSession('s1', makeConfig({ mismatchRevealMs: 10 }), r.listener);
    session.join('s', 'student');
    const { pair, odd } = findPairAndOdd(r.state());
    session.dispatch('s', { type: 'FLIP_CARD', cardIndex: pair[0] });
    session.dispatch('s', { type: 'FLIP_CARD', cardIndex: odd });
    assert.equal(r.state().status, 'resolving');
    session.dispatch('s', { type: 'FLIP_CARD', cardIndex: pair[1] });
    assert.match(r.rejections.at(-1)!.reason, /flip back/);
    await sleep(40);
    assert.equal(r.state().status, 'playing');
    assert.deepEqual(r.state().flippedCards, []);
    session.dispose();
  });

  it('reset cancels a pending mismatch timer so it cannot corrupt the new round', async () => {
    const r = recorder();
    const session = new GameSession('s1', makeConfig({ mismatchRevealMs: 10 }), r.listener);
    session.join('t', 'therapist');
    const { pair, odd } = findPairAndOdd(r.state());
    session.dispatch('t', { type: 'FLIP_CARD', cardIndex: pair[0] });
    session.dispatch('t', { type: 'FLIP_CARD', cardIndex: odd });
    session.dispatch('t', { type: 'RESET_GAME' });
    const versionAfterReset = r.last().version;
    await sleep(40);
    assert.equal(r.last().version, versionAfterReset, 'no extra broadcast from a stale timer');
    assert.equal(r.state().round, 2);
    session.dispose();
  });

  it('NEW_ROUND only adopts the new config when the template accepts the action', () => {
    const r = recorder();
    const session = new GameSession('s1', makeConfig(), r.listener);
    session.join('t', 'therapist');
    session.join('s', 'student');
    const bigger = { ...makeConfig({ rows: 4, columns: 4 }), gameId: 'memory-bigger' };
    session.dispatch('s', { type: 'NEW_ROUND' }, bigger);
    assert.equal(session.gameId, 'memory-test', 'student rejected: config unchanged');
    session.dispatch('t', { type: 'NEW_ROUND' }, bigger);
    assert.equal(session.gameId, 'memory-bigger');
    assert.equal(r.state().cards.length, 16);
    assert.equal(r.last().config.gameId, 'memory-bigger');
  });

  it('refuses to switch template mid-session', () => {
    const r = recorder();
    const session = new GameSession('s1', makeConfig(), r.listener);
    session.join('t', 'therapist');
    const foreign = { ...makeConfig(), template: 'bingo' as 'memory' };
    session.dispatch('t', { type: 'NEW_ROUND' }, foreign);
    assert.match(r.rejections[0]!.reason, /Cannot switch to template/);
  });
});
