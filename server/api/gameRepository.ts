import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { GameConfig } from '../../shared/types/gameConfig.js';
import { GAME_ID_PATTERN } from '../../shared/types/protocol.js';
import { getTemplate } from '../templates/registry.js';

/**
 * Stand-in for the customer's content backend. Reads JSON from data/games on
 * every request so edits are picked up by the next NEW_ROUND without a restart.
 * Run the server from the project root (or set GAMES_DATA_DIR).
 */
const DATA_DIR = path.resolve(process.cwd(), process.env.GAMES_DATA_DIR ?? 'data/games');

export class GameNotFoundError extends Error {
  constructor(gameId: string) {
    super(`Game "${gameId}" not found`);
  }
}

function assertConfigShape(raw: unknown, gameId: string): asserts raw is GameConfig {
  const cfg = raw as Partial<GameConfig>;
  const missing = (['gameId', 'template', 'title', 'theme', 'settings', 'items'] as const).filter((k) => !cfg[k]);
  if (missing.length) throw new Error(`"${gameId}": missing fields ${missing.join(', ')}`);
  if (cfg.gameId !== gameId) throw new Error(`"${gameId}": file gameId is "${cfg.gameId}"`);
  if (!Array.isArray(cfg.items)) throw new Error(`"${gameId}": items must be an array`);
}

export async function loadGameConfig(gameId: string): Promise<GameConfig> {
  if (!GAME_ID_PATTERN.test(gameId)) throw new GameNotFoundError(gameId);
  let text: string;
  try {
    text = await readFile(path.join(DATA_DIR, `${gameId}.json`), 'utf8');
  } catch {
    throw new GameNotFoundError(gameId);
  }
  const raw: unknown = JSON.parse(text);
  assertConfigShape(raw, gameId);
  getTemplate(raw).validateConfig(raw);
  return raw;
}

export async function listGameIds(): Promise<string[]> {
  const files = await readdir(DATA_DIR);
  return files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length)).sort();
}
