import type { MemoryState } from '../../shared/types/memoryState.js';
import { el, formatDuration } from './dom.js';

/** Score / pairs / timer. The timer is derived from server timestamps so both clients agree. */
export class StatsBar {
  private readonly score = el('div', { className: 'stat__value', textContent: '0' });
  private readonly pairs = el('div', { className: 'stat__value', textContent: '0 / 0' });
  private readonly time = el('div', { className: 'stat__value', textContent: '0:00' });
  private state: MemoryState | null = null;
  private lastScore = 0;

  constructor(host: HTMLElement, private readonly serverNow: () => number) {
    host.append(
      this.stat('Score', this.score),
      this.stat('Pairs', this.pairs),
      this.stat('Time', this.time),
    );
    setInterval(() => this.tick(), 250);
  }

  update(state: MemoryState): void {
    this.state = state;
    this.score.textContent = String(state.score);
    this.pairs.textContent = `${state.matchedCards.length / 2} / ${state.totalPairs}`;
    if (state.score > this.lastScore) this.bump(this.score);
    this.lastScore = state.score;
    this.tick();
  }

  private tick(): void {
    const s = this.state;
    if (!s || s.startedAt === null) {
      this.time.textContent = '0:00';
      return;
    }
    const end = s.completedAt ?? this.serverNow();
    this.time.textContent = formatDuration(end - s.startedAt);
  }

  private bump(node: HTMLElement): void {
    node.classList.remove('is-bumping');
    void node.offsetWidth;
    node.classList.add('is-bumping');
  }

  private stat(label: string, value: HTMLElement): HTMLElement {
    return el('div', { className: 'stat' }, [el('div', { className: 'stat__label', textContent: label }), value]);
  }
}
