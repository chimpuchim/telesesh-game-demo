import Phaser from 'phaser';
import type { GameItem, GameTheme } from '../../../../shared/types/gameConfig.js';
import type { CardFace } from '../../../../shared/types/memoryState.js';

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';
const LABEL_FONT = 'Nunito, system-ui, sans-serif';
const FLIP_MS = 130;

function hex(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

/**
 * One card. The outer container handles hover/pop scaling; the inner
 * "flipper" is squashed on X to fake a 3D flip between back and face.
 */
export class CardView extends Phaser.GameObjects.Container {
  readonly cardIndex: number;
  private readonly flipper: Phaser.GameObjects.Container;
  private readonly back: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly backSymbol: Phaser.GameObjects.Text;
  private readonly faceSymbol: Phaser.GameObjects.Text | Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly hitZone: Phaser.GameObjects.Zone;
  private shown: CardFace = 'hidden';
  private target: CardFace = 'hidden';
  private flipping = false;
  private cardWidth = 100;
  private cardHeight = 100;
  private hoverable = false;
  private hoverTween: Phaser.Tweens.Tween | null = null;
  private hovered = false;

  constructor(
    scene: Phaser.Scene,
    cardIndex: number,
    private readonly item: GameItem,
    private readonly theme: GameTheme,
    onClick: (index: number) => void,
  ) {
    super(scene);
    this.cardIndex = cardIndex;

    this.back = scene.add.graphics();
    this.face = scene.add.graphics();
    this.backSymbol = scene.add.text(0, 0, theme.cardBackSymbol, { fontFamily: EMOJI_FONT, color: '#ffffff' }).setOrigin(0.5);
    this.faceSymbol =
      item.image && scene.textures.exists(`item:${item.id}`)
        ? scene.add.image(0, 0, `item:${item.id}`)
        : scene.add.text(0, 0, item.emoji ?? '?', { fontFamily: EMOJI_FONT }).setOrigin(0.5);
    this.label = scene.add
      .text(0, 0, item.label, { fontFamily: LABEL_FONT, fontStyle: '800', color: '#2b2f3a' })
      .setOrigin(0.5);

    this.flipper = scene.add.container(0, 0, [this.back, this.backSymbol, this.face, this.faceSymbol, this.label]);
    this.add(this.flipper);

    this.hitZone = scene.add.zone(0, 0, 100, 100).setInteractive({ useHandCursor: true });
    this.add(this.hitZone);
    this.hitZone.on('pointerover', () => this.setHover(true));
    this.hitZone.on('pointerout', () => this.setHover(false));
    this.hitZone.on('pointerdown', () => {
      this.setHover(false);
      onClick(this.cardIndex);
    });

    this.showSide('hidden');
    scene.add.existing(this);
  }

  setCardSize(width: number, height: number): void {
    this.cardWidth = width;
    this.cardHeight = height;
    const radius = Math.min(width, height) * 0.14;
    const bw = Math.max(2, width * 0.035);

    this.back.clear();
    this.back.fillStyle(0x000000, 0.22).fillRoundedRect(-width / 2 + 3, -height / 2 + 6, width, height, radius);
    this.back.fillStyle(hex(this.theme.cardBackColor)).fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    this.back.lineStyle(bw, hex(this.theme.primaryColor), 0.9).strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
    this.back.lineStyle(1.5, 0xffffff, 0.12).strokeRoundedRect(-width / 2 + bw * 2.2, -height / 2 + bw * 2.2, width - bw * 4.4, height - bw * 4.4, radius * 0.7);

    this.face.clear();
    this.face.fillStyle(0x000000, 0.22).fillRoundedRect(-width / 2 + 3, -height / 2 + 6, width, height, radius);
    this.face.fillStyle(hex(this.theme.cardFaceColor)).fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    this.face.lineStyle(bw, hex(this.theme.secondaryColor), 1).strokeRoundedRect(-width / 2, -height / 2, width, height, radius);

    this.backSymbol.setFontSize(Math.round(height * 0.34)).setAlpha(0.9).setPosition(0, 0);
    const symbolSize = height * 0.42;
    if (this.faceSymbol instanceof Phaser.GameObjects.Image) {
      this.faceSymbol.setDisplaySize(symbolSize, symbolSize);
    } else {
      this.faceSymbol.setFontSize(Math.round(symbolSize)).setPadding(0, Math.round(symbolSize * 0.15), 0, 0);
    }
    this.faceSymbol.setPosition(0, -height * 0.1);
    this.label.setFontSize(Math.round(Math.min(height * 0.13, width / Math.max(6, this.item.label.length) * 1.6)));
    this.label.setPosition(0, height * 0.3);
    this.hitZone.setSize(width, height); // also resizes the input hit area
  }

  setHoverable(enabled: boolean): void {
    this.hoverable = enabled && this.target === 'hidden';
    if (!this.hoverable) this.setHover(false);
    this.hitZone.input!.cursor = this.hoverable ? 'pointer' : 'default';
  }

  /** Move toward the authoritative face, animating each flip. Repeated calls are queued, never overlapped. */
  setFace(face: CardFace): void {
    this.target = face;
    if (this.flipping) return;
    this.flipToTarget();
  }

  /** Celebration on a confirmed match. */
  pop(): void {
    this.scene.tweens.add({ targets: this, scale: { from: 1, to: 1.12 }, duration: 160, yoyo: true, ease: 'Sine.easeInOut' });
    this.scene.tweens.add({ targets: this.face, alpha: { from: 0.6, to: 1 }, duration: 300 });
  }

  shake(): void {
    this.scene.tweens.add({ targets: this.flipper, x: { from: -4, to: 4 }, duration: 50, yoyo: true, repeat: 2, onComplete: () => this.flipper.setX(0) });
  }

  dealIn(delayMs: number): void {
    this.setScale(0);
    this.setAlpha(0);
    this.scene.tweens.add({ targets: this, scale: 1, alpha: 1, delay: delayMs, duration: 320, ease: 'Back.easeOut' });
  }

  private setHover(on: boolean): void {
    if (on && !this.hoverable) return;
    if (on === this.hovered) return;
    this.hovered = on;
    this.hoverTween?.stop();
    this.hoverTween = this.scene.tweens.add({ targets: this, scale: on ? 1.05 : 1, duration: 120, ease: 'Sine.easeOut' });
  }

  private flipToTarget(): void {
    const wantUp = this.target !== 'hidden';
    const isUp = this.shown !== 'hidden';
    if (wantUp === isUp) {
      this.shown = this.target;
      this.setHoverable(this.hoverable);
      return;
    }
    this.flipping = true;
    this.scene.tweens.add({
      targets: this.flipper,
      scaleX: 0,
      duration: FLIP_MS,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.showSide(this.target);
        this.scene.tweens.add({
          targets: this.flipper,
          scaleX: 1,
          duration: FLIP_MS,
          ease: 'Sine.easeOut',
          onComplete: () => {
            this.flipping = false;
            this.flipToTarget();
          },
        });
      },
    });
  }

  private showSide(face: CardFace): void {
    this.shown = face;
    const up = face !== 'hidden';
    this.back.setVisible(!up);
    this.backSymbol.setVisible(!up);
    this.face.setVisible(up);
    this.faceSymbol.setVisible(up);
    this.label.setVisible(up);
  }

  get size(): { width: number; height: number } {
    return { width: this.cardWidth, height: this.cardHeight };
  }
}
