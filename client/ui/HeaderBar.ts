import type { Participants, Role } from '../../shared/types/protocol.js';
import type { ConnectionStatus } from '../game/types/index.js';
import { el } from './dom.js';

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Connecting...',
  connected: 'Connected',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
};

export class HeaderBar {
  private readonly gameName = el('span', { className: 'brand__game', textContent: 'Loading game...' });
  private readonly connChip = el('span', { className: 'chip chip--conn is-connecting' }, [
    el('span', { className: 'dot' }),
    el('span', { textContent: STATUS_LABEL.connecting }),
  ]);
  private readonly therapistDot = el('span', { className: 'dot', title: 'Therapist' });
  private readonly studentDot = el('span', { className: 'dot', title: 'Student' });
  private readonly muteBtn = el('button', { className: 'icon-btn', type: 'button', title: 'Toggle sound' });

  constructor(
    host: HTMLElement,
    opts: { role: Role; sessionId: string; muted: boolean; onToggleMute: () => boolean },
  ) {
    this.setMuted(opts.muted);
    this.muteBtn.addEventListener('click', () => this.setMuted(opts.onToggleMute()));

    host.append(
      el('div', { className: 'brand' }, [
        el('div', { className: 'brand__logo', textContent: '🎯' }),
        el('div', { className: 'brand__text' }, [
          el('span', { className: 'brand__title', textContent: 'TeleSesh Game Demo' }),
          this.gameName,
        ]),
      ]),
      el('div', { className: 'header__meta' }, [
        el('span', { className: 'chip chip--session' }, [
          el('span', { className: 'chip__label', textContent: 'Session' }),
          el('span', { textContent: opts.sessionId }),
        ]),
        el('span', { className: 'chip chip--presence', title: 'Who is in the session' }, [
          el('span', { className: 'chip__label', textContent: 'In room' }),
          this.therapistDot,
          el('span', { textContent: 'T' }),
          this.studentDot,
          el('span', { textContent: 'S' }),
        ]),
        el('span', { className: `chip chip--role is-${opts.role}` }, [
          el('span', { className: 'chip__label', textContent: 'Role:' }),
          el('span', { textContent: opts.role === 'therapist' ? 'Therapist' : 'Student' }),
        ]),
        this.connChip,
        this.muteBtn,
      ]),
    );
  }

  setGameName(name: string): void {
    this.gameName.textContent = name;
  }

  setStatus(status: ConnectionStatus): void {
    this.connChip.className = `chip chip--conn is-${status}`;
    (this.connChip.lastElementChild as HTMLElement).textContent = STATUS_LABEL[status];
  }

  setParticipants(p: Participants): void {
    this.therapistDot.classList.toggle('is-on', p.therapist > 0);
    this.studentDot.classList.toggle('is-on', p.student > 0);
  }

  private setMuted(muted: boolean): void {
    this.muteBtn.textContent = muted ? '🔇' : '🔊';
  }
}
