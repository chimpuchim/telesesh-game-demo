/** Fixed-window counter: at most `max` events per `windowMs`, per instance (one per socket). */
export class RateLimiter {
  private windowStart = 0;
  private count = 0;

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  allow(): boolean {
    const t = this.now();
    if (t - this.windowStart >= this.windowMs) {
      this.windowStart = t;
      this.count = 0;
    }
    this.count++;
    return this.count <= this.max;
  }
}
