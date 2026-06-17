import Phaser from "phaser";
import { hasSaveData, loadGame, deleteSave } from "../game/persistence";

const TYPE_COLOURS = [
  0xf97316, // fire
  0x3b82f6, // water
  0x22c55e, // grass
  0xfbbf24, // electric
  0x9333ea, // psychic
  0x67e8f9, // ice
  0x7c3aed, // dragon
  0x6b7280, // dark
  0xfbbf24, // normal
  0xef4444, // fighting
];

interface DriftCircle {
  x: number;
  y: number;
  vy: number;
  radius: number;
  color: number;
  graphic: Phaser.GameObjects.Arc;
}

export default class Title extends Phaser.Scene {
  private driftCircles: DriftCircle[] = [];

  constructor() {
    super("Title");
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // Dark background
    this.add.rectangle(0, 0, W, H, 0x0d1b2a).setOrigin(0);

    // Drifting circles background (10 circles)
    for (let i = 0; i < 10; i++) {
      const radius = Phaser.Math.Between(8, 20);
      const color = TYPE_COLOURS[i % TYPE_COLOURS.length];
      const x = Phaser.Math.Between(radius, W - radius);
      const y = Phaser.Math.Between(0, H);
      const vy = -(0.3 + Math.random() * 0.5);

      const graphic = this.add.arc(x, y, radius, 0, 360, false, color, 0.35);
      graphic.setScrollFactor(0).setDepth(1);

      this.driftCircles.push({ x, y, vy, radius, color, graphic });
    }

    // Title text — animated bob, font size capped so it fits any viewport width
    const titleFontSize = Math.min(48, Math.floor(W / 10));
    const titleY = H / 2 - 80;
    const titleText = this.add.text(W / 2, titleY, "Pokémon Adventure", {
      fontFamily: "monospace",
      fontSize: `${titleFontSize}px`,
      color: "#fbbf24",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 4,
      shadow: { offsetX: 2, offsetY: 2, color: "#000000", blur: 4, fill: true }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    // Bob tween: ±4px, ~2s period (1s each way)
    this.tweens.add({
      targets: titleText,
      y: titleY + 4,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    // Subtitle
    this.add.text(W / 2, H / 2 - 22, "A fan-made RPG", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#94a3b8"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    // Button layout
    const btnW = 200;
    const btnH = 52;
    const btnY = H / 2 + 40;

    this.makeButton(W / 2, btnY, btnW, btnH, 0xfbbf24, "▶  New Game", "#0f172a", () => {
      deleteSave();
      this.scene.start("Boot");
    });

    // "Continue" button — only if save data exists
    if (hasSaveData()) {
      const contY = btnY + btnH + 16;
      this.makeButton(W / 2, contY, btnW, btnH, 0x22d3ee, "📂  Continue", "#0f172a", () => {
        loadGame();
        this.scene.start("Boot");
      });
    }
  }

  private makeButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    fillColor: number,
    label: string,
    textColor: string,
    onDown: () => void
  ): void {
    const x = cx - w / 2;
    const y = cy;

    const bg = this.add.graphics().setScrollFactor(0).setDepth(10);
    bg.fillStyle(fillColor, 1);
    bg.fillRoundedRect(x, y, w, h, 10);

    this.add.text(cx, cy + h / 2, label, {
      fontFamily: "monospace",
      fontSize: "20px",
      color: textColor,
      fontStyle: "bold"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(11);

    const hit = this.add.rectangle(cx, cy + h / 2, w, h, 0x000000, 0)
      .setScrollFactor(0).setDepth(12).setInteractive({ useHandCursor: true });

    const hoverColor = Phaser.Display.Color.ValueToColor(fillColor);
    hoverColor.darken(15);
    const hoverFill = hoverColor.color;

    hit.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(hoverFill, 1);
      bg.fillRoundedRect(x, y, w, h, 10);
    });
    hit.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(fillColor, 1);
      bg.fillRoundedRect(x, y, w, h, 10);
    });
    hit.on("pointerdown", onDown);
  }

  update(): void {
    const H = this.scale.height;
    const W = this.scale.width;
    for (const circle of this.driftCircles) {
      circle.y += circle.vy;
      // Wrap from top back to bottom
      if (circle.y + circle.radius < 0) {
        circle.y = H + circle.radius;
        circle.x = Phaser.Math.Between(circle.radius, W - circle.radius);
      }
      circle.graphic.setPosition(circle.x, circle.y);
    }
  }
}
