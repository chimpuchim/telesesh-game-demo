import type { MemoryAction, MemorySettings, MemoryState } from './memoryState.js';

/**
 * Registry of every game template's shared contract. Adding a template means
 * adding one entry here; every union below (settings, state, actions) and the
 * server/client registries derive from it.
 */
export interface TemplateContracts {
  memory: { settings: MemorySettings; state: MemoryState; action: MemoryAction };
}

export type GameTemplateId = keyof TemplateContracts;
export type TemplateSettings = TemplateContracts[GameTemplateId]['settings'];
export type GameState = TemplateContracts[GameTemplateId]['state'];
export type ClientAction = TemplateContracts[GameTemplateId]['action'];
