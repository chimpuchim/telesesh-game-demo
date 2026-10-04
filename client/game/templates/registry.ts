import type { GameTemplateId } from '../../../shared/types/templates.js';
import { MEMORY_SCENE_KEY, MemoryScene } from './memory/MemoryScene.js';
import type { TemplateScene } from './TemplateScene.js';

export interface TemplateEntry {
  sceneKey: string;
  sceneClass: new () => TemplateScene;
}

/** One client scene per entry of TemplateContracts; TypeScript fails the build if one is missing. */
export const TEMPLATE_REGISTRY: Record<GameTemplateId, TemplateEntry> = {
  memory: { sceneKey: MEMORY_SCENE_KEY, sceneClass: MemoryScene },
};
