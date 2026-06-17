import Phaser from "phaser";
import { BIOMES } from "../data/biomes";
import { SPECIES } from "../data/species";
import type { LandmarkData, RegionData, TownData, PortalData } from "../data/regions";
import { gameState } from "../game/store";
import {
  WORLD_SCALE,
  addToTeam,
  addToBox,
  getRegion,
  healTeam,
  makePokemon,
  makeWildPokemon,
  randomLevel,
  usePotion,
  useRevive,
  generateNpcTrainers,
  generateEliteFourTrainers,
  generateHiddenItems,
  collectItem,
  checkItemRespawns,
  getPokedexCount,
  NpcTrainer,
  HiddenItem,
  RivalEncounter,
  PokemonInstance,
  markCaught,
  generateRivalEncounters,
  getRivalTeam,
  HELD_ITEMS
} from "../game/state";
import { pickWeighted } from "../game/utils";
import * as Sound from "../game/sound";
import { saveGame, loadGame } from "../game/persistence";
import { TouchControls } from "../game/touch";

type WildSprite = Phaser.Physics.Arcade.Sprite & { wildId: string };

export default class Overworld extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private player!: Phaser.Physics.Arcade.Sprite;
  private zoneGraphics!: Phaser.GameObjects.Graphics;
  private routeGraphics!: Phaser.GameObjects.Graphics;
  private poiGraphics!: Phaser.GameObjects.Graphics;
  private propGraphics!: Phaser.GameObjects.Graphics;
  private oceanGraphics!: Phaser.GameObjects.Graphics;
  private worldBounds = { x: 0, y: 0, width: 0, height: 0 };
  private propBodies!: Phaser.Physics.Arcade.StaticGroup;
  private hudText!: Phaser.GameObjects.Text;
  private mapContainer?: Phaser.GameObjects.Container;
  private mapGraphics?: Phaser.GameObjects.Graphics;
  private mapPlayerMarker?: Phaser.GameObjects.Arc;
  private mapText!: Phaser.GameObjects.Text;
  private wildSprites: Map<string, WildSprite> = new Map();
  private trainerSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private itemSprites: Map<string, Phaser.GameObjects.Arc> = new Map();
  private rivalSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private rivalEncounters: RivalEncounter[] = [];
  private encounterCooldown = 0;
  private props: Array<{ x: number; y: number; type: string; variant: number; scale: number }> = [];
  private mapOpen = false;
  private starterOpen = false;
  private starterOverlay?: Phaser.GameObjects.Rectangle;
  private starterText: Phaser.GameObjects.GameObject[] = [];
  private keyE?: Phaser.Input.Keyboard.Key;
  private keyH?: Phaser.Input.Keyboard.Key;
  private keyP?: Phaser.Input.Keyboard.Key;
  private keyT?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;
  private keyR?: Phaser.Input.Keyboard.Key;
  private keyL?: Phaser.Input.Keyboard.Key;
  private teamOpen = false;
  private teamOverlay?: Phaser.GameObjects.Rectangle;
  private teamText: Phaser.GameObjects.Text[] = [];
  private pokedexOpen = false;
  private pokedexOverlay?: Phaser.GameObjects.Rectangle;
  private pokedexText: Phaser.GameObjects.Text[] = [];
  private notificationText?: Phaser.GameObjects.Text;
  private notificationTimer = 0;
  private xpBoostActive = false;
  private xpBoostTimer = 0;
  private powerSpotCooldowns: Map<string, number> = new Map();
  private powerSpotEffects: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private ambientParticles: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private isPaused = false;
  private pauseOverlay?: Phaser.GameObjects.Rectangle;
  private pauseText: Phaser.GameObjects.Text[] = [];
  private portalSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private portalTransitioning = false;
  private touch!: TouchControls;
  private interactPressed = false;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private battleStarting = false;
  private walkTime = 0;
  private playerBaseScale = 1;
  private vignette?: Phaser.GameObjects.Graphics;
  private martOpen = false;
  private martOverlay?: Phaser.GameObjects.Rectangle;
  private martElements: Phaser.GameObjects.GameObject[] = [];
  private tutorialElements: Phaser.GameObjects.GameObject[] = [];
  // Elite Four
  private e4CooldownActive = false;
  private championOverlay?: Phaser.GameObjects.Rectangle;
  private championElements: Phaser.GameObjects.GameObject[] = [];
  // Box tab for team screen
  private teamTab: "team" | "box" = "team";
  private teamSelectedMon: { source: "team" | "box"; index: number } | null = null;

  constructor() {
    super("Overworld");
  }

  create(): void {
    const region = getRegion(gameState);
    const bounds = this.getWorldBounds(region);
    this.worldBounds = bounds;

    this.physics.world.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);

    this.oceanGraphics = this.add.graphics();
    this.oceanGraphics.setDepth(-200);
    this.zoneGraphics = this.add.graphics();
    this.routeGraphics = this.add.graphics();
    this.poiGraphics = this.add.graphics();
    this.propGraphics = this.add.graphics();
    this.propBodies = this.physics.add.staticGroup();
    this.drawOceanBackground(region);
    this.drawZones(region);
    this.drawRoutes(region);
    this.drawPointsOfInterest(region);

    if (gameState.wildMons.length === 0) {
      this.spawnWildMons(region);
    }
    if (this.props.length === 0) {
      this.spawnProps(region);
    }

    // Initialize NPC trainers if not already done (upgrade to 12 if old save has only 6)
    if (gameState.npcTrainers.length < 12) {
      gameState.npcTrainers = generateNpcTrainers();
    }

    // Initialize Elite Four trainers if not already done
    if (gameState.e4Trainers == null || gameState.e4Trainers.length === 0) {
      gameState.e4Trainers = generateEliteFourTrainers();
    }
    if (gameState.e4Progress == null) gameState.e4Progress = 0;

    // Ensure new inventory fields exist for old saves
    if (gameState.inventory.oranberry == null) gameState.inventory.oranberry = 0;
    if (gameState.inventory.luckyegg == null) gameState.inventory.luckyegg = 0;
    if (gameState.inventory.shellbell == null) gameState.inventory.shellbell = 0;

    // Initialize hidden items if not already done
    if (gameState.hiddenItems.length === 0) {
      gameState.hiddenItems = generateHiddenItems();
    }

    // Initialize rival encounters
    this.rivalEncounters = generateRivalEncounters();

    // Create ambient particle effects for each zone
    this.createAmbientEffects(region);
    this.createWeatherEffect(region);
    this.showNotification("📍 " + region.name, 2500);

    const startZone = region.zones[0];
    const startX = startZone.x * WORLD_SCALE;
    const startY = startZone.y * WORLD_SCALE;
    // Fixed depths for the ground layers so entities (depth = y) always sort above them
    this.zoneGraphics.setDepth(-100);
    this.routeGraphics.setDepth(-90);
    this.poiGraphics.setDepth(-80);
    this.propGraphics.setDepth(-70);

    const playerTexture = this.textures.exists("trainer-ash") ? "trainer-ash" : "player-fallback";
    this.playerShadow = this.add.ellipse(startX, startY, 40, 14, 0x000000, 0.28);
    this.player = this.physics.add.sprite(startX, startY, playerTexture);
    this.applyDisplayHeight(this.player, 64);
    this.playerBaseScale = this.player.scaleY;
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.propBodies);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.setupCameraZoom();
    this.scale.on("resize", this.setupCameraZoom, this);
    this.createVignette();
    this.scale.on("resize", this.createVignette, this);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyE = this.input.keyboard!.addKey("E");
    this.keyH = this.input.keyboard!.addKey("H");
    this.keyP = this.input.keyboard!.addKey("P");
    this.keyT = this.input.keyboard!.addKey("T");
    this.keyD = this.input.keyboard!.addKey("D");
    this.keyR = this.input.keyboard!.addKey("R");
    this.keyL = this.input.keyboard!.addKey("L");

    this.hudText = this.add.text(16, 16, "", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#e8e8e8",
      backgroundColor: "#0f172a80",
      padding: { left: 8, right: 8, top: 4, bottom: 4 }
    });
    this.hudText.setScrollFactor(0);

    // Notification text for item pickups etc.
    this.notificationText = this.add.text(this.scale.width / 2, 80, "", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#fbbf24",
      backgroundColor: "#0f172a",
      padding: { left: 12, right: 12, top: 8, bottom: 8 }
    });
    this.notificationText.setScrollFactor(0).setOrigin(0.5).setVisible(false);

    // On-screen touch controls (only created on touch / coarse-pointer devices)
    this.touch = new TouchControls(this, [
      { id: "interact", label: "A", primary: true, color: 0x16a34a },
      { id: "item", label: "+", color: 0x0ea5e9 },
      { id: "team", label: "T", color: 0x7c3aed },
      { id: "map", label: "M", color: 0xb45309 },
      { id: "menu", label: "☰", color: 0x334155 }
    ]);

    // Hide controls whenever the scene is paused (e.g. a battle launches) and
    // restore them when it resumes.
    this.events.on(Phaser.Scenes.Events.PAUSE, () => this.touch?.setVisible(false));
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      if (!this.starterOpen && !this.isPaused) {
        this.touch?.setVisible(true);
        // Auto-save after battle ends
        saveGame();
        this.showNotification("💾 Auto-saved", 1200);
      }
    });

    this.input.keyboard!.on("keydown-M", () => {
      if (this.teamOpen || this.pokedexOpen || this.starterOpen) return;
      this.mapOpen = !this.mapOpen;
      if (this.mapOpen) {
        this.openVisualMap();
      } else {
        this.closeVisualMap();
      }
    });
    this.input.keyboard!.on("keydown-T", () => {
      if (this.mapOpen || this.pokedexOpen || this.starterOpen) return;
      if (this.teamOpen) {
        this.closeTeamScreen();
      } else {
        this.openTeamScreen();
      }
    });
    this.input.keyboard!.on("keydown-D", () => {
      if (this.mapOpen || this.teamOpen || this.starterOpen) return;
      if (this.pokedexOpen) {
        this.closePokedex();
      } else {
        this.openPokedex();
      }
    });
    this.input.keyboard!.on("keydown-ESC", () => {
      if (this.starterOpen) return;
      this.togglePause();
    });
    this.input.keyboard!.on("keydown-S", () => {
      if (this.starterOpen || this.mapOpen || this.teamOpen || this.pokedexOpen) return;
      if (saveGame()) {
        Sound.playMenuSelect();
        this.showNotification("Game Saved!", 1500);
      } else {
        this.showNotification("Save Failed!", 1500);
      }
    });
    this.input.keyboard!.on("keydown-F1", () => {
      if (this.starterOpen) return;
      if (loadGame()) {
        Sound.playMenuSelect();
        this.showNotification("Game Loaded!", 1500);
        this.time.delayedCall(500, () => {
          this.scene.restart();
        });
      } else {
        this.showNotification("No save data found!", 1500);
      }
    });

    this.createWildSprites();
    this.createTrainerSprites();
    this.createItemSprites();
    this.createRivalSprites();
    this.createPortalSprites();

    // Check if we came through a portal and need to set position
    if (gameState.portalTargetX !== undefined && gameState.portalTargetY !== undefined) {
      this.player.setPosition(gameState.portalTargetX * WORLD_SCALE, gameState.portalTargetY * WORLD_SCALE);
      gameState.portalTargetX = undefined;
      gameState.portalTargetY = undefined;
    }

    if (gameState.team.length === 0) {
      this.openStarterSelect();
    }

    if (!gameState.tutorialSeen) {
      this.showTutorial();
    }
  }

  update(): void {
    if (this.starterOpen || this.isPaused) {
      return;
    }

    if (this.battleStarting) return;

    this.interactPressed = false;
    this.processTouchButtons();

    // Handle notification timer
    if (this.notificationTimer > 0) {
      this.notificationTimer -= this.game.loop.delta;
      if (this.notificationTimer <= 0) {
        this.notificationText?.setVisible(false);
      }
    }

    // Handle XP boost timer
    if (this.xpBoostActive && this.xpBoostTimer > 0) {
      this.xpBoostTimer -= this.game.loop.delta;
      if (this.xpBoostTimer <= 0) {
        this.xpBoostActive = false;
        gameState.xpMultiplier = 1;
        this.showNotification("XP boost has worn off!");
      }
    }

    // Update total play time and check for item respawns
    gameState.totalPlayTime += this.game.loop.delta;
    const respawnedItems = checkItemRespawns(gameState);
    if (respawnedItems.length > 0) {
      this.createItemSpritesForIds(respawnedItems);
    }

    // Update power spot cooldowns
    for (const [spotId, cooldown] of this.powerSpotCooldowns.entries()) {
      if (cooldown > 0) {
        this.powerSpotCooldowns.set(spotId, cooldown - this.game.loop.delta);
      }
    }

    this.updatePlayer();
    this.updateWildMons();
    this.updatePoiHud();
    this.handleHealing();
    this.checkTrainerEncounters();
    this.checkRivalEncounters();
    this.checkItemPickups();
    this.checkPowerSpots();
    this.checkLeagueEntrance();
    this.checkPortals();

    if (this.encounterCooldown > 0) {
      this.encounterCooldown -= this.game.loop.delta;
    }
  }

  private showNotification(message: string, duration = 2000): void {
    if (this.notificationText) {
      this.notificationText.setText(message).setVisible(true);
      this.notificationTimer = duration;
    }
  }

  private processTouchButtons(): void {
    if (!this.touch || !this.touch.active) return;

    if (this.touch.wasButtonPressed("interact")) {
      this.interactPressed = true;
    }
    if (this.touch.wasButtonPressed("item")) {
      if (usePotion(gameState)) {
        Sound.playHeal();
        this.showNotification("Used Potion!");
      } else {
        this.showNotification("No potions left!");
      }
    }
    if (this.touch.wasButtonPressed("team")) {
      if (this.teamOpen) {
        this.closeTeamScreen();
      } else if (!this.mapOpen && !this.pokedexOpen) {
        this.openTeamScreen();
      }
    }
    if (this.touch.wasButtonPressed("map")) {
      if (this.mapOpen) {
        this.closeVisualMap();
      } else if (!this.teamOpen && !this.pokedexOpen) {
        this.mapOpen = true;
        this.openVisualMap();
      }
    }
    if (this.touch.wasButtonPressed("menu")) {
      this.togglePause();
    }
  }

  private updatePlayer(): void {
    const speed = 180;
    let velocityX = 0;
    let velocityY = 0;

    if (this.cursors.left.isDown) velocityX = -speed;
    else if (this.cursors.right.isDown) velocityX = speed;

    if (this.cursors.up.isDown) velocityY = -speed;
    else if (this.cursors.down.isDown) velocityY = speed;

    // Virtual joystick (touch) overrides when engaged.
    if (this.touch && this.touch.active) {
      const axis = this.touch.getAxis();
      if (axis.x !== 0 || axis.y !== 0) {
        velocityX = axis.x * speed;
        velocityY = axis.y * speed;
      }
    }

    if (velocityX !== 0 && velocityY !== 0) {
      const length = Math.hypot(velocityX, velocityY);
      velocityX = (velocityX / length) * speed;
      velocityY = (velocityY / length) * speed;
    }

    this.player.setVelocity(velocityX, velocityY);

    const moving = velocityX !== 0 || velocityY !== 0;
    // Face the direction of horizontal travel
    if (velocityX < 0) this.player.setFlipX(true);
    else if (velocityX > 0) this.player.setFlipX(false);

    // Walk bob: gentle squash-and-bounce while moving
    if (moving) {
      this.walkTime += this.game.loop.delta;
      const bob = Math.sin(this.walkTime * 0.018);
      this.player.setScale(
        this.playerBaseScale * (1 - bob * 0.04),
        this.playerBaseScale * (1 + bob * 0.05)
      );
    } else {
      this.walkTime = 0;
      this.player.setScale(this.playerBaseScale, this.playerBaseScale);
    }

    // Keep the player's shadow under its feet
    if (this.playerShadow) {
      this.playerShadow.setPosition(this.player.x, this.player.y + 26);
      this.playerShadow.setScale(moving ? 0.9 : 1);
    }
  }

  private updateWildMons(): void {
    const region = getRegion(gameState);
    for (const wild of gameState.wildMons) {
      const zone = region.zones.find((z) => z.id === wild.zoneId);
      if (!zone) continue;
      const jitter = 0.3;
      wild.vx += (Math.random() - 0.5) * jitter;
      wild.vy += (Math.random() - 0.5) * jitter;
      const speed = Math.hypot(wild.vx, wild.vy) || 0.0001;
      const maxSpeed = 1.2;
      if (speed > maxSpeed) {
        wild.vx = (wild.vx / speed) * maxSpeed;
        wild.vy = (wild.vy / speed) * maxSpeed;
      }

      const zoneX = zone.x * WORLD_SCALE;
      const zoneY = zone.y * WORLD_SCALE;
      const zoneR = zone.r * WORLD_SCALE;
      const dx = wild.x - zoneX;
      const dy = wild.y - zoneY;
      const dist = Math.hypot(dx, dy) || 0.0001;
      if (dist > zoneR - 30) {
        wild.vx -= (dx / dist) * 0.6;
        wild.vy -= (dy / dist) * 0.6;
      }

      wild.x += wild.vx;
      wild.y += wild.vy;

      const sprite = this.wildSprites.get(wild.id);
      if (sprite) {
        sprite.setPosition(wild.x, wild.y);
        sprite.setFlipX(wild.vx < 0);
        const shadow = (sprite as unknown as { shadow?: Phaser.GameObjects.Ellipse }).shadow;
        if (shadow) {
          shadow.setPosition(wild.x, wild.y + 20);
        }
      }

      if (this.encounterCooldown <= 0) {
        const distanceToPlayer = Phaser.Math.Distance.Between(this.player.x, this.player.y, wild.x, wild.y);
        if (distanceToPlayer < 32) {
          this.startBattle(wild.id);
          break;
        }
      }
    }
  }

  private checkTrainerEncounters(): void {
    if (this.encounterCooldown > 0) return;

    for (const trainer of gameState.npcTrainers) {
      const trainerX = trainer.x * WORLD_SCALE;
      const trainerY = trainer.y * WORLD_SCALE;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, trainerX, trainerY);

      if (distance < 60) {
        const alreadyDefeated = !!gameState.defeatedTrainers[trainer.id];

        // Rematch: available when player has 2+ badges and trainer already defeated
        if (alreadyDefeated && gameState.badges.length >= 2) {
          this.showNotification(`${trainer.name}: "I've been training! Rematch time!"`, 2000);
          this.startTrainerRematch(trainer);
          break;
        } else if (!alreadyDefeated) {
          // Show "!" indicator and start battle
          this.showNotification(`${trainer.name}: "${trainer.dialogue}"`);
          this.startTrainerBattle(trainer);
          break;
        }
      }
    }
  }

  private checkItemPickups(): void {
    for (const item of gameState.hiddenItems) {
      if (item.found) continue;

      const itemX = item.x * WORLD_SCALE;
      const itemY = item.y * WORLD_SCALE;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, itemX, itemY);

      if (distance < 30) {
        const result = collectItem(gameState, item.id);
        if (result) {
          Sound.playItemGet();
          const itemName = result.item === "pokeball" ? "Poke Ball" :
            result.item === "greatball" ? "Great Ball" :
            result.item === "ultraball" ? "Ultra Ball" :
            result.item === "potion" ? "Potion" :
            result.item === "superpotion" ? "Super Potion" :
            result.item === "revive" ? "Revive" : result.item;
          this.showNotification(`Found ${result.amount}x ${itemName}!`);

          // Remove item sprite
          const sprite = this.itemSprites.get(item.id);
          if (sprite) {
            sprite.destroy();
            this.itemSprites.delete(item.id);
          }
        }
      }
    }
  }

  private checkPowerSpots(): void {
    const region = getRegion(gameState);
    const playerX = this.player.x;
    const playerY = this.player.y;

    for (const spot of region.powerSpots) {
      const spotX = spot.x * WORLD_SCALE;
      const spotY = spot.y * WORLD_SCALE;
      const distance = Phaser.Math.Distance.Between(playerX, playerY, spotX, spotY);

      if (distance < 35) {
        const cooldown = this.powerSpotCooldowns.get(spot.id) || 0;
        if (cooldown <= 0) {
          this.activatePowerSpot(spot);
          this.powerSpotCooldowns.set(spot.id, 30000); // 30 second cooldown
        }
      }
    }
  }

  private activatePowerSpot(spot: { id: string; name: string; effect: string; x: number; y: number; color: number }): void {
    Sound.playMenuSelect();

    switch (spot.effect) {
      case "heal": {
        // Heal all Pokemon by 30%
        gameState.team.forEach(mon => {
          const healAmount = Math.floor(mon.maxHp * 0.3);
          mon.hp = Math.min(mon.maxHp, mon.hp + healAmount);
        });
        Sound.playHeal();
        this.showNotification(`${spot.name}: Your Pokemon feel refreshed!`, 2500);
        break;
      }
      case "xpboost": {
        // Give 2x XP for 60 seconds
        this.xpBoostActive = true;
        this.xpBoostTimer = 60000;
        gameState.xpMultiplier = 2;
        this.showNotification(`${spot.name}: 2x XP boost for 60 seconds!`, 2500);
        break;
      }
      case "rarepokemon": {
        // Spawn a rare Pokemon nearby
        this.spawnRarePokemon(spot.x, spot.y);
        this.showNotification(`${spot.name}: A rare Pokemon appeared!`, 2500);
        Sound.playEncounter();
        break;
      }
    }
  }

  private spawnRarePokemon(spotX: number, spotY: number): void {
    const rarePool = ["eevee", "dratini", "lapras", "pikachu", "abra"];
    const speciesId = rarePool[Math.floor(Math.random() * rarePool.length)];
    const level = 10 + Math.floor(Math.random() * 10);

    const mon = makeWildPokemon(speciesId, level, "sanctuary");
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 30;
    mon.x = spotX * WORLD_SCALE + Math.cos(angle) * dist;
    mon.y = spotY * WORLD_SCALE + Math.sin(angle) * dist;
    gameState.wildMons.push(mon);

    // Create sprite for the new Pokemon
    const textureKey = this.textures.exists(`pokemon-${mon.speciesId}`)
      ? `pokemon-${mon.speciesId}`
      : "wild-fallback";
    const sprite = this.physics.add.sprite(mon.x, mon.y, textureKey) as WildSprite;
    this.applyDisplayHeight(sprite, 48);
    sprite.wildId = mon.id;
    this.wildSprites.set(mon.id, sprite);

    // Add sparkle effect to indicate rarity
    this.tweens.add({
      targets: sprite,
      alpha: { from: 0.5, to: 1 },
      scale: { from: 0.5, to: sprite.scaleX },
      duration: 500,
      ease: "Back.easeOut"
    });
  }

  private checkLeagueEntrance(): void {
    if (gameState.isChampion || this.e4CooldownActive) return;

    // Require 3 badges
    const leagueX = 45 * WORLD_SCALE;
    const leagueY = 35 * WORLD_SCALE;
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, leagueX, leagueY);

    if (distance < 80) {
      if (gameState.badges.length < 3) {
        // Show "need badges" hint once per approach
        if (!this.e4CooldownActive) {
          this.showNotification("You need all 3 Gym Badges first!", 2500);
          this.e4CooldownActive = true;
          this.time.delayedCall(3000, () => { this.e4CooldownActive = false; });
        }
        return;
      }

      if ((this.keyL && this.input.keyboard?.checkDown(this.keyL, 500)) || this.interactPressed) {
        this.interactPressed = false;

        if (gameState.e4Progress >= 4) {
          // All 4 defeated — show champion screen
          this.showChampionCelebration();
          return;
        }

        // Start next E4 battle
        const battleNum = gameState.e4Progress + 1;
        this.showNotification(`Elite Four Battle ${battleNum} of 4!`, 2000);
        this.time.delayedCall(500, () => this.startE4Battle(gameState.e4Progress));
      }
    }
  }

  private startE4Battle(index: number): void {
    if (!gameState.e4Trainers || gameState.e4Trainers.length === 0) {
      gameState.e4Trainers = generateEliteFourTrainers();
    }
    const trainer = gameState.e4Trainers[index];
    if (!trainer) return;

    this.e4CooldownActive = true;
    this.encounterCooldown = 1500;
    this.scene.pause();
    this.scene.launch("Battle", {
      type: "elite",
      trainerId: trainer.id,
      trainerName: trainer.name,
      trainerTeam: trainer.team
    });

    const battleScene = this.scene.get("Battle");
    battleScene.events.once("battle-complete", (payload: { result: string }) => {
      if (payload.result === "victory") {
        gameState.e4Progress = index + 1;
        if (gameState.e4Progress >= 4) {
          gameState.eliteFourDefeated = true;
          gameState.isChampion = true;
          this.scene.resume();
          Sound.playOverworldMusic();
          this.time.delayedCall(300, () => this.showChampionCelebration());
        } else {
          const next = gameState.e4Progress + 1;
          this.showNotification(`Victory! Next: Elite Four battle ${next} of 4`, 2500);
          this.scene.resume();
          Sound.playOverworldMusic();
          this.e4CooldownActive = false;
        }
      } else if (payload.result === "defeat") {
        this.scene.resume();
        Sound.playOverworldMusic();
        this.handleBattleDefeat();
        this.e4CooldownActive = false;
      } else {
        this.scene.resume();
        Sound.playOverworldMusic();
        this.e4CooldownActive = false;
      }
    });
  }

  private showChampionCelebration(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const overlay = this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.85)
      .setScrollFactor(0).setDepth(1200).setInteractive();
    this.championElements.push(overlay);

    const gold = this.add.rectangle(centerX, centerY, 560, 320, 0x1a1000, 1)
      .setScrollFactor(0).setDepth(1201).setStrokeStyle(4, 0xffd700);
    this.championElements.push(gold);

    const title = this.add.text(centerX, centerY - 110, "CHAMPION!", {
      fontFamily: "monospace",
      fontSize: "48px",
      color: "#ffd700",
      fontStyle: "bold"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1202);
    this.championElements.push(title);

    const sub = this.add.text(centerX, centerY - 40, "YOU ARE THE POKEMON CHAMPION!", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1202);
    this.championElements.push(sub);

    const desc = this.add.text(centerX, centerY + 20,
      "You defeated all four Elite Four members\nand claimed the title of Champion!", {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#fbbf24",
      align: "center",
      lineSpacing: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1202);
    this.championElements.push(desc);

    // Sparkle animation
    for (let i = 0; i < 20; i++) {
      this.time.delayedCall(i * 150, () => {
        const sx = centerX + (Math.random() - 0.5) * 480;
        const sy = centerY + (Math.random() - 0.5) * 260;
        const star = this.add.circle(sx, sy, 4, 0xffd700)
          .setScrollFactor(0).setDepth(1203);
        this.tweens.add({
          targets: star,
          y: star.y - 40,
          alpha: 0,
          duration: 800,
          onComplete: () => star.destroy()
        });
      });
    }

    // Auto-close after 5 seconds
    this.time.delayedCall(5000, () => {
      this.championElements.forEach(el => (el as Phaser.GameObjects.GameObject).destroy());
      this.championElements = [];
    });

    Sound.playVictory();
  }

  private startTrainerBattle(trainer: NpcTrainer): void {
    this.encounterCooldown = 1500;
    this.scene.pause();
    this.scene.launch("Battle", {
      type: "trainer",
      trainerId: trainer.id,
      trainerName: trainer.name,
      trainerTeam: trainer.team
    });
    const battleScene = this.scene.get("Battle");
    battleScene.events.once("battle-complete", (payload: { result: string }) => {
      if (payload.result === "victory") {
        gameState.defeatedTrainers[trainer.id] = true;
        // Remove trainer sprite
        const sprite = this.trainerSprites.get(trainer.id);
        if (sprite) {
          sprite.destroy();
          this.trainerSprites.delete(trainer.id);
        }
      } else if (payload.result === "defeat") {
        this.handleBattleDefeat();
      }
      this.scene.resume();
      Sound.playOverworldMusic();
    });
  }

  private startTrainerRematch(trainer: NpcTrainer): void {
    // Rematch team is 5 levels higher than original
    const rematchTeam = trainer.team.map(m => ({ speciesId: m.speciesId, level: m.level + 5 }));
    this.encounterCooldown = 1500;
    this.scene.pause();
    this.scene.launch("Battle", {
      type: "trainer",
      trainerId: trainer.id + "-rematch",
      trainerName: trainer.name,
      trainerTeam: rematchTeam
    });
    const battleScene = this.scene.get("Battle");
    battleScene.events.once("battle-complete", (payload: { result: string }) => {
      if (payload.result === "victory") {
        this.showNotification(`${trainer.name}: "${trainer.dialogue}"`, 2500);
      } else if (payload.result === "defeat") {
        this.handleBattleDefeat();
      }
      this.scene.resume();
      Sound.playOverworldMusic();
    });
  }

  private startBattle(wildId: string): void {
    if (this.battleStarting) return;
    this.battleStarting = true;
    this.encounterCooldown = 1500;
    this.player.setVelocity(0, 0);
    this.cameras.main.flash(200, 255, 255, 255);
    this.cameras.main.shake(240, 0.012);
    this.time.delayedCall(300, () => this.doStartBattle(wildId));
  }

  private doStartBattle(wildId: string): void {
    this.battleStarting = false;
    this.scene.pause();
    this.scene.launch("Battle", { wildId, type: "wild" });
    const battleScene = this.scene.get("Battle");
    battleScene.events.once("battle-complete", (payload: { wildId: string }) => {
      if (!gameState.wildMons.find((m) => m.id === payload.wildId)) {
        const sprite = this.wildSprites.get(payload.wildId);
        if (sprite) {
          (sprite as unknown as { shadow?: Phaser.GameObjects.Ellipse }).shadow?.destroy();
          sprite.destroy();
          this.wildSprites.delete(payload.wildId);
        }
      }
      this.scene.resume();
      Sound.playOverworldMusic();
    });
  }

  private startGymBattle(gymId: string): void {
    this.encounterCooldown = 1500;
    this.scene.pause();
    this.scene.launch("Battle", { type: "gym", gymId });
    const battleScene = this.scene.get("Battle");
    battleScene.events.once("battle-complete", (payload: { result: string }) => {
      if (payload.result === "victory") {
        const region = getRegion(gameState);
        const gym = region.gyms.find(g => g.id === gymId);
        if (gym) {
          this.showNotification(`You earned the ${gym.badge}!`, 3000);
        }
      } else if (payload.result === "defeat") {
        this.handleBattleDefeat();
      }
      this.scene.resume();
      Sound.playOverworldMusic();
    });
  }

  private spawnWildMons(region: RegionData): void {
    const difficultyByRegion: Record<string, number> = {
      aurora: 1.0,
      "shadow-archipelago": 1.3,
      verdania: 1.1,
      solstice: 1.2,
      frostholm: 1.35,
      urbania: 1.5,
    };
    const regionMult = difficultyByRegion[region.id] ?? 1.0;

    region.zones.forEach((zone) => {
      const biome = BIOMES[zone.biome];
      const spawnCount = Math.floor(4 + zone.r * 0.3);
      for (let i = 0; i < spawnCount; i++) {
        const entry = pickWeighted(biome.spawns);
        const level = Math.min(100, Math.floor(randomLevel(entry.min, entry.max) * regionMult));
        const mon = makeWildPokemon(entry.id, level, zone.id);
        mon.x = (zone.x + (Math.random() * 2 - 1) * zone.r * 0.8) * WORLD_SCALE;
        mon.y = (zone.y + (Math.random() * 2 - 1) * zone.r * 0.8) * WORLD_SCALE;
        gameState.wildMons.push(mon);
      }
    });
  }

  private createWildSprites(): void {
    gameState.wildMons.forEach((wild) => {
      const textureKey = this.textures.exists(`pokemon-${wild.speciesId}`)
        ? `pokemon-${wild.speciesId}`
        : "wild-fallback";
      const sprite = this.physics.add.sprite(wild.x, wild.y, textureKey) as WildSprite;
      this.applyDisplayHeight(sprite, 48);
      sprite.wildId = wild.id;
      const shadow = this.makeShadow(wild.x, wild.y + 20, 32);
      (sprite as unknown as { shadow: Phaser.GameObjects.Ellipse }).shadow = shadow;
      this.wildSprites.set(wild.id, sprite);
    });
  }

  private createTrainerSprites(): void {
    gameState.npcTrainers.forEach((trainer) => {
      if (gameState.defeatedTrainers[trainer.id]) return;

      const x = trainer.x * WORLD_SCALE;
      const y = trainer.y * WORLD_SCALE;

      // Create trainer sprite using their specific sprite
      const textureKey = this.textures.exists(trainer.sprite) ? trainer.sprite : "trainer-youngster";
      this.makeShadow(x, y + 24, 36);
      const sprite = this.add.sprite(x, y, textureKey);
      this.applyDisplayHeight(sprite, 56);

      // Add exclamation mark above trainer
      const exclaim = this.add.text(x, y - 40, "!", {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#ff0000",
        fontStyle: "bold"
      }).setOrigin(0.5);

      // Animate the exclamation mark
      this.tweens.add({
        targets: exclaim,
        y: y - 50,
        duration: 500,
        yoyo: true,
        repeat: -1
      });

      this.trainerSprites.set(trainer.id, sprite);
    });
  }

  private createItemSprites(): void {
    gameState.hiddenItems.forEach((item) => {
      if (item.found) return;

      const x = item.x * WORLD_SCALE;
      const y = item.y * WORLD_SCALE;

      // Create sparkle effect for hidden items
      const sparkle = this.add.circle(x, y, 8, 0xfbbf24);
      sparkle.setAlpha(0.8);

      // Pulsing animation
      this.tweens.add({
        targets: sparkle,
        alpha: 0.3,
        scale: 1.3,
        duration: 800,
        yoyo: true,
        repeat: -1
      });

      this.itemSprites.set(item.id, sparkle);
    });
  }

  private createItemSpritesForIds(itemIds: string[]): void {
    for (const itemId of itemIds) {
      const item = gameState.hiddenItems.find(i => i.id === itemId);
      if (!item || item.found) continue;

      const x = item.x * WORLD_SCALE;
      const y = item.y * WORLD_SCALE;

      const sparkle = this.add.circle(x, y, 8, 0xfbbf24);
      sparkle.setAlpha(0.8);

      this.tweens.add({
        targets: sparkle,
        alpha: 0.3,
        scale: 1.3,
        duration: 800,
        yoyo: true,
        repeat: -1
      });

      this.itemSprites.set(item.id, sparkle);
    }
  }

  private createPortalSprites(): void {
    const region = getRegion(gameState);
    if (!region.portals) return;

    for (const portal of region.portals) {
      const x = portal.x * WORLD_SCALE;
      const y = portal.y * WORLD_SCALE;

      // Create container for portal effects
      const container = this.add.container(x, y);

      // Outer glow ring
      const outer = this.add.circle(0, 0, 35, portal.color, 0.3);
      // Middle ring
      const middle = this.add.circle(0, 0, 25, portal.color, 0.5);
      // Inner core
      const inner = this.add.circle(0, 0, 15, portal.color, 0.8);

      // Add swirl effect lines
      const swirl1 = this.add.arc(0, 0, 20, 0, 90, false, 0xffffff, 0.6);
      swirl1.setStrokeStyle(3, 0xffffff, 0.8);
      const swirl2 = this.add.arc(0, 0, 20, 180, 270, false, 0xffffff, 0.6);
      swirl2.setStrokeStyle(3, 0xffffff, 0.8);

      container.add([outer, middle, inner, swirl1, swirl2]);

      // Rotation animation for the whole portal
      this.tweens.add({
        targets: container,
        angle: 360,
        duration: 3000,
        repeat: -1,
        ease: 'Linear'
      });

      // Pulse animation for the rings
      this.tweens.add({
        targets: [outer, middle],
        scale: 1.2,
        alpha: 0.2,
        duration: 1500,
        yoyo: true,
        repeat: -1
      });

      // Add portal label
      const label = this.add.text(x, y + 50, portal.name, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#c4b5fd"
      }).setOrigin(0.5);

      this.portalSprites.set(portal.id, container);
    }
  }

  private checkPortals(): void {
    if (this.portalTransitioning) return;
    const region = getRegion(gameState);
    if (!region.portals) return;

    for (const portal of region.portals) {
      const portalX = portal.x * WORLD_SCALE;
      const portalY = portal.y * WORLD_SCALE;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, portalX, portalY);

      if (distance < 30) {
        this.triggerPortalTransition(portal);
        break;
      }
    }
  }

  private triggerPortalTransition(portal: PortalData): void {
    this.portalTransitioning = true;
    Sound.playMenuSelect();

    // Disable player movement
    this.player.setVelocity(0, 0);

    // Get player screen position
    const playerScreenX = this.player.x - this.cameras.main.scrollX;
    const playerScreenY = this.player.y - this.cameras.main.scrollY;

    // Create swirl overlay effect
    const overlay = this.add.graphics();
    overlay.setScrollFactor(0);
    overlay.setDepth(2000);

    const centerX = playerScreenX;
    const centerY = playerScreenY;

    // Animate swirl growing and player shrinking
    let frame = 0;
    const maxFrames = 60;

    // Shrink and spin the player
    this.tweens.add({
      targets: this.player,
      scaleX: 0,
      scaleY: 0,
      angle: 720,
      duration: 1200,
      ease: 'Cubic.easeIn'
    });

    const swirlTimer = this.time.addEvent({
      delay: 20,
      repeat: maxFrames,
      callback: () => {
        frame++;
        const progress = frame / maxFrames;

        overlay.clear();

        // Draw expanding swirl
        for (let i = 0; i < 6; i++) {
          const baseAngle = (progress * Math.PI * 4) + (i * Math.PI / 3);
          const radius = progress * 400;
          const armWidth = 30 + progress * 50;

          overlay.fillStyle(portal.color, 0.7 - progress * 0.3);

          // Draw spiral arm
          for (let j = 0; j < 20; j++) {
            const t = j / 20;
            const r = radius * t;
            const angle = baseAngle + t * Math.PI;
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            const size = armWidth * (1 - t * 0.5);
            overlay.fillCircle(x, y, size);
          }
        }

        // Central vortex
        overlay.fillStyle(0x000000, progress);
        overlay.fillCircle(centerX, centerY, 20 + progress * 100);
        overlay.fillStyle(portal.color, 0.8);
        overlay.fillCircle(centerX, centerY, 10 + progress * 30);
      }
    });

    // After animation, switch region
    this.time.delayedCall(1400, () => {
      // Clear wild Pokemon for the new region
      gameState.wildMons = [];

      // Set target position and region
      gameState.portalTargetX = portal.targetX;
      gameState.portalTargetY = portal.targetY;
      gameState.regionIndex = portal.targetRegionIndex;

      // Auto-save on portal transition
      saveGame();

      // Restart scene to load new region
      this.scene.restart();
    });
  }

  private createRivalSprites(): void {
    // Only show the next rival encounter that hasn't been defeated
    const nextBattleNumber = gameState.rivalBattles + 1;
    const nextEncounter = this.rivalEncounters.find(e => e.battleNumber === nextBattleNumber);

    if (!nextEncounter || gameState.rivalDefeated[nextEncounter.battleNumber]) return;
    if (!gameState.playerStarter) return; // Don't show rival until player has chosen starter

    const x = nextEncounter.x * WORLD_SCALE;
    const y = nextEncounter.y * WORLD_SCALE;

    // Create rival sprite with unique appearance
    const sprite = this.add.sprite(x, y, "trainer-rival");
    this.applyDisplayHeight(sprite, 60);

    // Add "!" indicator above rival
    const exclaim = this.add.text(x, y - 45, "!", {
      fontFamily: "monospace",
      fontSize: "28px",
      color: "#3b82f6",
      fontStyle: "bold"
    }).setOrigin(0.5);

    // Animate the exclamation mark
    this.tweens.add({
      targets: exclaim,
      y: y - 55,
      duration: 400,
      yoyo: true,
      repeat: -1
    });

    // Add name label
    const nameLabel = this.add.text(x, y + 35, "RIVAL", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#3b82f6",
      backgroundColor: "#1e293b",
      padding: { left: 4, right: 4, top: 2, bottom: 2 }
    }).setOrigin(0.5);

    this.rivalSprites.set(nextEncounter.id, sprite);
  }

  private checkRivalEncounters(): void {
    if (this.encounterCooldown > 0) return;
    if (!gameState.playerStarter) return;

    const nextBattleNumber = gameState.rivalBattles + 1;
    const encounter = this.rivalEncounters.find(e => e.battleNumber === nextBattleNumber);

    if (!encounter || gameState.rivalDefeated[encounter.battleNumber]) return;

    const rivalX = encounter.x * WORLD_SCALE;
    const rivalY = encounter.y * WORLD_SCALE;
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, rivalX, rivalY);

    if (distance < 50) {
      this.showNotification(`RIVAL: "${encounter.dialogue}"`, 3000);
      this.startRivalBattle(encounter);
    }
  }

  private startRivalBattle(encounter: RivalEncounter): void {
    this.encounterCooldown = 2000;
    this.scene.pause();

    const rivalTeam = getRivalTeam(gameState, encounter.battleNumber);

    this.scene.launch("Battle", {
      type: "rival",
      trainerId: encounter.id,
      trainerName: "Rival Blue",
      trainerTeam: rivalTeam
    });

    const battleScene = this.scene.get("Battle");
    battleScene.events.once("battle-complete", (payload: { result: string }) => {
      if (payload.result === "victory") {
        gameState.rivalDefeated[encounter.battleNumber] = true;
        gameState.rivalBattles = encounter.battleNumber;
        this.showNotification(`RIVAL: "${encounter.defeatDialogue}"`, 3000);

        // Remove rival sprite
        const sprite = this.rivalSprites.get(encounter.id);
        if (sprite) {
          sprite.destroy();
          this.rivalSprites.delete(encounter.id);
        }

        // Spawn next rival encounter if any
        this.time.delayedCall(1000, () => {
          this.createRivalSprites();
        });
      } else if (payload.result === "defeat") {
        // Teleport player to nearest Pokemon Center on defeat
        this.handleBattleDefeat();
      }
      this.scene.resume();
      Sound.playOverworldMusic();
    });
  }

  private findNearestTown(): TownData | null {
    const region = getRegion(gameState);
    let nearest: TownData | null = null;
    let minDist = Infinity;
    for (const town of region.towns) {
      if (!town.services.includes("center")) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        town.x * WORLD_SCALE, town.y * WORLD_SCALE
      );
      if (dist < minDist) {
        minDist = dist;
        nearest = town;
      }
    }
    return nearest;
  }

  private handleBattleDefeat(): void {
    const nearestTown = this.findNearestTown();
    if (nearestTown) {
      this.player.setPosition(nearestTown.x * WORLD_SCALE, nearestTown.y * WORLD_SCALE);
    }
    healTeam(gameState);
    this.showNotification("You rushed to the Pokemon Center...", 3000);
    this.encounterCooldown = 5000;
  }

  private drawZoneShape(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, shape: string, rotation: number): void {
    switch (shape) {
      case "ellipse": {
        g.save();
        g.translateCanvas(x, y);
        g.rotateCanvas(rotation);
        g.fillEllipse(0, 0, r * 1.4, r * 0.8);
        g.restore();
        break;
      }
      case "blob": {
        const seed = x * 1000 + y;
        const mainRx = r * (0.9 + 0.2 * Math.sin(seed));
        const mainRy = r * (0.9 + 0.2 * Math.cos(seed));
        g.fillEllipse(x, y, mainRx * 2, mainRy * 2);
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 + seed * 0.1;
          const dist = r * 0.6;
          const bumpX = x + Math.cos(angle) * dist;
          const bumpY = y + Math.sin(angle) * dist;
          const bumpR = r * (0.4 + 0.15 * Math.sin(seed + i * 2));
          g.fillEllipse(bumpX, bumpY, bumpR * 2, bumpR * 1.6);
        }
        break;
      }
      case "rounded": {
        const width = r * 1.6;
        const height = r * 1.2;
        g.fillRoundedRect(x - width, y - height, width * 2, height * 2, r * 0.4);
        break;
      }
      default:
        g.fillCircle(x, y, r);
    }
  }

  private drawOceanBackground(region: RegionData): void {
    this.oceanGraphics.clear();
    const bounds = this.worldBounds;
    const pad = 500;
    const ox = bounds.x - pad;
    const oy = bounds.y - pad;
    const ow = bounds.width + pad * 2;
    const oh = bounds.height + pad * 2;

    // Deep ocean base
    this.oceanGraphics.fillStyle(0x0a2540, 1);
    this.oceanGraphics.fillRect(ox, oy, ow, oh);

    // Mid-depth ocean variation — scattered ellipses using deterministic pseudo-random
    this.oceanGraphics.fillStyle(0x1a4a7a, 0.35);
    for (let i = 0; i < 30; i++) {
      const s = i * 137.508; // golden angle distribution
      const wx = ox + (Math.sin(s) * 0.5 + 0.5) * ow;
      const wy = oy + (Math.cos(s * 0.7) * 0.5 + 0.5) * oh;
      const wr = 100 + Math.sin(s * 1.3) * 60;
      this.oceanGraphics.fillEllipse(wx, wy, wr * 3, wr);
    }

    // Surface shimmer highlights
    this.oceanGraphics.fillStyle(0x2d6fa5, 0.18);
    for (let i = 0; i < 60; i++) {
      const s = i * 73.1;
      const wx = ox + (Math.sin(s * 0.31) * 0.5 + 0.5) * ow;
      const wy = oy + (Math.cos(s * 0.17) * 0.5 + 0.5) * oh;
      const wr = 25 + Math.sin(s * 2.1) * 15;
      this.oceanGraphics.fillEllipse(wx, wy, wr * 2.5, wr * 0.5);
    }

    // Island base / beach landmass — drawn slightly larger than zones so beach rim shows
    // Pass 1: outer sandy beach ring (12% larger)
    this.oceanGraphics.fillStyle(0xd4a853, 1.0);
    region.zones.forEach((zone) => {
      const x = zone.x * WORLD_SCALE;
      const y = zone.y * WORLD_SCALE;
      const r = zone.r * WORLD_SCALE;
      const shape = zone.shape || "circle";
      const rotation = (zone.rotation || 0) * Math.PI / 180;
      this.drawZoneShape(this.oceanGraphics, x, y, r * 1.12, shape, rotation);
    });

    // Pass 2: inner beach / shore transition (sandy-green, 4% larger than zone)
    this.oceanGraphics.fillStyle(0xc8b464, 1.0);
    region.zones.forEach((zone) => {
      const x = zone.x * WORLD_SCALE;
      const y = zone.y * WORLD_SCALE;
      const r = zone.r * WORLD_SCALE;
      const shape = zone.shape || "circle";
      const rotation = (zone.rotation || 0) * Math.PI / 180;
      this.drawZoneShape(this.oceanGraphics, x, y, r * 1.04, shape, rotation);
    });
  }

  private drawZones(region: RegionData): void {
    this.zoneGraphics.clear();
    region.zones.forEach((zone) => {
      const biome = BIOMES[zone.biome];
      const x = zone.x * WORLD_SCALE;
      const y = zone.y * WORLD_SCALE;
      const r = zone.r * WORLD_SCALE;
      const shape = zone.shape || "circle";
      const rotation = (zone.rotation || 0) * Math.PI / 180;
      this.zoneGraphics.fillStyle(biome.color, 0.92);
      this.drawZoneShape(this.zoneGraphics, x, y, r, shape, rotation);
    });
  }

  private createAmbientEffects(region: RegionData): void {
    // Clean up old particles
    this.ambientParticles.forEach(emitter => emitter.destroy());
    this.ambientParticles = [];

    region.zones.forEach((zone) => {
      const x = zone.x * WORLD_SCALE;
      const y = zone.y * WORLD_SCALE;
      const r = zone.r * WORLD_SCALE;

      // Create a simple graphics texture for particles
      const particleKey = `particle-${zone.biome}`;
      if (!this.textures.exists(particleKey)) {
        const graphics = this.add.graphics();

        // Different particle styles per biome
        switch (zone.biome) {
          case "forest":
            graphics.fillStyle(0x22c55e, 0.6);
            graphics.fillCircle(4, 4, 3);
            break;
          case "cave":
            graphics.fillStyle(0xa5f3fc, 0.8);
            graphics.fillRect(2, 0, 4, 8);
            break;
          case "lake":
            graphics.fillStyle(0x60a5fa, 0.5);
            graphics.fillCircle(4, 4, 4);
            break;
          case "tundra":
            graphics.fillStyle(0xffffff, 0.8);
            graphics.fillCircle(3, 3, 2);
            break;
          case "desert":
            graphics.fillStyle(0xfcd34d, 0.4);
            graphics.fillCircle(3, 3, 2);
            break;
          case "mountain":
            graphics.fillStyle(0x9ca3af, 0.5);
            graphics.fillCircle(3, 3, 2);
            break;
          case "jungle":
            graphics.fillStyle(0x22c55e, 0.7);
            graphics.fillCircle(4, 4, 3);
            break;
          case "ruins":
            graphics.fillStyle(0xa0936e, 0.6);
            graphics.fillRect(1, 1, 3, 3);
            break;
          case "marsh":
            graphics.fillStyle(0x6bbd8b, 0.6);
            graphics.fillCircle(4, 4, 3);
            break;
          case "city":
            graphics.fillStyle(0x94a3b8, 0.4);
            graphics.fillRect(2, 0, 2, 4);
            break;
          case "volcano":
            graphics.fillStyle(0xff6b35, 0.7);
            graphics.fillCircle(3, 3, 2);
            break;
          default:
            graphics.fillStyle(0xffffff, 0.3);
            graphics.fillCircle(2, 2, 2);
        }

        graphics.generateTexture(particleKey, 8, 8);
        graphics.destroy();
      }

      // Create particle emitter for this zone
      const particles = this.add.particles(x, y, particleKey, {
        x: { min: -r * 0.8, max: r * 0.8 },
        y: { min: -r * 0.8, max: r * 0.8 },
        speed: { min: 5, max: 20 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.8, end: 0.2 },
        alpha: { start: 0.6, end: 0 },
        lifespan: { min: 3000, max: 6000 },
        frequency: zone.biome === "tundra" ? 200 : zone.biome === "cave" ? 400 : 600,
        quantity: 1,
        blendMode: zone.biome === "cave" ? "ADD" : "NORMAL"
      });

      this.ambientParticles.push(particles);
    });

    // Create power spot glow effects
    region.powerSpots.forEach((spot) => {
      const x = spot.x * WORLD_SCALE;
      const y = spot.y * WORLD_SCALE;

      const glowKey = `glow-${spot.id}`;
      if (!this.textures.exists(glowKey)) {
        const graphics = this.add.graphics();
        graphics.fillStyle(spot.color, 0.8);
        graphics.fillCircle(6, 6, 5);
        graphics.generateTexture(glowKey, 12, 12);
        graphics.destroy();
      }

      const particles = this.add.particles(x, y, glowKey, {
        x: { min: -20, max: 20 },
        y: { min: -20, max: 20 },
        speed: { min: 10, max: 30 },
        angle: { min: 250, max: 290 }, // Float upward
        scale: { start: 0.6, end: 0.1 },
        alpha: { start: 0.7, end: 0 },
        lifespan: 2000,
        frequency: 150,
        quantity: 1,
        blendMode: "ADD"
      });

      this.powerSpotEffects.push(particles);
    });
  }

  private createWeatherEffect(region: RegionData): void {
    const id = region.id;

    if (id === 'verdania' || id === 'solstice') {
      // Rain: falling light-blue droplets, scroll-factor 0, depth 5
      const rainKey = 'rain-particle';
      if (!this.textures.exists(rainKey)) {
        const g = this.add.graphics();
        g.fillStyle(0x93c5fd, 0.7);
        g.fillRect(0, 0, 2, 6);
        g.generateTexture(rainKey, 2, 6);
        g.destroy();
      }
      const emitter = this.add.particles(this.scale.width / 2, -20, rainKey, {
        x: { min: -this.scale.width / 2, max: this.scale.width / 2 },
        y: 0,
        speedX: { min: -20, max: 20 },
        speedY: { min: 180, max: 280 },
        scale: 1,
        alpha: { start: 0.6, end: 0.3 },
        lifespan: 2000,
        frequency: id === 'solstice' ? 15 : 40,
        quantity: 1,
      });
      emitter.setScrollFactor(0).setDepth(5);
      this.ambientParticles.push(emitter);
    }

    if (id === 'frostholm') {
      // Snow: drifting white flakes, scroll-factor 0, depth 5
      const snowKey = 'snow-particle';
      if (!this.textures.exists(snowKey)) {
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(3, 3, 3);
        g.generateTexture(snowKey, 6, 6);
        g.destroy();
      }
      const emitter = this.add.particles(this.scale.width / 2, -10, snowKey, {
        x: { min: -this.scale.width / 2, max: this.scale.width / 2 },
        y: 0,
        speedX: { min: -15, max: 15 },
        speedY: { min: 40, max: 80 },
        scale: { start: 0.6, end: 0.3 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 5000,
        frequency: 60,
        quantity: 1,
      });
      emitter.setScrollFactor(0).setDepth(5);
      this.ambientParticles.push(emitter);
    }
  }

  private drawRoutes(region: RegionData): void {
    this.routeGraphics.clear();
    this.routeGraphics.lineStyle(6, 0x0f172a, 0.4);
    this.routeGraphics.lineStyle(3, 0xf9fafb, 0.7);
    region.routes.forEach((route) => {
      const from = this.findTownOrLandmark(region, route.from);
      const to = this.findTownOrLandmark(region, route.to);
      if (!from || !to) return;
      const fromX = from.x * WORLD_SCALE;
      const fromY = from.y * WORLD_SCALE;
      const toX = to.x * WORLD_SCALE;
      const toY = to.y * WORLD_SCALE;
      this.routeGraphics.strokeLineShape(new Phaser.Geom.Line(fromX, fromY, toX, toY));
    });
  }

  private drawPointsOfInterest(region: RegionData): void {
    this.poiGraphics.clear();
    region.towns.forEach((town) => {
      const x = town.x * WORLD_SCALE;
      const y = town.y * WORLD_SCALE;
      this.poiGraphics.fillStyle(0x1f2937, 0.9);
      this.poiGraphics.fillRect(x - 18, y - 16, 36, 32);
      this.poiGraphics.fillStyle(0xfbbf24, 0.9);
      this.poiGraphics.fillRect(x - 18, y - 22, 36, 6);
      // Add building details
      this.poiGraphics.fillStyle(0x3b82f6, 0.9);
      this.poiGraphics.fillRect(x - 4, y - 8, 8, 12);
    });
    region.landmarks.forEach((landmark) => {
      const x = landmark.x * WORLD_SCALE;
      const y = landmark.y * WORLD_SCALE;
      this.poiGraphics.fillStyle(landmark.color, 0.9);
      this.poiGraphics.fillTriangle(x, y - 20, x - 14, y + 10, x + 14, y + 10);
      this.poiGraphics.lineStyle(2, 0xffffff, 0.6);
      this.poiGraphics.strokeTriangle(x, y - 20, x - 14, y + 10, x + 14, y + 10);
    });
    region.gyms.forEach((gym) => {
      const x = gym.x * WORLD_SCALE;
      const y = gym.y * WORLD_SCALE;
      const isDefeated = gameState.defeatedGyms[gym.id];
      this.poiGraphics.fillStyle(isDefeated ? 0x6b7280 : gym.color, 0.9);
      this.poiGraphics.fillRect(x - 16, y - 16, 32, 32);
      this.poiGraphics.lineStyle(2, 0xffffff, 0.7);
      this.poiGraphics.strokeRect(x - 16, y - 16, 32, 32);
      // Add gym symbol
      if (!isDefeated) {
        this.poiGraphics.fillStyle(0xffffff, 0.8);
        this.poiGraphics.fillCircle(x, y, 6);
      }
    });
    region.powerSpots.forEach((spot) => {
      const x = spot.x * WORLD_SCALE;
      const y = spot.y * WORLD_SCALE;

      // Draw base glow
      this.poiGraphics.fillStyle(spot.color, 0.15);
      this.poiGraphics.fillCircle(x, y, 32);
      this.poiGraphics.fillStyle(spot.color, 0.25);
      this.poiGraphics.fillCircle(x, y, 24);

      // Draw effect-specific decoration
      if (spot.effect === "heal") {
        // Healing spring - water ripples
        this.poiGraphics.lineStyle(2, 0x60a5fa, 0.7);
        this.poiGraphics.strokeCircle(x, y, 12);
        this.poiGraphics.strokeCircle(x, y, 20);
        // Cross symbol
        this.poiGraphics.fillStyle(0xffffff, 0.9);
        this.poiGraphics.fillRect(x - 2, y - 8, 4, 16);
        this.poiGraphics.fillRect(x - 8, y - 2, 16, 4);
      } else if (spot.effect === "xpboost") {
        // Ancient shrine - star pattern
        this.poiGraphics.lineStyle(2, spot.color, 0.9);
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const innerR = 8;
          const outerR = 18;
          this.poiGraphics.beginPath();
          this.poiGraphics.moveTo(x + Math.cos(angle) * innerR, y + Math.sin(angle) * innerR);
          this.poiGraphics.lineTo(x + Math.cos(angle) * outerR, y + Math.sin(angle) * outerR);
          this.poiGraphics.strokePath();
        }
        // Center gem
        this.poiGraphics.fillStyle(0xffd700, 0.9);
        this.poiGraphics.fillCircle(x, y, 6);
      } else if (spot.effect === "rarepokemon") {
        // Sanctuary - Pokeball-like symbol
        this.poiGraphics.lineStyle(3, spot.color, 0.9);
        this.poiGraphics.strokeCircle(x, y, 16);
        this.poiGraphics.beginPath();
        this.poiGraphics.moveTo(x - 16, y);
        this.poiGraphics.lineTo(x + 16, y);
        this.poiGraphics.strokePath();
        this.poiGraphics.fillStyle(0xffffff, 0.9);
        this.poiGraphics.fillCircle(x, y, 5);
        this.poiGraphics.lineStyle(2, spot.color, 1);
        this.poiGraphics.strokeCircle(x, y, 5);
      }

      // Outer decorative ring
      this.poiGraphics.lineStyle(2, spot.color, 0.6);
      this.poiGraphics.strokeCircle(x, y, 28);
    });

    // Draw Pokemon League entrance if all gyms defeated
    const allGymsDefeated = region.gyms.every(g => gameState.defeatedGyms[g.id]);
    if (allGymsDefeated && !gameState.isChampion) {
      const leagueX = 45 * WORLD_SCALE;
      const leagueY = 35 * WORLD_SCALE;
      this.poiGraphics.fillStyle(0xffd700, 0.9);
      this.poiGraphics.fillRect(leagueX - 20, leagueY - 20, 40, 40);
      this.poiGraphics.lineStyle(3, 0xffffff, 0.9);
      this.poiGraphics.strokeRect(leagueX - 20, leagueY - 20, 40, 40);
      // Crown symbol
      this.poiGraphics.fillStyle(0xffffff, 0.9);
      this.poiGraphics.fillTriangle(leagueX, leagueY - 10, leagueX - 10, leagueY + 5, leagueX + 10, leagueY + 5);
    }
  }

  private spawnProps(region: RegionData): void {
    this.props = [];
    this.propBodies.clear(true, true);
    region.zones.forEach((zone) => {
      const biome = BIOMES[zone.biome];
      const count = Math.floor(zone.r * 1.2);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * zone.r * 0.9;
        const x = (zone.x + Math.cos(angle) * radius) * WORLD_SCALE;
        const y = (zone.y + Math.sin(angle) * radius) * WORLD_SCALE;
        const type = biome.props[Math.floor(Math.random() * biome.props.length)];
        const variant = Math.floor(Math.random() * 3); // 0, 1, or 2 variant
        const scale = 0.8 + Math.random() * 0.4; // 0.8 to 1.2 scale
        this.props.push({ x, y, type, variant, scale });
        const size = this.getPropBodySize(type);
        // Position collision body at the base of the prop, make it smaller
        const body = this.propBodies.create(x, y + size.h * 0.3, "collider") as Phaser.Physics.Arcade.Image;
        body.setDisplaySize(size.w * 0.6, size.h * 0.5); // Smaller collision area
        body.setAlpha(0);
        body.refreshBody();
      }
    });
    this.drawProps();
  }

  private drawProps(): void {
    this.propGraphics.clear();
    this.props.forEach((prop) => {
      const { x, y, type, variant, scale } = prop;
      const s = scale;

      switch (type) {
        case "tree":
          this.drawTree(x, y, variant, s);
          break;
        case "pine":
          this.drawPine(x, y, variant, s);
          break;
        case "bush":
          this.drawBush(x, y, variant, s);
          break;
        case "flower":
          this.drawFlower(x, y, variant, s);
          break;
        case "rock":
          this.drawRock(x, y, variant, s);
          break;
        case "boulder":
          this.drawBoulder(x, y, variant, s);
          break;
        case "rockspire":
          this.drawRockspire(x, y, variant, s);
          break;
        case "crystal":
          this.drawCrystal(x, y, variant, s);
          break;
        case "glacier":
          this.drawGlacier(x, y, variant, s);
          break;
        case "snowdrift":
          this.drawSnowdrift(x, y, variant, s);
          break;
        case "cactus":
          this.drawCactus(x, y, variant, s);
          break;
        case "waterlily":
          this.drawWaterlily(x, y, variant, s);
          break;
        case "reed":
          this.drawReed(x, y, variant, s);
          break;
        default:
          this.propGraphics.fillStyle(0x4b5563, 1);
          this.propGraphics.fillRect(x - 6, y - 6, 12, 12);
          break;
      }
    });
  }

  private drawTree(x: number, y: number, variant: number, s: number): void {
    const g = this.propGraphics;
    // Trunk with texture
    g.fillStyle(0x5b3a1e, 1);
    g.fillRect(x - 5 * s, y - 8 * s, 10 * s, 18 * s);
    g.fillStyle(0x4a2f18, 1);
    g.fillRect(x - 2 * s, y - 6 * s, 2 * s, 14 * s);

    // Layered foliage based on variant
    const colors = [
      [0x22c55e, 0x16a34a, 0x15803d],  // Green
      [0x4ade80, 0x22c55e, 0x16a34a],  // Light green
      [0x86efac, 0x4ade80, 0x22c55e]   // Pale green
    ][variant];

    g.fillStyle(colors[2], 1);
    g.fillCircle(x, y - 14 * s, 16 * s);
    g.fillStyle(colors[1], 1);
    g.fillCircle(x - 4 * s, y - 18 * s, 12 * s);
    g.fillCircle(x + 5 * s, y - 16 * s, 11 * s);
    g.fillStyle(colors[0], 1);
    g.fillCircle(x, y - 22 * s, 10 * s);

    // Highlight
    g.fillStyle(0xffffff, 0.2);
    g.fillCircle(x - 3 * s, y - 24 * s, 4 * s);
  }

  private drawPine(x: number, y: number, variant: number, s: number): void {
    const g = this.propGraphics;
    // Trunk
    g.fillStyle(0x5b3a1e, 1);
    g.fillRect(x - 3 * s, y + 2 * s, 6 * s, 10 * s);

    // Layered triangles for pine look
    const colors = [0x1f5c38, 0x2a6b3f, 0x357a4a][variant];
    const darkColor = [0x164430, 0x1f5c38, 0x2a6b3f][variant];

    // Back layer
    g.fillStyle(darkColor, 1);
    g.fillTriangle(x, y - 28 * s, x - 16 * s, y + 4 * s, x + 16 * s, y + 4 * s);

    // Middle layers
    g.fillStyle(colors, 1);
    g.fillTriangle(x, y - 26 * s, x - 14 * s, y - 6 * s, x + 14 * s, y - 6 * s);
    g.fillTriangle(x, y - 18 * s, x - 12 * s, y + 2 * s, x + 12 * s, y + 2 * s);

    // Snow caps on some variants
    if (variant === 2) {
      g.fillStyle(0xffffff, 0.7);
      g.fillTriangle(x, y - 26 * s, x - 6 * s, y - 18 * s, x + 6 * s, y - 18 * s);
    }
  }

  private drawBush(x: number, y: number, variant: number, s: number): void {
    const g = this.propGraphics;
    const colors = [
      [0x22c55e, 0x16a34a],
      [0x4ade80, 0x22c55e],
      [0xf472b6, 0xec4899] // Flowering bush
    ][variant];

    // Multiple overlapping circles for organic shape
    g.fillStyle(colors[1], 1);
    g.fillCircle(x - 4 * s, y - 4 * s, 9 * s);
    g.fillCircle(x + 5 * s, y - 3 * s, 8 * s);
    g.fillStyle(colors[0], 1);
    g.fillCircle(x, y - 6 * s, 10 * s);
    g.fillCircle(x + 3 * s, y - 8 * s, 7 * s);

    // Add berries/flowers for variant 2
    if (variant === 2) {
      g.fillStyle(0xfcd34d, 1);
      g.fillCircle(x - 5 * s, y - 8 * s, 2 * s);
      g.fillCircle(x + 4 * s, y - 10 * s, 2 * s);
      g.fillCircle(x + 6 * s, y - 4 * s, 2 * s);
    }

    // Highlight
    g.fillStyle(0xffffff, 0.15);
    g.fillCircle(x - 2 * s, y - 10 * s, 4 * s);
  }

  private drawFlower(x: number, y: number, variant: number, s: number): void {
    const g = this.propGraphics;
    const petalColors = [0xf472b6, 0xfbbf24, 0xa78bfa][variant];

    // Stem
    g.fillStyle(0x22c55e, 1);
    g.fillRect(x - 1 * s, y - 2 * s, 2 * s, 8 * s);

    // Petals in a circle
    g.fillStyle(petalColors, 1);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(angle) * 4 * s;
      const py = y - 6 * s + Math.sin(angle) * 4 * s;
      g.fillEllipse(px, py, 4 * s, 3 * s);
    }

    // Center
    g.fillStyle(0xfcd34d, 1);
    g.fillCircle(x, y - 6 * s, 3 * s);

    // Leaf
    g.fillStyle(0x22c55e, 1);
    g.fillEllipse(x + 3 * s, y + 2 * s, 4 * s, 2 * s);
  }

  private drawRock(x: number, y: number, variant: number, s: number): void {
    const g = this.propGraphics;
    const colors = [0x6b7280, 0x78716c, 0x9ca3af][variant];
    const darkColors = [0x4b5563, 0x57534e, 0x6b7280][variant];

    // Main rock body - irregular polygon
    g.fillStyle(colors, 1);
    g.beginPath();
    g.moveTo(x - 2 * s, y - 12 * s);
    g.lineTo(x + 8 * s, y - 8 * s);
    g.lineTo(x + 10 * s, y + 2 * s);
    g.lineTo(x + 6 * s, y + 8 * s);
    g.lineTo(x - 8 * s, y + 8 * s);
    g.lineTo(x - 10 * s, y + 2 * s);
    g.lineTo(x - 8 * s, y - 6 * s);
    g.closePath();
    g.fillPath();

    // Shading
    g.fillStyle(darkColors, 1);
    g.beginPath();
    g.moveTo(x - 8 * s, y + 8 * s);
    g.lineTo(x - 10 * s, y + 2 * s);
    g.lineTo(x - 6 * s, y + 4 * s);
    g.lineTo(x - 4 * s, y + 8 * s);
    g.closePath();
    g.fillPath();

    // Highlight
    g.fillStyle(0xffffff, 0.2);
    g.fillCircle(x + 2 * s, y - 6 * s, 3 * s);
  }

  private drawBoulder(x: number, y: number, variant: number, s: number): void {
    const g = this.propGraphics;
    const colors = [0x8b8f97, 0xa3a8b0, 0x78716c][variant];

    // Large rounded boulder
    g.fillStyle(colors, 1);
    g.fillEllipse(x, y - 2 * s, 16 * s, 12 * s);

    // Darker bottom
    g.fillStyle(0x4b5563, 0.4);
    g.fillEllipse(x, y + 2 * s, 14 * s, 6 * s);

    // Cracks/texture
    g.lineStyle(1, 0x374151, 0.3);
    g.beginPath();
    g.moveTo(x - 4 * s, y - 4 * s);
    g.lineTo(x + 2 * s, y);
    g.lineTo(x + 6 * s, y - 2 * s);
    g.strokePath();

    // Highlight
    g.fillStyle(0xffffff, 0.25);
    g.fillEllipse(x - 3 * s, y - 5 * s, 5 * s, 3 * s);
  }

  private drawRockspire(x: number, y: number, variant: number, s: number): void {
    const g = this.propGraphics;
    const colors = [0x5f5b52, 0x78716c, 0x6b7280][variant];

    // Tall jagged rock
    g.fillStyle(colors, 1);
    g.beginPath();
    g.moveTo(x, y - 24 * s);
    g.lineTo(x + 6 * s, y - 14 * s);
    g.lineTo(x + 10 * s, y + 10 * s);
    g.lineTo(x - 10 * s, y + 10 * s);
    g.lineTo(x - 6 * s, y - 10 * s);
    g.closePath();
    g.fillPath();

    // Side shading
    g.fillStyle(0x374151, 0.4);
    g.beginPath();
    g.moveTo(x - 6 * s, y - 10 * s);
    g.lineTo(x, y - 24 * s);
    g.lineTo(x - 2 * s, y - 12 * s);
    g.lineTo(x - 10 * s, y + 10 * s);
    g.closePath();
    g.fillPath();

    // Highlight streak
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(x + 2 * s, y - 16 * s, 2 * s, 12 * s);
  }

  private drawCrystal(x: number, y: number, variant: number, s: number): void {
    const g = this.propGraphics;
    const colors = [0xa5f3fc, 0xc4b5fd, 0xfda4af][variant]; // Cyan, purple, pink

    // Main crystal
    g.fillStyle(colors, 0.85);
    g.fillTriangle(x, y - 22 * s, x - 8 * s, y + 8 * s, x + 8 * s, y + 8 * s);

    // Inner shine
    g.fillStyle(0xffffff, 0.4);
    g.fillTriangle(x, y - 18 * s, x - 3 * s, y + 2 * s, x + 3 * s, y + 2 * s);

    // Outline glow
    g.lineStyle(2, colors, 0.6);
    g.strokeTriangle(x, y - 22 * s, x - 8 * s, y + 8 * s, x + 8 * s, y + 8 * s);

    // Small secondary crystal
    g.fillStyle(colors, 0.7);
    g.fillTriangle(x + 8 * s, y - 10 * s, x + 4 * s, y + 6 * s, x + 12 * s, y + 6 * s);
  }

  private drawGlacier(x: number, y: number, variant: number, s: number): void {
    const g = this.propGraphics;

    // Ice chunk
    g.fillStyle(0xdbeafe, 0.9);
    g.beginPath();
    g.moveTo(x - 4 * s, y - 24 * s);
    g.lineTo(x + 8 * s, y - 18 * s);
    g.lineTo(x + 14 * s, y + 10 * s);
    g.lineTo(x - 14 * s, y + 10 * s);
    g.lineTo(x - 10 * s, y - 12 * s);
    g.closePath();
    g.fillPath();

    // Ice cracks
    g.lineStyle(1, 0x93c5fd, 0.6);
    g.beginPath();
    g.moveTo(x, y - 16 * s);
    g.lineTo(x - 4 * s, y - 4 * s);
    g.lineTo(x + 2 * s, y + 4 * s);
    g.strokePath();

    // Highlight
    g.fillStyle(0xffffff, 0.5);
    g.fillTriangle(x - 2 * s, y - 20 * s, x - 8 * s, y - 8 * s, x + 4 * s, y - 14 * s);

    // Snow on top
    if (variant === 0) {
      g.fillStyle(0xffffff, 0.9);
      g.fillEllipse(x, y - 22 * s, 10 * s, 4 * s);
    }
  }

  private drawSnowdrift(x: number, y: number, variant: number, s: number): void {
    const g = this.propGraphics;

    // Multiple snow mounds
    g.fillStyle(0xf8fafc, 1);
    g.fillEllipse(x - 6 * s, y + 4 * s, 14 * s, 8 * s);
    g.fillEllipse(x + 8 * s, y + 6 * s, 12 * s, 6 * s);
    g.fillEllipse(x, y + 2 * s, 18 * s, 10 * s);

    // Subtle shading
    g.fillStyle(0xe2e8f0, 0.4);
    g.fillEllipse(x + 4 * s, y + 6 * s, 10 * s, 4 * s);

    // Sparkles for variant 1
    if (variant === 1) {
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(x - 4 * s, y - 2 * s, 1.5 * s);
      g.fillCircle(x + 6 * s, y, 1 * s);
      g.fillCircle(x, y + 4 * s, 1 * s);
    }
  }

  private drawCactus(x: number, y: number, variant: number, s: number): void {
    const g = this.propGraphics;
    const color = [0x22c55e, 0x16a34a, 0x15803d][variant];
    const darkColor = [0x16a34a, 0x15803d, 0x14532d][variant];

    // Main body
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - 4 * s, y - 18 * s, 8 * s, 26 * s, 3 * s);

    // Arms
    g.fillRoundedRect(x - 12 * s, y - 10 * s, 8 * s, 4 * s, 2 * s);
    g.fillRoundedRect(x - 12 * s, y - 10 * s, 4 * s, 12 * s, 2 * s);

    g.fillRoundedRect(x + 4 * s, y - 6 * s, 8 * s, 4 * s, 2 * s);
    g.fillRoundedRect(x + 8 * s, y - 6 * s, 4 * s, 10 * s, 2 * s);

    // Vertical lines for texture
    g.lineStyle(1, darkColor, 0.5);
    g.beginPath();
    g.moveTo(x - 1 * s, y - 16 * s);
    g.lineTo(x - 1 * s, y + 6 * s);
    g.moveTo(x + 1 * s, y - 16 * s);
    g.lineTo(x + 1 * s, y + 6 * s);
    g.strokePath();

    // Flower on top for variant 2
    if (variant === 2) {
      g.fillStyle(0xfbbf24, 1);
      g.fillCircle(x, y - 20 * s, 4 * s);
      g.fillStyle(0xfcd34d, 1);
      g.fillCircle(x, y - 20 * s, 2 * s);
    }
  }

  private drawWaterlily(x: number, y: number, variant: number, s: number): void {
    const g = this.propGraphics;

    // Lily pad
    g.fillStyle(0x22c55e, 0.8);
    g.fillEllipse(x, y + 4 * s, 18 * s, 12 * s);

    // Notch in pad
    g.fillStyle(0x4f7fc9, 0.5);
    g.fillTriangle(x, y + 4 * s, x - 2 * s, y - 2 * s, x + 2 * s, y - 2 * s);

    // Darker center
    g.fillStyle(0x16a34a, 0.6);
    g.fillEllipse(x, y + 4 * s, 8 * s, 5 * s);

    // Flower for some variants
    if (variant !== 0) {
      const flowerColor = variant === 1 ? 0xfda4af : 0xfbbf24;
      g.fillStyle(flowerColor, 0.9);
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const px = x + Math.cos(angle) * 4 * s;
        const py = y + Math.sin(angle) * 3 * s;
        g.fillEllipse(px, py, 3 * s, 2 * s);
      }
      g.fillStyle(0xfcd34d, 1);
      g.fillCircle(x, y, 2 * s);
    }
  }

  private drawReed(x: number, y: number, variant: number, s: number): void {
    const g = this.propGraphics;
    const count = variant + 2; // 2-4 reeds

    for (let i = 0; i < count; i++) {
      const offsetX = (i - count / 2) * 4 * s;
      const height = (14 + Math.random() * 6) * s;

      // Stem
      g.fillStyle(0x15803d, 1);
      g.fillRect(x + offsetX - 1 * s, y - height, 2 * s, height + 4 * s);

      // Cattail top
      g.fillStyle(0x78350f, 1);
      g.fillEllipse(x + offsetX, y - height - 4 * s, 3 * s, 6 * s);
    }
  }

  private getPropBodySize(type: string): { w: number; h: number } {
    // Collision sizes - smaller than visual for better gameplay feel
    switch (type) {
      case "tree": return { w: 12, h: 14 };      // Just trunk area
      case "pine": return { w: 10, h: 12 };      // Just trunk area
      case "bush": return { w: 14, h: 10 };      // Can brush against
      case "flower": return { w: 4, h: 4 };       // Tiny, almost walkable
      case "rock": return { w: 14, h: 10 };      // Base only
      case "boulder": return { w: 18, h: 12 };   // Rounded so smaller
      case "rockspire": return { w: 12, h: 14 }; // Narrower at base
      case "crystal": return { w: 10, h: 12 };   // Can get close
      case "glacier": return { w: 16, h: 12 };   // Wide but low
      case "snowdrift": return { w: 12, h: 6 };  // Very walkable
      case "cactus": return { w: 10, h: 16 };    // Tall and thin
      case "waterlily": return { w: 8, h: 4 };   // Almost walkable
      case "reed": return { w: 6, h: 8 };        // Walk through
      default: return { w: 10, h: 10 };
    }
  }

  private updatePoiHud(): void {
    const region = getRegion(gameState);
    const playerX = this.player.x;
    const playerY = this.player.y;
    let gymLabel = "";
    let locationLabel = "Wilderness";
    let gymHint = "";
    let healHint = "";
    let leagueHint = "";
    let powerSpotHint = "";
    let xpBoostLabel = "";

    for (const gym of region.gyms) {
      const distance = Phaser.Math.Distance.Between(playerX, playerY, gym.x * WORLD_SCALE, gym.y * WORLD_SCALE);
      if (distance < 90 && !gameState.defeatedGyms[gym.id]) {
        gymLabel = `Gym: ${gym.name} (${gym.leader})`;
        gymHint = "[E/A] Challenge Gym";
        if ((this.keyE && this.input.keyboard?.checkDown(this.keyE, 250)) || this.interactPressed) {
          this.interactPressed = false;
          this.startGymBattle(gym.id);
          return;
        }
        break;
      }
    }

    let martHint = "";
    for (const town of region.towns) {
      const distance = Phaser.Math.Distance.Between(playerX, playerY, town.x * WORLD_SCALE, town.y * WORLD_SCALE);
      if (distance < 70) {
        locationLabel = town.name;
        if (town.services.includes("center")) {
          healHint = "[H] Pokemon Center";
        }
        if (town.services.includes("mart") && distance < 50) {
          martHint = "[E/A] Poke Mart";
          if ((this.keyE && this.input.keyboard?.checkDown(this.keyE, 250)) || this.interactPressed) {
            // Don't consume interact if gym is also nearby (gym takes priority)
            if (!gymHint) {
              this.interactPressed = false;
              if (!this.martOpen) this.openMart();
            }
          }
        }
        break;
      }
    }

    if (locationLabel === "Wilderness") {
      for (const landmark of region.landmarks) {
        const distance = Phaser.Math.Distance.Between(playerX, playerY, landmark.x * WORLD_SCALE, landmark.y * WORLD_SCALE);
        if (distance < 70) {
          locationLabel = landmark.name;
          break;
        }
      }
    }

    if (locationLabel === "Wilderness") {
      const zone = region.zones.find((z) =>
        Phaser.Math.Distance.Between(playerX, playerY, z.x * WORLD_SCALE, z.y * WORLD_SCALE) < z.r * WORLD_SCALE
      );
      if (zone) locationLabel = zone.name;
    }

    // Check for Pokemon League
    const allGymsDefeated = region.gyms.every(g => gameState.defeatedGyms[g.id]);
    if (!gameState.isChampion) {
      const leagueX = 45 * WORLD_SCALE;
      const leagueY = 35 * WORLD_SCALE;
      const distance = Phaser.Math.Distance.Between(playerX, playerY, leagueX, leagueY);
      if (distance < 80) {
        if (gameState.badges.length < 3) {
          leagueHint = "Need 3 badges for the Elite Four";
        } else if (gameState.e4Progress > 0 && gameState.e4Progress < 4) {
          leagueHint = `[L] Elite Four - Battle ${gameState.e4Progress + 1} of 4`;
        } else if (gameState.e4Progress >= 4) {
          leagueHint = "[L] Claim your Champion title!";
        } else {
          leagueHint = "[L] Enter the Elite Four!";
        }
      }
    }

    // Check for nearby power spots
    for (const spot of region.powerSpots) {
      const distance = Phaser.Math.Distance.Between(playerX, playerY, spot.x * WORLD_SCALE, spot.y * WORLD_SCALE);
      if (distance < 60) {
        const cooldown = this.powerSpotCooldowns.get(spot.id) || 0;
        if (cooldown <= 0) {
          const effectDesc = spot.effect === "heal" ? "Healing aura nearby!" :
            spot.effect === "xpboost" ? "Ancient power nearby!" :
            "Rare Pokemon sense something!";
          powerSpotHint = `${spot.name}: ${effectDesc}`;
        } else {
          powerSpotHint = `${spot.name}: Recharging...`;
        }
        break;
      }
    }

    // Show XP boost status
    if (this.xpBoostActive) {
      const secondsLeft = Math.ceil(this.xpBoostTimer / 1000);
      xpBoostLabel = `2x XP BOOST: ${secondsLeft}s`;
    }

    const pokedexCount = getPokedexCount(gameState);
    const nextGym = region.gyms.find((gym) => !gameState.defeatedGyms[gym.id]);
    const objective = gameState.isChampion ? "Champion!" :
      allGymsDefeated ? "Challenge the Pokemon League!" :
      nextGym ? `Defeat ${nextGym.name}` : "Explore!";

    const hudLines = [
      `Location: ${locationLabel}`,
      gymLabel,
      `Badges: ${gameState.badges.length}/3  |  Pokedex: ${pokedexCount.caught}  |  ₽${gameState.money ?? 500}`,
      `Goal: ${objective}`,
      xpBoostLabel,
      "",
      powerSpotHint,
      healHint,
      martHint,
      gymHint,
      leagueHint,
      `[P] Potion (${gameState.inventory.potion}) | [R] Revive (${gameState.inventory.revive})`,
      "[M] Map | [T] Team | [D] Pokedex"
    ].filter(line => line !== "");

    this.hudText.setText(hudLines.join("\n"));

    // Update player marker on visual map if open
    if (this.mapOpen && this.mapPlayerMarker && this.mapContainer) {
      const bounds = this.getWorldBounds(region);
      const mapWidth = 400;
      const mapHeight = 300;
      const scaleX = mapWidth / bounds.width;
      const scaleY = mapHeight / bounds.height;
      const markerX = (this.player.x - bounds.x) * scaleX;
      const markerY = (this.player.y - bounds.y) * scaleY;
      this.mapPlayerMarker.setPosition(markerX, markerY);
    }
  }

  private setupCameraZoom(): void {
    // With RESIZE mode the canvas fills the full viewport.
    // Scale zoom so ~600 world-units are visible along the short axis,
    // giving phones a close-up view and desktops a wider perspective.
    const minSide = Math.min(this.scale.width, this.scale.height);
    const zoom = Phaser.Math.Clamp(minSide / 600, 0.75, 2.2);
    this.cameras.main.setZoom(zoom);
  }

  private createVignette(): void {
    this.vignette?.destroy();
    const w = this.scale.width;
    const h = this.scale.height;
    const g = this.add.graphics();
    g.setScrollFactor(0).setDepth(900);
    // Soft darkened edges for depth/atmosphere
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const alpha = 0.06 * (i + 1);
      const inset = (i / steps) * Math.min(w, h) * 0.18;
      g.fillStyle(0x000000, alpha);
      g.fillRect(0, 0, w, inset);
      g.fillRect(0, h - inset, w, inset);
      g.fillRect(0, 0, inset, h);
      g.fillRect(w - inset, 0, inset, h);
    }
    this.vignette = g;
  }

  /** Soft ground shadow placed under an entity standing at (x, baseY).
   *  Pinned to a fixed depth band: above the ground layers, below all entities. */
  private makeShadow(x: number, baseY: number, width: number): Phaser.GameObjects.Ellipse {
    const shadow = this.add.ellipse(x, baseY, width, width * 0.35, 0x000000, 0.25);
    shadow.setDepth(-50);
    return shadow;
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

  private handleHealing(): void {
    const region = getRegion(gameState);
    const playerX = this.player.x;
    const playerY = this.player.y;

    const healActivated = (this.keyH && this.input.keyboard?.checkDown(this.keyH, 250)) || this.interactPressed;
    if (healActivated) {
      const town = region.towns.find((t) =>
        t.services.includes("center") &&
        Phaser.Math.Distance.Between(playerX, playerY, t.x * WORLD_SCALE, t.y * WORLD_SCALE) < 70
      );
      if (town) {
        this.interactPressed = false;
        Sound.playHeal();
        healTeam(gameState);
        this.showNotification("Your Pokemon have been healed!");
      }
    }
    if (this.keyP && this.input.keyboard?.checkDown(this.keyP, 250)) {
      if (usePotion(gameState)) {
        Sound.playHeal();
        this.showNotification("Used Potion!");
      }
    }
    if (this.keyR && this.input.keyboard?.checkDown(this.keyR, 250)) {
      if (useRevive(gameState)) {
        this.showNotification("Used Revive!");
      }
    }
  }

  private togglePause(): void {
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  private openVisualMap(): void {
    this.touch?.setVisible(false);
    const region = getRegion(gameState);
    const bounds = this.getWorldBounds(region);

    const mapWidth = 400;
    const mapHeight = 300;
    const mapX = this.scale.width / 2;
    const mapY = this.scale.height / 2;

    // Create container for the map
    this.mapContainer = this.add.container(mapX - mapWidth / 2, mapY - mapHeight / 2);
    this.mapContainer.setScrollFactor(0);
    this.mapContainer.setDepth(500);

    // Background panel
    const bg = this.add.rectangle(mapWidth / 2, mapHeight / 2, mapWidth + 20, mapHeight + 60, 0x0f172a, 0.95);
    bg.setStrokeStyle(3, 0xfbbf24);
    this.mapContainer.add(bg);

    // Title
    const title = this.add.text(mapWidth / 2, -15, region.name, {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#fbbf24",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.mapContainer.add(title);

    // Map graphics for drawing zones
    this.mapGraphics = this.add.graphics();
    this.mapContainer.add(this.mapGraphics);

    const scaleX = mapWidth / bounds.width;
    const scaleY = mapHeight / bounds.height;

    // Draw zones
    region.zones.forEach((zone) => {
      const biome = BIOMES[zone.biome];
      const x = (zone.x * WORLD_SCALE - bounds.x) * scaleX;
      const y = (zone.y * WORLD_SCALE - bounds.y) * scaleY;
      const r = zone.r * WORLD_SCALE * Math.min(scaleX, scaleY) * 0.8;

      this.mapGraphics!.fillStyle(biome.color, 0.6);
      this.mapGraphics!.fillCircle(x, y, r);
      this.mapGraphics!.lineStyle(1, biome.color, 0.8);
      this.mapGraphics!.strokeCircle(x, y, r);
    });

    // Draw towns
    region.towns.forEach((town) => {
      const x = (town.x * WORLD_SCALE - bounds.x) * scaleX;
      const y = (town.y * WORLD_SCALE - bounds.y) * scaleY;

      // Town marker (house shape)
      this.mapGraphics!.fillStyle(0x60a5fa, 1);
      this.mapGraphics!.fillRect(x - 6, y - 3, 12, 10);
      this.mapGraphics!.fillTriangle(x - 8, y - 3, x + 8, y - 3, x, y - 10);

      // Town name
      const label = this.add.text(x, y + 12, town.name, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#93c5fd"
      }).setOrigin(0.5);
      this.mapContainer!.add(label);
    });

    // Draw gyms
    region.gyms.forEach((gym) => {
      const x = (gym.x * WORLD_SCALE - bounds.x) * scaleX;
      const y = (gym.y * WORLD_SCALE - bounds.y) * scaleY;
      const isCleared = gameState.defeatedGyms[gym.id];

      // Gym marker (star shape)
      this.mapGraphics!.fillStyle(isCleared ? 0x22c55e : gym.color, 1);
      this.mapGraphics!.fillCircle(x, y, 8);
      this.mapGraphics!.lineStyle(2, 0xffffff, 0.8);
      this.mapGraphics!.strokeCircle(x, y, 8);

      // Gym label
      const label = this.add.text(x, y + 14, isCleared ? "✓" : gym.leader, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: isCleared ? "#22c55e" : "#fbbf24"
      }).setOrigin(0.5);
      this.mapContainer!.add(label);
    });

    // Draw portals
    if (region.portals) {
      region.portals.forEach((portal) => {
        const x = (portal.x * WORLD_SCALE - bounds.x) * scaleX;
        const y = (portal.y * WORLD_SCALE - bounds.y) * scaleY;

        // Portal marker (swirl)
        this.mapGraphics!.fillStyle(portal.color, 0.8);
        this.mapGraphics!.fillCircle(x, y, 10);
        this.mapGraphics!.lineStyle(2, 0xffffff, 0.6);
        this.mapGraphics!.strokeCircle(x, y, 10);
        this.mapGraphics!.strokeCircle(x, y, 6);

        // Portal label
        const label = this.add.text(x, y + 16, "Portal", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#c4b5fd"
        }).setOrigin(0.5);
        this.mapContainer!.add(label);
      });
    }

    // Player marker
    const playerX = (this.player.x - bounds.x) * scaleX;
    const playerY = (this.player.y - bounds.y) * scaleY;
    this.mapPlayerMarker = this.add.circle(playerX, playerY, 6, 0xff0000, 1);
    this.mapPlayerMarker.setStrokeStyle(2, 0xffffff);
    this.mapContainer.add(this.mapPlayerMarker);

    // Pulse animation for player marker
    this.tweens.add({
      targets: this.mapPlayerMarker,
      scale: 1.3,
      alpha: 0.7,
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    // Legend at bottom
    const legend = this.add.text(mapWidth / 2, mapHeight + 15,
      `Badges: ${gameState.badges.length}/${region.gyms.length}  |  [M] Close`, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#94a3b8"
    }).setOrigin(0.5);
    this.mapContainer.add(legend);
  }

  private closeVisualMap(): void {
    this.mapOpen = false;
    this.touch?.setVisible(true);
    if (this.mapContainer) {
      this.mapContainer.destroy();
      this.mapContainer = undefined;
    }
    this.mapGraphics = undefined;
    this.mapPlayerMarker = undefined;
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.physics.pause();
    this.touch?.setVisible(false);

    // Close any open menus
    if (this.mapOpen) {
      this.closeVisualMap();
    }
    if (this.teamOpen) this.closeTeamScreen();
    if (this.pokedexOpen) this.closePokedex();

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Dark overlay
    this.pauseOverlay = this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.7);
    this.pauseOverlay.setScrollFactor(0);
    this.pauseOverlay.setDepth(1000);

    // Pause title
    const title = this.add.text(centerX, centerY - 100, "PAUSED", {
      fontFamily: "monospace",
      fontSize: "36px",
      color: "#fbbf24",
      fontStyle: "bold"
    });
    title.setScrollFactor(0).setOrigin(0.5).setDepth(1001);
    this.pauseText.push(title);

    // Menu options
    const menuItems = [
      { label: "Resume Game", y: centerY - 20 },
      { label: "Save Game [S]", y: centerY + 30 },
      { label: "Load Game [F1]", y: centerY + 80 }
    ];

    menuItems.forEach((item) => {
      const text = this.add.text(centerX, item.y, item.label, {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#f8fafc",
        backgroundColor: "#1e293b",
        padding: { left: 20, right: 20, top: 10, bottom: 10 }
      });
      text.setScrollFactor(0).setOrigin(0.5).setDepth(1001);
      text.setInteractive({ useHandCursor: true });
      text.on("pointerover", () => text.setStyle({ backgroundColor: "#334155" }));
      text.on("pointerout", () => text.setStyle({ backgroundColor: "#1e293b" }));
      if (item.label === "Resume Game") {
        text.on("pointerdown", () => this.resumeGame());
      } else if (item.label === "Save Game [S]") {
        text.on("pointerdown", () => {
          if (saveGame()) {
            Sound.playMenuSelect();
            this.showNotification("Game Saved!", 1500);
          }
        });
      } else if (item.label === "Load Game [F1]") {
        text.on("pointerdown", () => {
          if (loadGame()) {
            Sound.playMenuSelect();
            this.resumeGame();
            this.time.delayedCall(100, () => {
              this.scene.restart();
            });
          } else {
            this.showNotification("No save data found!", 1500);
          }
        });
      }
      this.pauseText.push(text);
    });

    // Controls hint
    const hint = this.add.text(centerX, centerY + 150, "Press ESC to resume", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#6b7280"
    });
    hint.setScrollFactor(0).setOrigin(0.5).setDepth(1001);
    this.pauseText.push(hint);
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.physics.resume();
    this.touch?.setVisible(true);

    // Clean up pause UI
    if (this.pauseOverlay) {
      this.pauseOverlay.destroy();
      this.pauseOverlay = undefined;
    }
    this.pauseText.forEach(t => t.destroy());
    this.pauseText = [];
  }

  private openTeamScreen(): void {
    if (this.teamOpen) return;
    this.teamOpen = true;
    this.teamTab = "team";
    this.teamSelectedMon = null;
    this.touch?.setVisible(false);
    this.renderTeamScreen();
  }

  private renderTeamScreen(): void {
    // Destroy any existing team UI
    if (this.teamOverlay) { this.teamOverlay.destroy(); this.teamOverlay = undefined; }
    this.teamText.forEach(t => t.destroy());
    this.teamText = [];

    const width = 620;
    const height = 430;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.teamOverlay = this.add.rectangle(centerX, centerY, width, height, 0x0f172a, 0.97)
      .setScrollFactor(0).setDepth(500).setStrokeStyle(2, 0x334155);

    const push = (go: Phaser.GameObjects.GameObject) => {
      (go as Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.GameObject).setScrollFactor?.(0);
      (go as Phaser.GameObjects.Components.Depth & Phaser.GameObjects.GameObject).setDepth?.(501);
      this.teamText.push(go as Phaser.GameObjects.Text);
    };

    // ---- Tabs ----
    const tabTeam = this.add.text(centerX - 200, centerY - 200, "[TEAM]", {
      fontFamily: "monospace", fontSize: "18px",
      color: this.teamTab === "team" ? "#fbbf24" : "#64748b",
      backgroundColor: this.teamTab === "team" ? "#1e293b" : "transparent",
      padding: { left: 10, right: 10, top: 4, bottom: 4 }
    }).setScrollFactor(0).setDepth(502).setInteractive({ useHandCursor: true });
    tabTeam.on("pointerdown", () => { this.teamTab = "team"; this.teamSelectedMon = null; this.renderTeamScreen(); });
    this.teamText.push(tabTeam);

    const tabBox = this.add.text(centerX - 80, centerY - 200, "[BOX]", {
      fontFamily: "monospace", fontSize: "18px",
      color: this.teamTab === "box" ? "#fbbf24" : "#64748b",
      backgroundColor: this.teamTab === "box" ? "#1e293b" : "transparent",
      padding: { left: 10, right: 10, top: 4, bottom: 4 }
    }).setScrollFactor(0).setDepth(502).setInteractive({ useHandCursor: true });
    tabBox.on("pointerdown", () => { this.teamTab = "box"; this.teamSelectedMon = null; this.renderTeamScreen(); });
    this.teamText.push(tabBox);

    if (this.teamTab === "team") {
      this.renderTeamTab(centerX, centerY, push);
    } else {
      this.renderBoxTab(centerX, centerY, push);
    }

    const close = this.add.text(centerX - 290, centerY + 195, "[T] Close", {
      fontFamily: "monospace", fontSize: "13px", color: "#6b7280"
    }).setScrollFactor(0).setDepth(502);
    this.teamText.push(close);
  }

  private renderTeamTab(
    centerX: number, centerY: number,
    push: (go: Phaser.GameObjects.GameObject) => void
  ): void {
    const selected = this.teamSelectedMon;

    if (gameState.team.length === 0) {
      push(this.add.text(centerX - 270, centerY - 140, "No Pokemon in team", {
        fontFamily: "monospace", fontSize: "14px", color: "#6b7280"
      }));
      return;
    }

    gameState.team.forEach((mon, index) => {
      const y = centerY - 150 + index * 46;
      const hpPercent = Math.floor((mon.hp / mon.maxHp) * 100);
      const hpColor = hpPercent > 50 ? "#22c55e" : hpPercent > 20 ? "#eab308" : "#ef4444";
      const statusStr = mon.status !== "none" ? ` [${mon.status.toUpperCase()}]` : "";
      const isSelected = selected?.source === "team" && selected.index === index;
      const heldStr = mon.heldItem ? ` [${HELD_ITEMS[mon.heldItem]?.name ?? mon.heldItem}]` : "";

      const bg = this.add.rectangle(centerX - 5, y + 20, 570, 40,
        isSelected ? 0x334155 : 0x1e293b, 0.8)
        .setScrollFactor(0).setDepth(501).setStrokeStyle(1, isSelected ? 0xfbbf24 : 0x334155)
        .setInteractive({ useHandCursor: true });
      bg.on("pointerdown", () => {
        if (isSelected) {
          this.teamSelectedMon = null;
        } else {
          this.teamSelectedMon = { source: "team", index };
        }
        this.renderTeamScreen();
      });
      this.teamText.push(bg);

      push(this.add.text(centerX - 285, y + 6,
        `${index + 1}. ${mon.nickname || mon.name} Lv${mon.level}${heldStr}`, {
        fontFamily: "monospace", fontSize: "15px",
        color: mon.hp > 0 ? "#f8fafc" : "#6b7280"
      }));
      push(this.add.text(centerX - 285, y + 26,
        `   HP: ${mon.hp}/${mon.maxHp} (${hpPercent}%)${statusStr}`, {
        fontFamily: "monospace", fontSize: "11px", color: hpColor
      }));
    });

    // Action panel when a team mon is selected
    if (selected?.source === "team") {
      const mon = gameState.team[selected.index];
      if (mon) {
        const panelY = centerY + 100;
        push(this.add.text(centerX - 290, panelY, `Selected: ${mon.name}`, {
          fontFamily: "monospace", fontSize: "13px", color: "#fbbf24"
        }));

        // Send to Box button
        const toBoxBtn = this.add.text(centerX - 290, panelY + 22, "[Send to Box]", {
          fontFamily: "monospace", fontSize: "13px", color: "#0f172a",
          backgroundColor: "#94a3b8",
          padding: { left: 8, right: 8, top: 3, bottom: 3 }
        }).setScrollFactor(0).setDepth(502).setInteractive({ useHandCursor: true });
        toBoxBtn.on("pointerdown", () => {
          if (gameState.team.length <= 1) {
            this.showNotification("Can't box your last Pokemon!", 1500);
            return;
          }
          const [removed] = gameState.team.splice(selected.index, 1);
          addToBox(gameState, removed);
          this.teamSelectedMon = null;
          this.renderTeamScreen();
          this.showNotification(`${removed.name} moved to Box!`, 1500);
        });
        this.teamText.push(toBoxBtn);

        // Held item equip/unequip
        const heldItems = (["oranberry", "luckyegg", "shellbell"] as const).filter(
          k => (gameState.inventory[k] ?? 0) > 0
        );
        if (heldItems.length > 0 || mon.heldItem) {
          let itemBtnX = centerX - 40;
          if (mon.heldItem) {
            const unequipBtn = this.add.text(itemBtnX, panelY + 22, "[Unequip]", {
              fontFamily: "monospace", fontSize: "13px", color: "#0f172a",
              backgroundColor: "#ef4444",
              padding: { left: 8, right: 8, top: 3, bottom: 3 }
            }).setScrollFactor(0).setDepth(502).setInteractive({ useHandCursor: true });
            unequipBtn.on("pointerdown", () => {
              const key = mon.heldItem! as keyof typeof gameState.inventory;
              gameState.inventory[key] = (gameState.inventory[key] ?? 0) + 1;
              mon.heldItem = undefined;
              this.renderTeamScreen();
              this.showNotification("Item unequipped!", 1200);
            });
            this.teamText.push(unequipBtn);
            itemBtnX += 120;
          }
          heldItems.forEach(itemKey => {
            const info = HELD_ITEMS[itemKey];
            const equipBtn = this.add.text(itemBtnX, panelY + 22, `[Equip ${info.name}]`, {
              fontFamily: "monospace", fontSize: "12px", color: "#0f172a",
              backgroundColor: "#fbbf24",
              padding: { left: 6, right: 6, top: 3, bottom: 3 }
            }).setScrollFactor(0).setDepth(502).setInteractive({ useHandCursor: true });
            equipBtn.on("pointerdown", () => {
              if (mon.heldItem) {
                // Return existing held item to inventory
                const oldKey = mon.heldItem as keyof typeof gameState.inventory;
                gameState.inventory[oldKey] = (gameState.inventory[oldKey] ?? 0) + 1;
              }
              gameState.inventory[itemKey] = Math.max(0, (gameState.inventory[itemKey] ?? 0) - 1);
              mon.heldItem = itemKey;
              this.renderTeamScreen();
              this.showNotification(`${mon.name} is holding ${info.name}!`, 1500);
            });
            this.teamText.push(equipBtn);
            itemBtnX += equipBtn.width + 8;
          });
        }
      }
    }
  }

  private renderBoxTab(
    centerX: number, centerY: number,
    push: (go: Phaser.GameObjects.GameObject) => void
  ): void {
    const selected = this.teamSelectedMon;

    if (gameState.box.length === 0) {
      push(this.add.text(centerX - 270, centerY - 140,
        "Your PC Box is empty.\nSend Pokemon here from the TEAM tab.", {
        fontFamily: "monospace", fontSize: "14px", color: "#6b7280", lineSpacing: 4
      }));
      return;
    }

    // Show up to 20 box Pokemon in a grid (4 columns × 5 rows)
    const cols = 4;
    const cellW = 140;
    const cellH = 54;
    const gridStartX = centerX - 280;
    const gridStartY = centerY - 155;

    gameState.box.slice(0, 20).forEach((mon, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const bx = gridStartX + col * cellW;
      const by = gridStartY + row * cellH;
      const isSelected = selected?.source === "box" && selected.index === index;

      const bg = this.add.rectangle(bx + cellW / 2 - 4, by + cellH / 2 - 4,
        cellW - 6, cellH - 6, isSelected ? 0x334155 : 0x1e293b, 0.9)
        .setScrollFactor(0).setDepth(501).setStrokeStyle(1, isSelected ? 0xfbbf24 : 0x334155)
        .setInteractive({ useHandCursor: true });
      bg.on("pointerdown", () => {
        if (isSelected) {
          this.teamSelectedMon = null;
        } else {
          this.teamSelectedMon = { source: "box", index };
        }
        this.renderTeamScreen();
      });
      this.teamText.push(bg);

      push(this.add.text(bx, by + 4, `${mon.nickname || mon.name}`, {
        fontFamily: "monospace", fontSize: "12px", color: "#f8fafc"
      }));
      push(this.add.text(bx, by + 20, `Lv${mon.level}  ${mon.types[0]}`, {
        fontFamily: "monospace", fontSize: "10px", color: "#94a3b8"
      }));
    });

    if (gameState.box.length > 20) {
      push(this.add.text(centerX - 270, centerY + 155,
        `+${gameState.box.length - 20} more in Box (showing first 20)`, {
        fontFamily: "monospace", fontSize: "11px", color: "#6b7280"
      }));
    }

    // Action panel when a box mon is selected
    if (selected?.source === "box") {
      const mon = gameState.box[selected.index];
      if (mon) {
        const panelY = centerY + 165;
        push(this.add.text(centerX - 290, panelY, `Selected: ${mon.name} Lv${mon.level}`, {
          fontFamily: "monospace", fontSize: "12px", color: "#fbbf24"
        }));

        // Add to Team button
        const addBtn = this.add.text(centerX - 70, panelY, "[Add to Team]", {
          fontFamily: "monospace", fontSize: "12px", color: "#0f172a",
          backgroundColor: "#22c55e",
          padding: { left: 8, right: 8, top: 3, bottom: 3 }
        }).setScrollFactor(0).setDepth(502).setInteractive({ useHandCursor: true });
        addBtn.on("pointerdown", () => {
          if (gameState.team.length >= 6) {
            this.showNotification("Team is full! Send someone to Box first.", 2000);
            return;
          }
          const [removed] = gameState.box.splice(selected.index, 1);
          gameState.team.push(removed);
          this.teamSelectedMon = null;
          this.renderTeamScreen();
          this.showNotification(`${removed.name} added to team!`, 1500);
        });
        this.teamText.push(addBtn);
      }
    }
  }

  private closeTeamScreen(): void {
    this.teamOpen = false;
    this.teamSelectedMon = null;
    this.touch?.setVisible(true);
    if (this.teamOverlay) { this.teamOverlay.destroy(); this.teamOverlay = undefined; }
    this.teamText.forEach((item) => item.destroy());
    this.teamText = [];
  }

  private makePanel(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
    objs: Phaser.GameObjects.GameObject[],
    depth = 500
  ): void {
    g.fillStyle(0x0f172a, 0.96);
    g.fillRoundedRect(x, y, w, h, 12);
    g.lineStyle(2, 0xffffff, 0.15);
    g.strokeRoundedRect(x, y, w, h, 12);
    g.fillStyle(0xfbbf24, 0.18);
    g.fillRoundedRect(x, y, w, 40, 12);
    g.fillRect(x, y + 20, w, 20);
    const titleText = this.add
      .text(x + w / 2, y + 20, title, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);
    objs.push(titleText);
  }

  private openPokedex(): void {
    if (this.pokedexOpen) return;
    this.pokedexOpen = true;
    this.touch?.setVisible(false);
    const width = 600;
    const height = 400;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const panelX = centerX - width / 2;
    const panelY = centerY - height / 2;

    // Use makePanel helper for consistent UI
    const panelG = this.add.graphics().setScrollFactor(0).setDepth(499);
    this.makePanel(panelG, panelX, panelY, width, height, "Pokédex", this.pokedexText as unknown as Phaser.GameObjects.GameObject[], 500);
    // Keep a reference for cleanup (store in pokedexOverlay slot via hack-free approach)
    this.pokedexOverlay = panelG as unknown as Phaser.GameObjects.Rectangle;

    const pokedexCount = getPokedexCount(gameState);
    const statsStr = `Seen: ${pokedexCount.seen}  |  Caught: ${pokedexCount.caught}`;
    const statsText = this.add.text(centerX, panelY + 58, statsStr, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ef4444"
    }).setScrollFactor(0).setOrigin(0.5);
    this.pokedexText.push(statsText);

    // Show caught Pokemon
    const entries = Object.entries(gameState.pokedex).filter(([_, data]) => data.caught);
    const columns = 3;
    entries.slice(0, 18).forEach(([speciesId, data], index) => {
      const species = SPECIES[speciesId];
      if (!species) return;
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = centerX - 260 + col * 180;
      const y = centerY - 130 + row * 45;

      const text = this.add.text(x, y,
        `#${(index + 1).toString().padStart(3, "0")} ${species.name}`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: data.caught ? "#22c55e" : "#6b7280"
      });
      text.setScrollFactor(0);
      this.pokedexText.push(text);
    });

    if (entries.length === 0) {
      const empty = this.add.text(centerX - 280, centerY - 100, "No Pokemon caught yet!\nGo explore and catch some!", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#6b7280"
      });
      empty.setScrollFactor(0);
      this.pokedexText.push(empty);
    }

    const close = this.add.text(centerX - 280, centerY + 160, "[D] Close Pokedex", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#6b7280"
    });
    close.setScrollFactor(0);
    this.pokedexText.push(close);
  }

  private closePokedex(): void {
    this.pokedexOpen = false;
    this.touch?.setVisible(true);
    if (this.pokedexOverlay) this.pokedexOverlay.destroy();
    this.pokedexText.forEach((item) => item.destroy());
    this.pokedexText = [];
  }

  private openStarterSelect(): void {
    this.starterOpen = true;
    this.touch?.setVisible(false);
    const W = this.scale.width;
    const H = this.scale.height;
    const centerX = W / 2;
    const centerY = H / 2;

    // Scale panel to fit the viewport on any screen size
    const panelWidth = Math.min(520, W - 16);
    const s = panelWidth / 520; // uniform scale factor
    const panelHeight = Math.min(Math.round(420 * s), H - 60);

    this.starterOverlay = this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0x0f172a, 0.97);
    this.starterOverlay.setScrollFactor(0);
    this.starterOverlay.setStrokeStyle(3, 0xfbbf24);

    // Title
    const title = this.add.text(centerX, centerY - Math.round(175 * s), "Choose Your Partner!", {
      fontFamily: "monospace",
      fontSize: `${Math.max(14, Math.round(24 * s))}px`,
      color: "#fbbf24",
      fontStyle: "bold"
    });
    title.setScrollFactor(0).setOrigin(0.5);
    this.starterText.push(title);

    // Subtitle
    const subtitle = this.add.text(centerX, centerY - Math.round(145 * s), "Your first Pokemon awaits...", {
      fontFamily: "monospace",
      fontSize: `${Math.max(10, Math.round(14 * s))}px`,
      color: "#94a3b8"
    });
    subtitle.setScrollFactor(0).setOrigin(0.5);
    this.starterText.push(subtitle);

    const starters = [
      { id: "bulbasaur", type: "Grass/Poison", color: 0x22c55e, darkColor: 0x166534 },
      { id: "charmander", type: "Fire", color: 0xf97316, darkColor: 0xc2410c },
      { id: "squirtle", type: "Water", color: 0x3b82f6, darkColor: 0x1d4ed8 },
      { id: "pikachu", type: "Electric", color: 0xfbbf24, darkColor: 0xd97706 }
    ];

    // 2x2 grid layout — positions scale with panel
    const gridStartX = centerX - Math.round(115 * s);
    const gridStartY = centerY - Math.round(70 * s);
    const cellWidth = Math.round(230 * s);
    const cellHeight = Math.round(140 * s);
    const cardW = Math.round(200 * s);
    const cardH = Math.round(120 * s);
    const spriteH = Math.max(48, Math.round(80 * s));
    const spriteOffX = -Math.round(50 * s);
    const textOffX = Math.round(30 * s);

    starters.forEach((starter, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = gridStartX + col * cellWidth;
      const y = gridStartY + row * cellHeight;
      const name = SPECIES[starter.id].name;

      // Card background
      const cardBg = this.add.rectangle(x, y, cardW, cardH, starter.darkColor, 0.3);
      cardBg.setScrollFactor(0);
      cardBg.setStrokeStyle(2, starter.color);
      this.starterText.push(cardBg);

      // Pokemon sprite
      const spriteKey = this.textures.exists(`pokemon-${starter.id}`) ? `pokemon-${starter.id}` : "wild-fallback";
      const sprite = this.add.sprite(x + spriteOffX, y, spriteKey);
      sprite.setScrollFactor(0);
      this.applyDisplayHeight(sprite, spriteH);
      this.starterText.push(sprite);

      // Add idle animation to sprite
      this.tweens.add({
        targets: sprite,
        y: y - 5,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });

      // Pokemon name
      const nameText = this.add.text(x + textOffX, y - Math.round(25 * s), name, {
        fontFamily: "monospace",
        fontSize: `${Math.max(12, Math.round(18 * s))}px`,
        color: "#f8fafc",
        fontStyle: "bold"
      });
      nameText.setScrollFactor(0).setOrigin(0.5);
      this.starterText.push(nameText);

      // Type badge
      const typeBadge = this.add.text(x + textOffX, y + Math.round(5 * s), starter.type, {
        fontFamily: "monospace",
        fontSize: `${Math.max(9, Math.round(11 * s))}px`,
        color: "#ffffff",
        backgroundColor: `#${starter.color.toString(16).padStart(6, "0")}`,
        padding: { left: 8, right: 8, top: 3, bottom: 3 }
      });
      typeBadge.setScrollFactor(0).setOrigin(0.5);
      this.starterText.push(typeBadge);

      // Level indicator
      const levelText = this.add.text(x + textOffX, y + Math.round(30 * s), "Lv. 5", {
        fontFamily: "monospace",
        fontSize: `${Math.max(9, Math.round(12 * s))}px`,
        color: "#94a3b8"
      });
      levelText.setScrollFactor(0).setOrigin(0.5);
      this.starterText.push(levelText);

      // Make the whole card interactive
      cardBg.setInteractive({ useHandCursor: true });
      cardBg.on("pointerover", () => {
        cardBg.setStrokeStyle(3, 0xffffff);
        cardBg.setFillStyle(starter.color, 0.4);
        sprite.setScale(sprite.scaleX * 1.1, sprite.scaleY * 1.1);
      });
      cardBg.on("pointerout", () => {
        cardBg.setStrokeStyle(2, starter.color);
        cardBg.setFillStyle(starter.darkColor, 0.3);
        sprite.setScale(sprite.scaleX / 1.1, sprite.scaleY / 1.1);
      });
      cardBg.on("pointerdown", () => {
        Sound.playMenuSelect();
        const mon = makePokemon(starter.id, 5);
        gameState.playerStarter = starter.id;
        this.showStarterNamingPrompt(mon, name, () => {
          markCaught(gameState, starter.id);
          addToTeam(gameState, mon);
          this.closeStarterSelect();
          const displayName = mon.nickname || mon.name;
          this.showNotification(`${displayName} joined your team!`, 3000);
          Sound.playOverworldMusic();
          this.time.delayedCall(500, () => {
            this.createRivalSprites();
          });
        });
      });
    });

    // Bottom hint
    const hint = this.add.text(centerX, centerY + Math.round(175 * s), "Click a Pokemon to begin your adventure!", {
      fontFamily: "monospace",
      fontSize: `${Math.max(10, Math.round(13 * s))}px`,
      color: "#64748b"
    });
    hint.setScrollFactor(0).setOrigin(0.5);
    this.starterText.push(hint);
  }

  private closeStarterSelect(): void {
    this.starterOpen = false;
    this.touch?.setVisible(true);
    if (this.starterOverlay) this.starterOverlay.destroy();
    this.starterText.forEach((item) => item.destroy());
    this.starterText = [];
  }

  private showStarterNamingPrompt(mon: PokemonInstance, speciesName: string, onDone: () => void): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const depth = 1100;

    // Dark overlay
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75)
      .setScrollFactor(0).setDepth(depth);

    const panelW = 360;
    const panelH = 200;
    const panelX = W / 2 - panelW / 2;
    const panelY = H / 2 - panelH / 2;

    const panel = this.add.rectangle(W / 2, H / 2, panelW, panelH, 0x1e293b, 0.98)
      .setScrollFactor(0).setDepth(depth + 1);
    panel.setStrokeStyle(2, 0xfbbf24);

    const titleTxt = this.add.text(W / 2, panelY + 28, `What will you name your ${speciesName}?`, {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#fbbf24",
      wordWrap: { width: panelW - 32 },
      align: "center"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);

    // HTML input element
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 12;
    input.placeholder = speciesName;
    input.style.cssText = [
      "position:fixed",
      "left:50%",
      "top:50%",
      "transform:translate(-50%,-50%)",
      "background:#1e293b",
      "color:white",
      "border:2px solid #fbbf24",
      "font-family:monospace",
      "font-size:18px",
      "padding:8px 16px",
      "border-radius:6px",
      "text-align:center",
      "outline:none",
      "width:240px",
      "z-index:9999"
    ].join(";");
    document.body.appendChild(input);
    input.focus();

    const cleanup = () => {
      overlay.destroy();
      panel.destroy();
      titleTxt.destroy();
      confirmBtn.destroy();
      skipBtn.destroy();
      if (document.body.contains(input)) document.body.removeChild(input);
    };

    const confirm = () => {
      const val = input.value.trim();
      mon.nickname = val.length > 0 ? val : speciesName;
      cleanup();
      onDone();
    };

    const skip = () => {
      mon.nickname = speciesName;
      cleanup();
      onDone();
    };

    const btnY = panelY + panelH - 36;

    const confirmBtn = this.add.text(W / 2 - 60, btnY, "Confirm", {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#0f172a",
      backgroundColor: "#fbbf24",
      padding: { left: 12, right: 12, top: 6, bottom: 6 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2).setInteractive({ useHandCursor: true });
    confirmBtn.on("pointerdown", confirm);

    const skipBtn = this.add.text(W / 2 + 60, btnY, "Skip", {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#f8fafc",
      backgroundColor: "#6b7280",
      padding: { left: 12, right: 12, top: 6, bottom: 6 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2).setInteractive({ useHandCursor: true });
    skipBtn.on("pointerdown", skip);

    // Enter key confirms
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirm();
      else if (e.key === "Escape") skip();
    });

    void panelX; // suppress unused var
  }

  private openMart(): void {
    if (this.martOpen || this.teamOpen || this.mapOpen || this.pokedexOpen || this.isPaused) return;
    this.martOpen = true;
    this.touch?.setVisible(false);
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const cardW = 440;
    const cardH = 480;

    this.martOverlay = this.add.rectangle(centerX, centerY, cardW, cardH, 0x0f172a, 0.95);
    this.martOverlay.setScrollFactor(0).setDepth(950).setStrokeStyle(2, 0xfbbf24);
    this.martElements = [];

    // Title
    const title = this.add.text(centerX, centerY - cardH / 2 + 24, "Poke Mart", {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#fbbf24",
      fontStyle: "bold"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(951);
    this.martElements.push(title);

    // Money display
    const moneyText = this.add.text(centerX, centerY - cardH / 2 + 52, `Your money: ₽${gameState.money ?? 0}`, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#4ade80"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(951);
    this.martElements.push(moneyText);

    const items: Array<{ name: string; key: keyof typeof gameState.inventory; price: number; desc?: string }> = [
      { name: "Poke Ball",    key: "pokeball",    price: 100 },
      { name: "Great Ball",   key: "greatball",   price: 300 },
      { name: "Ultra Ball",   key: "ultraball",   price: 600 },
      { name: "Potion",       key: "potion",      price: 80  },
      { name: "Super Potion", key: "superpotion", price: 200 },
      { name: "Revive",       key: "revive",      price: 500 },
      { name: "Oran Berry",   key: "oranberry",   price: 150,  desc: "Held: restore 10 HP <50%" },
      { name: "Lucky Egg",    key: "luckyegg",    price: 2000, desc: "Held: 1.5x EXP" },
      { name: "Shell Bell",   key: "shellbell",   price: 1000, desc: "Held: restore 1/8 dmg dealt" }
    ];

    const startY = centerY - cardH / 2 + 90;
    const rowH = 38;

    items.forEach((item, i) => {
      const rowY = startY + i * rowH;

      // Item label
      const labelStr = item.desc
        ? `${item.name}  ₽${item.price}  (${item.desc})`
        : `${item.name}  ₽${item.price}`;
      const label = this.add.text(centerX - 195, rowY, labelStr, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#e2e8f0"
      }).setScrollFactor(0).setDepth(951);
      this.martElements.push(label);

      // Buy button
      const buyBtn = this.add.text(centerX + 175, rowY, "[Buy]", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#0f172a",
        backgroundColor: "#fbbf24",
        padding: { left: 7, right: 7, top: 2, bottom: 2 }
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(951).setInteractive({ useHandCursor: true });

      buyBtn.on("pointerover", () => buyBtn.setStyle({ backgroundColor: "#f59e0b" }));
      buyBtn.on("pointerout", () => buyBtn.setStyle({ backgroundColor: "#fbbf24" }));
      buyBtn.on("pointerdown", () => {
        const currentMoney = gameState.money ?? 0;
        if (currentMoney < item.price) {
          this.showNotification("Not enough money!", 1500);
          return;
        }
        gameState.money = currentMoney - item.price;
        gameState.inventory[item.key] = (gameState.inventory[item.key] ?? 0) + 1;
        Sound.playMenuSelect();
        moneyText.setText(`Your money: ₽${gameState.money}`);
        this.showNotification(`Bought ${item.name}!`, 1200);
      });
      this.martElements.push(buyBtn);
    });

    // Close button
    const closeBtn = this.add.text(centerX, centerY + cardH / 2 - 24, "[Close]", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#f8fafc",
      backgroundColor: "#374151",
      padding: { left: 16, right: 16, top: 8, bottom: 8 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(951).setInteractive({ useHandCursor: true });
    closeBtn.on("pointerdown", () => this.closeMart());
    this.martElements.push(closeBtn);
  }

  private closeMart(): void {
    this.martOpen = false;
    this.touch?.setVisible(true);
    if (this.martOverlay) {
      this.martOverlay.destroy();
      this.martOverlay = undefined;
    }
    this.martElements.forEach(el => (el as Phaser.GameObjects.GameObject).destroy());
    this.martElements = [];
  }

  private showTutorial(): void {
    const tips = [
      {
        title: "🕹️ Move around",
        desc: "Use arrow keys or the on-screen joystick\nto explore the world."
      },
      {
        title: "⚔️ Battle Pokémon",
        desc: "Walk into wild Pokémon to fight them.\nFind trainers and talk to them for a challenge!"
      },
      {
        title: "🎯 Catch Pokémon",
        desc: "In battle, choose 'Bag → Pokéball' then\naim your throw at the moving target ring."
      },
      {
        title: "🏆 Your Goal",
        desc: "Defeat the 3 Gym Leaders then challenge\nthe Elite Four at the League Entrance!"
      }
    ];

    let tipIndex = 0;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const cardW = 400;
    const cardH = 280;

    // Dark overlay
    const overlay = this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.82)
      .setScrollFactor(0).setDepth(1000).setInteractive();
    this.tutorialElements.push(overlay);

    // Card background
    const card = this.add.rectangle(centerX, centerY, cardW, cardH, 0x1e293b, 1)
      .setScrollFactor(0).setDepth(1001).setStrokeStyle(2, 0xfbbf24);
    this.tutorialElements.push(card);

    // Title text
    const titleText = this.add.text(centerX, centerY - 90, tips[0].title, {
      fontFamily: "monospace",
      fontSize: "24px",
      color: "#fbbf24",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
    this.tutorialElements.push(titleText);

    // Description text
    const descText = this.add.text(centerX, centerY - 10, tips[0].desc, {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#e2e8f0",
      align: "center",
      lineSpacing: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
    this.tutorialElements.push(descText);

    // Progress indicator
    const progressText = this.add.text(centerX, centerY + 70, "1 / 4", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#94a3b8"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
    this.tutorialElements.push(progressText);

    // Next button
    const nextBtn = this.add.text(centerX + 120, centerY + 100, "Next →", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#0f172a",
      backgroundColor: "#fbbf24",
      fontStyle: "bold",
      padding: { left: 16, right: 16, top: 8, bottom: 8 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002).setInteractive({ useHandCursor: true });
    this.tutorialElements.push(nextBtn);

    nextBtn.on("pointerover", () => nextBtn.setStyle({ backgroundColor: "#f59e0b" }));
    nextBtn.on("pointerout", () => nextBtn.setStyle({ backgroundColor: "#fbbf24" }));
    nextBtn.on("pointerdown", () => {
      tipIndex++;
      if (tipIndex >= tips.length) {
        // Close tutorial
        gameState.tutorialSeen = true;
        this.tutorialElements.forEach(el => (el as Phaser.GameObjects.GameObject).destroy());
        this.tutorialElements = [];
        return;
      }
      const tip = tips[tipIndex];
      titleText.setText(tip.title);
      descText.setText(tip.desc);
      progressText.setText(`${tipIndex + 1} / ${tips.length}`);
      if (tipIndex === tips.length - 1) {
        nextBtn.setText("Got it!");
      }
    });
  }

  private findTownOrLandmark(region: RegionData, id: string): TownData | LandmarkData | null {
    const town = region.towns.find((t) => t.id === id);
    if (town) return town;
    const landmark = region.landmarks.find((l) => l.id === id);
    return landmark ?? null;
  }

  private getWorldBounds(region: RegionData) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    region.zones.forEach((zone) => {
      minX = Math.min(minX, (zone.x - zone.r) * WORLD_SCALE);
      maxX = Math.max(maxX, (zone.x + zone.r) * WORLD_SCALE);
      minY = Math.min(minY, (zone.y - zone.r) * WORLD_SCALE);
      maxY = Math.max(maxY, (zone.y + zone.r) * WORLD_SCALE);
    });
    region.gyms.forEach((gym) => {
      minX = Math.min(minX, gym.x * WORLD_SCALE);
      maxX = Math.max(maxX, gym.x * WORLD_SCALE);
      minY = Math.min(minY, gym.y * WORLD_SCALE);
      maxY = Math.max(maxY, gym.y * WORLD_SCALE);
    });
    region.powerSpots.forEach((spot) => {
      minX = Math.min(minX, spot.x * WORLD_SCALE);
      maxX = Math.max(maxX, spot.x * WORLD_SCALE);
      minY = Math.min(minY, spot.y * WORLD_SCALE);
      maxY = Math.max(maxY, spot.y * WORLD_SCALE);
    });
    region.towns.forEach((town) => {
      minX = Math.min(minX, town.x * WORLD_SCALE);
      maxX = Math.max(maxX, town.x * WORLD_SCALE);
      minY = Math.min(minY, town.y * WORLD_SCALE);
      maxY = Math.max(maxY, town.y * WORLD_SCALE);
    });
    region.landmarks.forEach((landmark) => {
      minX = Math.min(minX, landmark.x * WORLD_SCALE);
      maxX = Math.max(maxX, landmark.x * WORLD_SCALE);
      minY = Math.min(minY, landmark.y * WORLD_SCALE);
      maxY = Math.max(maxY, landmark.y * WORLD_SCALE);
    });

    const padding = 150;
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    };
  }
}
