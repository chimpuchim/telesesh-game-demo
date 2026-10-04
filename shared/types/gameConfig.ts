/**
 * Content/configuration contract shared by the client, the server and the
 * customer's backend. Everything the game shows (theme, items, board size)
 * comes from here; gameplay code never hardcodes it.
 */
export type GameTemplateId = 'memory';

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

export interface MemorySettings {
  rows: number;
  columns: number;
  /** How long two mismatched cards stay revealed before flipping back. */
  mismatchRevealMs: number;
  pointsPerMatch: number;
}

export interface GameConfig {
  gameId: string;
  template: GameTemplateId;
  title: string;
  theme: GameTheme;
  settings: MemorySettings;
  items: GameItem[];
}
