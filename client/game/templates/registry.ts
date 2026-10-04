import type Phaser from 'phaser';
import type { GameTemplateId } from '../../../shared/types/gameConfig.js';
import { MEMORY_SCENE_KEY, MemoryScene } from './memory/MemoryScene.js';

export interface TemplateEntry {
  sceneKey: string;
  sceneClass: new () => Phaser.Scene;
}

/** Maps a config's `template` to the Phaser scene that renders it. New templates register here. */
export const TEMPLATE_REGISTRY: Record<GameTemplateId, TemplateEntry> = {
  memory: { sceneKey: MEMORY_SCENE_KEY, sceneClass: MemoryScene },
};
