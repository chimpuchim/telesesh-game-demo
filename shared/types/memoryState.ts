/** Per-game settings of the memory template (comes from the JSON config). */
export interface MemorySettings {
  rows: number;
  columns: number;
  /** How long two mismatched cards stay revealed before flipping back. */
  mismatchRevealMs: number;
  pointsPerMatch: number;
}

/** Authoritative state of one memory-matching round. Owned by the server. */
export type CardFace = 'hidden' | 'flipped' | 'matched';

export interface MemoryCard {
  /** Position on the board (row-major). Stable for the whole round. */
  index: number;
  itemId: string;
  face: CardFace;
}

export type MemoryStatus =
  /** Board dealt, timer not started. */
  | 'ready'
  | 'playing'
  /** Two mismatched cards are revealed; input is locked until they flip back. */
  | 'resolving'
  | 'completed';

export interface MemoryState {
  cards: MemoryCard[];
  flippedCards: number[];
  matchedCards: number[];
  score: number;
  moves: number;
  totalPairs: number;
  status: MemoryStatus;
  /** Server epoch ms; null until the first card is flipped. */
  startedAt: number | null;
  completedAt: number | null;
  /** Incremented on every reset/new round so clients can discard stale animations. */
  round: number;
}

export type MemoryAction =
  | { type: 'FLIP_CARD'; cardIndex: number }
  | { type: 'RESET_GAME' }
  /** Re-deal with freshly loaded content; `gameId` switches to another game of the same template. */
  | { type: 'NEW_ROUND'; gameId?: string }
  /** Internal, scheduled by the server after a mismatch. Never accepted from clients. */
  | { type: 'RESOLVE_MISMATCH'; round: number };
