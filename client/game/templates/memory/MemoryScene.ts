import Phaser from 'phaser';
import type { GameConfig } from '../../../../shared/types/gameConfig.js';
import type { MemoryState } from '../../../../shared/types/memoryState.js';
import type { GameEvent } from '../../../../shared/types/protocol.js';
import type { SoundService } from '../../services/SoundService.js';
import { CardView } from './CardView.js';
import { computeBoardLayout } from './boardLayout.js';

export interface MemorySceneData {
  config: GameConfig;
  sound: SoundService;
  onFlip: (cardIndex: number) => void;
}

export const MEMORY_SCENE_KEY = 'MemoryScene';

/**
 * Renders the authoritative MemoryState. The scene never decides game rules:
 * it animates towards whatever snapshot the server sends and reports taps.
 */
export class MemoryScene extends Phaser.Scene {
  private config!: GameConfig;
  private sound_!: SoundService;
  private onFlip!: (cardIndex: number) => void;
  private cards: CardView[] = [];
  private round = -1;
  private pendingFlip: number | null = null;
  private pendingTimer?: Phaser.Time.TimerEvent;
  private lastState: MemoryState | null = null;
  private ready = false;
  private queued: MemoryState | null = null;

  constructor() {
    super(MEMORY_SCENE_KEY);
  }

  init(data: MemorySceneData): void {
    this.config = data.config;
    this.sound_ = data.sound;
    this.onFlip = data.onFlip;
    this.cards = [];
    this.round = -1;
    this.lastState = null;
    this.ready = false;
    this.queued = null;
  }

  preload(): void {
    for (const item of this.config.items) {
      if (item.image) this.load.image(`item:${item.id}`, item.image);
    }
  }

  create(): void {
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
    this.ready = true;
    if (this.queued) this.applyState(this.queued);
  }

  applyState(state: MemoryState): void {
    if (!this.ready) {
      this.queued = state;
      return;
    }
    if (state.round !== this.round) this.deal(state);
    for (const card of state.cards) this.cards[card.index]?.setFace(card.face);
    this.clearPending();
    this.lastState = state;
    this.updateInput();
  }

  handleEvent(event: GameEvent): void {
    switch (event.type) {
      case 'MATCH':
        this.sound_.match();
        for (const i of event.cardIndexes) {
          const card = this.cards[i];
          if (!card) continue;
          this.time.delayedCall(220, () => {
            card.pop();
            this.burst(card.x, card.y, card.size.width);
          });
        }
        break;
      case 'MISMATCH':
        this.time.delayedCall(300, () => {
          this.sound_.mismatch();
          for (const i of event.cardIndexes) this.cards[i]?.shake();
        });
        break;
      case 'COMPLETED':
        this.time.delayedCall(350, () => this.sound_.win());
        break;
      case 'RESET':
        break;
    }
  }

  private deal(state: MemoryState): void {
    this.round = state.round;
    for (const card of this.cards) card.destroy();
    this.cards = state.cards.map((card) => {
      const item = this.config.items.find((i) => i.id === card.itemId) ?? { id: card.itemId, label: card.itemId, emoji: '?' };
      return new CardView(this, card.index, item, this.config.theme, (index) => this.requestFlip(index));
    });
    this.layout();
    this.cards.forEach((card, i) => card.dealIn(i * 28));
  }

  private requestFlip(cardIndex: number): void {
    const state = this.lastState;
    if (!state || this.pendingFlip !== null) return;
    const card = state.cards[cardIndex];
    if (!card || card.face !== 'hidden') return;
    if (state.status === 'resolving' || state.status === 'completed' || state.flippedCards.length >= 2) return;

    this.sound_.flip();
    this.pendingFlip = cardIndex;
    // Guard against a lost action: unlock after a moment if no snapshot arrives.
    this.pendingTimer = this.time.delayedCall(1200, () => this.clearPending());
    this.onFlip(cardIndex);
    this.updateInput();
  }

  private clearPending(): void {
    this.pendingFlip = null;
    this.pendingTimer?.remove(false);
    this.pendingTimer = undefined;
  }

  private updateInput(): void {
    const s = this.lastState;
    const enabled = !!s && s.status !== 'resolving' && s.status !== 'completed' && s.flippedCards.length < 2 && this.pendingFlip === null;
    for (const card of this.cards) card.setHoverable(enabled);
  }

  private layout(): void {
    const { rows, columns } = this.config.settings;
    const { width, height } = this.scale.gameSize;
    const padding = Math.max(12, Math.min(width, height) * 0.04);
    const l = computeBoardLayout(width, height, rows, columns, padding);
    for (const card of this.cards) {
      const row = Math.floor(card.cardIndex / columns);
      const col = card.cardIndex % columns;
      card.setPosition(l.originX + col * (l.cardWidth + l.gap), l.originY + row * (l.cardHeight + l.gap));
      card.setCardSize(l.cardWidth, l.cardHeight);
    }
  }

  private burst(x: number, y: number, size: number): void {
    const colors = [this.config.theme.primaryColor, this.config.theme.secondaryColor, '#ffffff'];
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
      const dist = size * (0.6 + Math.random() * 0.5);
      const color = Phaser.Display.Color.HexStringToColor(colors[i % colors.length]!).color;
      const dot = this.add.circle(x, y, size * 0.035 + Math.random() * size * 0.02, color);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.3,
        duration: 520 + Math.random() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }
}
