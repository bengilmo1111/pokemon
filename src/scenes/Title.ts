import { rng } from "../game/rng";
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

    // Vertical gradient backdrop (deep navy → near-black) for depth.
    const bg = this.add.graphics().setScrollFactor(0).setDepth(0);
    bg.fillGradientStyle(0x142544, 0x142544, 0x070d18, 0x070d18, 1);
    bg.fillRect(0, 0, W, H);

    // Drifting type-coloured orbs, soft and low-alpha so they read as ambience.
    for (let i = 0; i < 14; i++) {
      const radius = Phaser.Math.Between(10, 26);
      const color = TYPE_COLOURS[i % TYPE_COLOURS.length];
      const x = Phaser.Math.Between(radius, W - radius);
      const y = Phaser.Math.Between(0, H);
      const vy = -(0.25 + rng() * 0.5);

      const graphic = this.add.arc(x, y, radius, 0, 360, false, color, 0.22);
      graphic.setScrollFactor(0).setDepth(1);

      this.driftCircles.push({ x, y, vy, radius, color, graphic });
    }

    // ---- Header ----------------------------------------------------------
    const titleLabel = "Pokémon Adventure";
    // Size to fit the viewport width (monospace bold ≈ 0.62em per glyph).
    const titleFontSize = Math.min(52, Math.floor((W - 28) / (titleLabel.length * 0.62)));
    const titleY = Math.max(76, Math.floor(H * 0.12));
    const titleText = this.add.text(W / 2, titleY, titleLabel, {
      fontFamily: "monospace",
      fontSize: `${titleFontSize}px`,
      color: "#fbbf24",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 5,
      shadow: { offsetX: 2, offsetY: 3, color: "#000000", blur: 6, fill: true }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);
    // Safety: never let the stroke/shadow push it past the edges.
    if (titleText.displayWidth > W - 16) titleText.setScale((W - 16) / titleText.displayWidth);

    // Bob tween: ±4px, ~2s period.
    this.tweens.add({
      targets: titleText,
      y: titleY + 4,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    // A small row of type-coloured dots under the title for flavour.
    const dotColours = [0xf97316, 0x3b82f6, 0x22c55e, 0xfbbf24, 0x9333ea];
    const dotGap = 22;
    const dotStartX = W / 2 - (dotColours.length - 1) * dotGap / 2;
    dotColours.forEach((c, i) => {
      this.add.circle(dotStartX + i * dotGap, titleY + titleFontSize * 0.7, 5, c)
        .setScrollFactor(0).setDepth(10);
    });

    this.add.text(W / 2, titleY + titleFontSize * 0.7 + 26, "Choose a save slot to begin", {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#94a3b8"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    // Footer hint.
    this.add.text(W / 2, H - 22, "Tap a card to play  •  Mobile-first", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#475569"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    // Remember where the slot list should start (just below the header).
    this.listTop = titleY + titleFontSize * 0.7 + 52;

    // Wait one resize tick so RESIZE mode has settled to the true viewport size
    // before placing interactive buttons (first paint can be off by a frame).
    this.scale.once("resize", () => this.drawSaveSlots());
    // Also draw immediately in case no resize fires (canvas already correct size).
    this.drawSaveSlots();
  }

  private listTop = 0;

  private drawSaveSlots(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const slots = getSaveSlots();

    const pad = 16;
    const slotW = Math.min(460, W - 28);
    const gap = 16;
    // Size cards to fill the space below the header without overflowing short
    // screens, clamped to a comfortable range.
    const available = H - this.listTop - 30;
    const slotH = Math.max(96, Math.min(132, Math.floor((available - gap * (slots.length - 1)) / slots.length)));
    const totalH = slots.length * slotH + (slots.length - 1) * gap;
    const startY = Math.max(this.listTop, this.listTop + (available - totalH) / 2);
    const cardX = W / 2 - slotW / 2;

    slots.forEach((slotInfo, index) => {
      const y = startY + index * (slotH + gap);
      const hasData = hasSaveData(slotInfo.slot);
      const accent = hasData ? 0x22d3ee : 0x64748b;

      // Card body.
      const bg = this.add.graphics().setScrollFactor(0).setDepth(10);
      bg.fillStyle(hasData ? 0x1c2942 : 0x141d30, 0.97);
      bg.fillRoundedRect(cardX, y, slotW, slotH, 14);
      bg.lineStyle(2, hasData ? 0x2b4a63 : 0x33415a, 1);
      bg.strokeRoundedRect(cardX, y, slotW, slotH, 14);
      // Left accent stripe.
      bg.fillStyle(accent, 1);
      bg.fillRoundedRect(cardX, y + 10, 5, slotH - 20, 3);

      const title = `${slotInfo.slot}. ${slotInfo.name}`;
      this.add.text(cardX + pad + 8, y + 14, title, {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#f8fafc",
        fontStyle: "bold"
      }).setScrollFactor(0).setDepth(11);

      const detail = hasData
        ? `${slotInfo.teamSize} Pokémon  •  ${slotInfo.badges} badges  •  ${new Date(slotInfo.timestamp).toLocaleDateString()}`
        : "Empty slot — tap New Game to begin";
      this.add.text(cardX + pad + 8, y + 44, detail, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: hasData ? "#cbd5e1" : "#7c8aa3"
      }).setScrollFactor(0).setDepth(11);

      // ---- Button row (touch-friendly, no overlap) ----------------------
      const rowH = 40;
      const rowY = y + slotH - rowH - 12;
      const rowW = slotW - pad * 2;
      const rowX = cardX + pad;

      if (hasData) {
        const btnGap = 8;
        const usable = rowW - btnGap * 2;
        const wContinue = Math.round(usable * 0.46);
        const wSmall = Math.round((usable - wContinue) / 2);

        const xContinue = rowX + wContinue / 2;
        const xRename = rowX + wContinue + btnGap + wSmall / 2;
        const xNew = rowX + wContinue + btnGap + wSmall + btnGap + wSmall / 2;

        this.makeButton(xContinue, rowY, wContinue, rowH, 0x22d3ee, "▶ Continue", "#06283c", () => {
          setActiveSaveSlot(slotInfo.slot);
          loadGame(slotInfo.slot);
          this.scene.start("Boot");
        });
        this.makeButton(xRename, rowY, wSmall, rowH, 0x334155, "Rename", "#e5e7eb", () => {
          this.showNameModal({
            title: "Rename this save",
            initial: slotInfo.name,
            confirmLabel: "Save",
            onConfirm: (name) => { if (renameSaveSlot(slotInfo.slot, name)) this.scene.restart(); }
          });
        });
        this.makeButton(xNew, rowY, wSmall, rowH, 0xef4444, "New Game", "#ffffff", () => {
          this.confirmNewGame(slotInfo.slot);
        });
      } else {
        // Single, full-width primary action — impossible to mis-tap.
        this.makeButton(cardX + slotW / 2, rowY, rowW, rowH, 0xfbbf24, "＋ New Game", "#3b2f06", () => {
          this.startNewGame(slotInfo.slot);
        });
      }
    });
  }

  /**
   * On-screen name entry, replacing window.prompt — that browser dialog is
   * clunky and breaks immersion on a kid's tablet (the primary device). Uses a
   * real HTML <input> overlaid on the canvas so the soft keyboard opens on
   * touch, the same proven pattern as the catch/starter naming screens.
   */
  private showNameModal(opts: { title: string; initial: string; confirmLabel: string; onConfirm: (name: string) => void }): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const depth = 60;

    const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.7)
      .setOrigin(0).setScrollFactor(0).setDepth(depth).setInteractive();

    const panelW = Math.min(420, W * 0.85);
    const panelH = 232;
    const panel = this.add.graphics().setScrollFactor(0).setDepth(depth + 1);
    panel.fillStyle(0x1a1a2e, 0.98);
    panel.fillRoundedRect(W / 2 - panelW / 2, H / 2 - panelH / 2, panelW, panelH, 14);
    panel.lineStyle(3, 0xfbbf24, 1);
    panel.strokeRoundedRect(W / 2 - panelW / 2, H / 2 - panelH / 2, panelW, panelH, 14);

    const title = this.add.text(W / 2, H / 2 - 82, opts.title, {
      fontFamily: "monospace", fontSize: "20px", color: "#fbbf24", fontStyle: "bold"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);

    const hint = this.add.text(W / 2, H / 2 - 46, "Tap the box to type a name", {
      fontFamily: "monospace", fontSize: "12px", color: "#94a3b8"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 24;
    input.value = opts.initial;
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "off");
    Object.assign(input.style, {
      position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
      width: "240px", height: "42px", fontFamily: "monospace", fontSize: "20px",
      textAlign: "center", background: "#374151", color: "#f8fafc",
      border: "2px solid #fbbf24", borderRadius: "6px", outline: "none", zIndex: "1000"
    } as Partial<CSSStyleDeclaration>);
    input.addEventListener("input", () => {
      const cleaned = input.value.replace(/[^a-zA-Z0-9 \-'!?.]/g, "").slice(0, 24);
      if (cleaned !== input.value) input.value = cleaned;
    });
    document.body.appendChild(input);
    this.time.delayedCall(60, () => input.focus());

    const els: Phaser.GameObjects.GameObject[] = [overlay, panel, title, hint];
    const cleanup = () => {
      els.forEach((e) => e.destroy());
      if (document.body.contains(input)) document.body.removeChild(input);
    };

    const confirm = () => {
      const name = input.value.trim().replace(/\s+/g, " ").slice(0, 24) || opts.initial;
      cleanup();
      opts.onConfirm(name);
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); confirm(); }
      else if (e.key === "Escape") { e.preventDefault(); cleanup(); }
    });

    this.makeButton(W / 2 - 88, H / 2 + 60, 160, 46, 0x22c55e, opts.confirmLabel, "#06283c", confirm, depth + 2, els);
    this.makeButton(W / 2 + 88, H / 2 + 60, 160, 46, 0x334155, "Cancel", "#e5e7eb", cleanup, depth + 2, els);
  }

  private startNewGame(slot: number): void {
    this.showNameModal({
      title: "Name your adventure",
      initial: `Save Slot ${slot}`,
      confirmLabel: "Start!",
      onConfirm: (name) => {
        deleteSave(slot);
        Object.assign(gameState, createInitialState());
        saveGame(slot, name);
        this.scene.start("Boot");
      }
    });
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
    const radius = Math.min(10, h / 2);

    const bg = this.add.graphics().setScrollFactor(0).setDepth(depthBase);
    bg.fillStyle(fillColor, 1);
    bg.fillRoundedRect(x, y, w, h, radius);

    // Font scales with button height and is capped to the width so labels in
    // the narrow secondary buttons don't bleed past the edges on small screens.
    const byHeight = h < 30 ? 12 : h < 44 ? 15 : 19;
    const byWidth = Math.floor((w - 12) / Math.max(1, label.length) * 1.7);
    const fontPx = Math.max(11, Math.min(byHeight, byWidth));

    const txt = this.add.text(cx, cy + h / 2, label, {
      fontFamily: "monospace",
      fontSize: `${fontPx}px`,
      color: textColor,
      fontStyle: "bold"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depthBase + 1);

    const hit = this.add.rectangle(cx, cy + h / 2, w, h, 0x000000, 0)
      .setScrollFactor(0).setDepth(depthBase + 2).setInteractive({ useHandCursor: true });

    collect?.push(bg, txt, hit);

    const hoverColor = Phaser.Display.Color.ValueToColor(fillColor);
    hoverColor.darken(15);
    const hoverFill = hoverColor.color;

    const paint = (fill: number) => {
      bg.clear();
      bg.fillStyle(fill, 1);
      bg.fillRoundedRect(x, y, w, h, radius);
    };

    hit.on("pointerover", () => paint(hoverFill));
    hit.on("pointerout", () => { paint(fillColor); txt.setScale(1); });
    // Brief press feedback, then fire (works for touch and mouse alike).
    hit.on("pointerdown", () => {
      paint(hoverFill);
      txt.setScale(0.96);
    });
    hit.on("pointerup", () => {
      txt.setScale(1);
      paint(fillColor);
      onDown();
    });
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
