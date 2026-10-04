import type { GameConfig } from '../../shared/types/gameConfig.js';
import type { GameTemplateId, TemplateContracts } from '../../shared/types/templates.js';
import type { GameTemplate } from './GameTemplate.js';
import { MemoryTemplate } from './memory/MemoryTemplate.js';

type TemplateRegistry = {
  [K in GameTemplateId]: GameTemplate<TemplateContracts[K]['state'], TemplateContracts[K]['action']>;
};

/** One server-side implementation per entry of TemplateContracts; TypeScript fails the build if one is missing. */
const templates: TemplateRegistry = {
  memory: new MemoryTemplate(),
};

export type AnyTemplate = TemplateRegistry[GameTemplateId];

export function getTemplate(config: GameConfig): AnyTemplate {
  const template = templates[config.template];
  if (!template) throw new Error(`Unknown game template "${config.template}"`);
  return template;
}
