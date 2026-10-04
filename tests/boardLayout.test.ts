import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeBoardLayout } from '../client/game/templates/memory/boardLayout.js';

describe('computeBoardLayout', () => {
  it('fits the grid inside the viewport and centres it', () => {
    for (const [w, h] of [[1024, 600], [768, 900], [375, 500]] as const) {
      const l = computeBoardLayout(w, h, 4, 4, 12);
      const gridW = 4 * l.cardWidth + 3 * l.gap;
      const gridH = 4 * l.cardHeight + 3 * l.gap;
      assert.ok(gridW <= w - 24 && gridH <= h - 24, `fits in ${w}x${h}`);
      assert.ok(Math.abs(l.originX - l.cardWidth / 2 - (w - gridW) / 2) < 1, 'centred horizontally');
      assert.ok(Math.abs(l.originY - l.cardHeight / 2 - (h - gridH) / 2) < 1, 'centred vertically');
    }
  });
});
