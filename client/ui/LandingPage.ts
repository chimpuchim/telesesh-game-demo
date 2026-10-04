import type { GameSummary } from '../game/services/GameConfigService.js';
import { buildUrl } from '../game/services/urlParams.js';
import { DEFAULTS } from '../game/types/index.js';
import { el } from './dom.js';

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function randomSessionCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/**
 * Shown when the URL has no `session` parameter (someone opened the bare link).
 * Lets a visitor start a session as therapist and hand the student link to a
 * second tab, device or person.
 */
export class LandingPage {
  private readonly code = el('input', { className: 'landing__code', type: 'text' });
  private readonly gameSelect = el('select', { className: 'select' });
  private readonly studentLink = el('input', { className: 'landing__link', type: 'text' });
  private readonly copyBtn = el('button', { className: 'btn btn--secondary landing__copy', type: 'button', textContent: 'Copy' });

  constructor(host: HTMLElement, games: GameSummary[], onGameChange: (gameId: string) => void) {
    this.code.value = randomSessionCode();
    this.code.maxLength = 24;
    this.code.spellcheck = false;
    this.studentLink.readOnly = true;

    this.gameSelect.replaceChildren(
      ...games.map((g) => {
        const option = el('option', { textContent: `${g.title} (${g.themeName})` });
        option.value = g.gameId;
        return option;
      }),
    );
    if (games.length === 0) {
      const option = el('option', { textContent: 'Animal Match' });
      option.value = DEFAULTS.gameId;
      this.gameSelect.append(option);
    }

    const shuffle = el('button', { className: 'icon-btn', type: 'button', title: 'New code', textContent: '🎲' });
    shuffle.addEventListener('click', () => {
      this.code.value = randomSessionCode();
      this.refreshLinks();
    });
    this.code.addEventListener('input', () => {
      this.code.value = this.code.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      this.refreshLinks();
    });
    this.gameSelect.addEventListener('change', () => {
      this.refreshLinks();
      onGameChange(this.gameSelect.value);
    });

    const therapistBtn = el('button', { className: 'btn landing__primary', type: 'button', textContent: 'Open Therapist view' });
    therapistBtn.addEventListener('click', () => {
      window.location.href = this.url('therapist');
    });
    const studentBtn = el('button', { className: 'btn btn--secondary', type: 'button', textContent: 'Open Student view in a new tab' });
    studentBtn.addEventListener('click', () => window.open(this.url('student'), '_blank', 'noopener'));
    this.copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.studentLink.value);
        this.copyBtn.textContent = 'Copied!';
      } catch {
        this.studentLink.select();
        this.copyBtn.textContent = 'Select & copy';
      }
      setTimeout(() => (this.copyBtn.textContent = 'Copy'), 1500);
    });

    host.append(
      el('div', { className: 'landing' }, [
        el('div', { className: 'landing__card' }, [
          el('div', { className: 'brand landing__brand' }, [
            el('div', { className: 'brand__logo', textContent: '🎯' }),
            el('div', { className: 'brand__text' }, [
              el('span', { className: 'brand__title', textContent: 'TeleSesh Game Demo' }),
              el('span', { className: 'brand__game', textContent: 'Real-time memory game for therapy sessions' }),
            ]),
          ]),
          el('p', { className: 'landing__lead' }, [
            'A therapist and a student join the same session from different devices and see the same ' +
              'board live. Start here as the therapist, then open the student link in another tab, on a ' +
              'tablet, or send it to a colleague.',
          ]),
          el('div', { className: 'landing__grid' }, [
            el('label', { className: 'field' }, ['Session code', el('div', { className: 'landing__row' }, [this.code, shuffle])]),
            el('label', { className: 'field' }, ['Game content', this.gameSelect]),
          ]),
          therapistBtn,
          studentBtn,
          el('label', { className: 'field landing__share' }, [
            'Student link',
            el('div', { className: 'landing__row' }, [this.studentLink, this.copyBtn]),
          ]),
          el('p', { className: 'landing__hint', textContent: 'Tip: put the two windows side by side to watch every flip sync in real time.' }),
        ]),
      ]),
    );
    this.refreshLinks();
    onGameChange(this.gameSelect.value);
  }

  private url(role: 'therapist' | 'student'): string {
    const sessionId = this.code.value || randomSessionCode();
    return buildUrl({ sessionId, role, gameId: this.gameSelect.value }, DEFAULTS);
  }

  private refreshLinks(): void {
    this.studentLink.value = this.url('student');
  }
}
