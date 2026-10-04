import type { GameConfig } from '../../shared/types/gameConfig.js';
import type { GameTemplate } from './GameTemplate.js';
import { MemoryTemplate } from './memory/MemoryTemplate.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTemplate = GameTemplate<any, any>;

const templates: Record<string, AnyTemplate> = {
  memory: new MemoryTemplate(),
};

export function getTemplate(config: GameConfig): AnyTemplate {
  const template = templates[config.template];
  if (!template) throw new Error(`Unknown game template "${config.template}"`);
  return template;
}
