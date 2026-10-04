import type { GameTheme } from '../../shared/types/gameConfig.js';

/** Pushes theme colours from the game config into CSS variables so the DOM chrome matches the board. */
export function applyTheme(theme: GameTheme): void {
  const root = document.documentElement.style;
  root.setProperty('--theme-bg', theme.background);
  root.setProperty('--theme-primary', theme.primaryColor);
  root.setProperty('--theme-secondary', theme.secondaryColor);
  root.setProperty('--theme-text', theme.textColor);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.cardBackColor);
}
