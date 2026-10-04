import type Phaser from 'phaser';
import type { GameConfig } from '../../../shared/types/gameConfig.js';
import type { GameEvent, GameState } from '../../../shared/types/protocol.js';
import type { SoundService } from '../services/SoundService.js';

/** Data every template scene receives from GameHost on start. */
export interface TemplateSceneData {
  config: GameConfig;
  sound: SoundService;
  onAction: (action: import('../../../shared/types/protocol.js').ClientAction) => void;
}

/** What GameHost needs from any template's scene, regardless of game. */
export interface TemplateScene extends Phaser.Scene {
  applyState(state: GameState): void;
  handleEvent(event: GameEvent): void;
}
