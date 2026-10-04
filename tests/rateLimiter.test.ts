import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RateLimiter } from '../server/socket/RateLimiter.js';

describe('RateLimiter', () => {
  it('allows up to max events per window, then refuses until the window rolls over', () => {
    let now = 0;
    const limiter = new RateLimiter(3, 1000, () => now);
    assert.deepEqual([limiter.allow(), limiter.allow(), limiter.allow(), limiter.allow()], [true, true, true, false]);
    now = 999;
    assert.equal(limiter.allow(), false);
    now = 1000;
    assert.equal(limiter.allow(), true);
  });
});
