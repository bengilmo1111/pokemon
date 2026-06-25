import { rng } from "../game/rng";
import { emitTestEvent } from "../game/testBridge";
import { TouchControls } from "../game/touch";
import Phaser from "phaser";
import { MOVES } from "../data/moves";
import { SPECIES } from "../data/species";
import { getAbility } from "../data/abilities";
import { gameState } from "../game/store";
import * as Sound from "../game/sound";
import {
  attemptCatch,
  calculateDamage,
  rollAccuracy,
  canAct,
  applyStatusDamage,
  getStatusDisplayText,
  getStatusColor,
  tryInflictStatus,
  StatStages,
  Weather
} from "../game/battle";
import {
  addToBox,
  addToTeam,
  getRegion,
  makePokemon,
  PokemonInstance,
  gainExp,
  calculateExpGain,
  markSeen,
  markCaught,
  LevelUpResult,
  StatusEffect,
  getMovePp,
  getMaxPp,
  usePp,
  hasUsableMove
} from "../game/state";
import { drawPanel, UI } from "../game/ui/theme";

interface BattleData {
  type: "wild" | "gym" | "trainer" | "rival" | "elite";
  wildId?: string;
  gymId?: string;
  trainerId?: string;
  trainerName?: string;
  trainerTeam?: { speciesId: string; level: number }[];
}

type StatStageKey = keyof StatStages;

const STAT_LABELS: Record<StatStageKey, string> = {
  atk: "Attack",
  def: "Defense",
  spd: "Speed",
  spAtk: "Sp. Atk",
  spDef: "Sp. Def"
};

// Per-type base hue for the battle backdrop (sky + ground are tinted from this).
const BATTLE_BG_BY_TYPE: Record<string, number> = {
  normal: 0x8a8a6e, fire: 0xb5532a, water: 0x2f5fa6, grass: 0x3f8a4a,
  electric: 0xb89a22, ice: 0x4f93a8, fighting: 0x8a4030, poison: 0x6a3a78,
  ground: 0x9a7a44, flying: 0x5a72a8, psychic: 0xa84a72, bug: 0x6a7a30,
  rock: 0x7a6a44, ghost: 0x453a66, dragon: 0x4a3aa0, dark: 0x3a3344,
  steel: 0x5a6a78, fairy: 0xa85f86
};

export default class Battle extends Phaser.Scene {
  private wildId!: string;
  private playerMon!: PokemonInstance;
  private enemyMon!: PokemonInstance;
  private enemyTeam: PokemonInstance[] = [];
  private enemyIndex = 0;
  private playerIndex = 0;
  private canCatch = true;
  private isTrainerBattle = false;
  private trainerName = "";
  private playerSprite?: Phaser.GameObjects.Sprite;
  private enemySprite?: Phaser.GameObjects.Sprite;
  private playerShadow?: Phaser.GameObjects.Ellipse;
  private enemyShadow?: Phaser.GameObjects.Ellipse;
  private messageText!: Phaser.GameObjects.Text;
  private messageBg?: Phaser.GameObjects.Graphics;
  private playerHpText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
  private playerHpBar?: Phaser.GameObjects.Graphics;
  private enemyHpBar?: Phaser.GameObjects.Graphics;
  private weather: Weather = "none";
  private weatherTurns = 0;
  private weatherOverlay?: Phaser.GameObjects.Rectangle;
  private playerExpText!: Phaser.GameObjects.Text;
  private playerStatusText!: Phaser.GameObjects.Text;
  private enemyStatusText!: Phaser.GameObjects.Text;
  private rootMenuItems: Phaser.GameObjects.Text[] = [];
  private moveMenuItems: Phaser.GameObjects.Text[] = [];
  private switchMenuItems: Phaser.GameObjects.Text[] = [];
  private ballMenuItems: Phaser.GameObjects.Text[] = [];
  private busy = false;
  private moveMenuOpen = false;
  private switchMenuOpen = false;
  private ballMenuOpen = false;
  private pendingLevelUps: { mon: PokemonInstance; result: LevelUpResult }[] = [];
  private namingOverlay?: Phaser.GameObjects.Rectangle;
  private namingElements: Phaser.GameObjects.GameObject[] = [];
  /** HTML input overlay for nicknaming — needed so the soft keyboard opens on touch. */
  private nameInput?: HTMLInputElement;
  private pendingCatchMon?: PokemonInstance;

  // Targeting mini-game state
  private targetingActive = false;
  private targetingBallType?: "pokeball" | "greatball" | "ultraball";
  private targetRing?: Phaser.GameObjects.Arc;
  private targetRingInner?: Phaser.GameObjects.Arc;
  private reticle?: Phaser.GameObjects.Container;
  private targetingElements: Phaser.GameObjects.GameObject[] = [];
  private reticleX = 0;
  private reticleY = 0;
  private ringAngle = 0;
  private ringRadius = 60;
  private cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private throwButton?: Phaser.GameObjects.Text;
  private targetingPointerHandler?: (pointer: Phaser.Input.Pointer) => void;

  // Move tooltip
  private tooltipBg?: Phaser.GameObjects.Rectangle;
  private tooltipText?: Phaser.GameObjects.Text;

  // Held item state (per battle)
  private usedOranBerry = false;

  // Stat stages (per battle, reset on switch)
  private playerStages: StatStages = { atk: 0, def: 0, spd: 0, spAtk: 0, spDef: 0 };
  private enemyStages: StatStages = { atk: 0, def: 0, spd: 0, spAtk: 0, spDef: 0 };

  // XP bar graphics
  private xpBarBg?: Phaser.GameObjects.Rectangle;
  private xpBarFill?: Phaser.GameObjects.Rectangle;
  private xpBarX = 0;
  private xpBarY = 0;
  private xpBarW = 0;

  constructor() {
    super("Battle");
  }

  init(): void {
    // Reset all state when scene initializes
    this.busy = false;
    this.moveMenuOpen = false;
    this.switchMenuOpen = false;
    this.ballMenuOpen = false;
    this.rootMenuItems = [];
    this.moveMenuItems = [];
    this.switchMenuItems = [];
    this.ballMenuItems = [];
    this.namingElements = [];
    this.pendingLevelUps = [];
    this.pendingCatchMon = undefined;
    // Reset targeting state
    this.targetingActive = false;
    this.targetingBallType = undefined;
    this.targetingElements = [];
    // Reset tooltip
    this.tooltipBg = undefined;
    this.tooltipText = undefined;
    // Reset weather
    this.weather = "none";
    this.weatherTurns = 0;
    this.weatherOverlay = undefined;
    // Reset held item state
    this.usedOranBerry = false;
    // Reset stat stages
    this.playerStages = { atk: 0, def: 0, spd: 0, spAtk: 0, spDef: 0 };
    this.enemyStages = { atk: 0, def: 0, spd: 0, spAtk: 0, spDef: 0 };
    // Reset XP bar refs
    this.xpBarBg = undefined;
    this.xpBarFill = undefined;
  }

  create(data: BattleData): void {
    // Ensure input is enabled for this scene
    this.input.enabled = true;
    // Never leak the nickname input overlay if the scene stops mid-naming.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeNameInput());

    this.canCatch = data.type === "wild";
    this.isTrainerBattle = data.type !== "wild";
    this.playerIndex = this.findNextAlive();
    this.playerMon = gameState.team[this.playerIndex];
    this.pendingLevelUps = [];

    if (!this.playerMon) {
      // Instant-escape: the whole team has fainted, so there is nobody to send
      // out. This is the root cause of the "encounter just auto-saves" loop —
      // the overworld should never let the player reach this state.
      emitTestEvent("battle:instant-escape", { type: data.type, reason: "no-alive-team" });
      this.endBattle("escape");
      return;
    }

    if (data.type === "wild") {
      this.wildId = data.wildId ?? "";
      const wild = gameState.wildMons.find((m) => m.id === data.wildId);
      if (!wild) {
        emitTestEvent("battle:instant-escape", { type: data.type, reason: "wild-missing" });
        this.endBattle("escape");
        return;
      }
      this.enemyTeam = [makePokemon(wild.speciesId, wild.level)];
      markSeen(gameState, wild.speciesId);
    } else if (data.type === "gym") {
      const region = getRegion(gameState);
      const gym = region.gyms.find((g) => g.id === data.gymId);
      if (!gym) {
        this.endBattle("escape");
        return;
      }
      this.wildId = gym.id;
      this.trainerName = `Leader ${gym.leader}`;
      this.enemyTeam = gym.team.map((entry) => {
        markSeen(gameState, entry.speciesId);
        return makePokemon(entry.speciesId, entry.level);
      });
    } else if (data.type === "trainer" || data.type === "rival" || data.type === "elite") {
      this.wildId = data.trainerId ?? "";
      this.trainerName = data.trainerName ?? "Trainer";
      this.enemyTeam = (data.trainerTeam ?? []).map((entry) => {
        markSeen(gameState, entry.speciesId);
        return makePokemon(entry.speciesId, entry.level);
      });
    }

    this.enemyIndex = 0;
    this.enemyMon = this.enemyTeam[this.enemyIndex];

    // The battle is now genuinely running (all guards passed, combatants set).
    emitTestEvent("battle:active", {
      type: data.type,
      enemySpeciesId: this.enemyMon?.speciesId,
      playerSpeciesId: this.playerMon.speciesId
    });

    // Atmospheric, type-themed battle background + layered platforms.
    this.createBattleBackground();

    const playerTexture = this.textures.exists(`pokemon-${this.playerMon.speciesId}`)
      ? `pokemon-${this.playerMon.speciesId}`
      : "wild-fallback";
    const enemyTexture = this.textures.exists(`pokemon-${this.enemyMon.speciesId}`)
      ? `pokemon-${this.enemyMon.speciesId}`
      : "wild-fallback";

    // Soft contact shadows that ground each Pokémon on its platform.
    this.playerShadow = this.add.ellipse(this.scale.width * 0.25, this.scale.height * 0.52, 116, 30, 0x000000, 0.32)
      .setDepth(9);
    this.enemyShadow = this.add.ellipse(this.scale.width * 0.7, this.scale.height * 0.38, 96, 26, 0x000000, 0.32)
      .setDepth(9);

    // Create sprites off-screen for entrance animation
    this.playerSprite = this.add.sprite(-100, this.scale.height * 0.45, playerTexture);
    this.enemySprite = this.add.sprite(this.scale.width + 100, this.scale.height * 0.3, enemyTexture);
    this.applyDisplayHeight(this.playerSprite, 140);
    this.applyDisplayHeight(this.enemySprite, 160);
    this.playerSprite.setDepth(10);
    this.enemySprite.setDepth(10);

    // Entrance animations - slide in from sides
    this.tweens.add({
      targets: this.playerSprite,
      x: this.scale.width * 0.25,
      duration: 600,
      ease: "Back.easeOut"
    });
    this.tweens.add({
      targets: this.enemySprite,
      x: this.scale.width * 0.7,
      duration: 600,
      ease: "Back.easeOut"
    });

    // Add idle bobbing animations
    this.tweens.add({
      targets: this.playerSprite,
      y: this.scale.height * 0.45 - 8,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.tweens.add({
      targets: this.enemySprite,
      y: this.scale.height * 0.3 - 6,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: 300  // Offset so they don't bob in sync
    });

    const introText = data.type === "wild"
      ? `A wild ${this.enemyMon.name} appeared!`
      : `${this.trainerName} wants to battle!`;
    // Message bar — full-width, anchored just above the battle buttons, high depth
    // so it always renders over enemy stats (which sit at depth 0).
    const msgY = this.scale.height - 205;
    this.messageBg = this.add.graphics().setDepth(149).setScrollFactor(0);
    drawPanel(this.messageBg, 8, msgY - 28, this.scale.width - 16, 56, { radius: 12 });
    this.messageText = this.add.text(this.scale.width / 2, msgY, introText, {
      fontFamily: "monospace",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#fde68a",
      wordWrap: { width: this.scale.width - 32 },
      align: "center"
    }).setOrigin(0.5).setDepth(150).setScrollFactor(0);

    // Play encounter sound and start battle music
    Sound.playEncounter();
    this.time.delayedCall(500, () => Sound.playBattleMusic());

    // Player & enemy info boxes — shared themed panels.
    const infoPanels = this.add.graphics();
    drawPanel(infoPanels, this.scale.width - 220, this.scale.height * 0.6, 200, 90, { radius: 12, shadow: false });
    this.playerHpText = this.add.text(this.scale.width - 210, this.scale.height * 0.61, "", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#93c5fd"
    });
    this.playerExpText = this.add.text(this.scale.width - 210, this.scale.height * 0.66, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#a78bfa"
    });
    this.playerStatusText = this.add.text(this.scale.width - 210, this.scale.height * 0.70, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#fbbf24"
    });

