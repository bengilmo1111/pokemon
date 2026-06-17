import Phaser from "phaser";
import { MOVES } from "../data/moves";
import { SPECIES } from "../data/species";
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
  tryInflictStatus
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
  StatusEffect
} from "../game/state";

interface BattleData {
  type: "wild" | "gym" | "trainer" | "rival" | "elite";
  wildId?: string;
  gymId?: string;
  trainerId?: string;
  trainerName?: string;
  trainerTeam?: { speciesId: string; level: number }[];
}

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
  private messageText!: Phaser.GameObjects.Text;
  private playerHpText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
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
  }

  create(data: BattleData): void {
    // Ensure input is enabled for this scene
    this.input.enabled = true;

    this.canCatch = data.type === "wild";
    this.isTrainerBattle = data.type !== "wild";
    this.playerIndex = this.findNextAlive();
    this.playerMon = gameState.team[this.playerIndex];
    this.pendingLevelUps = [];

    if (!this.playerMon) {
      this.endBattle("escape");
      return;
    }

    if (data.type === "wild") {
      this.wildId = data.wildId ?? "";
      const wild = gameState.wildMons.find((m) => m.id === data.wildId);
      if (!wild) {
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
      this.trainerName = gym.leader;
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

    // Create battle background (depth 0)
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x1b2533).setOrigin(0).setDepth(0);
    this.add.rectangle(0, this.scale.height * 0.55, this.scale.width, this.scale.height * 0.45, 0x101522).setOrigin(0).setDepth(0);

    // Add battle platform graphics
    this.add.ellipse(this.scale.width * 0.25, this.scale.height * 0.52, 120, 30, 0x2d3748);
    this.add.ellipse(this.scale.width * 0.7, this.scale.height * 0.38, 100, 25, 0x2d3748);

    const playerTexture = this.textures.exists(`pokemon-${this.playerMon.speciesId}`)
      ? `pokemon-${this.playerMon.speciesId}`
      : "wild-fallback";
    const enemyTexture = this.textures.exists(`pokemon-${this.enemyMon.speciesId}`)
      ? `pokemon-${this.enemyMon.speciesId}`
      : "wild-fallback";

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
    this.messageText = this.add.text(24, 24, introText, {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#e5e7eb"
    });

    // Play encounter sound and start battle music
    Sound.playEncounter();
    this.time.delayedCall(500, () => Sound.playBattleMusic());

    // Player Pokemon info box
    this.add.rectangle(this.scale.width - 220, this.scale.height * 0.6, 200, 80, 0x1e293b, 0.9).setOrigin(0);
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

    // Enemy Pokemon info box
    this.add.rectangle(20, this.scale.height * 0.08, 200, 70, 0x1e293b, 0.9).setOrigin(0);
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
      { label: "Pokemon", color: "#15803d", action: () => this.openSwitchMenu() },
      { label: "Run", color: "#334155", action: () => this.handleRun() }
    ];

    const colX = [this.scale.width * 0.28, this.scale.width * 0.72];
    const rowY = [this.scale.height - 168, this.scale.height - 80];
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

  private openMoveMenu(): void {
    if (this.busy || this.moveMenuOpen || this.switchMenuOpen || this.ballMenuOpen) return;
    this.moveMenuOpen = true;
    this.rootMenuItems.forEach((item) => item.setVisible(false));

    const moveIds = this.playerMon.moves;
    const colX = [this.scale.width * 0.28, this.scale.width * 0.72];
    const rowY = [this.scale.height - 210, this.scale.height - 130];
    const btnWidth = this.scale.width * 0.46;

    moveIds.forEach((moveId, index) => {
      const move = MOVES[moveId];
      const label = move ? `${move.name}\n${move.type.toUpperCase()}` : moveId;
      const x = colX[index % 2];
      const y = rowY[Math.floor(index / 2)];
      const text = this.add.text(x, y, label, {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#f9fafb",
        backgroundColor: "#374151",
        align: "center",
        fixedWidth: btnWidth,
        padding: { top: 10, bottom: 10 }
      });
      text.setOrigin(0.5).setDepth(100);
      text.setInteractive({ useHandCursor: true });
      text.on("pointerdown", () => this.handleFight(moveId));
      this.moveMenuItems.push(text);
    });

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
    this.rootMenuItems.forEach((item) => item.setVisible(true));
  }

  private openBallMenu(): void {
    if (this.busy || this.ballMenuOpen || this.moveMenuOpen || this.switchMenuOpen) return;
    if (!this.canCatch) {
      this.setMessage("Can't use items in trainer battles!");
      return;
    }
    this.ballMenuOpen = true;
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
        backgroundColor: "#374151",
        align: "center",
        fixedWidth: btnWidth,
        padding: { top: 9, bottom: 9 }
      });
      text.setOrigin(0.5).setDepth(100);
      text.setInteractive({ useHandCursor: true });
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
    this.rootMenuItems.forEach((item) => item.setVisible(false));

    const startY = this.scale.height * 0.72;
    const spacing = 24;
    gameState.team.forEach((mon, index) => {
      const statusText = mon.status !== "none" ? ` [${getStatusDisplayText(mon.status)}]` : "";
      const label = `${mon.nickname || mon.name} Lv${mon.level} (${mon.hp}/${mon.maxHp})${statusText}`;
      const isDisabled = index === this.playerIndex || mon.hp <= 0;
      const text = this.add.text(32, startY + index * spacing, label, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: isDisabled ? "#6b7280" : "#f9fafb",
        backgroundColor: "#374151",
        padding: { left: 6, right: 6, top: 2, bottom: 2 }
      });
      text.setDepth(100);
      text.setInteractive({ useHandCursor: true });
      if (!isDisabled) {
        text.on("pointerdown", () => this.handleSwitch(index));
        text.on("pointerover", () => text.setStyle({ backgroundColor: "#4b5563" }));
        text.on("pointerout", () => text.setStyle({ backgroundColor: "#374151" }));
      }
      this.switchMenuItems.push(text);
    });

    const backText = this.add.text(32, startY + gameState.team.length * spacing + 6, "Back", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#f9fafb",
      backgroundColor: "#374151",
      padding: { left: 6, right: 6, top: 2, bottom: 2 }
    });
    backText.setDepth(100);
    backText.setInteractive({ useHandCursor: true });
    backText.on("pointerdown", () => this.closeSwitchMenu());
    this.switchMenuItems.push(backText);
  }

  private closeSwitchMenu(): void {
    this.switchMenuOpen = false;
    this.switchMenuItems.forEach((item) => item.destroy());
    this.switchMenuItems = [];
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

  private async handleEnemyFainted(): Promise<void> {
    // Faint animation - fall down and fade
    await this.showFaintAnimation(this.enemySprite!);
    this.setMessage(`${this.enemyMon.name} fainted!`);
    await this.wait(500);

    // Award experience
    const expGain = calculateExpGain(this.enemyMon.speciesId, this.enemyMon.level, this.isTrainerBattle);
    const result = gainExp(this.playerMon, expGain);

    this.setMessage(`${this.playerMon.name} gained ${expGain} EXP!`);
    this.updateHpText();
    await this.wait(600);

    // Handle level up
    if (result.levelsGained > 0) {
      Sound.playLevelUp();
      this.setMessage(`${this.playerMon.name} grew to level ${this.playerMon.level}!`);
      await this.showLevelUpAnimation();
      await this.wait(800);

      // Handle new moves
      for (const newMoveId of result.newMoves) {
        const moveName = MOVES[newMoveId]?.name ?? newMoveId;
        Sound.playMenuSelect();
        this.setMessage(`${this.playerMon.name} learned ${moveName}!`);
        await this.wait(800);
      }

      // Handle evolution
      if (result.evolved && result.newName) {
        Sound.playEvolution();
        await this.showEvolutionAnimation(result.oldName!, result.newName);
        this.updatePlayerSprite();
        // Mark the new species as caught in pokedex
        markSeen(gameState, this.playerMon.speciesId);
      }
    }

    // Check for next enemy
    if (this.enemyIndex < this.enemyTeam.length - 1) {
      this.enemyIndex += 1;
      this.enemyMon = this.enemyTeam[this.enemyIndex];
      this.setMessage(`${this.trainerName} sent out ${this.enemyMon.name}!`);
      this.updateEnemySprite();
      await this.showEntranceAnimation(this.enemySprite!, false);
      await this.wait(300);
      this.busy = false;
      return;
    }

    this.endBattle("victory");
  }

  private async showLevelUpAnimation(): Promise<void> {
    // Create sparkle effect
    for (let i = 0; i < 8; i++) {
      const sparkle = this.add.circle(
        this.playerSprite!.x + (Math.random() - 0.5) * 80,
        this.playerSprite!.y + (Math.random() - 0.5) * 80,
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

    // Instructions text
    const instructions = this.add.text(this.scale.width / 2, this.scale.height - 60,
      "Drag to aim • tap THROW (or arrow keys + SPACE)", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#fbbf24",
        backgroundColor: "#1e293b",
        padding: { left: 12, right: 12, top: 6, bottom: 6 }
      }).setOrigin(0.5).setDepth(100);
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
      caught = baseChance || Math.random() < 0.3; // Extra 30% chance on perfect
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
      this.setMessage("Cannot run from a trainer battle!");
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
    this.setMessage(`Go ${this.playerMon.nickname || this.playerMon.name}!`);
    this.updatePlayerSprite();
    await this.wait(400);

    const enemyMove = this.pickEnemyMove();
    await this.executeEnemyTurn(enemyMove);
    if (await this.resolvePlayerFaint()) return;
    this.busy = false;
  }

  private async executeMove(attacker: PokemonInstance, defender: PokemonInstance, moveId: string): Promise<void> {
    const move = MOVES[moveId];
    if (!move) {
      this.setMessage(`${attacker.name} has no move!`);
      await this.wait(400);
      return;
    }

    this.setMessage(`${attacker.name} used ${move.name}!`);
    await this.wait(450);

    if (!rollAccuracy(moveId, attacker)) {
      Sound.playMiss();
      this.setMessage("The move missed!");
      await this.wait(400);
      return;
    }

    const result = calculateDamage(attacker, defender, moveId);
    const moveType = MOVES[moveId]?.type || "normal";

    // Show attack animation with type-based effects
    if (attacker === this.playerMon) {
      await this.showAttackAnimation(this.playerSprite!, this.enemySprite!, result.isCritical, moveType);
    } else {
      await this.showAttackAnimation(this.enemySprite!, this.playerSprite!, result.isCritical, moveType);
    }

    defender.hp = Math.max(0, defender.hp - result.damage);
    this.updateHpText();

    if (result.isCritical) {
      this.setMessage("A critical hit!");
      await this.wait(400);
    }

    if (result.effectivenessText) {
      this.setMessage(result.effectivenessText);
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
        sprite.x + (Math.random() - 0.5) * 60,
        originalY + (Math.random() - 0.5) * 40,
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
    const moves = this.enemyMon.moves.filter(m => MOVES[m]);
    if (moves.length === 0) return this.enemyMon.moves[0] ?? "tackle";

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
      return effectiveMoves[Math.floor(Math.random() * effectiveMoves.length)];
    }

    return moves[Math.floor(Math.random() * moves.length)];
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

    this.enemyHpText.setText(
      `${this.enemyMon.name} Lv${this.enemyMon.level}\nHP: ${this.enemyMon.hp}/${this.enemyMon.maxHp}`
    );
    this.enemyStatusText.setText(enemyStatusStr);
    if (this.enemyMon.status !== "none") {
      this.enemyStatusText.setColor(`#${getStatusColor(this.enemyMon.status).toString(16)}`);
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

    // Input display (shows typed nickname)
    let currentName = "";
    const inputDisplay = this.add.text(centerX, centerY - 20, "_", {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#f8fafc",
      backgroundColor: "#374151",
      padding: { left: 16, right: 16, top: 8, bottom: 8 }
    }).setOrigin(0.5);
    this.namingElements.push(inputDisplay);

    // Instructions
    const instructions = this.add.text(centerX, centerY + 30, "Type a nickname (1-12 characters)", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#94a3b8"
    }).setOrigin(0.5);
    this.namingElements.push(instructions);

    // Keyboard input handler
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        // Confirm name
        this.input.keyboard?.off("keydown", keyHandler);
        this.finishCatch(currentName || undefined);
      } else if (event.key === "Escape") {
        // Keep default name
        this.input.keyboard?.off("keydown", keyHandler);
        this.finishCatch(undefined);
      } else if (event.key === "Backspace") {
        currentName = currentName.slice(0, -1);
        inputDisplay.setText(currentName || "_");
      } else if (event.key.length === 1 && currentName.length < 12) {
        // Only allow alphanumeric characters and some basic punctuation
        if (/^[a-zA-Z0-9 \-'!?.]$/.test(event.key)) {
          currentName += event.key;
          inputDisplay.setText(currentName);
        }
      }
    };
    this.input.keyboard?.on("keydown", keyHandler);

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
    confirmBtn.on("pointerdown", () => {
      this.input.keyboard?.off("keydown", keyHandler);
      this.finishCatch(currentName || undefined);
    });
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
    skipBtn.on("pointerdown", () => {
      this.input.keyboard?.off("keydown", keyHandler);
      this.finishCatch(undefined);
    });
    this.namingElements.push(skipBtn);

    // Hint text
    const hint = this.add.text(centerX, centerY + 120, "[Enter] Confirm  |  [Esc] Skip", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#6b7280"
    }).setOrigin(0.5);
    this.namingElements.push(hint);
  }

  private async finishCatch(nickname?: string): Promise<void> {
    // Clean up naming screen
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

    this.events.emit("battle-complete", { result, wildId: this.wildId });
    this.scene.stop();
  }
}
