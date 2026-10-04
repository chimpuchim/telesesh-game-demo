import type { ClientAction } from '../../shared/types/protocol.js';
import type { GameSummary } from '../game/services/GameConfigService.js';
import { el } from './dom.js';

/** Admin controls. Only mounted for the therapist role; the server also enforces the role. */
export class TherapistPanel {
  private readonly select = el('select', { className: 'select' });
  private readonly status = el('div', { className: 'tpanel__status' });
  private readonly panel = el('aside', { className: 'tpanel' });

  constructor(host: HTMLElement, private readonly send: (action: ClientAction) => void) {
    const reset = el('button', { className: 'btn', type: 'button', textContent: 'Reset Game' });
    reset.addEventListener('click', () => this.send({ type: 'RESET_GAME' }));

    const newRound = el('button', { className: 'btn btn--secondary', type: 'button', textContent: 'New Round' });
    newRound.addEventListener('click', () => {
      const gameId = this.select.value || undefined;
      this.send(gameId ? { type: 'NEW_ROUND', gameId } : { type: 'NEW_ROUND' });
    });

    this.panel.append(
      el('div', { className: 'tpanel__title', textContent: 'Therapist controls' }),
      reset,
      el('label', { className: 'field' }, ['Game content', this.select]),
      newRound,
      this.status,
    );
    host.append(this.panel);
  }

  setGames(games: GameSummary[], currentGameId: string): void {
    this.select.replaceChildren(
      ...games.map((g) => {
        const option = el('option', { textContent: `${g.title} (${g.themeName})` });
        option.value = g.gameId;
        return option;
      }),
    );
    this.select.value = currentGameId;
  }

  setCurrentGame(gameId: string): void {
    if (this.select.value !== gameId) this.select.value = gameId;
  }

  setStatusText(text: string): void {
    this.status.textContent = text;
  }
}
