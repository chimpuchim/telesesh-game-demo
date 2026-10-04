import type { Role } from '../../../shared/types/protocol.js';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface UrlParams {
  sessionId: string;
  role: Role;
  gameId: string;
}

export const DEFAULTS: UrlParams = {
  sessionId: 'demo123',
  role: 'student',
  gameId: 'memory-animals',
};
