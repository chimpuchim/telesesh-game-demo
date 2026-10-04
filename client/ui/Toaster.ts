import { el } from './dom.js';

export class Toaster {
  constructor(private readonly host: HTMLElement) {}

  show(message: string, kind: 'info' | 'warn' | 'error' = 'info', ms = 2200): void {
    const toast = el('div', { className: `toast toast--${kind}`, textContent: message });
    this.host.append(toast);
    setTimeout(() => toast.remove(), ms);
  }
}
