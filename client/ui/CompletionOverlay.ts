import type { MemoryState } from '../../shared/types/memoryState.js';
import { el, formatDuration } from './dom.js';

/** Friendly end-of-round screen, shared by both roles. */
export class CompletionOverlay {
  private node: HTMLElement | null = null;

  constructor(private readonly host: HTMLElement, private readonly onPlayAgain: () => void) {}

  show(state: MemoryState, themeName: string): void {
    if (this.node) return;
    const elapsed = state.startedAt !== null && state.completedAt !== null ? state.completedAt - state.startedAt : 0;
    const playAgain = el('button', { className: 'btn', type: 'button', textContent: 'Play Again' });
    playAgain.addEventListener('click', () => {
      playAgain.disabled = true;
      this.onPlayAgain();
    });

    this.node = el('div', { className: 'overlay' }, [
      el('div', { className: 'card-modal' }, [
        el('div', { className: 'card-modal__emoji', textContent: '🎉' }),
        el('h2', { className: 'card-modal__title', textContent: 'Great job!' }),
        el('p', { className: 'card-modal__subtitle', textContent: `You found every pair in ${themeName}.` }),
        el('div', { className: 'card-modal__grid' }, [
          this.stat('Score', String(state.score)),
          this.stat('Pairs', `${state.matchedCards.length / 2} / ${state.totalPairs}`),
          this.stat('Time', formatDuration(elapsed)),
        ]),
        playAgain,
        el('p', { className: 'card-modal__note', textContent: `${state.moves} moves` }),
      ]),
    ]);
    this.host.append(this.node);
  }

  hide(): void {
    this.node?.remove();
    this.node = null;
  }

  private stat(label: string, value: string): HTMLElement {
    return el('div', { className: 'stat' }, [
      el('div', { className: 'stat__label', textContent: label }),
      el('div', { className: 'stat__value', textContent: value }),
    ]);
  }
}