    // XP bar (below player info)
    this.xpBarX = this.scale.width - 210;
    this.xpBarY = this.scale.height * 0.70;
    this.xpBarW = 180;
    this.xpBarBg = this.add.rectangle(this.xpBarX, this.xpBarY, this.xpBarW, 6, UI.borderSoft).setOrigin(0);
    this.xpBarFill = this.add.rectangle(this.xpBarX, this.xpBarY, 0, 6, 0x8b5cf6).setOrigin(0);

    // Enemy Pokemon info box
    drawPanel(infoPanels, 20, this.scale.height * 0.08, 200, 70, { radius: 12, shadow: false });
    this.enemyHpText = this.add.text(30, this.scale.height * 0.09, "", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#fca5a5"
    });
    this.enemyStatusText = this.add.text(30, this.scale.height * 0.14, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#fbbf24"
    });

    // Graphical HP bars floating above each combatant.
    this.playerHpBar = this.add.graphics().setDepth(40);
    this.enemyHpBar = this.add.graphics().setDepth(40);

    this.updateHpText();
    this.createMenu();

    // Setup cursor keys for targeting mini-game
    this.cursorKeys = this.input.keyboard?.createCursorKeys();
  }

  update(_time: number, _delta: number): void {
    // Handle targeting mini-game
    if (this.targetingActive && this.reticle && this.cursorKeys) {
      const speed = 4;

      // Move reticle with arrow keys
      if (this.cursorKeys.left?.isDown) {
        this.reticleX -= speed;
      }
      if (this.cursorKeys.right?.isDown) {
        this.reticleX += speed;
      }
      if (this.cursorKeys.up?.isDown) {
        this.reticleY -= speed;
      }
      if (this.cursorKeys.down?.isDown) {
        this.reticleY += speed;
      }

      // Clamp reticle to screen bounds around enemy
      const enemyX = this.enemySprite?.x ?? this.scale.width * 0.7;
      const enemyY = this.enemySprite?.y ?? this.scale.height * 0.3;
      const bounds = 120;
      this.reticleX = Phaser.Math.Clamp(this.reticleX, enemyX - bounds, enemyX + bounds);
      this.reticleY = Phaser.Math.Clamp(this.reticleY, enemyY - bounds, enemyY + bounds);

      // Update reticle position
      this.reticle.setPosition(this.reticleX, this.reticleY);

      // Animate target ring - moves in a circle around the enemy
      this.ringAngle += 0.03;
      if (this.targetRing && this.targetRingInner) {
        const ringX = enemyX + Math.cos(this.ringAngle) * this.ringRadius;
        const ringY = enemyY + Math.sin(this.ringAngle) * this.ringRadius;
        this.targetRing.setPosition(ringX, ringY);
        this.targetRingInner.setPosition(ringX, ringY);
      }
    }
  }

  private createMenu(): void {
    // Large 2x2 grid of touch-friendly buttons across the bottom of the screen.
    const items = [
      { label: "Fight", color: "#b91c1c", action: () => this.openMoveMenu() },
      { label: "Bag", color: "#a16207", action: () => this.openBallMenu() },
      { label: "Pokémon", color: "#15803d", action: () => this.openSwitchMenu() },
      { label: "Run", color: "#334155", action: () => this.handleRun() }
    ];

    const colX = [this.scale.width * 0.28, this.scale.width * 0.72];
    const rowY = [this.scale.height - 132, this.scale.height - 48];
    const btnWidth = this.scale.width * 0.42;

    items.forEach((item, index) => {
      const x = colX[index % 2];
      const y = rowY[Math.floor(index / 2)];
      const text = this.add.text(x, y, item.label, {
        fontFamily: "monospace",
        fontSize: "30px",
        color: "#f9fafb",
        backgroundColor: item.color,
        align: "center",
        fixedWidth: btnWidth,
        fontStyle: "bold",
        padding: { top: 16, bottom: 16 }
      });
      text.setOrigin(0.5).setDepth(100);
      text.setInteractive({ useHandCursor: true });
      text.on("pointerdown", () => {
        Sound.playMenuSelect();
        item.action();
      });
      this.rootMenuItems.push(text);
    });
  }

  /**
   * The message bar sits just above the action buttons; the move/bag/switch
   * submenus extend up into that band, so the bar is hidden while a submenu is
   * open (no message is relevant during selection) and restored on Back.
   */
  private setBattleMessageVisible(visible: boolean): void {
    this.messageBg?.setVisible(visible);
    this.messageText?.setVisible(visible);
  }

  /**
   * Full-screen dim behind a submenu so its rows read as a modal instead of
   * floating text over the sprites. Sits below the menu items (depth 100) but
   * above the battle scene. Pushed into the menu's item pool so it's destroyed
   * with the rest of the submenu.
   */
  private addSubmenuBackdrop(pool: Phaser.GameObjects.GameObject[]): void {
    const backdrop = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x0b1220, 0.72)
      .setDepth(95)
      .setScrollFactor(0)
      .setInteractive(); // swallow taps that miss a row (no accidental world hits)
    pool.push(backdrop);
  }

  private openMoveMenu(): void {
    if (this.busy || this.moveMenuOpen || this.switchMenuOpen || this.ballMenuOpen) return;
    this.moveMenuOpen = true;
    this.setBattleMessageVisible(false);
    this.addSubmenuBackdrop(this.moveMenuItems);
    this.rootMenuItems.forEach((item) => item.setVisible(false));

    const moveIds = this.playerMon.moves;
    // Slightly narrower buttons so two columns never overlap at 375 px
    const btnWidth = Math.floor(this.scale.width * 0.44);
    const gap = (this.scale.width - btnWidth * 2) / 3;
    const colX = [gap + btnWidth / 2, gap * 2 + btnWidth * 1.5];
    const rowY = [this.scale.height - 220, this.scale.height - 140];

    // Type-colour map — used as button background to communicate move type at a glance
    const TYPE_COLORS: Record<string, string> = {
      fire: "#b91c1c", water: "#1d4ed8", grass: "#15803d", electric: "#a16207",
      psychic: "#be185d", ice: "#0e7490", dragon: "#4338ca", dark: "#374151",
      normal: "#4b5563", fighting: "#92400e", poison: "#6d28d9", ground: "#854d0e",
      flying: "#0369a1", bug: "#3f6212", rock: "#57534e", ghost: "#4c1d95",
      steel: "#374151", fairy: "#9d174d"
    };

    // Create shared tooltip objects (hidden initially)
    if (!this.tooltipBg) {
      this.tooltipBg = this.add.rectangle(0, 0, 200, 80, 0x1e293b, 0.95)
        .setStrokeStyle(2, 0xfbbf24)
        .setScrollFactor(0)
        .setDepth(850)
        .setVisible(false);
    }
    if (!this.tooltipText) {
      this.tooltipText = this.add.text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f8fafc",
        align: "center"
      })
        .setScrollFactor(0)
        .setDepth(851)
        .setOrigin(0.5)
        .setVisible(false);
    }

    moveIds.forEach((moveId, index) => {
      const move = MOVES[moveId];
      const pp = getMovePp(this.playerMon, moveId);
      const maxPp = getMaxPp(moveId);
      const disabled = pp <= 0;
      const typeBg = move ? (TYPE_COLORS[move.type] ?? "#374151") : "#374151";
      const label = move
        ? `${move.name}\n${move.type.toUpperCase()} PP ${pp}/${maxPp}`
        : moveId;
      const x = colX[index % 2];
      const y = rowY[Math.floor(index / 2)];
      const text = this.add.text(x, y, label, {
        fontFamily: "monospace",
        fontSize: "18px",
        fontStyle: "bold",
        color: disabled ? "#9ca3af" : "#f9fafb",
        backgroundColor: disabled ? "#1f2937" : typeBg,
        align: "center",
        fixedWidth: btnWidth,
        padding: { top: 14, bottom: 14 }
      });
      text.setOrigin(0.5).setDepth(100).setAlpha(disabled ? 0.55 : 1);
      text.setInteractive({ useHandCursor: !disabled });
      if (!disabled) text.on("pointerdown", () => this.handleFight(moveId));

      // Tooltip on hover
      text.on("pointerover", () => {
        if (!move || !this.tooltipBg || !this.tooltipText) return;
        const typeHex = TYPE_COLORS[move.type] ?? "#a8a878";
        const catIcon = move.category === "physical" ? "⚔️ Physical" :
                        move.category === "special" ? "✨ Special" : "💤 Status";
        const pwrStr = move.power > 0 ? `Power: ${move.power}` : "Power: —";
        const accStr = move.accuracy < 1 ? `Acc: ${Math.round(move.accuracy * 100)}%` : "Acc: 100%";
        const tooltipContent = `[${move.type.toUpperCase()}]\n${pwrStr} | ${accStr}\n${catIcon}`;
        this.tooltipText.setText(tooltipContent);
        this.tooltipText.setColor(typeHex);

        // Position tooltip above the button, clamped to stay on-screen.
        const tw = 220;
        const th = 72;
        const tx = Phaser.Math.Clamp(x, tw / 2 + 8, this.scale.width - tw / 2 - 8);
        let ty = y - 60;
        if (ty - th / 2 < 8) ty = y + 60; // flip below if it would clip the top
        ty = Phaser.Math.Clamp(ty, th / 2 + 8, this.scale.height - th / 2 - 8);
        this.tooltipBg.setPosition(tx, ty).setSize(tw, th).setVisible(true);
        this.tooltipText.setPosition(tx, ty).setVisible(true);
      });
      text.on("pointerout", () => {
        this.tooltipBg?.setVisible(false);
        this.tooltipText?.setVisible(false);
      });

      this.moveMenuItems.push(text);
    });

    // If every move is out of PP, offer Struggle.
    if (!hasUsableMove(this.playerMon)) {
      const struggle = this.add.text(this.scale.width * 0.5, this.scale.height - 168, "STRUGGLE", {
        fontFamily: "monospace", fontSize: "20px", color: "#fca5a5",
        backgroundColor: "#7f1d1d", align: "center",
        fixedWidth: this.scale.width * 0.6, padding: { top: 10, bottom: 10 }
      }).setOrigin(0.5).setDepth(100).setInteractive({ useHandCursor: true });
      struggle.on("pointerdown", () => this.handleFight("struggle"));
      this.moveMenuItems.push(struggle);
    }

    const backText = this.add.text(this.scale.width * 0.5, this.scale.height - 56, "◀ Back", {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#f9fafb",
      backgroundColor: "#1f2937",
      align: "center",
      fixedWidth: this.scale.width * 0.5,
      fontStyle: "bold",
      padding: { top: 10, bottom: 10 }
    });
    backText.setOrigin(0.5).setDepth(100);
    backText.setInteractive({ useHandCursor: true });
    backText.on("pointerdown", () => this.closeMoveMenu());
    this.moveMenuItems.push(backText);
  }

  private closeMoveMenu(): void {
    this.moveMenuOpen = false;
    this.moveMenuItems.forEach((item) => item.destroy());
    this.moveMenuItems = [];
    this.tooltipBg?.setVisible(false);
    this.tooltipText?.setVisible(false);
    this.setBattleMessageVisible(true);
    this.rootMenuItems.forEach((item) => item.setVisible(true));
  }

  private openBallMenu(): void {
    if (this.busy || this.ballMenuOpen || this.moveMenuOpen || this.switchMenuOpen) return;
    if (!this.canCatch) {
      this.setMessage("Can't use items in trainer battles!");
      return;
    }
    this.ballMenuOpen = true;
    this.setBattleMessageVisible(false);
    this.addSubmenuBackdrop(this.ballMenuItems);
    this.rootMenuItems.forEach((item) => item.setVisible(false));

    const btnWidth = this.scale.width * 0.6;
    const x = this.scale.width * 0.5;
    let y = this.scale.height - 250;
    const rowH = 52;
    const balls: Array<{ type: "pokeball" | "greatball" | "ultraball"; name: string }> = [
      { type: "pokeball", name: "Poke Ball" },
      { type: "greatball", name: "Great Ball" },
      { type: "ultraball", name: "Ultra Ball" }
    ];

    const makeItem = (label: string, enabled: boolean, onTap: () => void) => {
      const text = this.add.text(x, y, label, {
        fontFamily: "monospace",
        fontSize: "22px",
        color: enabled ? "#f9fafb" : "#6b7280",
        backgroundColor: enabled ? "#374151" : "#1f2937",
        align: "center",
        fixedWidth: btnWidth,
        padding: { top: 9, bottom: 9 }
      });
      text.setOrigin(0.5).setDepth(100).setAlpha(enabled ? 1 : 0.6);
      text.setInteractive({ useHandCursor: enabled });
      if (enabled) text.on("pointerdown", onTap);
      this.ballMenuItems.push(text);
      y += rowH;
    };

    balls.forEach((ball) => {
      const count = gameState.inventory[ball.type];
      makeItem(`${ball.name} x${count}`, count > 0, () => this.handleCatch(ball.type));
    });

    const potionCount = gameState.inventory.potion;
    makeItem(`Potion x${potionCount}`, potionCount > 0, () => this.handleUsePotion());

    const backText = this.add.text(x, y + 6, "◀ Back", {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#f9fafb",
      backgroundColor: "#1f2937",
      align: "center",
      fixedWidth: btnWidth,
      fontStyle: "bold",
      padding: { top: 9, bottom: 9 }
    });
    backText.setOrigin(0.5).setDepth(100);
    backText.setInteractive({ useHandCursor: true });
    backText.on("pointerdown", () => this.closeBallMenu());
    this.ballMenuItems.push(backText);
  }

  private closeBallMenu(): void {
    this.ballMenuOpen = false;
    this.ballMenuItems.forEach((item) => item.destroy());
    this.ballMenuItems = [];
    this.setBattleMessageVisible(true);
    this.rootMenuItems.forEach((item) => item.setVisible(true));
  }

  private async handleUsePotion(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.closeBallMenu();

    if (gameState.inventory.potion <= 0) {
      this.setMessage("No Potions left!");
      this.busy = false;
      return;
    }

    if (this.playerMon.hp >= this.playerMon.maxHp) {
      this.setMessage(`${this.playerMon.name} is already at full HP!`);
      this.busy = false;
      return;
    }

    gameState.inventory.potion -= 1;
    const healAmount = Math.min(20, this.playerMon.maxHp - this.playerMon.hp);
    this.playerMon.hp += healAmount;
    this.updateHpText();
    this.setMessage(`Used Potion! ${this.playerMon.name} recovered ${healAmount} HP!`);
    await this.wait(600);

    // Enemy attacks after using item
    const enemyMove = this.pickEnemyMove();
    await this.executeEnemyTurn(enemyMove);
    if (await this.resolvePlayerFaint()) return;
    this.busy = false;
  }

  private openSwitchMenu(): void {
    if (this.busy || this.switchMenuOpen || this.moveMenuOpen || this.ballMenuOpen) return;
    this.switchMenuOpen = true;
    this.setBattleMessageVisible(false);
    this.addSubmenuBackdrop(this.switchMenuItems);
    this.rootMenuItems.forEach((item) => item.setVisible(false));

    const W = this.scale.width;
    const H = this.scale.height;
    const cardW = W * 0.88;
    const cardH = 56;
    const cardX = W / 2;
    const totalCards = gameState.team.length + 1; // +1 for Back
    const totalH = totalCards * (cardH + 8);
    let cardY = H / 2 - totalH / 2 + cardH / 2;

    gameState.team.forEach((mon, index) => {
      const isDisabled = index === this.playerIndex || mon.hp <= 0;
      const hpPct = mon.maxHp > 0 ? mon.hp / mon.maxHp : 0;
      const hpColor = hpPct > 0.5 ? "#22c55e" : hpPct > 0.2 ? "#eab308" : "#ef4444";
      const statusSuffix = mon.status !== "none" ? `  [${getStatusDisplayText(mon.status)}]` : "";
      const label = `${mon.nickname || mon.name}  Lv${mon.level}\nHP: ${mon.hp}/${mon.maxHp}${statusSuffix}`;
      const bgColor = isDisabled ? "#1f2937" : (index === this.playerIndex ? "#064e3b" : "#1e3a5f");

      const text = this.add.text(cardX, cardY, label, {
        fontFamily: "monospace",
        fontSize: "20px",
        fontStyle: "bold",
        color: isDisabled ? "#6b7280" : hpColor,
        backgroundColor: bgColor,
        align: "center",
        fixedWidth: cardW,
        padding: { top: 10, bottom: 10 }
      });
      // Keep cards fully opaque (the grey colour already signals "disabled");
      // a translucent card let the battle sprites bleed through and read as a mess.
      text.setOrigin(0.5).setDepth(100).setScrollFactor(0);
      text.setInteractive({ useHandCursor: !isDisabled });
      if (!isDisabled) {
        text.on("pointerdown", () => this.handleSwitch(index));
        text.on("pointerover", () => text.setStyle({ backgroundColor: "#2563eb" }));
        text.on("pointerout", () => text.setStyle({ backgroundColor: bgColor }));
      }
      this.switchMenuItems.push(text);
      cardY += cardH + 8;
    });

    const backText = this.add.text(cardX, cardY, "◀ Back", {
      fontFamily: "monospace",
      fontSize: "22px",
      fontStyle: "bold",
      color: "#f9fafb",
      backgroundColor: "#374151",
      align: "center",
      fixedWidth: cardW,
      padding: { top: 12, bottom: 12 }
    });
    backText.setOrigin(0.5).setDepth(100).setScrollFactor(0);
    backText.setInteractive({ useHandCursor: true });
    backText.on("pointerdown", () => this.closeSwitchMenu());
    backText.on("pointerover", () => backText.setStyle({ backgroundColor: "#4b5563" }));
    backText.on("pointerout",  () => backText.setStyle({ backgroundColor: "#374151" }));
    this.switchMenuItems.push(backText);
  }

  private closeSwitchMenu(): void {
    this.switchMenuOpen = false;
    this.switchMenuItems.forEach((item) => item.destroy());
    this.switchMenuItems = [];
    this.setBattleMessageVisible(true);
    this.rootMenuItems.forEach((item) => item.setVisible(true));
  }

  private async handleFight(moveId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.closeMoveMenu();

    // Check if player can act
    const playerCanAct = canAct(this.playerMon);
    if (!playerCanAct.canAct) {
      this.setMessage(playerCanAct.reason || `${this.playerMon.name} can't move!`);
      await this.wait(600);
    } else {
      await this.executeMove(this.playerMon, this.enemyMon, moveId);
    }

    // Apply status damage to player after their turn
    const playerStatusResult = applyStatusDamage(this.playerMon);
    if (playerStatusResult.message) {
      this.setMessage(playerStatusResult.message);
      this.updateHpText();
      await this.wait(500);
    }

    if (this.enemyMon.hp <= 0) {
      await this.handleEnemyFainted();
      return;
    }

    // Enemy turn
    const enemyMove = this.pickEnemyMove();
    await this.executeEnemyTurn(enemyMove);

    // End-of-turn weather (sandstorm chip + countdown)
    await this.applyEndOfTurnWeather();
    if (this.enemyMon.hp <= 0) { await this.handleEnemyFainted(); return; }

    if (await this.resolvePlayerFaint()) return;
    this.busy = false;
  }

  private async executeEnemyTurn(moveId: string): Promise<void> {
    // Check if enemy can act
    const enemyCanAct = canAct(this.enemyMon);
    if (!enemyCanAct.canAct) {
      this.setMessage(enemyCanAct.reason || `${this.enemyMon.name} can't move!`);
      await this.wait(600);
    } else {
      await this.executeMove(this.enemyMon, this.playerMon, moveId);
    }

    // Apply status damage to enemy after their turn
    const enemyStatusResult = applyStatusDamage(this.enemyMon);
    if (enemyStatusResult.message) {
      this.setMessage(enemyStatusResult.message);
      this.updateHpText();
      await this.wait(500);
      if (this.enemyMon.hp <= 0) {
        await this.handleEnemyFainted();
        return;
      }
    }
  }

  private animateXpBar(fromRatio: number, toRatio: number, onDone: () => void): void {
    if (!this.xpBarFill) { onDone(); return; }
    this.xpBarFill.setSize(this.xpBarW * fromRatio, 6);
    this.tweens.add({
      targets: this.xpBarFill,
      displayWidth: this.xpBarW * toRatio,
      duration: 600,
      ease: "Linear",
      onComplete: () => onDone()
    });
  }

  private async awardXpWithAnimation(expGain: number): Promise<void> {
    if (!this.xpBarFill) return;

    const mon = this.playerMon;
    const expBefore = mon.exp;
    const expToNext = mon.expToNext;
    const levelBefore = mon.level;

    const result = gainExp(mon, expGain);

    // Floating XP text
    if (this.playerSprite) {
      this.showFloatingText(`+${expGain} XP`, this.playerSprite.x, this.playerSprite.y - 80, "#a78bfa");
    }

    const playerDisplayName = mon.nickname || mon.name;

    if (result.levelsGained === 0) {
      // Simple fill animation
      const fromRatio = expToNext > 0 ? Math.min(1, expBefore / expToNext) : 0;
      const toRatio = expToNext > 0 ? Math.min(1, mon.exp / mon.expToNext) : 0;
      await new Promise<void>((resolve) => this.animateXpBar(fromRatio, toRatio, resolve));
    } else {
      // Level up: fill to 100% then flash, reset and animate remainder
      const fromRatio = expToNext > 0 ? Math.min(1, expBefore / expToNext) : 0;
      await new Promise<void>((resolve) => this.animateXpBar(fromRatio, 1, resolve));

      // Flash bar white
      if (this.xpBarFill) {
        await new Promise<void>((resolve) => {
          this.tweens.add({
            targets: this.xpBarFill,
            alpha: 0.3,
            duration: 200,
            yoyo: true,
            onComplete: () => resolve()
          });
        });
      }

      // Reset to 0 then fill to remainder
      const remainderRatio = mon.expToNext > 0 ? Math.min(1, mon.exp / mon.expToNext) : 0;
      if (this.xpBarFill) this.xpBarFill.setSize(0, 6);
      await new Promise<void>((resolve) => this.animateXpBar(0, remainderRatio, resolve));

      Sound.playLevelUp();
      this.setMessage(`${playerDisplayName} grew to level ${mon.level}!`);
      await this.showLevelUpAnimation();
      await this.wait(800);

      // Handle new moves
      for (const newMoveId of result.newMoves) {
        const moveName = MOVES[newMoveId]?.name ?? newMoveId;
        Sound.playMenuSelect();
        this.setMessage(`${playerDisplayName} learned ${moveName}!`);
        await this.wait(800);
      }

      // Handle moves learned at full capacity — let the player choose.
      for (const pendingId of result.pendingMoves) {
        await this.promptForgetMove(mon, pendingId);
      }

      // Handle evolution
      if (result.evolved && result.newName) {
        Sound.playEvolution();
        await this.showEvolutionAnimation(result.oldName!, result.newName);
        this.updatePlayerSprite();
        markSeen(gameState, mon.speciesId);
      }
    }

    void levelBefore; // suppress unused warning
    this.updateHpText();
  }

  /**
   * When a Pokémon at full moves (4) wants to learn another, prompt the player
   * to forget one move or skip learning. Resolves once a choice is made.
   */
  private promptForgetMove(mon: PokemonInstance, newMoveId: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const W = this.scale.width;
      const H = this.scale.height;
      const name = mon.nickname || mon.name;
      const newName = MOVES[newMoveId]?.name ?? newMoveId;
      const els: Phaser.GameObjects.GameObject[] = [];

      els.push(this.add.rectangle(0, 0, W, H, 0x000000, 0.72)
        .setOrigin(0).setScrollFactor(0).setDepth(900).setInteractive());
      els.push(this.add.text(W / 2, H * 0.24,
        `${name} wants to learn ${newName},\nbut already knows 4 moves.\nForget a move?`, {
          fontFamily: "monospace", fontSize: "18px", color: "#e5e7eb",
          align: "center", lineSpacing: 4, wordWrap: { width: W - 60 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(901));

      const cleanup = () => els.forEach((e) => e.destroy());
      const mkBtn = (y: number, label: string, bg: string, onClick: () => void) => {
        const btn = this.add.text(W / 2, y, label, {
          fontFamily: "monospace", fontSize: "16px", color: "#0f172a",
          backgroundColor: bg, align: "center",
          padding: { left: 12, right: 12, top: 8, bottom: 8 }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(901)
          .setInteractive({ useHandCursor: true });
        btn.on("pointerdown", onClick);
        els.push(btn);
      };

      mon.moves.forEach((mId, i) => {
        const m = MOVES[mId];
        mkBtn(H * 0.4 + i * 52, `${m?.name ?? mId}  (${m?.type ?? "?"})`, "#fbbf24", () => {
          const forgotten = m?.name ?? mId;
          mon.moves[i] = newMoveId;
          cleanup();
          Sound.playMenuSelect();
          this.setMessage(`${name} forgot ${forgotten} and learned ${newName}!`);
          this.time.delayedCall(1000, resolve);
        });
      });
      mkBtn(H * 0.4 + 4 * 52, `Don't learn ${newName}`, "#94a3b8", () => {
        cleanup();
        this.setMessage(`${name} did not learn ${newName}.`);
        this.time.delayedCall(800, resolve);
      });
    });
  }

  private async handleEnemyFainted(): Promise<void> {
    // Faint animation - fall down and fade
    await this.showFaintAnimation(this.enemySprite!);
    this.setMessage(`${this.enemyMon.name} fainted!`);
    await this.wait(500);

    // Award experience
    const baseExpGain = calculateExpGain(this.enemyMon.speciesId, this.enemyMon.level, this.isTrainerBattle);
    const hasLuckyEgg = this.playerMon.heldItem === "luckyegg";
    const expGain = hasLuckyEgg ? Math.floor(baseExpGain * 1.5) : baseExpGain;

    const luckyStr = hasLuckyEgg ? " (Lucky Egg!)" : "";
    const playerDisplayName = this.playerMon.nickname || this.playerMon.name;
    this.setMessage(`${playerDisplayName} gained ${expGain} EXP!${luckyStr}`);

    // Animated XP gain (calls gainExp internally)
    await this.awardXpWithAnimation(baseExpGain);

    // Check for next enemy
    if (this.enemyIndex < this.enemyTeam.length - 1) {
      this.enemyIndex += 1;
      this.enemyMon = this.enemyTeam[this.enemyIndex];
      // Reset enemy stat stages on switch
      this.enemyStages = { atk: 0, def: 0, spd: 0, spAtk: 0, spDef: 0 };
      this.setMessage(`${this.trainerName} sent out ${this.enemyMon.name}!`);
      this.updateEnemySprite();
      await this.showEntranceAnimation(this.enemySprite!, false);
      await this.wait(300);
      if (this.applyIntimidate(this.enemyMon, this.playerStages, this.playerMon.nickname || this.playerMon.name)) {
        await this.wait(600);
      }
      this.busy = false;
      return;
    }

    // Award prize money on final victory
    let prizeMoneyEarned = 0;
    if (this.isTrainerBattle) {
      const avgLevel = this.enemyTeam.reduce((sum, m) => sum + m.level, 0) / Math.max(1, this.enemyTeam.length);
      prizeMoneyEarned = Math.max(1, Math.floor(avgLevel * 20));
    } else {
      prizeMoneyEarned = Math.max(1, Math.floor(this.enemyMon.level * 5));
    }
    gameState.money = (gameState.money ?? 0) + prizeMoneyEarned;
    this.setMessage(`You won! Earned ₽${prizeMoneyEarned}`);
    await this.wait(800);

    this.endBattle("victory");
  }

  private async showLevelUpAnimation(): Promise<void> {
    // Create sparkle effect
    for (let i = 0; i < 8; i++) {
      const sparkle = this.add.circle(
        this.playerSprite!.x + (rng() - 0.5) * 80,
        this.playerSprite!.y + (rng() - 0.5) * 80,
        4,
        0xfbbf24
      );
      this.tweens.add({
        targets: sparkle,
        y: sparkle.y - 50,
        alpha: 0,
        duration: 600,
        onComplete: () => sparkle.destroy()
      });
    }

    // Flash the sprite
    this.tweens.add({
      targets: this.playerSprite,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 2
    });
  }

  private async showEvolutionAnimation(oldName: string, newName: string): Promise<void> {
    this.setMessage(`What? ${oldName} is evolving!`);
    await this.wait(1000);

    // Create evolution light effect
    const light = this.add.circle(this.playerSprite!.x, this.playerSprite!.y, 10, 0xffffff, 0.8);
    this.tweens.add({
      targets: light,
      scaleX: 15,
      scaleY: 15,
      alpha: 0,
      duration: 1500,
      onComplete: () => light.destroy()
    });

    // Flash effect
    for (let i = 0; i < 5; i++) {
      await this.wait(200);
      this.playerSprite?.setAlpha(0.3);
      await this.wait(100);
      this.playerSprite?.setAlpha(1);
    }

    this.setMessage(`Congratulations! ${oldName} evolved into ${newName}!`);
    await this.wait(1500);
  }

  private async handleCatch(ballType: "pokeball" | "greatball" | "ultraball"): Promise<void> {
    if (this.busy || this.moveMenuOpen || this.switchMenuOpen) return;
    if (!this.canCatch) {
      this.setMessage("You cannot catch trainer Pokemon!");
      return;
    }
    this.busy = true;
    this.closeBallMenu();

    if (gameState.inventory[ballType] <= 0) {
      this.setMessage(`No ${ballType === "pokeball" ? "Poke" : ballType === "greatball" ? "Great" : "Ultra"} Balls left!`);
      this.busy = false;
      return;
    }

    // Start targeting mini-game instead of immediate catch
    this.startTargetingGame(ballType);
  }

  private startTargetingGame(ballType: "pokeball" | "greatball" | "ultraball"): void {
    this.targetingActive = true;
    this.targetingBallType = ballType;
    this.ringAngle = 0;

    // Hide root menu during targeting
    this.rootMenuItems.forEach((item) => item.setVisible(false));

    const enemyX = this.enemySprite?.x ?? this.scale.width * 0.7;
    const enemyY = this.enemySprite?.y ?? this.scale.height * 0.3;

    // Initialize reticle position at center
    this.reticleX = enemyX;
    this.reticleY = enemyY;

    // Create outer target ring (moves in circle around enemy)
    this.targetRing = this.add.circle(enemyX + this.ringRadius, enemyY, 30, 0x00000000);
    this.targetRing.setStrokeStyle(4, 0x22c55e);
    this.targetRing.setDepth(50);
    this.targetingElements.push(this.targetRing);

    // Create inner target ring (sweet spot)
    this.targetRingInner = this.add.circle(enemyX + this.ringRadius, enemyY, 15, 0x22c55e, 0.3);
    this.targetRingInner.setDepth(50);
    this.targetingElements.push(this.targetRingInner);

    // Create player reticle (crosshair)
    this.reticle = this.add.container(this.reticleX, this.reticleY);
    this.reticle.setDepth(51);

    // Crosshair lines
    const lineColor = 0xff4444;
    const lineH = this.add.rectangle(0, 0, 30, 3, lineColor);
    const lineV = this.add.rectangle(0, 0, 3, 30, lineColor);
    const dot = this.add.circle(0, 0, 4, lineColor);

    // Outer ring for crosshair
    const crosshairRing = this.add.circle(0, 0, 18, 0x00000000);
    crosshairRing.setStrokeStyle(2, lineColor);

    this.reticle.add([lineH, lineV, dot, crosshairRing]);
    this.targetingElements.push(this.reticle);

    // Instructions text — drop the keyboard hint on touch devices.
    const isTouch = TouchControls.shouldEnable(this);
    const instrText = isTouch
      ? "Drag to aim, then tap THROW"
      : "Drag to aim • THROW, or arrow keys + SPACE";
    const instructions = this.add.text(this.scale.width / 2, this.scale.height - 60, instrText, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#fbbf24",
        backgroundColor: "#1e293b",
        padding: { left: 12, right: 12, top: 6, bottom: 6 }
      }).setOrigin(0.5).setDepth(100);
    instructions.setData("testid", "targeting-instructions");
    this.targetingElements.push(instructions);

    // THROW button (touch-friendly; also works with mouse)
    this.throwButton = this.add.text(this.scale.width / 2, this.scale.height - 20, "THROW!", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#0f172a",
      backgroundColor: "#22c55e",
      fontStyle: "bold",
      padding: { left: 28, right: 28, top: 8, bottom: 8 }
    }).setOrigin(0.5).setDepth(101);
    this.throwButton.setInteractive({ useHandCursor: true });
    this.throwButton.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation();
      this.fireAtTarget();
    });
    this.targetingElements.push(this.throwButton);

    // Drag-to-aim: move the reticle to wherever the player touches/drags,
    // except when the touch lands on the THROW button.
    this.targetingPointerHandler = (pointer: Phaser.Input.Pointer) => {
      if (!this.targetingActive || !pointer.isDown) return;
      if (this.throwButton && this.throwButton.getBounds().contains(pointer.x, pointer.y)) return;
      this.reticleX = pointer.x;
      this.reticleY = pointer.y;
    };
    this.input.on("pointerdown", this.targetingPointerHandler);
    this.input.on("pointermove", this.targetingPointerHandler);

    // Ball type indicator
    const ballName = ballType === "pokeball" ? "Poke Ball" : ballType === "greatball" ? "Great Ball" : "Ultra Ball";
    const ballIndicator = this.add.text(this.scale.width / 2, this.scale.height - 90,
      `Throwing: ${ballName}`, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#93c5fd"
      }).setOrigin(0.5).setDepth(100);
    this.targetingElements.push(ballIndicator);

    this.setMessage("Aim at the green target ring!");

    // Setup space bar to fire
    const spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey?.once("down", () => {
      this.fireAtTarget();
    });
  }

  private async fireAtTarget(): Promise<void> {
    if (!this.targetingActive || !this.targetingBallType) return;

    this.targetingActive = false;

    // Remove the drag-to-aim listeners
    if (this.targetingPointerHandler) {
      this.input.off("pointerdown", this.targetingPointerHandler);
      this.input.off("pointermove", this.targetingPointerHandler);
      this.targetingPointerHandler = undefined;
    }
    this.throwButton = undefined;

    // Get current positions
    const ringX = this.targetRing?.x ?? 0;
    const ringY = this.targetRing?.y ?? 0;

    // Calculate distance from reticle to target ring center
    const dx = this.reticleX - ringX;
    const dy = this.reticleY - ringY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Determine hit quality (15 = inner ring radius, 30 = outer ring radius)
    const perfectHit = distance <= 15;
    const goodHit = distance <= 30;

    // Clean up targeting elements
    this.targetingElements.forEach(el => el.destroy());
    this.targetingElements = [];
    this.targetRing = undefined;
    this.targetRingInner = undefined;
    this.reticle = undefined;

    // Show root menu again
    this.rootMenuItems.forEach((item) => item.setVisible(true));

    // Consume the ball
    gameState.inventory[this.targetingBallType] -= 1;
    const ballName = this.targetingBallType === "pokeball" ? "Poke Ball" :
                     this.targetingBallType === "greatball" ? "Great Ball" : "Ultra Ball";

    if (!goodHit) {
      // Missed the target completely - 0% catch chance
      this.setMessage(`You threw the ${ballName}...`);
      await this.animateBallThrowMiss();
      Sound.playMiss();
      this.setMessage("The ball missed completely!");
      await this.wait(600);

      // Enemy gets a turn
      const enemyMove = this.pickEnemyMove();
      await this.executeEnemyTurn(enemyMove);
      if (await this.resolvePlayerFaint()) return;
      this.busy = false;
      return;
    }

    // Good hit - proceed with normal catch logic
    this.setMessage(`You threw a ${ballName}!`);
    await this.animateBallThrow();

    // Perfect hit gives a catch bonus
    let caught: boolean;
    if (perfectHit) {
      this.setMessage("Perfect throw!");
      await this.wait(300);
      // Perfect throw - much higher catch rate
      const baseChance = attemptCatch(this.enemyMon, this.targetingBallType);
      caught = baseChance || rng() < 0.3; // Extra 30% chance on perfect
    } else {
      // Good hit - normal catch chance
      caught = attemptCatch(this.enemyMon, this.targetingBallType);
    }

    if (caught) {
      // Catch animation
      Sound.playCatch();
      await this.wait(300);
      this.setMessage("Gotcha!");
      await this.wait(400);
      this.setMessage(`${this.enemyMon.name} was caught!`);
      await this.wait(600);

      // Show naming screen
      this.pendingCatchMon = this.enemyMon;
      this.showNamingScreen();
      return;
    }

    // Shake animation then break free
    Sound.playCatchFail();
    await this.wait(300);
    this.setMessage(`${this.enemyMon.name} broke free!`);
    await this.wait(500);

    const enemyMove = this.pickEnemyMove();
    await this.executeEnemyTurn(enemyMove);
    if (await this.resolvePlayerFaint()) return;
    this.busy = false;
  }

  private async animateBallThrowMiss(): Promise<void> {
    // Ball flies past the enemy and off screen
    const startX = this.scale.width * 0.3;
    const startY = this.scale.height * 0.6;
    const ball = this.add.circle(startX, startY, 8, 0xff0000);
    const ballTop = this.add.circle(startX, startY - 2, 8, 0xffffff);
    ballTop.setName("ball-top-miss");

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: [ball, ballTop],
        x: this.scale.width + 50,
        y: this.scale.height * 0.1,
        duration: 600,
        ease: "Quad.easeOut",
        onComplete: () => {
          ball.destroy();
          ballTop.destroy();
          resolve();
        }
      });
    });
  }

  private async animateBallThrow(): Promise<void> {
    const ball = this.add.circle(this.scale.width * 0.3, this.scale.height * 0.6, 8, 0xff0000);
    this.add.circle(this.scale.width * 0.3, this.scale.height * 0.6 - 2, 8, 0xffffff).setName("ball-top");

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: ball,
        x: this.enemySprite!.x,
        y: this.enemySprite!.y,
        duration: 400,
        ease: "Quad.easeOut",
        onComplete: () => {
          ball.destroy();
          this.children.getByName("ball-top")?.destroy();
          resolve();
        }
      });
    });
  }

  private async handleRun(): Promise<void> {
    if (this.busy || this.moveMenuOpen || this.switchMenuOpen || this.ballMenuOpen) return;
    if (!this.canCatch) {
      Sound.playMiss();
      this.setMessage("No! There's no running from a Trainer battle!");
      return;
    }
    this.busy = true;
    this.setMessage("Got away safely!");
    await this.wait(400);
    this.endBattle("escape");
  }

  private async handleSwitch(index: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.closeSwitchMenu();
    this.playerIndex = index;
    this.playerMon = gameState.team[this.playerIndex];
    // Reset player stat stages on switch
    this.playerStages = { atk: 0, def: 0, spd: 0, spAtk: 0, spDef: 0 };
    this.setMessage(`Go ${this.playerMon.nickname || this.playerMon.name}!`);
    this.updatePlayerSprite();
    await this.wait(400);

    if (this.applyIntimidate(this.playerMon, this.enemyStages, this.enemyMon.name)) {
      await this.wait(600);
    }

    const enemyMove = this.pickEnemyMove();
    await this.executeEnemyTurn(enemyMove);
    if (await this.resolvePlayerFaint()) return;
    this.busy = false;
  }

  private readonly STAT_MOVES: Record<string, { target: "user" | "foe"; stat: StatStageKey; stages: number }> = {
    "growl":        { target: "foe",  stat: "atk", stages: -1 },
    "leer":         { target: "foe",  stat: "def", stages: -1 },
    "tail-whip":    { target: "foe",  stat: "def", stages: -1 },
    "string-shot":  { target: "foe",  stat: "spd", stages: -1 },
    "screech":      { target: "foe",  stat: "def", stages: -2 },
    "harden":       { target: "user", stat: "def", stages: +1 },
    "withdraw":     { target: "user", stat: "def", stages: +1 },
    "defense-curl": { target: "user", stat: "def", stages: +1 },
    "swords-dance": { target: "user", stat: "atk", stages: +2 },
    "growth":       { target: "user", stat: "spAtk", stages: +1 },
    "agility":      { target: "user", stat: "spd", stages: +2 },
    "amnesia":      { target: "user", stat: "spDef", stages: +2 },
    "calm-mind":    { target: "user", stat: "spAtk", stages: +1 },
    "nasty-plot":   { target: "user", stat: "spAtk", stages: +2 },
    "charm":        { target: "foe",  stat: "atk", stages: -2 },
  };

  private showFloatingText(text: string, x: number, y: number, color = "#ffffff"): void {
    const ft = this.add.text(x, y, text, {
      fontFamily: "monospace",
      fontSize: "16px",
      color,
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(500);

    this.tweens.add({
      targets: ft,
      y: y - 30,
      alpha: 0,
      duration: 800,
      ease: "Quad.easeOut",
      onComplete: () => ft.destroy()
    });
  }

  private async executeMove(attacker: PokemonInstance, defender: PokemonInstance, moveId: string): Promise<void> {
    const move = MOVES[moveId];
    if (!move) {
      this.setMessage(`${attacker.name} has no move!`);
      await this.wait(400);
      return;
    }

    // Spend PP (Struggle has none to spend).
    if (moveId !== "struggle") usePp(attacker, moveId);

    const attackerDisplayName = attacker === this.playerMon ? (attacker.nickname || attacker.name) : attacker.name;
    this.setMessage(`${attackerDisplayName} used ${move.name}!`);
    await this.wait(450);

    if (!rollAccuracy(moveId, attacker)) {
      Sound.playMiss();
      this.setMessage("The move missed!");
      await this.wait(400);
      return;
    }

    // Handle stat-change status moves
    if (move.category === "status" && this.STAT_MOVES[moveId]) {
      const statDef = this.STAT_MOVES[moveId];
      const isPlayer = attacker === this.playerMon;
      const targetIsPlayer = statDef.target === "user" ? isPlayer : !isPlayer;
      const stages = targetIsPlayer ? this.playerStages : this.enemyStages;
      const targetSprite = targetIsPlayer ? this.playerSprite : this.enemySprite;
      const targetMon = targetIsPlayer ? this.playerMon : this.enemyMon;

      // Apply stage change clamped to [-6, +6]
      stages[statDef.stat] = Math.max(-6, Math.min(6, stages[statDef.stat] + statDef.stages));

      // Build message
      const statName = STAT_LABELS[statDef.stat];
      const changeWord = statDef.stages > 1 ? "sharply rose" : statDef.stages === 1 ? "rose" :
                         statDef.stages < -1 ? "sharply fell" : "fell";
      const displayName = targetMon.nickname || targetMon.name;
      this.setMessage(`${displayName}'s ${statName} ${changeWord}!`);

      // Floating text above affected sprite
      if (targetSprite) {
        const floatColor = statDef.stages > 0 ? "#22d3ee" : "#f87171";
        const floatText = statDef.stages > 0 ? `${statName}↑` : `${statName}↓`;
        this.showFloatingText(floatText, targetSprite.x, targetSprite.y - 60, floatColor);
      }

      await this.wait(700);
      return;
    }

    // Status-inflicting moves (sleep-powder, thunder-wave, toxic, will-o-wisp…):
    // apply the move's declared status to the defender via the shared engine.
    if (move.category === "status" && move.effect?.status) {
      const inflicted = tryInflictStatus(defender, move.effect.status, moveId);
      const defenderName = defender === this.playerMon ? (defender.nickname || defender.name) : defender.name;
      if (inflicted) {
        this.updateHpText();
        const verb: Record<string, string> = {
          poison: "was poisoned", burn: "was burned", paralysis: "was paralyzed",
          sleep: "fell asleep", freeze: "was frozen solid"
        };
        this.setMessage(`${defenderName} ${verb[move.effect.status] ?? "was afflicted"}!`);
      } else {
        this.setMessage("But it failed!");
      }
      await this.wait(700);
      return;
    }

    // Weather-setting moves (Rain Dance / Sunny Day / Sandstorm).
    if (move.category === "status" && move.effect?.weather) {
      this.setWeather(move.effect.weather);
      await this.wait(700);
      return;
    }

    // Any other status move with no implemented effect: just show its message.
    if (move.category === "status") {
      await this.wait(400);
      return;
    }

    const attackerStages = attacker === this.playerMon ? this.playerStages : this.enemyStages;
    const defenderStages = defender === this.playerMon ? this.playerStages : this.enemyStages;
    const result = calculateDamage(attacker, defender, moveId, attackerStages, defenderStages, this.weather);
    const moveType = MOVES[moveId]?.type || "normal";

    // Show attack animation with type-based effects
    if (attacker === this.playerMon) {
      await this.showAttackAnimation(this.playerSprite!, this.enemySprite!, result.isCritical, moveType);
    } else {
      await this.showAttackAnimation(this.enemySprite!, this.playerSprite!, result.isCritical, moveType);
    }

    defender.hp = Math.max(0, defender.hp - result.damage);
    this.updateHpText();

    // ---- Held item effects triggered by damage ----

    // Shell Bell: attacker restores 1/8 of damage dealt (only player-side attacker for simplicity)
    if (attacker === this.playerMon && attacker.heldItem === "shellbell" && result.damage > 0) {
      const restore = Math.floor(result.damage / 8);
      if (restore > 0) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + restore);
        this.updateHpText();
        this.setMessage(`Shell Bell restored ${restore} HP!`);
        await this.wait(400);
      }
    }

    // Oran Berry: player mon restores 10 HP when it drops below 50% (once per battle)
    if (defender === this.playerMon && defender.heldItem === "oranberry" && !this.usedOranBerry) {
      if (defender.hp > 0 && defender.hp < Math.floor(defender.maxHp / 2)) {
        this.usedOranBerry = true;
        const restore = Math.min(10, defender.maxHp - defender.hp);
        defender.hp += restore;
        this.updateHpText();
        this.setMessage(`Oran Berry restored ${restore} HP!`);
        await this.wait(400);
      }
    }

    if (result.isCritical) {
      this.setMessage("A critical hit!");
      await this.wait(400);
    }

    if (result.effectivenessText) {
      this.setMessage(result.effectivenessText);
      // Type matchup colour flash
      if (result.effectiveness !== 1) {
        let flashColor: number;
        let flashAlpha: number;
        if (result.effectiveness === 0) {
          flashColor = 0x888888;
          flashAlpha = 0.25;
        } else if (result.effectiveness > 1) {
          flashColor = 0x00ff88;
          flashAlpha = 0.25;
        } else {
          flashColor = 0xff3300;
          flashAlpha = 0.20;
        }
        const flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, flashColor, 0)
          .setOrigin(0)
          .setScrollFactor(0)
          .setDepth(800);
        this.tweens.add({
          targets: flash,
          alpha: flashAlpha,
          duration: 100,
          yoyo: true,
          hold: 0,
          onComplete: () => {
            this.tweens.add({
              targets: flash,
              alpha: 0,
              duration: 200,
              onComplete: () => flash.destroy()
            });
          }
        });
      }
      await this.wait(450);
    }

    // Handle status effect infliction
    if (result.statusInflicted && defender.status === "none") {
      if (tryInflictStatus(defender, result.statusInflicted)) {
        const statusName = result.statusInflicted === "paralysis" ? "paralyzed" :
          result.statusInflicted === "burn" ? "burned" :
          result.statusInflicted === "freeze" ? "frozen" :
          result.statusInflicted === "poison" ? "poisoned" : result.statusInflicted;
        this.setMessage(`${defender.name} was ${statusName}!`);
        this.updateHpText();
        await this.wait(500);
      }
    }

    // Defender ability: Static may paralyze a physical (contact) attacker.
    const defAbility = getAbility(defender.ability);
    if (defAbility?.contactParalyze && move.category === "physical" &&
        attacker.status === "none" && rng() < defAbility.contactParalyze) {
      if (tryInflictStatus(attacker, "paralysis")) {
        const atkName = attacker === this.playerMon ? (attacker.nickname || attacker.name) : attacker.name;
        this.setMessage(`${atkName} was paralyzed by ${defAbility.name}!`);
        this.updateHpText();
        await this.wait(500);
      }
    }
  }

  /** Intimidate: lower the opposing Pokémon's Attack by one stage on entry. */
  private applyIntimidate(enteringMon: PokemonInstance, opposingStages: StatStages, opposingName: string): boolean {
    if (getAbility(enteringMon.ability)?.intimidate && opposingStages.atk > -6) {
      opposingStages.atk = Math.max(-6, opposingStages.atk - 1);
      const enterName = enteringMon === this.playerMon ? (enteringMon.nickname || enteringMon.name) : enteringMon.name;
      this.setMessage(`${enterName}'s Intimidate cut ${opposingName}'s Attack!`);
      return true;
    }
    return false;
  }

  private async showAttackAnimation(attacker: Phaser.GameObjects.Sprite, target: Phaser.GameObjects.Sprite, isCritical: boolean, moveType?: string): Promise<void> {
    const originalX = attacker.x;
    const originalY = attacker.y;
    const targetX = target.x;
    const targetY = target.y;

    // Get type-based color
    const typeColors: Record<string, number> = {
      fire: 0xff6600,
      water: 0x3399ff,
      grass: 0x22cc55,
      electric: 0xffcc00,
      ice: 0x66ccff,
      fighting: 0xcc3300,
      poison: 0x9933ff,
      ground: 0xcc9966,
      flying: 0x9999ff,
      psychic: 0xff66cc,
      bug: 0x99cc33,
      rock: 0x999966,
      ghost: 0x6666cc,
      dragon: 0x6633ff,
      dark: 0x666666,
      steel: 0x99aacc,
      fairy: 0xffaacc,
      normal: 0xcccccc
    };
    const effectColor = moveType ? (typeColors[moveType] || 0xffffff) : 0xffffff;

    // Charge up animation - attacker glows
    attacker.setTint(effectColor);
    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: attacker,
        scaleX: attacker.scaleX * 1.15,
        scaleY: attacker.scaleY * 1.15,
        duration: 150,
        yoyo: true,
        onComplete: () => resolve()
      });
    });
    attacker.clearTint();

    // Lunge toward target with trail effect
    const trail1 = this.add.circle(originalX, originalY, 15, effectColor, 0.6).setDepth(5);
    const trail2 = this.add.circle(originalX, originalY, 10, effectColor, 0.4).setDepth(5);

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: attacker,
        x: originalX + (targetX > originalX ? 50 : -50),
        duration: 120,
        ease: "Quad.easeIn",
        onComplete: () => resolve()
      });
    });

    // Fade out trails
    this.tweens.add({ targets: [trail1, trail2], alpha: 0, duration: 200, onComplete: () => { trail1.destroy(); trail2.destroy(); }});

    // Impact effect - spawn particles at target
    this.createImpactEffect(targetX, targetY, effectColor, isCritical);

    // Play hit sound
    if (isCritical) {
      Sound.playCriticalHit();
    } else {
      Sound.playHit();
    }

    // Screen shake
    this.cameras.main.shake(isCritical ? 200 : 100, isCritical ? 0.015 : 0.008);

    // Flash target
    const flashColor = isCritical ? 0xff0000 : 0xffffff;
    target.setTint(flashColor);

    // Damage recoil - target moves back
    const recoilDistance = isCritical ? 25 : 15;
    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: target,
        x: targetX + (targetX > originalX ? recoilDistance : -recoilDistance),
        duration: 80,
        yoyo: true,
        onComplete: () => resolve()
      });
    });

    target.clearTint();

    // Return attacker to position
    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: attacker,
        x: originalX,
        duration: 150,
        ease: "Quad.easeOut",
        onComplete: () => resolve()
      });
    });

    // Extra shake for critical
    if (isCritical) {
      // Flash screen white briefly
      const flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0.5).setOrigin(0).setDepth(50);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 150,
        onComplete: () => flash.destroy()
      });
    }
  }

  private createImpactEffect(x: number, y: number, color: number, isCritical: boolean): void {
    const particleCount = isCritical ? 12 : 6;

    // Spawn impact particles
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = isCritical ? 120 : 80;
      const size = isCritical ? 8 : 5;

      const particle = this.add.circle(x, y, size, color).setDepth(20);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.2,
        duration: 400,
        ease: "Quad.easeOut",
        onComplete: () => particle.destroy()
      });
    }

    // Impact star burst
    if (isCritical) {
      for (let i = 0; i < 4; i++) {
        const star = this.add.star(x, y, 4, 5, 15, color).setDepth(21);
        this.tweens.add({
          targets: star,
          scaleX: 2,
          scaleY: 2,
          alpha: 0,
          angle: 90,
          duration: 300,
          onComplete: () => star.destroy()
        });
      }
    }

    // Impact ring
    const ring = this.add.circle(x, y, 10, color, 0).setDepth(19);
    ring.setStrokeStyle(3, color);
    this.tweens.add({
      targets: ring,
      scaleX: 4,
      scaleY: 4,
      alpha: 0,
      duration: 350,
      onComplete: () => ring.destroy()
    });
  }

  private async showFaintAnimation(sprite: Phaser.GameObjects.Sprite): Promise<void> {
    // Stop any ongoing tweens on this sprite
    this.tweens.killTweensOf(sprite);

    // Play faint sound
    Sound.playFaint();

    // Flash red
    sprite.setTint(0xff0000);
    await this.wait(100);
    sprite.clearTint();

    // Spin and fall down while fading
    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: sprite,
        y: sprite.y + 100,
        alpha: 0,
        angle: 180,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 600,
        ease: "Quad.easeIn",
        onComplete: () => resolve()
      });
    });

    // Create poof effect where Pokemon was
    const originalY = sprite.y - 100;
    for (let i = 0; i < 8; i++) {
      const puff = this.add.circle(
        sprite.x + (rng() - 0.5) * 60,
        originalY + (rng() - 0.5) * 40,
        15,
        0x888888,
        0.7
      ).setDepth(15);

      this.tweens.add({
        targets: puff,
        y: puff.y - 30,
        alpha: 0,
        scaleX: 2,
        scaleY: 2,
        duration: 400,
        onComplete: () => puff.destroy()
      });
    }
  }

  private pickEnemyMove(): string {
    // Only moves the enemy still has PP for; Struggle if all are depleted.
    const moves = this.enemyMon.moves.filter(m => MOVES[m] && getMovePp(this.enemyMon, m) > 0);
    if (moves.length === 0) return "struggle";

    // Simple AI: prefer super-effective moves
    const playerTypes = this.playerMon.types;
    const effectiveMoves = moves.filter(moveId => {
      const move = MOVES[moveId];
      if (!move || move.power <= 0) return false;
      const effectiveness = playerTypes.reduce((acc, type) => {
        return acc * (MOVES[moveId] ? 1 : 1);
      }, 1);
      return effectiveness > 1;
    });

    if (effectiveMoves.length > 0) {
      return effectiveMoves[Math.floor(rng() * effectiveMoves.length)];
    }

    return moves[Math.floor(rng() * moves.length)];
  }

  private findNextAlive(): number {
    return gameState.team.findIndex((mon) => mon.hp > 0);
  }

  private async resolvePlayerFaint(): Promise<boolean> {
    if (this.playerMon.hp > 0) return false;

    // Show faint animation for player Pokemon
    await this.showFaintAnimation(this.playerSprite!);
    this.setMessage(`${this.playerMon.nickname || this.playerMon.name} fainted!`);
    await this.wait(400);

    const nextIndex = this.findNextAlive();
    if (nextIndex === -1) {
      this.setMessage("You blacked out!");
      await this.wait(800);
      this.endBattle("defeat");
      return true;
    }
    this.playerIndex = nextIndex;
    this.playerMon = gameState.team[this.playerIndex];
    this.setMessage(`${this.playerMon.nickname || this.playerMon.name}, I choose you!`);
    this.updatePlayerSprite();
    await this.showEntranceAnimation(this.playerSprite!, true);
    await this.wait(300);
    this.busy = false;
    return false;
  }

  private async showEntranceAnimation(sprite: Phaser.GameObjects.Sprite, isPlayer: boolean): Promise<void> {
    const targetX = isPlayer ? this.scale.width * 0.25 : this.scale.width * 0.7;
    const targetY = isPlayer ? this.scale.height * 0.45 : this.scale.height * 0.3;
    sprite.setAlpha(0);
    sprite.setScale(0.3);
    sprite.setAngle(0);
    sprite.x = isPlayer ? -50 : this.scale.width + 50;
    sprite.y = targetY;

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: sprite,
        x: targetX,
        alpha: 1,
        scaleX: isPlayer ? 1 : 1,
        scaleY: isPlayer ? 1 : 1,
        duration: 400,
        ease: "Back.easeOut",
        onComplete: () => resolve()
      });
    });

    // Restore proper scale
    this.applyDisplayHeight(sprite, isPlayer ? 140 : 160);

    // Restart idle animation
    this.tweens.add({
      targets: sprite,
      y: sprite.y - (isPlayer ? 8 : 6),
      duration: isPlayer ? 1200 : 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  private updateHpText(): void {
    const playerStatusStr = this.playerMon.status !== "none" ? ` [${getStatusDisplayText(this.playerMon.status)}]` : "";
    const enemyStatusStr = this.enemyMon.status !== "none" ? ` [${getStatusDisplayText(this.enemyMon.status)}]` : "";

    this.playerHpText.setText(
      `${this.playerMon.nickname || this.playerMon.name} Lv${this.playerMon.level}\nHP: ${this.playerMon.hp}/${this.playerMon.maxHp}`
    );
    this.playerExpText.setText(`EXP: ${this.playerMon.exp}/${this.playerMon.expToNext}`);
    this.playerStatusText.setText(playerStatusStr);
    if (this.playerMon.status !== "none") {
      this.playerStatusText.setColor(`#${getStatusColor(this.playerMon.status).toString(16)}`);
    }

    // Update XP bar
    if (this.xpBarFill) {
      const expRatio = this.playerMon.expToNext > 0
        ? Math.min(1, this.playerMon.exp / this.playerMon.expToNext)
        : 0;
      this.xpBarFill.setSize(this.xpBarW * expRatio, 6);
    }

    this.enemyHpText.setText(
      `${this.enemyMon.name} Lv${this.enemyMon.level}\nHP: ${this.enemyMon.hp}/${this.enemyMon.maxHp}`
    );
    this.enemyStatusText.setText(enemyStatusStr);
    if (this.enemyMon.status !== "none") {
      this.enemyStatusText.setColor(`#${getStatusColor(this.enemyMon.status).toString(16)}`);
    }

    this.drawHpBars();
  }

  /** Draw colour-coded HP bars above the two Pokémon sprites. */
  private drawHpBars(): void {
    const barW = 130;
    const barH = 12;
    const draw = (
      g: Phaser.GameObjects.Graphics | undefined,
      cx: number,
      cy: number,
      ratio: number
    ) => {
      if (!g) return;
      const x = cx - barW / 2;
      const r = Math.max(0, Math.min(1, ratio));
      const color = r > 0.5 ? 0x22c55e : r > 0.2 ? 0xfbbf24 : 0xef4444;
      g.clear();
      g.fillStyle(0x000000, 0.55);
      g.fillRoundedRect(x - 2, cy - 2, barW + 4, barH + 4, 4);
      g.fillStyle(0x1f2937, 1);
      g.fillRect(x, cy, barW, barH);
      g.fillStyle(color, 1);
      g.fillRect(x, cy, barW * r, barH);
      g.lineStyle(1, 0xffffff, 0.6);
      g.strokeRect(x, cy, barW, barH);
    };
    draw(this.playerHpBar, this.scale.width * 0.25, this.scale.height * 0.45 - 100,
      this.playerMon.hp / this.playerMon.maxHp);
    draw(this.enemyHpBar, this.scale.width * 0.7, this.scale.height * 0.3 - 110,
      this.enemyMon.hp / this.enemyMon.maxHp);
  }

  /** Set the active weather, show a message, and tint the field. */
  /** Scale an RGB colour by a factor (>1 brightens, <1 darkens). */
  private adjustColor(int: number, factor: number): number {
    const c = Phaser.Display.Color.IntegerToColor(int);
    return Phaser.Display.Color.GetColor(
      Phaser.Math.Clamp(Math.round(c.red * factor), 0, 255),
      Phaser.Math.Clamp(Math.round(c.green * factor), 0, 255),
      Phaser.Math.Clamp(Math.round(c.blue * factor), 0, 255)
    );
  }

  /** Atmospheric, type-themed gradient backdrop with layered platforms. */
  private createBattleBackground(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const horizon = h * 0.52;
    const base = BATTLE_BG_BY_TYPE[this.enemyMon.types[0]] ?? 0x4a6fa5;

    const g = this.add.graphics().setDepth(0);
    // Sky: light tint at the top easing down to the horizon.
    g.fillGradientStyle(this.adjustColor(base, 1.7), this.adjustColor(base, 1.7),
      this.adjustColor(base, 1.15), this.adjustColor(base, 1.15), 1);
    g.fillRect(0, 0, w, horizon + 2);
    // Distant hills hugging the horizon.
    g.fillStyle(this.adjustColor(base, 0.95), 0.5);
    g.fillEllipse(w * 0.3, horizon, w * 0.95, h * 0.18);
    g.fillStyle(this.adjustColor(base, 0.8), 0.5);
    g.fillEllipse(w * 0.78, horizon, w * 0.85, h * 0.14);
    // Ground: darker gradient from the horizon to the bottom.
    g.fillGradientStyle(this.adjustColor(base, 0.7), this.adjustColor(base, 0.7),
      this.adjustColor(base, 0.42), this.adjustColor(base, 0.42), 1);
    g.fillRect(0, horizon, w, h - horizon);

    this.drawPlatform(w * 0.25, h * 0.52, 132, 34, base);
    this.drawPlatform(w * 0.7, h * 0.38, 108, 28, base);
  }

  /** Layered disc platform: contact shadow + base + lit top. */
  private drawPlatform(cx: number, cy: number, rw: number, rh: number, base: number): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(cx, cy + 6, rw * 1.08, rh * 0.7);
    g.fillStyle(this.adjustColor(base, 0.65), 1);
    g.fillEllipse(cx, cy, rw, rh);
    g.fillStyle(this.adjustColor(base, 1.35), 0.9);
    g.fillEllipse(cx, cy - rh * 0.18, rw * 0.86, rh * 0.66);
  }

  private setWeather(weather: Weather): void {
    this.weather = weather;
    this.weatherTurns = 5;
    const msg: Record<string, string> = {
      rain: "It started to rain!",
      sun: "The sunlight turned harsh!",
      sandstorm: "A sandstorm kicked up!",
      none: ""
    };
    this.setMessage(msg[weather] ?? "");
    const tint: Record<string, number> = {
      rain: 0x3b5bdb, sun: 0xf59e0b, sandstorm: 0xb59f6b, none: 0x000000
    };
    this.weatherOverlay?.destroy();
    if (weather !== "none") {
      this.weatherOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, tint[weather], 0.12)
        .setOrigin(0).setScrollFactor(0).setDepth(35);
    }
  }

  /** End-of-turn weather: sandstorm chip + countdown, clearing when it expires. */
  private async applyEndOfTurnWeather(): Promise<void> {
    if (this.weather === "none") return;

    if (this.weather === "sandstorm") {
      const immune = (m: PokemonInstance) =>
        m.types.includes("rock") || m.types.includes("ground") || m.types.includes("steel");
      let chipped = false;
      for (const m of [this.playerMon, this.enemyMon]) {
        if (m.hp > 0 && !immune(m)) {
          m.hp = Math.max(0, m.hp - Math.max(1, Math.floor(m.maxHp / 16)));
          chipped = true;
        }
      }
      if (chipped) {
        this.updateHpText();
        this.setMessage("The sandstorm rages!");
        await this.wait(500);
      }
    }

    this.weatherTurns -= 1;
    if (this.weatherTurns <= 0) {
      const ended: Record<string, string> = {
        rain: "The rain stopped.", sun: "The sunlight faded.",
        sandstorm: "The sandstorm subsided.", none: ""
      };
      this.setMessage(ended[this.weather] ?? "");
      this.weather = "none";
      this.weatherOverlay?.destroy();
      this.weatherOverlay = undefined;
      await this.wait(500);
    }
  }

  private updatePlayerSprite(): void {
    if (!this.playerSprite) return;
    const key = this.textures.exists(`pokemon-${this.playerMon.speciesId}`)
      ? `pokemon-${this.playerMon.speciesId}`
      : "wild-fallback";
    this.playerSprite.setTexture(key);
    this.applyDisplayHeight(this.playerSprite, 140);
    this.updateHpText();
  }

  private updateEnemySprite(): void {
    if (!this.enemySprite) return;
    const key = this.textures.exists(`pokemon-${this.enemyMon.speciesId}`)
      ? `pokemon-${this.enemyMon.speciesId}`
      : "wild-fallback";
    this.enemySprite.setTexture(key);
    this.applyDisplayHeight(this.enemySprite, 160);
    this.updateHpText();
  }

  private setMessage(message: string): void {
    // A message is always meant to be seen — make sure the bar wasn't left
    // hidden by an open submenu.
    this.setBattleMessageVisible(true);
    this.messageText.setText(message);
  }

  private applyDisplayHeight(sprite: Phaser.GameObjects.Sprite, height: number): void {
    const texture = sprite.texture.getSourceImage() as HTMLImageElement;
    if (texture && texture.height) {
      const scale = height / texture.height;
      sprite.setScale(scale);
    } else {
      sprite.setDisplaySize(height, height);
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, () => resolve());
    });
  }

  private showNamingScreen(): void {
    if (!this.pendingCatchMon) return;

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Dim background
    this.namingOverlay = this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.7);

    // Create naming box
    const box = this.add.rectangle(centerX, centerY, 420, 280, 0x1e293b, 0.98);
    box.setStrokeStyle(3, 0xfbbf24);
    this.namingElements.push(box);

    // Title
    const title = this.add.text(centerX, centerY - 110, "Give a nickname?", {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#fbbf24"
    }).setOrigin(0.5);
    this.namingElements.push(title);

    // Pokemon name
    const pokemonName = this.add.text(centerX, centerY - 70, this.pendingCatchMon.name, {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#93c5fd"
    }).setOrigin(0.5);
    this.namingElements.push(pokemonName);

    // Nickname entry via a real HTML <input> overlaid on the canvas. A Phaser
    // text object can't open the device soft keyboard, so on touch the old
    // keydown-only field was impossible to type into; this input does (the user
    // taps it to bring up the keyboard, or it autofocuses on desktop).
    const submit = () => this.finishCatch(this.nameInput?.value.trim() || undefined);

    const dom = document.createElement("input");
    dom.type = "text";
    dom.maxLength = 12;
    dom.placeholder = "nickname (optional)";
    dom.setAttribute("autocomplete", "off");
    dom.setAttribute("autocapitalize", "off");
    Object.assign(dom.style, {
      position: "fixed", left: `${centerX}px`, top: `${centerY - 20}px`,
      transform: "translate(-50%, -50%)", width: "240px", height: "42px",
      fontFamily: "monospace", fontSize: "20px", textAlign: "center",
      background: "#374151", color: "#f8fafc", border: "2px solid #fbbf24",
      borderRadius: "6px", outline: "none", zIndex: "1000"
    } as Partial<CSSStyleDeclaration>);
    dom.addEventListener("input", () => {
      const cleaned = dom.value.replace(/[^a-zA-Z0-9 \-'!?.]/g, "").slice(0, 12);
      if (cleaned !== dom.value) dom.value = cleaned;
    });
    dom.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
      else if (e.key === "Escape") { e.preventDefault(); this.finishCatch(undefined); }
    });
    document.body.appendChild(dom);
    this.nameInput = dom;
    this.time.delayedCall(60, () => this.nameInput?.focus());

    // Instructions
    const instructions = this.add.text(centerX, centerY + 30, "Tap the field to type a nickname", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#94a3b8"
    }).setOrigin(0.5);
    this.namingElements.push(instructions);

    // Confirm button
    const confirmBtn = this.add.text(centerX - 70, centerY + 80, "Confirm", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#f8fafc",
      backgroundColor: "#22c55e",
      padding: { left: 14, right: 14, top: 8, bottom: 8 }
    }).setOrigin(0.5);
    confirmBtn.setInteractive({ useHandCursor: true });
    confirmBtn.on("pointerover", () => confirmBtn.setScale(1.05));
    confirmBtn.on("pointerout", () => confirmBtn.setScale(1));
    confirmBtn.on("pointerdown", () => submit());
    this.namingElements.push(confirmBtn);

    // Skip button (keep default name)
    const skipBtn = this.add.text(centerX + 70, centerY + 80, "Skip", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#f8fafc",
      backgroundColor: "#6b7280",
      padding: { left: 14, right: 14, top: 8, bottom: 8 }
    }).setOrigin(0.5);
    skipBtn.setInteractive({ useHandCursor: true });
    skipBtn.on("pointerover", () => skipBtn.setScale(1.05));
    skipBtn.on("pointerout", () => skipBtn.setScale(1));
    skipBtn.on("pointerdown", () => this.finishCatch(undefined));
    this.namingElements.push(skipBtn);

    // Hint text
    const hint = this.add.text(centerX, centerY + 120, "Confirm to keep the name  ·  Skip for default", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#6b7280"
    }).setOrigin(0.5);
    this.namingElements.push(hint);
  }

  /** Remove the HTML nickname input overlay if present. */
  private removeNameInput(): void {
    this.nameInput?.remove();
    this.nameInput = undefined;
  }

  private async finishCatch(nickname?: string): Promise<void> {
    // Clean up naming screen
    this.removeNameInput();
    this.namingOverlay?.destroy();
    this.namingElements.forEach(el => el.destroy());
    this.namingElements = [];

    if (!this.pendingCatchMon) {
      this.endBattle("caught");
      return;
    }

    // Apply nickname if provided
    if (nickname && nickname.trim().length > 0) {
      this.pendingCatchMon.nickname = nickname.trim();
      this.setMessage(`${this.pendingCatchMon.name} was nicknamed ${nickname.trim()}!`);
    } else {
      this.setMessage(`${this.pendingCatchMon.name} joined your team!`);
    }
    await this.wait(600);

    // Add to team or box
    if (!addToTeam(gameState, this.pendingCatchMon)) {
      addToBox(gameState, this.pendingCatchMon);
      this.setMessage("Team is full. Sent to the box.");
      await this.wait(500);
    }

    // Mark as caught in Pokedex
    markCaught(gameState, this.pendingCatchMon.speciesId);

    this.pendingCatchMon = undefined;
    await this.wait(400);
    this.endBattle("caught");
  }

  private endBattle(result: "victory" | "defeat" | "caught" | "escape"): void {
    // Stop battle music
    Sound.stopMusic();

    // Play appropriate end sound
    if (result === "victory" || result === "caught") {
      Sound.playVictory();
    } else if (result === "defeat") {
      Sound.playDefeat();
    }

    if (this.canCatch && (result === "victory" || result === "caught")) {
      const index = gameState.wildMons.findIndex((m) => m.id === this.wildId);
      if (index !== -1) gameState.wildMons.splice(index, 1);
    }

    if (this.isTrainerBattle && result === "victory") {
      // Handle gym victory
      const region = getRegion(gameState);
      const gym = region.gyms.find((g) => g.id === this.wildId);
      if (gym && !gameState.defeatedGyms[gym.id]) {
        gameState.defeatedGyms[gym.id] = true;
        gameState.badges.push(gym.badge);
      }

      // Handle trainer victory
      if (gameState.defeatedTrainers) {
        gameState.defeatedTrainers[this.wildId] = true;
      }
    }

    emitTestEvent("battle:complete", { result, wildId: this.wildId });
    this.events.emit("battle-complete", { result, wildId: this.wildId });
    this.scene.stop();
  }
}
