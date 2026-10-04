import { el } from './dom.js';

export class LoadingScreen {
  private readonly node: HTMLElement;
  private readonly text = el('div', { textContent: 'Loading game...' });

  constructor(host: HTMLElement) {
    this.node = el('div', { className: 'loading' }, [
      el('div', { className: 'loading__card' }, [el('div', { className: 'loading__spinner' }), this.text]),
    ]);
    host.append(this.node);
  }

  setMessage(message: string): void {
    this.text.textContent = message;
  }

  fail(message: string): void {
    this.node.querySelector('.loading__spinner')?.remove();
    this.text.className = 'error-text';
    this.text.textContent = message;
  }

  hide(): void {
    this.node.remove();
  }
}
