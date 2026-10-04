import Phaser from 'phaser';
import type { GameEvent, SessionSnapshot } from '../../shared/types/protocol.js';
import type { SoundService } from './services/SoundService.js';
import { MemoryScene } from './templates/memory/MemoryScene.js';
import { TEMPLATE_REGISTRY } from './templates/registry.js';

/**
 * Owns the Phaser.Game instance, keeps the canvas crisp on hi-DPI screens and
 * (re)starts the right template scene whenever the session's game changes.
 */
export class GameHost {
  private readonly game: Phaser.Game;
  private readonly dpr = Math.min(window.devicePixelRatio || 1, 2);
  /** Serialised config of the running scene; any content change (not just a new gameId) restarts it. */
  private activeConfigKey: string | null = null;
  private activeSceneKey: string | null = null;
  private booted = false;
  private pendingSnapshot: SessionSnapshot | null = null;

  constructor(
    private readonly parent: HTMLElement,
    private readonly sound: SoundService,
    private readonly onFlip: (cardIndex: number) => void,
  ) {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      transparent: true,
      scale: { mode: Phaser.Scale.NONE, width: 10, height: 10, zoom: 1 / this.dpr },
      render: { antialias: true, antialiasGL: true },
      input: { activePointers: 2 },
    });
    // Scenes are registered without auto-start; the first snapshot decides which one runs.
    for (const entry of Object.values(TEMPLATE_REGISTRY)) {
      this.game.scene.add(entry.sceneKey, entry.sceneClass, false);
    }
    new ResizeObserver(() => this.resize()).observe(parent);
    this.resize();
    if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = this.game;
    // Phaser boots asynchronously; the first snapshot usually arrives before that.
    this.game.events.once(Phaser.Core.Events.READY, () => {
      this.booted = true;
      if (this.pendingSnapshot) this.applySnapshot(this.pendingSnapshot);
      this.pendingSnapshot = null;
    });
  }

  applySnapshot(snapshot: SessionSnapshot): void {
    if (!this.booted) {
      this.pendingSnapshot = snapshot;
      return;
    }
    if (JSON.stringify(snapshot.config) !== this.activeConfigKey) this.startScene(snapshot);
    this.activeScene()?.applyState(snapshot.state);
  }

  handleEvent(event: GameEvent): void {
    if (this.booted) this.activeScene()?.handleEvent(event);
  }

  private startScene(snapshot: SessionSnapshot): void {
    const entry = TEMPLATE_REGISTRY[snapshot.config.template];
    if (!entry) throw new Error(`No client template for "${snapshot.config.template}"`);
    if (this.activeSceneKey) this.game.scene.stop(this.activeSceneKey);
    this.activeConfigKey = JSON.stringify(snapshot.config);
    this.activeSceneKey = entry.sceneKey;
    this.game.scene.start(entry.sceneKey, { config: snapshot.config, sound: this.sound, onFlip: this.onFlip });
  }

  private activeScene(): MemoryScene | null {
    if (!this.activeSceneKey) return null;
    const scene = this.game.scene.getScene(this.activeSceneKey);
    return scene instanceof MemoryScene ? scene : null;
  }

  private resize(): void {
    const w = Math.max(1, Math.floor(this.parent.clientWidth));
    const h = Math.max(1, Math.floor(this.parent.clientHeight));
    this.game.scale.resize(Math.floor(w * this.dpr), Math.floor(h * this.dpr));
  }
}
