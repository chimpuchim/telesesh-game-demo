import type { GameConfig } from '../../../shared/types/gameConfig.js';

export interface GameSummary {
  gameId: string;
  template: string;
  title: string;
  themeName: string;
}

/** Thin client for the content API. In production this points at the customer's backend. */
export class GameConfigService {
  constructor(private readonly baseUrl = '/api') {}

  async fetchGame(gameId: string): Promise<GameConfig> {
    const res = await fetch(`${this.baseUrl}/games/${encodeURIComponent(gameId)}`);
    if (res.status === 404) throw new Error(`Game "${gameId}" was not found`);
    if (!res.ok) throw new Error(`Failed to load game "${gameId}" (${res.status})`);
    return (await res.json()) as GameConfig;
  }

  async listGames(): Promise<GameSummary[]> {
    const res = await fetch(`${this.baseUrl}/games`);
    if (!res.ok) throw new Error(`Failed to list games (${res.status})`);
    return (await res.json()) as GameSummary[];
  }
}
