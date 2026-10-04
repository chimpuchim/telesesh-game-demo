/**
 * Content/configuration contract shared by the client, the server and the
 * customer's backend. Everything the game shows (theme, items, board size)
 * comes from here; gameplay code never hardcodes it.
 */
import type { GameTemplateId, TemplateSettings } from './templates.js';

export type { GameTemplateId } from './templates.js';

export interface GameTheme {
  name: string;
  /** Any valid CSS background value (gradient, colour, url(...)). */
  background: string;
  primaryColor: string;
  secondaryColor: string;
  cardBackColor: string;
  cardFaceColor: string;
  /** Glyph drawn on the back of every card. */
  cardBackSymbol: string;
  textColor: string;
}

export interface GameItem {
  id: string;
  label: string;
  /** Emoji/glyph rendered on the card face. */
  emoji?: string;
  /** Optional image URL; when present it is preferred over the emoji. */
  image?: string;
}

export interface GameConfig {
  gameId: string;
  template: GameTemplateId;
  title: string;
  theme: GameTheme;
  /** Template-specific settings; the template validates and narrows them. */
  settings: TemplateSettings;
  items: GameItem[];
}
