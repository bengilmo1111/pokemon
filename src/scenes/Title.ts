import Phaser from "phaser";
import { deleteSave, getSaveSlots, hasSaveData, loadGame, renameSaveSlot, saveGame, setActiveSaveSlot } from "../game/persistence";
import { gameState } from "../game/store";
import { createInitialState } from "../game/state";

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
    const titleY = H / 2 - 150;
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
    this.add.text(W / 2, H / 2 - 92, "Choose a save slot", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#94a3b8"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    // Wait one resize tick so RESIZE mode has settled to the true viewport size
    // before placing interactive buttons (first paint can be off by a frame).
    this.scale.once("resize", () => this.drawSaveSlots());
    // Also draw immediately in case no resize fires (canvas already correct size).
    this.drawSaveSlots();
  }

  private drawSaveSlots(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const slots = getSaveSlots();
    const slotW = Math.min(440, W * 0.88);
    const slotH = 96;
    const startY = H / 2 - 58;

    slots.forEach((slotInfo, index) => {
      const y = startY + index * (slotH + 14);
      const hasData = hasSaveData(slotInfo.slot);
      const title = `${slotInfo.slot}. ${slotInfo.name}`;
      const detail = hasData
        ? `${slotInfo.teamSize} Pokémon  •  ${slotInfo.badges} badges  •  ${new Date(slotInfo.timestamp).toLocaleDateString()}`
        : "Empty slot";

      const bg = this.add.graphics().setScrollFactor(0).setDepth(10);
      bg.fillStyle(hasData ? 0x1e293b : 0x172033, 0.96);
      bg.fillRoundedRect(W / 2 - slotW / 2, y, slotW, slotH, 12);
      bg.lineStyle(2, hasData ? 0x22d3ee : 0x64748b, 1);
      bg.strokeRoundedRect(W / 2 - slotW / 2, y, slotW, slotH, 12);

      this.add.text(W / 2 - slotW / 2 + 18, y + 16, title, {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#f8fafc",
        fontStyle: "bold"
      }).setScrollFactor(0).setDepth(11);

      this.add.text(W / 2 - slotW / 2 + 18, y + 48, detail, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#cbd5e1"
      }).setScrollFactor(0).setDepth(11);

      const primaryLabel = hasData ? "Continue" : "New Game";
      this.makeButton(W / 2 + slotW / 2 - 72, y + 9, 126, 26, hasData ? 0x22d3ee : 0xfbbf24, primaryLabel, "#0f172a", () => {
        if (hasData) {
          setActiveSaveSlot(slotInfo.slot);
          loadGame(slotInfo.slot);
          this.scene.start("Boot");
        } else {
          this.startNewGame(slotInfo.slot);
        }
      });

      this.makeButton(W / 2 + slotW / 2 - 72, y + 39, 126, 24, 0x334155, hasData ? "Rename" : "Name Slot", "#e5e7eb", () => {
        if (hasData) {
          const name = this.promptSlotName(slotInfo.slot, slotInfo.name);
          if (name && renameSaveSlot(slotInfo.slot, name)) this.scene.restart();
        } else {
          this.startNewGame(slotInfo.slot);
        }
      });

      if (hasData) {
        this.makeButton(W / 2 + slotW / 2 - 72, y + 67, 126, 22, 0xef4444, "New Game", "#ffffff", () => {
          this.confirmNewGame(slotInfo.slot);
        });
      }
    });
  }

  private promptSlotName(slot: number, currentName?: string): string | null {
    const name = window.prompt("Name this save slot:", currentName || `Save Slot ${slot}`);
    if (name === null) return null;
    return name.trim().replace(/\s+/g, " ").slice(0, 24) || `Save Slot ${slot}`;
  }

  private startNewGame(slot: number): void {
    const name = this.promptSlotName(slot);
    if (!name) return;
    deleteSave(slot);
    Object.assign(gameState, createInitialState());
    saveGame(slot, name);
    this.scene.start("Boot");
  }

  /** Modal asking the player to confirm overwriting an existing save. */
  private confirmNewGame(slot: number): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const depth = 50;

    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.7)
      .setOrigin(0).setScrollFactor(0).setDepth(depth).setInteractive();

    const panelW = Math.min(420, W * 0.85);
    const panelH = 240;
    const panel = this.add.graphics().setScrollFactor(0).setDepth(depth + 1);
    panel.fillStyle(0x1a1a2e, 0.98);
    panel.fillRoundedRect(W / 2 - panelW / 2, H / 2 - panelH / 2, panelW, panelH, 14);
    panel.lineStyle(3, 0xef4444, 1);
    panel.strokeRoundedRect(W / 2 - panelW / 2, H / 2 - panelH / 2, panelW, panelH, 14);

    const text = this.add.text(W / 2, H / 2 - 60,
      "Start a New Game?\n\nThis will erase only\nthis save slot.", {
        fontFamily: "monospace", fontSize: "18px", color: "#e5e7eb",
        align: "center", lineSpacing: 4
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);

    const els: Phaser.GameObjects.GameObject[] = [overlay, panel, text];
    const dismiss = () => els.forEach((e) => e.destroy());

    this.makeButton(W / 2 - 95, H / 2 + 40, 170, 48, 0xef4444, "Erase & Start", "#ffffff", () => {
      dismiss();
      this.startNewGame(slot);
    }, depth + 2, els);
    this.makeButton(W / 2 + 95, H / 2 + 40, 170, 48, 0x334155, "Cancel", "#e5e7eb", dismiss, depth + 2, els);
  }

  private makeButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    fillColor: number,
    label: string,
    textColor: string,
    onDown: () => void,
    depthBase = 12,
    collect?: Phaser.GameObjects.GameObject[]
  ): void {
    const x = cx - w / 2;
    const y = cy;

    const bg = this.add.graphics().setScrollFactor(0).setDepth(depthBase);
    bg.fillStyle(fillColor, 1);
    bg.fillRoundedRect(x, y, w, h, 8);

    const txt = this.add.text(cx, cy + h / 2, label, {
      fontFamily: "monospace",
      fontSize: h < 36 ? "13px" : "20px",
      color: textColor,
      fontStyle: "bold"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depthBase + 1);

    const hit = this.add.rectangle(cx, cy + h / 2, w, h, 0x000000, 0)
      .setScrollFactor(0).setDepth(depthBase + 2).setInteractive({ useHandCursor: true });

    collect?.push(bg, txt, hit);

    const hoverColor = Phaser.Display.Color.ValueToColor(fillColor);
    hoverColor.darken(15);
    const hoverFill = hoverColor.color;

    hit.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(hoverFill, 1);
      bg.fillRoundedRect(x, y, w, h, 8);
    });
    hit.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(fillColor, 1);
      bg.fillRoundedRect(x, y, w, h, 8);
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
