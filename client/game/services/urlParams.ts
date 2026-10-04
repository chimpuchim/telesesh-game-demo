import { GAME_ID_PATTERN, SESSION_ID_PATTERN } from '../../../shared/types/protocol.js';
import { DEFAULTS, type UrlParams } from '../types/index.js';

export function parseUrlParams(search: string = window.location.search): UrlParams {
  const q = new URLSearchParams(search);
  const session = q.get('session') ?? '';
  const game = q.get('game') ?? '';
  const role = q.get('role');
  return {
    sessionId: SESSION_ID_PATTERN.test(session) ? session : DEFAULTS.sessionId,
    role: role === 'therapist' ? 'therapist' : DEFAULTS.role,
    gameId: GAME_ID_PATTERN.test(game) ? game : DEFAULTS.gameId,
  };
}

export function buildUrl(params: Partial<UrlParams>, base: UrlParams): string {
  const q = new URLSearchParams({
    session: params.sessionId ?? base.sessionId,
    role: params.role ?? base.role,
    game: params.gameId ?? base.gameId,
  });
  return `${window.location.origin}${window.location.pathname}?${q.toString()}`;
}
