/** Tiny synthesised sound effects (no external assets). Unlocked on first user gesture. */
export class SoundService {
  private ctx: AudioContext | null = null;
  private _muted = localStorage.getItem('telesesh.muted') === '1';

  constructor() {
    const unlock = () => {
      this.context().resume().catch(() => undefined);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
  }

  get muted(): boolean {
    return this._muted;
  }

  toggleMuted(): boolean {
    this._muted = !this._muted;
    localStorage.setItem('telesesh.muted', this._muted ? '1' : '0');
    return this._muted;
  }

  flip(): void {
    this.tone([{ freq: 520, at: 0, dur: 0.06, type: 'triangle', gain: 0.18 }]);
  }

  match(): void {
    this.tone([
      { freq: 523, at: 0, dur: 0.12, type: 'sine', gain: 0.22 },
      { freq: 659, at: 0.1, dur: 0.12, type: 'sine', gain: 0.22 },
      { freq: 784, at: 0.2, dur: 0.22, type: 'sine', gain: 0.24 },
    ]);
  }

  mismatch(): void {
    this.tone([
      { freq: 300, at: 0, dur: 0.1, type: 'triangle', gain: 0.12 },
      { freq: 240, at: 0.1, dur: 0.14, type: 'triangle', gain: 0.1 },
    ]);
  }

  win(): void {
    const notes = [523, 659, 784, 1047, 784, 1047];
    this.tone(notes.map((freq, i) => ({ freq, at: i * 0.12, dur: i === notes.length - 1 ? 0.5 : 0.14, type: 'sine', gain: 0.22 })));
  }

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private tone(notes: { freq: number; at: number; dur: number; type: OscillatorType; gain: number }[]): void {
    if (this._muted) return;
    let ctx: AudioContext;
    try {
      ctx = this.context();
    } catch {
      return;
    }
    if (ctx.state !== 'running') return;
    const start = ctx.currentTime + 0.01;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = n.type;
      osc.frequency.value = n.freq;
      env.gain.setValueAtTime(0.0001, start + n.at);
      env.gain.exponentialRampToValueAtTime(n.gain, start + n.at + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, start + n.at + n.dur);
      osc.connect(env).connect(ctx.destination);
      osc.start(start + n.at);
      osc.stop(start + n.at + n.dur + 0.05);
    }
  }
}
