import { rng } from "../game/rng";
import { emitTestEvent } from "../game/testBridge";
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
  markSeen,
  generateRivalEncounters,
  getRivalTeam,
  HELD_ITEMS,
  EVO_STONES,
  tryItemEvolution
} from "../game/state";
import { pickWeighted } from "../game/utils";
import { getStatusColor, getStatusDisplayText } from "../game/battle";
import * as Sound from "../game/sound";
import { saveGame, loadGame } from "../game/persistence";
import { TouchControls } from "../game/touch";
import { fitMenu } from "../game/uiLayout";

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
  private hudVisible = true;
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
  // Perf caches: O(1) zone lookup per region, and skip HUD re-layout when unchanged.
  private zoneMap: Map<string, { x: number; y: number; r: number }> = new Map();
  private zoneMapRegion = -1;
  private lastHudText = "";
  private cameraAssignmentTimer = 0;
  private poiHudTimer = 0;
  private nearbyCheckTimer = 0;
  // Dedicated UI camera (zoom 1) so the device camera zoom never shrinks/recentres the HUD & controls.
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
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
  private teamText: Phaser.GameObjects.GameObject[] = [];
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
  private inBattle = false;
  private walkTime = 0;
  private playerBaseScale = 1;
  private lastValidPlayerPosition = new Phaser.Math.Vector2();
  private vignette?: Phaser.GameObjects.Graphics;
  private martOpen = false;
  private martOverlay?: Phaser.GameObjects.Rectangle;
  private martElements: Phaser.GameObjects.GameObject[] = [];
  private tutorialElements: Phaser.GameObjects.GameObject[] = [];
  // Elite Four
  private e4CooldownActive = false;
  private championOverlay?: Phaser.GameObjects.Rectangle;
  private championElements: Phaser.GameObjects.GameObject[] = [];
  // Responsive menu containers: each wraps a full-screen overlay so it can be
  // uniformly scaled to fit any viewport (see fitOpenMenus / uiLayout.fitMenu).
  private martContainer?: Phaser.GameObjects.Container;
  private martPage = 0;
  private pokedexContainer?: Phaser.GameObjects.Container;
  private teamContainer?: Phaser.GameObjects.Container;
  private championContainer?: Phaser.GameObjects.Container;
  // Box tab for team screen
  private teamTab: "team" | "box" = "team";
  private teamSelectedMon: { source: "team" | "box"; index: number } | null = null;
  // Service choice menu (shown when near multiple town services on touch)
  private serviceMenuOpen = false;
  private serviceMenuElements: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("Overworld");
  }

  create(): void {
    // Smooth fade-in (pairs with the portal/scene fade-out).
    this.cameras.main.fadeIn(250, 0, 0, 0);
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
    this.lastValidPlayerPosition.set(startX, startY);
    this.physics.add.collider(this.player, this.propBodies);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.setupCameraZoom();
    this.scale.on("resize", this.setupCameraZoom, this);

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
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#0f172acc",
      padding: { left: 10, right: 10, top: 6, bottom: 6 },
      lineSpacing: 2
    });
    this.hudText.setScrollFactor(0);

    // Notification text for item pickups etc.
    this.notificationText = this.add.text(this.scale.width / 2, 80, "", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#fbbf24",
      backgroundColor: "#0f172add",
      align: "center",
      wordWrap: { width: Math.min(this.scale.width - 32, 520) },
      padding: { left: 12, right: 12, top: 8, bottom: 8 }
    });
    this.notificationText.setScrollFactor(0).setOrigin(0.5).setVisible(false);

    // On-screen touch controls (only created on touch / coarse-pointer devices).
    // Hidden immediately if a modal (starter select / tutorial) is about to show —
    // they'll be restored when that modal closes.
    this.touch = new TouchControls(this, [
      { id: "interact", label: "Talk",  primary: true, color: 0x16a34a },
      { id: "item",     label: "Items", color: 0x0ea5e9 },
      { id: "team",     label: "Team",  color: 0x7c3aed },
      { id: "map",      label: "Map",   color: 0xb45309 },
      { id: "menu",     label: "≡",     color: 0x334155, corner: true }
    ]);
    if (gameState.team.length === 0 || !gameState.tutorialSeen) {
      this.touch?.setVisible(false);
    }

    // Hide controls whenever the scene is paused (e.g. a battle launches) and
    // restore them when it resumes.
    this.events.on(Phaser.Scenes.Events.PAUSE, () => this.touch?.setVisible(false));
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      if (!this.starterOpen && !this.isPaused) {
        this.touch?.setVisible(true);
        this.setHudVisible(true);
        if (this.inBattle) {
          this.inBattle = false;
          const ok = saveGame();
          emitTestEvent("save:fired", { reason: "post-battle", ok });
          if (ok) {
            this.showNotification("💾 Auto-saved", 1200);
          } else {
            this.showNotification("⚠ Auto-save failed (storage full?)", 2500);
          }
        }
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
      this.keepPlayerOnMap();
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

  update(_time: number, delta: number): void {
    // Keep UI (scrollFactor 0) on the un-zoomed UI camera and world on the main
    // camera. This is deliberately throttled because walking every child every
    // frame gets expensive as the map accumulates sprites, text, and overlays.
    this.cameraAssignmentTimer -= delta;
    if (this.cameraAssignmentTimer <= 0) {
      this.refreshCameraAssignments();
      this.cameraAssignmentTimer = 250;
    }

    if (this.starterOpen || this.isPaused || this.teamOpen || this.martOpen || this.pokedexOpen || this.mapOpen || this.serviceMenuOpen) {
      if (this.hudText?.visible) this.hudText.setVisible(false);
      return;
    }
    if (this.hudText && !this.hudText.visible) this.hudText.setVisible(true);

    if (this.battleStarting) return;

    this.interactPressed = false;
    this.processTouchButtons();

    // Handle notification timer
    if (this.notificationTimer > 0) {
      this.notificationTimer -= delta;
      // Keep the toast pinned just below the (variable-height) HUD every frame,
      // so it never drifts onto the status box if the HUD grew after it appeared.
      if (this.notificationText && this.notificationText.visible && this.hudText) {
        this.notificationText.setPosition(
          this.scale.width / 2,
          this.hudText.y + this.hudText.height + 22
        );
      }
      if (this.notificationTimer <= 0) {
        this.notificationText?.setVisible(false);
      }
    }

    // Handle XP boost timer
    if (this.xpBoostActive && this.xpBoostTimer > 0) {
      this.xpBoostTimer -= delta;
      if (this.xpBoostTimer <= 0) {
        this.xpBoostActive = false;
        gameState.xpMultiplier = 1;
        this.showNotification("XP boost has worn off!");
      }
    }

    // Update total play time and check for item respawns
    gameState.totalPlayTime += delta;
    const respawnedItems = checkItemRespawns(gameState);
    if (respawnedItems.length > 0) {
      this.createItemSpritesForIds(respawnedItems);
    }

    // Update power spot cooldowns
    for (const [spotId, cooldown] of this.powerSpotCooldowns.entries()) {
      if (cooldown > 0) {
        this.powerSpotCooldowns.set(spotId, cooldown - delta);
      }
    }

    this.updatePlayer();
    this.updateWildMons();
    this.poiHudTimer -= delta;
    if (this.poiHudTimer <= 0 || this.interactPressed) {
      this.updatePoiHud();
      this.poiHudTimer = 125;
    }
    this.handleHealing();
    this.nearbyCheckTimer -= delta;
    if (this.nearbyCheckTimer <= 0) {
      this.checkTrainerEncounters();
      this.checkRivalEncounters();
      this.checkItemPickups();
      this.checkPowerSpots();
      this.checkLeagueEntrance();
      this.checkPortals();
      this.nearbyCheckTimer = 100;
    }

    if (this.encounterCooldown > 0) {
      this.encounterCooldown -= delta;
    }
  }

  private keepPlayerOnMap(): void {
    const region = getRegion(gameState);
    if (this.isPointOnPlayableMap(this.player.x, this.player.y, region)) {
      this.lastValidPlayerPosition.set(this.player.x, this.player.y);
      return;
    }

    this.player.setPosition(this.lastValidPlayerPosition.x, this.lastValidPlayerPosition.y);
    this.player.setVelocity(0, 0);
  }

  private keepWildPokemonInZone(wild: { x: number; y: number; vx: number; vy: number }, zone: { x: number; y: number; r: number }): void {
    const centerX = zone.x * WORLD_SCALE;
    const centerY = zone.y * WORLD_SCALE;
    const maxRadius = zone.r * WORLD_SCALE * 0.92;
    const dx = wild.x - centerX;
    const dy = wild.y - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance <= maxRadius || distance === 0) return;

    wild.x = centerX + (dx / distance) * maxRadius;
    wild.y = centerY + (dy / distance) * maxRadius;
    wild.vx *= -0.35;
    wild.vy *= -0.35;
  }

  private isPointOnPlayableMap(x: number, y: number, region: RegionData): boolean {
    if (region.zones.some((zone) => this.isPointInZoneShape(x, y, zone, 1.12))) {
      return true;
    }

    if (region.routes.some((route) => this.isPointOnRoute(x, y, route, region))) {
      return true;
    }

    return [
      ...region.towns.map((point) => ({ x: point.x, y: point.y, radius: 34 })),
      ...region.landmarks.map((point) => ({ x: point.x, y: point.y, radius: 34 })),
      ...region.gyms.map((point) => ({ x: point.x, y: point.y, radius: 38 })),
      ...region.powerSpots.map((point) => ({ x: point.x, y: point.y, radius: 30 })),
      ...region.portals.map((point) => ({ x: point.x, y: point.y, radius: 34 }))
    ].some((point) => Phaser.Math.Distance.Between(x, y, point.x * WORLD_SCALE, point.y * WORLD_SCALE) <= point.radius);
  }

  private isPointInZoneShape(x: number, y: number, zone: RegionData["zones"][number], scale = 1): boolean {
    const centerX = zone.x * WORLD_SCALE;
    const centerY = zone.y * WORLD_SCALE;
    const r = zone.r * WORLD_SCALE * scale;
    const rotation = -((zone.rotation || 0) * Math.PI / 180);
    const dx = x - centerX;
    const dy = y - centerY;
    const localX = dx * Math.cos(rotation) - dy * Math.sin(rotation);
    const localY = dx * Math.sin(rotation) + dy * Math.cos(rotation);

    if (zone.shape === "ellipse") {
      const radiusX = r * 0.7;
      const radiusY = r * 0.4;
      return (localX * localX) / (radiusX * radiusX) + (localY * localY) / (radiusY * radiusY) <= 1;
    }

    if (zone.shape === "rounded") {
      return Math.abs(localX) <= r * 1.6 && Math.abs(localY) <= r * 1.2;
    }

    return localX * localX + localY * localY <= r * r;
  }

  private isPointOnRoute(x: number, y: number, route: RegionData["routes"][number], region: RegionData): boolean {
    const from = this.findTownOrLandmark(region, route.from);
    const to = this.findTownOrLandmark(region, route.to);
    if (!from || !to) return false;

    const ax = from.x * WORLD_SCALE;
    const ay = from.y * WORLD_SCALE;
    const bx = to.x * WORLD_SCALE;
    const by = to.y * WORLD_SCALE;
    const abx = bx - ax;
    const aby = by - ay;
    const lengthSq = abx * abx + aby * aby;
    if (lengthSq === 0) return false;

    const t = Phaser.Math.Clamp(((x - ax) * abx + (y - ay) * aby) / lengthSq, 0, 1);
    const closestX = ax + abx * t;
    const closestY = ay + aby * t;
    return Phaser.Math.Distance.Between(x, y, closestX, closestY) <= 18;
  }

  private showNotification(message: string, duration = 2000): void {
    if (this.notificationText) {
      this.notificationText.setText(message).setVisible(true);
      // Anchor the toast just under the HUD box so the two never overlap
      // (the HUD grows/shrinks with contextual hints, so measure it each time).
      const hudBottom = this.hudText ? this.hudText.y + this.hudText.height : 64;
      this.notificationText.setPosition(this.scale.width / 2, hudBottom + 22);
      this.notificationTimer = duration;
    }
  }

  private processTouchButtons(): void {
    if (!this.touch || !this.touch.active) return;

    if (this.touch.wasButtonPressed("interact")) {
      this.interactPressed = true;
    }
    if (this.touch.wasButtonPressed("item")) {
      // Distinguish "no potions" from "nobody needs healing" — previously both
      // showed "No potions left!", which lied when the team was simply full HP.
      if (gameState.inventory.potion <= 0) {
        this.showNotification("No potions left!");
      } else if (!gameState.team.some((m) => m.hp > 0 && m.hp < m.maxHp)) {
        this.showNotification("Team already at full HP!");
      } else if (usePotion(gameState)) {
        Sound.playHeal();
        this.showNotification("Used Potion!");
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

    this.keepPlayerOnMap();

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
    // Build/refresh the O(1) zone lookup when the region changes.
    if (this.zoneMapRegion !== gameState.regionIndex) {
      this.zoneMap = new Map(region.zones.map((z) => [z.id, { x: z.x, y: z.y, r: z.r }]));
      this.zoneMapRegion = gameState.regionIndex;
    }
    for (const wild of gameState.wildMons) {
      const zone = this.zoneMap.get(wild.zoneId);
      if (!zone) continue;
      const jitter = 0.3;
      wild.vx += (rng() - 0.5) * jitter;
      wild.vy += (rng() - 0.5) * jitter;
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
      this.keepWildPokemonInZone(wild, zone);

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
        const dxPlayer = this.player.x - wild.x;
        const dyPlayer = this.player.y - wild.y;
        if (dxPlayer * dxPlayer + dyPlayer * dyPlayer < 32 * 32) {
          // Never start a wild battle with a fully fainted team — there is
          // nobody to send out, so it would instant-escape and trigger the
          // auto-save loop. Heal/relocate instead (mirrors a battle defeat).
          if (!gameState.team.some((m) => m.hp > 0)) {
            emitTestEvent("encounter:blocked", { wildId: wild.id, reason: "no-alive-team" });
            this.handleBattleDefeat();
            break;
          }
          emitTestEvent("encounter:trigger", {
            wildId: wild.id,
            speciesId: wild.speciesId
          });
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
      const dx = this.player.x - trainerX;
      const dy = this.player.y - trainerY;
      if (dx * dx + dy * dy < 60 * 60) {
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
      const dx = this.player.x - itemX;
      const dy = this.player.y - itemY;
      if (dx * dx + dy * dy < 30 * 30) {
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

          // Remove item sprite with a little pop animation
          const sprite = this.itemSprites.get(item.id);
          if (sprite) {
            this.itemSprites.delete(item.id);
            this.tweens.add({
              targets: sprite,
              y: sprite.y - 16,
              scale: 0,
              alpha: 0,
              duration: 220,
              ease: "Back.easeIn",
              onComplete: () => sprite.destroy()
            });
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
      const dx = playerX - spotX;
      const dy = playerY - spotY;
      if (dx * dx + dy * dy < 35 * 35) {
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
    const speciesId = rarePool[Math.floor(rng() * rarePool.length)];
    const level = 10 + Math.floor(rng() * 10);

    const mon = makeWildPokemon(speciesId, level, "sanctuary");
    const angle = rng() * Math.PI * 2;
    const dist = 40 + rng() * 30;
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

    // Require every Gym Badge in the region before the League opens.
    const gymCount = getRegion(gameState).gyms.length;
    const leagueX = 45 * WORLD_SCALE;
    const leagueY = 35 * WORLD_SCALE;
    const dx = this.player.x - leagueX;
    const dy = this.player.y - leagueY;

    if (dx * dx + dy * dy < 80 * 80) {
      if (gameState.badges.length < gymCount) {
        // Show "need badges" hint once per approach
        if (!this.e4CooldownActive) {
          this.showNotification(`You need all ${gymCount} Gym Badges first!`, 2500);
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
    this.inBattle = true;
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

    // Full-screen dim stays unscaled so it always covers the whole viewport.
    const overlay = this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.85)
      .setScrollFactor(0).setDepth(1200).setInteractive();
    this.championElements.push(overlay);

    const gold = this.add.rectangle(centerX, centerY, 560, 320, 0x1a1000, 1)
      .setScrollFactor(0).setDepth(1201).setStrokeStyle(4, 0xffd700);

    const title = this.add.text(centerX, centerY - 110, "CHAMPION!", {
      fontFamily: "monospace",
      fontSize: "48px",
      color: "#ffd700",
      fontStyle: "bold"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1202);

    const sub = this.add.text(centerX, centerY - 40, "YOU ARE THE POKEMON CHAMPION!", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1202);

    const desc = this.add.text(centerX, centerY + 20,
      "You defeated all four Elite Four members\nand claimed the title of Champion!", {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#fbbf24",
      align: "center",
      lineSpacing: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1202);

    // The card scales to fit narrow phones (the dim overlay above does not).
    this.championContainer = this.add.container(0, 0, [gold, title, sub, desc]).setDepth(1201);
    fitMenu(this, this.championContainer, 560, 340);

    // Sparkle animation
    for (let i = 0; i < 20; i++) {
      this.time.delayedCall(i * 150, () => {
        const sx = centerX + (rng() - 0.5) * 480;
        const sy = centerY + (rng() - 0.5) * 260;
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
      if (this.championContainer) { this.championContainer.destroy(true); this.championContainer = undefined; }
    });

    Sound.playVictory();
  }

  private startTrainerBattle(trainer: NpcTrainer): void {
    this.encounterCooldown = 1500;
    this.inBattle = true;
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
    this.inBattle = true;
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
    this.inBattle = true;
    this.scene.pause();
    this.scene.launch("Battle", { wildId, type: "wild" });
    const battleScene = this.scene.get("Battle");
    battleScene.events.once("battle-complete", (payload: { wildId: string; result?: string }) => {
      if (!gameState.wildMons.find((m) => m.id === payload.wildId)) {
        const sprite = this.wildSprites.get(payload.wildId);
        if (sprite) {
          (sprite as unknown as { shadow?: Phaser.GameObjects.Ellipse }).shadow?.destroy();
          sprite.destroy();
          this.wildSprites.delete(payload.wildId);
        }
      }
      // A wild defeat must heal/relocate just like trainer defeats. Without this
      // the team stays fainted, so every following encounter instant-escapes and
      // the resume auto-save fires on a loop ("constant saves, no battles").
      if (payload.result === "defeat") {
        this.handleBattleDefeat();
      }
      this.scene.resume();
      Sound.playOverworldMusic();
    });
  }

  private startGymBattle(gymId: string): void {
    this.encounterCooldown = 1500;
    this.inBattle = true;
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
        mon.x = (zone.x + (rng() * 2 - 1) * zone.r * 0.8) * WORLD_SCALE;
        mon.y = (zone.y + (rng() * 2 - 1) * zone.r * 0.8) * WORLD_SCALE;
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
      const dx = this.player.x - portalX;
      const dy = this.player.y - portalY;
      if (dx * dx + dy * dy < 30 * 30) {
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

    // After the swirl, fade to black, then switch region (smoother than a snap).
    this.time.delayedCall(1400, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.uiCamera?.fadeOut(300, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
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
    const nameLabel = this.add.text(x, y + 35, "BLUE", {
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
    const dx = this.player.x - rivalX;
    const dy = this.player.y - rivalY;
    if (dx * dx + dy * dy < 50 * 50) {
      this.showNotification(`RIVAL: "${encounter.dialogue}"`, 3000);
      this.startRivalBattle(encounter);
    }
  }

  private startRivalBattle(encounter: RivalEncounter): void {
    this.encounterCooldown = 2000;
    this.inBattle = true;
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
    const g = this.zoneGraphics;
    region.zones.forEach((zone) => {
      const biome = BIOMES[zone.biome];
      const x = zone.x * WORLD_SCALE;
      const y = zone.y * WORLD_SCALE;
      const r = zone.r * WORLD_SCALE;
      const shape = zone.shape || "circle";
      const rotation = (zone.rotation || 0) * Math.PI / 180;
      // Flat biome fill. (A previous depth pass drew a darker rim + inset
      // fill, but the rim bled onto neighbouring zones and the blob bump
      // geometry didn't nest, producing dark seam lines across the map.)
      g.fillStyle(biome.color, 0.92);
      this.drawZoneShape(g, x, y, r, shape, rotation);

      // Lit centre: several lighter, concentric fills *inside* the zone fake a
      // soft radial gradient for gentle depth. They stay well within the radius
      // (same shape) so they never bleed onto neighbours the way an outer rim
      // did. Many thin layers at low alpha keep the falloff smooth (no banding).
      const layers = 12;
      for (let i = 1; i <= layers; i++) {
        const t = i / (layers + 1); // 0..1 inward
        const lit = Phaser.Display.Color.IntegerToColor(biome.color).lighten(Math.round(24 * t)).color;
        g.fillStyle(lit, 0.07);
        this.drawZoneShape(g, x, y, r * (1 - t * 0.85), shape, rotation);
      }
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

    // Draw each route as a dirt path: a darker earthy border underneath a
    // lighter sandy track on top. (Previously two lineStyle calls ran back to
    // back before any stroke, so only the last — a thin 3px white line — ever
    // drew, which read as a stray scratch across the grass.)
    const strokeAll = (width: number, color: number, alpha: number) => {
      this.routeGraphics.lineStyle(width, color, alpha);
      region.routes.forEach((route) => {
        const from = this.findTownOrLandmark(region, route.from);
        const to = this.findTownOrLandmark(region, route.to);
        if (!from || !to) return;
        const fromX = from.x * WORLD_SCALE;
        const fromY = from.y * WORLD_SCALE;
        const toX = to.x * WORLD_SCALE;
        const toY = to.y * WORLD_SCALE;
        this.routeGraphics.strokeLineShape(new Phaser.Geom.Line(fromX, fromY, toX, toY));
        // Round end-caps so the track blends into towns instead of butting flat.
        this.routeGraphics.fillStyle(color, alpha);
        this.routeGraphics.fillCircle(fromX, fromY, width / 2);
        this.routeGraphics.fillCircle(toX, toY, width / 2);
      });
    };

    strokeAll(16, 0x9c7b43, 0.55); // earthy border
    strokeAll(10, 0xcdb074, 0.95); // sandy track
  }

  private drawPointsOfInterest(region: RegionData): void {
    this.poiGraphics.clear();

    // Towns: house silhouette (triangle roof + rect body + door)
    region.towns.forEach((town) => {
      const x = town.x * WORLD_SCALE;
      const y = town.y * WORLD_SCALE;
      // Body
      this.poiGraphics.fillStyle(0xfef3c7, 0.95);
      this.poiGraphics.fillRect(x - 14, y - 8, 28, 22);
      // Roof
      this.poiGraphics.fillStyle(0xdc2626, 0.95);
      this.poiGraphics.fillTriangle(x, y - 26, x - 18, y - 8, x + 18, y - 8);
      // Door
      this.poiGraphics.fillStyle(0x92400e, 0.9);
      this.poiGraphics.fillRect(x - 5, y + 2, 10, 12);
      // Outline
      this.poiGraphics.lineStyle(2, 0x1f2937, 0.8);
      this.poiGraphics.strokeRect(x - 14, y - 8, 28, 22);
    });

    // Landmarks: triangle marker
    region.landmarks.forEach((landmark) => {
      const x = landmark.x * WORLD_SCALE;
      const y = landmark.y * WORLD_SCALE;
      this.poiGraphics.fillStyle(landmark.color, 0.9);
      this.poiGraphics.fillTriangle(x, y - 20, x - 14, y + 10, x + 14, y + 10);
      this.poiGraphics.lineStyle(2, 0xffffff, 0.6);
      this.poiGraphics.strokeTriangle(x, y - 20, x - 14, y + 10, x + 14, y + 10);
    });

    // Gyms: bold coloured building — taller than house, with pillars, banner stripe
    // and a type-coloured flag on top so it's unmistakably a gym.
    region.gyms.forEach((gym) => {
      const x = gym.x * WORLD_SCALE;
      const y = gym.y * WORLD_SCALE;
      const isDefeated = gameState.defeatedGyms[gym.id];
      const col = isDefeated ? 0x6b7280 : gym.color;
      const alpha = isDefeated ? 0.55 : 0.95;

      // Main building body — wider & taller than town house
      this.poiGraphics.fillStyle(0xdbeafe, alpha);
      this.poiGraphics.fillRect(x - 18, y - 14, 36, 28);
      this.poiGraphics.lineStyle(2, 0x1e40af, alpha);
      this.poiGraphics.strokeRect(x - 18, y - 14, 36, 28);

      // Flat roof / pediment (dark stripe across top)
      this.poiGraphics.fillStyle(0x1e40af, alpha);
      this.poiGraphics.fillRect(x - 20, y - 18, 40, 6);

      // Two pillars
      this.poiGraphics.fillStyle(0xffffff, alpha);
      this.poiGraphics.fillRect(x - 14, y - 14, 5, 22);
      this.poiGraphics.fillRect(x + 9,  y - 14, 5, 22);

      // Entrance door
      this.poiGraphics.fillStyle(col, alpha);
      this.poiGraphics.fillRect(x - 6, y + 2, 12, 12);

      // Type-coloured flag on a pole above the roof
      this.poiGraphics.lineStyle(2, 0x374151, 0.9);
      this.poiGraphics.strokeLineShape(new Phaser.Geom.Line(x, y - 18, x, y - 34));
      this.poiGraphics.fillStyle(col, isDefeated ? 0.5 : 1);
      this.poiGraphics.fillTriangle(x, y - 34, x + 12, y - 30, x, y - 26);

      // Checkmark overlay if defeated
      if (isDefeated) {
        this.poiGraphics.lineStyle(3, 0x22c55e, 0.9);
        this.poiGraphics.strokeTriangle(x - 7, y + 3, x - 1, y + 9, x + 8, y - 2);
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
        const angle = rng() * Math.PI * 2;
        const radius = rng() * zone.r * 0.9;
        const x = (zone.x + Math.cos(angle) * radius) * WORLD_SCALE;
        const y = (zone.y + Math.sin(angle) * radius) * WORLD_SCALE;
        const type = biome.props[Math.floor(rng() * biome.props.length)];
        const variant = Math.floor(rng() * 3); // 0, 1, or 2 variant
        const scale = 0.8 + rng() * 0.4; // 0.8 to 1.2 scale
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
      const height = (14 + rng() * 6) * s;

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
    const distSq = (x: number, y: number) => {
      const dx = playerX - x * WORLD_SCALE;
      const dy = playerY - y * WORLD_SCALE;
      return dx * dx + dy * dy;
    };

    const isTouch = this.touch?.active ?? false;

    // Collect touch-interactive services for the disambiguation menu
    type ServiceAction = { icon: string; label: string; action: () => void };
    const touchActions: ServiceAction[] = [];

    // --- Gym check ---
    let nearGymId: string | null = null;
    for (const gym of region.gyms) {
      if (distSq(gym.x, gym.y) < 90 * 90 && !gameState.defeatedGyms[gym.id]) {
        gymLabel = `${gym.name} · ${gym.leader}`;
        gymHint = isTouch ? "Talk: Battle Gym!" : "[E] Battle";
        nearGymId = gym.id;
        if (isTouch) {
          touchActions.push({ icon: "⚔️", label: `Battle ${gym.name}`, action: () => this.startGymBattle(gym.id) });
        } else if (this.keyE && this.input.keyboard?.checkDown(this.keyE, 250)) {
          this.startGymBattle(gym.id);
          return;
        }
        break;
      }
    }

    // --- Town check ---
    let martHint = "";
    for (const town of region.towns) {
      const distanceSq = distSq(town.x, town.y);
      if (distanceSq < 70 * 70) {
        locationLabel = town.name;
        if (town.services.includes("center")) {
          healHint = isTouch ? "Talk: Heal team!" : "[H] Heal";
          if (isTouch) {
            touchActions.push({ icon: "💊", label: "Heal Team", action: () => {
              Sound.playHeal();
              healTeam(gameState);
              this.showNotification("Your Pokémon have been healed!");
            }});
          }
        }
        if (town.services.includes("mart") && distanceSq < 50 * 50) {
          martHint = isTouch ? "Talk: Visit Mart!" : "[E] Mart";
          if (isTouch) {
            touchActions.push({ icon: "🛒", label: "Visit Mart", action: () => { if (!this.martOpen) this.openMart(); } });
          } else if (this.keyE && this.input.keyboard?.checkDown(this.keyE, 250) && !nearGymId) {
            if (!this.martOpen) this.openMart();
          }
        }
        break;
      }
    }

    // --- Touch interaction: single action fires directly, multiple show menu ---
    if (this.interactPressed && isTouch) {
      if (touchActions.length === 1) {
        this.interactPressed = false;
        touchActions[0].action();
        return;
      } else if (touchActions.length > 1) {
        this.interactPressed = false;
        this.showServiceChoiceMenu(touchActions);
        return;
      }
    }

    if (locationLabel === "Wilderness") {
      for (const landmark of region.landmarks) {
        if (distSq(landmark.x, landmark.y) < 70 * 70) {
          locationLabel = landmark.name;
          break;
        }
      }
    }

    if (locationLabel === "Wilderness") {
      const zone = region.zones.find((z) =>
        distSq(z.x, z.y) < (z.r * WORLD_SCALE) * (z.r * WORLD_SCALE)
      );
      if (zone) locationLabel = zone.name;
    }

    // Check for Pokemon League
    const allGymsDefeated = region.gyms.every(g => gameState.defeatedGyms[g.id]);
    if (!gameState.isChampion) {
      const leagueX = 45 * WORLD_SCALE;
      const leagueY = 35 * WORLD_SCALE;
      const dx = playerX - leagueX;
      const dy = playerY - leagueY;
      if (dx * dx + dy * dy < 80 * 80) {
        const gymCount = region.gyms.length;
        if (gameState.badges.length < gymCount) {
          leagueHint = `Need ${gymCount} badges for Elite Four`;
        } else if (gameState.e4Progress > 0 && gameState.e4Progress < 4) {
          leagueHint = isTouch
            ? `Elite Four - Battle ${gameState.e4Progress + 1} of 4`
            : `[L] Elite Four - Battle ${gameState.e4Progress + 1} of 4`;
        } else if (gameState.e4Progress >= 4) {
          leagueHint = isTouch ? "Claim your Champion title!" : "[L] Claim Champion title!";
        } else {
          leagueHint = isTouch ? "Tap Talk: Enter Elite Four!" : "[L] Enter the Elite Four!";
        }
      }
    }

    // Check for nearby power spots
    for (const spot of region.powerSpots) {
      if (distSq(spot.x, spot.y) < 60 * 60) {
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

    const inv = gameState.inventory;
    const footerLine = `💊×${inv.potion}  ✚×${inv.revive}`;

    const hudLines = [
      locationLabel,
      gymLabel,
      `★${gameState.badges.length}/${region.gyms.length}  #${pokedexCount.caught}  ₽${gameState.money ?? 500}`,
      `→ ${objective}`,
      xpBoostLabel,
      "",
      powerSpotHint,
      healHint,
      martHint,
      gymHint,
      leagueHint,
      footerLine,
    ].filter(line => line !== "");

    // Only re-layout the HUD text when its content actually changes.
    const hudStr = hudLines.join("\n");
    if (hudStr !== this.lastHudText) {
      this.hudText.setText(hudStr);
      this.lastHudText = hudStr;
    }

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

    // The UI camera always stays at zoom 1, full-viewport, no scroll — so HUD
    // and on-screen controls render at true screen size and edge positions,
    // unaffected by the world camera's zoom.
    if (!this.uiCamera) {
      this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
      this.uiCamera.setScroll(0, 0);
    } else {
      this.uiCamera.setSize(this.scale.width, this.scale.height);
    }
    this.refreshCameraAssignments();
    this.fitOpenMenus();
  }

  /**
   * Partition the display list between the two cameras by scroll factor:
   * scrollFactor-0 objects are UI (rendered only by the UI camera); everything
   * else is world (rendered only by the main, zoomed camera). Idempotent —
   * Phaser stores the ignore flag as a per-object bitmask — so it can be
   * re-run cheaply to catch dynamically created menus/overlays.
   */
  private refreshCameraAssignments(): void {
    if (!this.uiCamera) return;
    const main = this.cameras.main;
    const ui = this.uiCamera;
    for (const obj of this.children.list) {
      const sf = (obj as unknown as { scrollFactorX?: number }).scrollFactorX;
      if (sf === 0) {
        main.ignore(obj); // UI: hide from the zoomed world camera
      } else {
        ui.ignore(obj);   // world: hide from the UI camera
      }
    }
  }

  private createVignette(): void {
    // Vignette removed — the thick dark edges it produced on narrow phones
    // made the game look like it had a black border around the viewport.
    this.vignette?.destroy();
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

  private showServiceChoiceMenu(services: Array<{ icon: string; label: string; action: () => void }>): void {
    if (this.serviceMenuOpen) return;
    this.serviceMenuOpen = true;
    this.touch?.setVisible(false);
    this.setHudVisible(false);

    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const DEPTH = 950;
    const elements: Phaser.GameObjects.GameObject[] = [];

    const closeMenu = () => {
      this.serviceMenuOpen = false;
      this.touch?.setVisible(true);
      this.setHudVisible(true);
      elements.forEach(e => e.destroy());
      this.serviceMenuElements = [];
    };

    // Dimming overlay (also acts as cancel tap)
    const overlay = this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.6)
      .setScrollFactor(0).setDepth(DEPTH - 1).setInteractive();
    overlay.on("pointerdown", closeMenu);
    elements.push(overlay);

    // Panel
    const panelW = Math.min(W - 48, 400);
    const BTN_H = 60;
    const panelH = 64 + services.length * (BTN_H + 14) + 52;
    const panelTop = H / 2 - panelH / 2;

    const panelBg = this.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    panelBg.fillStyle(0x0f172a, 0.98);
    panelBg.fillRoundedRect(cx - panelW / 2, panelTop, panelW, panelH, 18);
    panelBg.lineStyle(2, 0x7c3aed, 1);
    panelBg.strokeRoundedRect(cx - panelW / 2, panelTop, panelW, panelH, 18);
    elements.push(panelBg);

    const title = this.add.text(cx, panelTop + 30, "What would you like to do?", {
      fontFamily: "monospace", fontSize: "20px", fontStyle: "bold", color: "#fbbf24"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 1);
    elements.push(title);

    services.forEach((svc, i) => {
      const btnY = panelTop + 68 + i * (BTN_H + 14);
      const btnW = panelW - 32;

      const btnBg = this.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
      const drawBtn = (hover: boolean) => {
        btnBg.clear();
        btnBg.fillStyle(hover ? 0x334155 : 0x1e293b, 1);
        btnBg.fillRoundedRect(cx - btnW / 2, btnY, btnW, BTN_H, 12);
        btnBg.lineStyle(2, hover ? 0x60a5fa : 0x475569, 1);
        btnBg.strokeRoundedRect(cx - btnW / 2, btnY, btnW, BTN_H, 12);
      };
      drawBtn(false);
      elements.push(btnBg);

      const lbl = this.add.text(cx, btnY + BTN_H / 2, `${svc.icon}  ${svc.label}`, {
        fontFamily: "monospace", fontSize: "22px", fontStyle: "bold", color: "#f8fafc"
      }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 2);
      elements.push(lbl);

      const hit = this.add.rectangle(cx, btnY + BTN_H / 2, btnW, BTN_H, 0, 0)
        .setScrollFactor(0).setDepth(DEPTH + 3).setInteractive({ useHandCursor: true });
      hit.setData("testid", `service-${svc.label.toLowerCase().replace(/\s+/g, "-")}`);
      hit.on("pointerover", () => drawBtn(true));
      hit.on("pointerout",  () => drawBtn(false));
      hit.on("pointerdown", () => { closeMenu(); svc.action(); });
      elements.push(hit);
    });

    // Go Back button
    const backY = panelTop + panelH - 38;
    const back = this.add.text(cx, backY, "← Go Back", {
      fontFamily: "monospace", fontSize: "17px", color: "#64748b"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 2).setInteractive({ useHandCursor: true });
    back.on("pointerdown", closeMenu);
    elements.push(back);

    this.serviceMenuElements = elements;
  }

  private handleHealing(): void {
    const region = getRegion(gameState);
    const playerX = this.player.x;
    const playerY = this.player.y;

    const healActivated = (this.keyH && this.input.keyboard?.checkDown(this.keyH, 250)) || this.interactPressed;
    if (healActivated) {
      const town = region.towns.find((t) => {
        if (!t.services.includes("center")) return false;
        const dx = playerX - t.x * WORLD_SCALE;
        const dy = playerY - t.y * WORLD_SCALE;
        return dx * dx + dy * dy < 70 * 70;
      });
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
    this.mapOpen = true;
    this.touch?.setVisible(false);
    this.setHudVisible(false);
    const region = getRegion(gameState);
    const bounds = this.getWorldBounds(region);

    const margin = 14;
    const mapWidth = Math.min(520, this.scale.width - margin * 2);
    const mapHeight = Math.max(180, Math.min(360, this.scale.height - margin * 2 - 100));
    const mapX = this.scale.width / 2;
    const mapY = this.scale.height / 2;
    const mapFont = Math.max(15, Math.min(19, Math.round(mapWidth / 26)));
    const labelFont = Math.max(14, Math.min(16, Math.round(mapWidth / 34)));

    // Create container for the map at natural scale. Text remains readable on
    // mobile; the panel itself is sized to the viewport instead of scaled down.
    this.mapContainer = this.add.container(mapX - mapWidth / 2, mapY - mapHeight / 2);
    this.mapContainer.setScrollFactor(0);
    this.mapContainer.setDepth(500);

    // Background panel
    const bg = this.add.rectangle(mapWidth / 2, mapHeight / 2, mapWidth, mapHeight + 92, 0x0f172a, 0.95);
    bg.setStrokeStyle(3, 0xfbbf24);
    this.mapContainer.add(bg);

    // Title
    const title = this.add.text(mapWidth / 2, -15, region.name, {
      fontFamily: "monospace",
      fontSize: `${mapFont}px`,
      color: "#fbbf24",
      fontStyle: "bold"
    }).setOrigin(0.5);
    this.mapContainer.add(title);

    // Map graphics for drawing zones
    this.mapGraphics = this.add.graphics();
    this.mapContainer.add(this.mapGraphics);

    const scaleX = mapWidth / bounds.width;
    const scaleY = mapHeight / bounds.height;

    // Greedy label de-collision: town/gym/portal names cluster tightly in dense
    // regions and used to render on top of each other. Each label is nudged
    // vertically (alternating down/up) away from already-placed labels so they
    // stay readable. Markers stay put; only the text moves.
    const placedLabels: { l: number; t: number; r: number; b: number }[] = [];
    const placeLabel = (label: Phaser.GameObjects.Text, px: number, py: number): void => {
      const w = label.width;
      const h = label.height;
      const xOverlaps = () => placedLabels.filter((p) => px - w / 2 < p.r && px + w / 2 > p.l);
      const hits = (cy: number) =>
        xOverlaps().some((p) => cy - h / 2 < p.b && cy + h / 2 > p.t);
      const step = h + 2;
      let cy = py;
      // Search outward (alternating down/up) for a free vertical slot.
      for (let i = 1; i <= 24 && hits(cy); i++) {
        const dir = i % 2 === 1 ? 1 : -1;
        cy = py + dir * Math.ceil(i / 2) * step;
      }
      // Guaranteed fallback: if still clashing, stack just below the lowest
      // label sharing this column so nothing is ever left overlapping.
      if (hits(cy)) {
        const lowest = xOverlaps().reduce((m, p) => Math.max(m, p.b), -Infinity);
        cy = lowest + h / 2 + 2;
      }
      label.setPosition(px, cy);
      placedLabels.push({ l: px - w / 2, t: cy - h / 2, r: px + w / 2, b: cy + h / 2 });
    };

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

      // Town name — pill background keeps it legible where labels overlap
      const label = this.add.text(x, y + 12, town.name, {
        fontFamily: "monospace",
        fontSize: `${labelFont}px`,
        color: "#bfdbfe",
        backgroundColor: "#0b1220cc",
        padding: { left: 5, right: 5, top: 2, bottom: 2 }
      }).setOrigin(0.5).setDepth(2);
      label.setData("testid", "map-label");
      placeLabel(label, x, y + 12);
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

      // Gym label — pill background + higher depth so leader names stay readable
      const label = this.add.text(x, y - 16, isCleared ? "✓" : gym.leader, {
        fontFamily: "monospace",
        fontSize: `${labelFont}px`,
        color: isCleared ? "#86efac" : "#fde68a",
        backgroundColor: "#0b1220dd",
        padding: { left: 5, right: 5, top: 2, bottom: 2 }
      }).setOrigin(0.5).setDepth(3);
      label.setData("testid", "map-label");
      placeLabel(label, x, y - 16);
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
          fontSize: `${labelFont}px`,
          color: "#ddd6fe",
          backgroundColor: "#0b1220cc",
          padding: { left: 5, right: 5, top: 2, bottom: 2 }
        }).setOrigin(0.5).setDepth(2);
        label.setData("testid", "map-label");
        placeLabel(label, x, y + 16);
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

    // Badge count legend
    const legend = this.add.text(mapWidth / 2, mapHeight + 8,
      `★${gameState.badges.length}/${region.gyms.length}`, {
      fontFamily: "monospace",
      fontSize: `${Math.max(14, labelFont)}px`,
      color: "#94a3b8"
    }).setOrigin(0.5);
    this.mapContainer.add(legend);

    // Close button — bottom-centre, matches mart/team/pokédex style.
    const mapClose = this.add.text(mapWidth / 2, mapHeight + 36, "✕  Close Map", {
      fontFamily: "monospace",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#f8fafc",
      backgroundColor: "#374151",
      padding: { left: 28, right: 28, top: 9, bottom: 9 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    mapClose.setData("testid", "close-map");
    mapClose.on("pointerover", () => mapClose.setStyle({ backgroundColor: "#4b5563" }));
    mapClose.on("pointerout",  () => mapClose.setStyle({ backgroundColor: "#374151" }));
    mapClose.on("pointerdown", () => this.closeVisualMap());
    this.mapContainer.add(mapClose);

    // Re-centre in case safe-area/rotation changed before opening.
    this.fitMapContainer();
  }

  /**
   * Scale the visual-map container to fit the viewport, centred about its local
   * midpoint (mapWidth/2, mapHeight/2) which is pinned to the screen centre.
   * Unlike the other menus the map's children use container-local coordinates,
   * so this re-centres correctly on resize.
   */
  private fitMapContainer(): void {
    if (!this.mapContainer) return;
    // The map is rebuilt on resize so text never has to be scaled below its
    // readable mobile size. This helper only keeps the current container centred.
    this.mapContainer.setScale(1);
    const bounds = this.mapContainer.getBounds();
    this.mapContainer.setPosition(
      this.scale.width / 2 - bounds.width / 2,
      this.scale.height / 2 - bounds.height / 2
    );
  }

  /** Re-fit any open full-screen menu after a viewport resize/rotation. */
  private fitOpenMenus(): void {
    if (this.martContainer) fitMenu(this, this.martContainer, 440, 620);
    if (this.championContainer) fitMenu(this, this.championContainer, 560, 340);
    if (this.mapOpen) {
      this.closeVisualMap();
      this.openVisualMap();
    }
    // Responsive dialogs re-render at the new viewport size instead of scaling.
    if (this.pokedexOpen) { this.closePokedex(); this.openPokedex(); }
    if (this.teamOpen) this.renderTeamScreen();
  }

  private closeVisualMap(): void {
    emitTestEvent("menu:close", { menu: "map" });
    this.mapOpen = false;
    this.touch?.setVisible(true);
    this.setHudVisible(true);
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
    this.setHudVisible(false);

    // Close any open menus
    if (this.mapOpen) this.closeVisualMap();
    if (this.teamOpen) this.closeTeamScreen();
    if (this.pokedexOpen) this.closePokedex();
    if (this.serviceMenuOpen) {
      this.serviceMenuElements.forEach(e => e.destroy());
      this.serviceMenuElements = [];
      this.serviceMenuOpen = false;
    }

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

    // Menu options. Keyboard shortcut hints ([S]/[F1]) only make sense with a
    // physical keyboard, so they're dropped on touch devices.
    const isTouch = Boolean(this.touch?.active);
    // The Pokédex is otherwise keyboard-only ([D]); surface it here so it's
    // reachable on touch. Items are laid out evenly from a top offset.
    const labels = [
      { id: "resume", label: "Resume Game" },
      { id: "pokedex", label: "📖  Pokédex" },
      { id: "save", label: isTouch ? "Save Game" : "Save Game [S]" },
      { id: "load", label: isTouch ? "Load Game" : "Load Game [F1]" }
    ];
    const rowGap = 50;
    const firstY = centerY - 45;
    const menuItems = labels.map((item, i) => ({ ...item, y: firstY + i * rowGap }));

    menuItems.forEach((item) => {
      const text = this.add.text(centerX, item.y, item.label, {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#f8fafc",
        backgroundColor: "#1e293b",
        padding: { left: 20, right: 20, top: 10, bottom: 10 }
      });
      text.setScrollFactor(0).setOrigin(0.5).setDepth(1001);
      text.setData("testid", `pause-${item.id}`);
      text.setInteractive({ useHandCursor: true });
      text.on("pointerover", () => text.setStyle({ backgroundColor: "#334155" }));
      text.on("pointerout", () => text.setStyle({ backgroundColor: "#1e293b" }));
      if (item.id === "resume") {
        text.on("pointerdown", () => this.resumeGame());
      } else if (item.id === "pokedex") {
        text.on("pointerdown", () => {
          Sound.playMenuSelect();
          this.resumeGame();
          this.openPokedex();
        });
      } else if (item.id === "save") {
        text.on("pointerdown", () => {
          if (saveGame()) {
            Sound.playMenuSelect();
            this.showNotification("Game Saved!", 1500);
          }
        });
      } else if (item.id === "load") {
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

    // Controls hint — keyboard wording on desktop, tap wording on touch.
    const hint = this.add.text(centerX, centerY + 150,
      isTouch ? "Tap Resume to continue" : "Press ESC to resume", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#6b7280"
    });
    hint.setScrollFactor(0).setOrigin(0.5).setDepth(1001);
    this.pauseText.push(hint);
  }

  private setHudVisible(visible: boolean): void {
    this.hudVisible = visible;
    this.hudText?.setVisible(visible);
    if (!visible) this.notificationText?.setVisible(false);
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.physics.resume();
    this.touch?.setVisible(true);
    this.setHudVisible(true);

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
    this.setHudVisible(false);
    this.renderTeamScreen();
  }

  private renderTeamScreen(): void {
    if (this.teamContainer) { this.teamContainer.destroy(true); this.teamContainer = undefined; }
    this.teamOverlay = undefined;
    this.teamText = [];

    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const DEPTH = 500;

    const push = (go: Phaser.GameObjects.GameObject) => {
      (go as Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.GameObject).setScrollFactor?.(0);
      (go as Phaser.GameObjects.Components.Depth & Phaser.GameObjects.GameObject).setDepth?.(DEPTH + 1);
      this.teamText.push(go);
    };

    // Full-screen background
    this.teamOverlay = this.add.rectangle(cx, H / 2, W, H, 0x0f172a, 0.98)
      .setScrollFactor(0).setDepth(DEPTH);

    // Header bar
    const headerBg = this.add.rectangle(cx, 28, W, 56, 0x7c3aed, 1)
      .setScrollFactor(0).setDepth(DEPTH + 1);
    this.teamText.push(headerBg);
    push(this.add.text(cx, 28, "MY TEAM", {
      fontFamily: "monospace", fontSize: "24px", fontStyle: "bold", color: "#f8fafc"
    }).setOrigin(0.5));

    // Tabs — two equal half-width buttons
    const tabY = 72;
    const tabW = W / 2;
    const teamTabBg = this.add.rectangle(tabW / 2, tabY, tabW, 40,
      this.teamTab === "team" ? 0x4c1d95 : 0x1e293b, 1)
      .setScrollFactor(0).setDepth(DEPTH + 1).setInteractive({ useHandCursor: true });
    teamTabBg.on("pointerdown", () => { this.teamTab = "team"; this.teamSelectedMon = null; this.renderTeamScreen(); });
    this.teamText.push(teamTabBg);
    push(this.add.text(tabW / 2, tabY, "TEAM", {
      fontFamily: "monospace", fontSize: "18px", fontStyle: "bold",
      color: this.teamTab === "team" ? "#fbbf24" : "#64748b"
    }).setOrigin(0.5));

    const boxTabBg = this.add.rectangle(tabW + tabW / 2, tabY, tabW, 40,
      this.teamTab === "box" ? 0x4c1d95 : 0x1e293b, 1)
      .setScrollFactor(0).setDepth(DEPTH + 1).setInteractive({ useHandCursor: true });
    boxTabBg.on("pointerdown", () => { this.teamTab = "box"; this.teamSelectedMon = null; this.renderTeamScreen(); });
    this.teamText.push(boxTabBg);
    push(this.add.text(tabW + tabW / 2, tabY, "BOX", {
      fontFamily: "monospace", fontSize: "18px", fontStyle: "bold",
      color: this.teamTab === "box" ? "#fbbf24" : "#64748b"
    }).setOrigin(0.5));

    if (this.teamTab === "team") {
      this.renderTeamTab(0, 0, W, H, 22, push);
    } else {
      this.renderBoxTab(0, 0, W, H, 22, push);
    }

    // Close — full-width footer button (labelled for the active tab)
    const closeLabel = this.teamTab === "box" ? "✕  Close Box" : "✕  Close Team";
    const closeBtn = this.add.text(cx, H - 36, closeLabel, {
      fontFamily: "monospace", fontSize: "22px", fontStyle: "bold",
      color: "#f8fafc", backgroundColor: "#374151",
      padding: { left: 40, right: 40, top: 14, bottom: 14 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 2).setInteractive({ useHandCursor: true });
    closeBtn.setData("testid", "close-team");
    closeBtn.on("pointerover", () => closeBtn.setStyle({ backgroundColor: "#4b5563" }));
    closeBtn.on("pointerout",  () => closeBtn.setStyle({ backgroundColor: "#374151" }));
    closeBtn.on("pointerdown", () => this.closeTeamScreen());
    this.teamText.push(closeBtn);

    this.teamContainer = this.add.container(0, 0, [this.teamOverlay!, ...this.teamText]);
    // Must be scrollFactor 0 so refreshCameraAssignments() routes it to the UI
    // camera. Without this the whole screen renders through the zoomed world
    // camera — appearing scaled/offset and making touch targets miss on mobile.
    this.teamContainer.setScrollFactor(0);
    this.teamContainer.setDepth(DEPTH);
  }

  private renderTeamTab(
    _left: number, _top: number, w: number, h: number, _fs: number,
    push: (go: Phaser.GameObjects.GameObject) => void
  ): void {
    const W = w;
    const DEPTH = 501;
    const CONTENT_TOP = 98;
    const CLOSE_H = 80;
    const ROW_H = 72;
    const selected = this.teamSelectedMon;
    const ACTION_H = selected?.source === "team" ? 108 : 0;
    const listBottom = h - CLOSE_H - ACTION_H;

    if (gameState.team.length === 0) {
      push(this.add.text(W / 2, CONTENT_TOP + 60, "No Pokémon in team!", {
        fontFamily: "monospace", fontSize: "22px", color: "#6b7280"
      }).setOrigin(0.5));
      return;
    }

    gameState.team.forEach((mon, index) => {
      const y = CONTENT_TOP + index * ROW_H;
      if (y + ROW_H > listBottom) return;

      const hpPct = Math.max(0, Math.floor((mon.hp / mon.maxHp) * 100));
      const hpFillColor = hpPct > 50 ? 0x22c55e : hpPct > 20 ? 0xeab308 : 0xef4444;
      const hpTextColor = hpPct > 50 ? "#22c55e" : hpPct > 20 ? "#eab308" : "#ef4444";
      const isSelected = selected?.source === "team" && selected.index === index;

      // Row background
      const rowBg = this.add.rectangle(W / 2, y + ROW_H / 2, W - 8, ROW_H - 4,
        isSelected ? 0x1e3a5f : 0x1e293b, 1)
        .setStrokeStyle(2, isSelected ? 0x60a5fa : 0x334155)
        .setScrollFactor(0).setDepth(DEPTH).setInteractive({ useHandCursor: true });
      rowBg.on("pointerdown", () => {
        this.teamSelectedMon = isSelected ? null : { source: "team", index };
        this.renderTeamScreen();
      });
      this.teamText.push(rowBg);

      // HP bar track
      const BAR_W = Math.floor(W * 0.5);
      const BAR_H = 10;
      const barX = 14;
      // Sits below the "Lv/HP" text line (at y+36) so the bar doesn't slice
      // through it; ROW_H (72) leaves room.
      const barY = y + 60;
      const hpBarTrack = this.add.rectangle(barX + BAR_W / 2, barY, BAR_W, BAR_H, 0x334155, 1)
        .setScrollFactor(0).setDepth(DEPTH + 1);
      hpBarTrack.setData("testid", `team-hpbar-${index}`);
      this.teamText.push(hpBarTrack);
      if (hpPct > 0) {
        const fillW = Math.max(4, Math.floor(BAR_W * hpPct / 100));
        this.teamText.push(
          this.add.rectangle(barX + fillW / 2, barY, fillW, BAR_H, hpFillColor, 1)
            .setScrollFactor(0).setDepth(DEPTH + 2)
        );
      }

      // Name + level
      push(this.add.text(14, y + 8, mon.nickname || mon.name, {
        fontFamily: "monospace", fontSize: "22px", fontStyle: "bold",
        color: mon.hp > 0 ? "#f8fafc" : "#6b7280"
      }));
      const statText = this.add.text(14, y + 36, `Lv.${mon.level}  HP ${mon.hp}/${mon.maxHp}`, {
        fontFamily: "monospace", fontSize: "15px", color: hpTextColor
      });
      statText.setData("testid", `team-stat-${index}`);
      push(statText);

      // Right: status badge
      if (mon.status !== "none") {
        push(this.add.text(W - 12, y + 12, getStatusDisplayText(mon.status), {
          fontFamily: "monospace", fontSize: "14px", fontStyle: "bold",
          color: `#${getStatusColor(mon.status).toString(16).padStart(6, "0")}`
        }).setOrigin(1, 0));
      }

      // Right: held item badge
      if (mon.heldItem) {
        push(this.add.text(W - 12, y + ROW_H - 18, `◆ ${HELD_ITEMS[mon.heldItem]?.name ?? mon.heldItem}`, {
          fontFamily: "monospace", fontSize: "13px", color: "#fbbf24"
        }).setOrigin(1, 1));
      }
    });

    // Action panel shown below list when a mon is selected
    if (selected?.source === "team") {
      const mon = gameState.team[selected.index];
      if (mon) {
        const panelY = h - CLOSE_H - ACTION_H;

        // Panel background divider
        this.teamText.push(
          this.add.rectangle(W / 2, panelY + ACTION_H / 2, W, ACTION_H, 0x111827, 1)
            .setStrokeStyle(1, 0x7c3aed).setScrollFactor(0).setDepth(DEPTH)
        );

        push(this.add.text(14, panelY + 10, `${mon.nickname || mon.name}`, {
          fontFamily: "monospace", fontSize: "18px", fontStyle: "bold", color: "#fbbf24"
        }));

        const btnY = panelY + 52;
        let btnX = 14;
        const BTN_STYLE = { fontFamily: "monospace", fontSize: "17px", fontStyle: "bold" };

        // Send to Box
        const toBoxBtn = this.add.text(btnX, btnY, "Send to Box", {
          ...BTN_STYLE, color: "#0f172a", backgroundColor: "#94a3b8",
          padding: { left: 14, right: 14, top: 10, bottom: 10 }
        }).setScrollFactor(0).setDepth(DEPTH + 2).setInteractive({ useHandCursor: true });
        toBoxBtn.on("pointerdown", () => {
          if (gameState.team.length <= 1) {
            this.showNotification("Can't box your last Pokémon!", 1500); return;
          }
          const [removed] = gameState.team.splice(selected.index, 1);
          addToBox(gameState, removed);
          this.teamSelectedMon = null;
          this.renderTeamScreen();
          this.showNotification(`${removed.name} moved to Box!`, 1500);
        });
        this.teamText.push(toBoxBtn);
        btnX += toBoxBtn.width + 10;

        // Stone evolution
        const evo = SPECIES[mon.speciesId]?.evolution;
        if (evo?.item && (gameState.inventory[evo.item as keyof typeof gameState.inventory] ?? 0) > 0) {
          const stone = EVO_STONES[evo.item];
          const evoBtn = this.add.text(btnX, btnY, `Evolve!`, {
            ...BTN_STYLE, color: "#0f172a", backgroundColor: "#a855f7",
            padding: { left: 14, right: 14, top: 10, bottom: 10 }
          }).setScrollFactor(0).setDepth(DEPTH + 2).setInteractive({ useHandCursor: true });
          evoBtn.on("pointerdown", () => {
            const key = evo.item as keyof typeof gameState.inventory;
            const result = tryItemEvolution(mon, evo.item!);
            if (result) {
              gameState.inventory[key] = Math.max(0, (gameState.inventory[key] ?? 0) - 1);
              markSeen(gameState, mon.speciesId);
              markCaught(gameState, mon.speciesId);
              Sound.playEvolution();
              this.renderTeamScreen();
              this.showNotification(`${result.oldName} evolved into ${result.newName}!`, 2500);
            }
          });
          this.teamText.push(evoBtn);
          btnX += evoBtn.width + 10;
          void stone;
        }

        // Unequip held item
        if (mon.heldItem) {
          const unequipBtn = this.add.text(btnX, btnY, "Unequip", {
            ...BTN_STYLE, color: "#f8fafc", backgroundColor: "#dc2626",
            padding: { left: 14, right: 14, top: 10, bottom: 10 }
          }).setScrollFactor(0).setDepth(DEPTH + 2).setInteractive({ useHandCursor: true });
          unequipBtn.on("pointerdown", () => {
            const key = mon.heldItem! as keyof typeof gameState.inventory;
            gameState.inventory[key] = (gameState.inventory[key] ?? 0) + 1;
            mon.heldItem = undefined;
            this.renderTeamScreen();
            this.showNotification("Item unequipped!", 1200);
          });
          this.teamText.push(unequipBtn);
          btnX += unequipBtn.width + 10;
        }

        // Equip available held items
        const heldItems = (["oranberry", "luckyegg", "shellbell"] as const)
          .filter(k => (gameState.inventory[k] ?? 0) > 0);
        heldItems.slice(0, 2).forEach(itemKey => {
          const info = HELD_ITEMS[itemKey];
          if (btnX > W - 80) return;
          const equipBtn = this.add.text(btnX, btnY, `+${info.name}`, {
            ...BTN_STYLE, color: "#0f172a", backgroundColor: "#fbbf24",
            padding: { left: 10, right: 10, top: 10, bottom: 10 }
          }).setScrollFactor(0).setDepth(DEPTH + 2).setInteractive({ useHandCursor: true });
          equipBtn.on("pointerdown", () => {
            if (mon.heldItem) {
              const oldKey = mon.heldItem as keyof typeof gameState.inventory;
              gameState.inventory[oldKey] = (gameState.inventory[oldKey] ?? 0) + 1;
            }
            gameState.inventory[itemKey] = Math.max(0, (gameState.inventory[itemKey] ?? 0) - 1);
            mon.heldItem = itemKey;
            this.renderTeamScreen();
            this.showNotification(`${mon.name} is holding ${info.name}!`, 1500);
          });
          this.teamText.push(equipBtn);
          btnX += equipBtn.width + 10;
        });
      }
    }
  }

  private renderBoxTab(
    _left: number, _top: number, w: number, h: number, _fs: number,
    push: (go: Phaser.GameObjects.GameObject) => void
  ): void {
    const W = w;
    const DEPTH = 501;
    const CONTENT_TOP = 98;
    const CLOSE_H = 80;
    const selected = this.teamSelectedMon;
    const ACTION_H = selected?.source === "box" ? 108 : 0;
    const availH = h - CONTENT_TOP - CLOSE_H - ACTION_H;

    if (gameState.box.length === 0) {
      push(this.add.text(W / 2, CONTENT_TOP + 60,
        "Box is empty!\nSend Pokémon here\nfrom the Team tab.", {
        fontFamily: "monospace", fontSize: "20px", color: "#6b7280",
        align: "center", lineSpacing: 6
      }).setOrigin(0.5));
      return;
    }

    const COLS = 3;
    const CELL_W = Math.floor((W - 16) / COLS);
    const CELL_H = 72;
    const maxRows = Math.max(1, Math.floor(availH / CELL_H));
    const maxEntries = COLS * maxRows;

    gameState.box.slice(0, maxEntries).forEach((mon, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const bx = 8 + col * CELL_W;
      const by = CONTENT_TOP + row * CELL_H;
      const isSelected = selected?.source === "box" && selected.index === index;

      const bg = this.add.rectangle(bx + CELL_W / 2, by + CELL_H / 2, CELL_W - 6, CELL_H - 6,
        isSelected ? 0x1e3a5f : 0x1e293b, 1)
        .setStrokeStyle(2, isSelected ? 0x60a5fa : 0x334155)
        .setScrollFactor(0).setDepth(DEPTH).setInteractive({ useHandCursor: true });
      bg.on("pointerdown", () => {
        this.teamSelectedMon = isSelected ? null : { source: "box", index };
        this.renderTeamScreen();
      });
      this.teamText.push(bg);

      push(this.add.text(bx + 6, by + 8, mon.nickname || mon.name, {
        fontFamily: "monospace", fontSize: "16px", fontStyle: "bold", color: "#f8fafc"
      }));
      push(this.add.text(bx + 6, by + 32, `Lv.${mon.level}`, {
        fontFamily: "monospace", fontSize: "14px", color: "#94a3b8"
      }));
      push(this.add.text(bx + 6, by + 52, mon.types[0], {
        fontFamily: "monospace", fontSize: "13px", color: "#64748b"
      }));
    });

    if (gameState.box.length > maxEntries) {
      push(this.add.text(W / 2, CONTENT_TOP + availH - 20,
        `+${gameState.box.length - maxEntries} more`, {
        fontFamily: "monospace", fontSize: "16px", color: "#6b7280"
      }).setOrigin(0.5));
    }

    // Action panel for selected box mon
    if (selected?.source === "box") {
      const mon = gameState.box[selected.index];
      if (mon) {
        const panelY = h - CLOSE_H - ACTION_H;

        this.teamText.push(
          this.add.rectangle(W / 2, panelY + ACTION_H / 2, W, ACTION_H, 0x111827, 1)
            .setStrokeStyle(1, 0x7c3aed).setScrollFactor(0).setDepth(DEPTH)
        );

        push(this.add.text(14, panelY + 10, `${mon.nickname || mon.name}  Lv.${mon.level}`, {
          fontFamily: "monospace", fontSize: "18px", fontStyle: "bold", color: "#fbbf24"
        }));

        const addBtn = this.add.text(14, panelY + 52, "Add to Team", {
          fontFamily: "monospace", fontSize: "18px", fontStyle: "bold", color: "#0f172a",
          backgroundColor: "#22c55e", padding: { left: 20, right: 20, top: 12, bottom: 12 }
        }).setScrollFactor(0).setDepth(DEPTH + 2).setInteractive({ useHandCursor: true });
        addBtn.on("pointerover", () => addBtn.setStyle({ backgroundColor: "#16a34a" }));
        addBtn.on("pointerout",  () => addBtn.setStyle({ backgroundColor: "#22c55e" }));
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
    emitTestEvent("menu:close", { menu: "team" });
    this.teamOpen = false;
    this.teamSelectedMon = null;
    this.touch?.setVisible(true);
    this.setHudVisible(true);
    if (this.teamContainer) { this.teamContainer.destroy(true); this.teamContainer = undefined; }
    this.teamOverlay = undefined;
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
        fontSize: `${Math.max(18, Math.min(22, Math.round(w / 25)))}px`,
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
    this.setHudVisible(false);

    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const DEPTH = 500;
    const push = (go: Phaser.GameObjects.GameObject) => {
      (go as Phaser.GameObjects.Components.ScrollFactor & typeof go).setScrollFactor?.(0);
      (go as Phaser.GameObjects.Components.Depth & typeof go).setDepth?.(DEPTH + 1);
      this.pokedexText.push(go as Phaser.GameObjects.Text);
    };

    // Full-screen dark panel
    const panelG = this.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    panelG.fillStyle(0x0f172a, 0.97);
    panelG.fillRect(0, 0, W, H);
    panelG.fillStyle(0x1e3a8a, 1);
    panelG.fillRect(0, 0, W, 56);
    this.pokedexOverlay = panelG as unknown as Phaser.GameObjects.Rectangle;

    // Title bar
    push(this.add.text(cx, 28, "📖  Pokédex", {
      fontFamily: "monospace", fontSize: "24px", fontStyle: "bold", color: "#fde68a"
    }).setOrigin(0.5));

    const pokedexCount = getPokedexCount(gameState);
    push(this.add.text(cx, 70, `Seen: ${pokedexCount.seen}    Caught: ${pokedexCount.caught}`, {
      fontFamily: "monospace", fontSize: "18px", color: "#94a3b8"
    }).setOrigin(0.5));

    const entries = Object.entries(gameState.pokedex).filter(([_, data]) => data.caught || data.seen);
    const ROW_H = 60;
    const listTop = 104;
    const closeBarH = 72;
    const maxVisible = Math.floor((H - listTop - closeBarH) / ROW_H);

    if (entries.length === 0) {
      push(this.add.text(cx, H / 2, "No Pokémon seen yet!\nGo explore!", {
        fontFamily: "monospace", fontSize: "22px", color: "#6b7280", align: "center"
      }).setOrigin(0.5));
    }

    entries.slice(0, maxVisible).forEach(([speciesId, data], index) => {
      const species = SPECIES[speciesId];
      if (!species) return;
      const rowY = listTop + index * ROW_H;
      const isCaught = data.caught;

      // Row background
      const rowBg = this.add.rectangle(cx, rowY + ROW_H / 2, W - 24, ROW_H - 6, isCaught ? 0x14532d : 0x1e293b, 0.9)
        .setStrokeStyle(1, isCaught ? 0x22c55e : 0x334155).setScrollFactor(0).setDepth(DEPTH + 1);
      this.pokedexText.push(rowBg as unknown as Phaser.GameObjects.Text);

      // Number badge
      push(this.add.text(20, rowY + 12, `#${(index + 1).toString().padStart(3, "0")}`, {
        fontFamily: "monospace", fontSize: "16px", color: "#64748b"
      }));

      // Name — large and clear
      push(this.add.text(72, rowY + 10, species.name, {
        fontFamily: "monospace", fontSize: "22px", fontStyle: "bold",
        color: isCaught ? "#4ade80" : "#94a3b8"
      }));

      // Status tag
      const tag = isCaught ? "✓ Caught" : "Seen";
      push(this.add.text(W - 20, rowY + 12, tag, {
        fontFamily: "monospace", fontSize: "16px",
        color: isCaught ? "#4ade80" : "#64748b"
      }).setOrigin(1, 0));
    });

    // Close button — full-width, large tap target
    const closeBtn = this.add.text(cx, H - 36, "✕  Close Pokédex", {
      fontFamily: "monospace", fontSize: "22px", fontStyle: "bold",
      color: "#f8fafc", backgroundColor: "#374151",
      padding: { left: 32, right: 32, top: 14, bottom: 14 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 1).setInteractive({ useHandCursor: true });
    closeBtn.setData("testid", "close-pokedex");
    closeBtn.on("pointerover", () => closeBtn.setStyle({ backgroundColor: "#4b5563" }));
    closeBtn.on("pointerout",  () => closeBtn.setStyle({ backgroundColor: "#374151" }));
    closeBtn.on("pointerdown", () => this.closePokedex());
    this.pokedexText.push(closeBtn);

    this.pokedexContainer = this.add.container(0, 0, [panelG, ...this.pokedexText]);
    // scrollFactor 0 → routed to the UI camera (see teamContainer note above).
    this.pokedexContainer.setScrollFactor(0);
    this.pokedexContainer.setDepth(DEPTH);
  }

  private closePokedex(): void {
    this.pokedexOpen = false;
    this.touch?.setVisible(true);
    this.setHudVisible(true);
    if (this.pokedexContainer) {
      this.pokedexContainer.destroy(true);
      this.pokedexContainer = undefined;
    }
    this.pokedexOverlay = undefined;
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
    const subtitle = this.add.text(centerX, centerY - Math.round(145 * s), "Your first Pokémon awaits...", {
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

    // Bottom hint — touch-appropriate verb, and spell Pokémon consistently.
    const isTouch = Boolean(this.touch?.active);
    const hintText = isTouch
      ? "Tap a Pokémon to begin your adventure!"
      : "Click a Pokémon to begin your adventure!";
    const hint = this.add.text(centerX, centerY + Math.round(175 * s), hintText, {
      fontFamily: "monospace",
      fontSize: `${Math.max(10, Math.round(13 * s))}px`,
      color: "#64748b"
    });
    hint.setScrollFactor(0).setOrigin(0.5);
    hint.setData("testid", "starter-hint");
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
    this.renderMart();
  }

  private renderMart(): void {
    this.touch?.setVisible(false);
    this.setHudVisible(false);
    if (this.martContainer) {
      this.martContainer.destroy(true);
      this.martContainer = undefined;
    }
    this.martOverlay = undefined;
    this.martElements = [];

    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const DEPTH = 950;

    const push = (go: Phaser.GameObjects.GameObject) => {
      (go as Phaser.GameObjects.Components.ScrollFactor & typeof go).setScrollFactor?.(0);
      (go as Phaser.GameObjects.Components.Depth & typeof go).setDepth?.(DEPTH + 1);
      this.martElements.push(go);
    };

    // Full-screen dark panel
    const bg = this.add.rectangle(cx, H / 2, W, H, 0x0f172a, 0.97)
      .setScrollFactor(0).setDepth(DEPTH);
    this.martOverlay = bg;

    // Header bar
    const headerBg = this.add.rectangle(cx, 28, W, 56, 0xb45309, 1)
      .setScrollFactor(0).setDepth(DEPTH + 1);
    this.martElements.push(headerBg);
    push(this.add.text(cx, 28, "🛒  Poké Mart", {
      fontFamily: "monospace", fontSize: "26px", fontStyle: "bold", color: "#fff7ed"
    }).setOrigin(0.5));

    const moneyText = this.add.text(cx, 66, `₽ ${gameState.money ?? 0}`, {
      fontFamily: "monospace", fontSize: "22px", fontStyle: "bold", color: "#fde68a"
    }).setOrigin(0.5);
    push(moneyText);

    const items: Array<{ name: string; key: keyof typeof gameState.inventory; price: number; desc: string }> = [
      { name: "Poké Ball",    key: "pokeball",    price: 100,  desc: "Catch wild Pokémon" },
      { name: "Great Ball",   key: "greatball",   price: 300,  desc: "Better catch chance" },
      { name: "Ultra Ball",   key: "ultraball",   price: 600,  desc: "Best catch chance" },
      { name: "Potion",       key: "potion",      price: 80,   desc: "Heal 20 HP" },
      { name: "Super Potion", key: "superpotion", price: 200,  desc: "Heal 50 HP" },
      { name: "Revive",       key: "revive",      price: 500,  desc: "Revive fainted Pokémon" },
      { name: "Oran Berry",   key: "oranberry",   price: 150,  desc: "Held: restore 10 HP <50%" },
      { name: "Lucky Egg",    key: "luckyegg",    price: 2000, desc: "Held: 1.5× EXP gain" },
      { name: "Shell Bell",   key: "shellbell",   price: 1000, desc: "Held: heal on attack" },
      { name: "Fire Stone",   key: "firestone",   price: 2100, desc: "Evolves fire-type Pokémon" },
      { name: "Thunder Stone",key: "thunderstone",price: 2100, desc: "Evolves electric Pokémon" },
      { name: "Moon Stone",   key: "moonstone",   price: 2100, desc: "Evolves Clefairy & others" },
      { name: "Water Stone",  key: "waterstone",  price: 2100, desc: "Evolves water Pokémon" },
      { name: "Leaf Stone",   key: "leafstone",   price: 2100, desc: "Evolves grass Pokémon" },
    ];

    const listTop = 92;
    const ROW_H = 72;
    // Reserve room for the pagination row AND the close button stacked above
    // each other (they used to overlap on multi-page shops).
    const closeBarH = 132;
    const maxRows = Math.max(1, Math.floor((H - listTop - closeBarH) / ROW_H));
    const pageCount = Math.max(1, Math.ceil(items.length / maxRows));
    this.martPage = Phaser.Math.Clamp(this.martPage, 0, pageCount - 1);
    const pageItems = items.slice(this.martPage * maxRows, (this.martPage + 1) * maxRows);

    pageItems.forEach((item, i) => {
      const rowY = listTop + i * ROW_H;

      // Row background — alternating shade
      const rowBg = this.add.rectangle(cx, rowY + ROW_H / 2, W - 16, ROW_H - 4, i % 2 === 0 ? 0x1e293b : 0x0f172a, 1)
        .setStrokeStyle(1, 0x334155).setScrollFactor(0).setDepth(DEPTH + 1);
      this.martElements.push(rowBg);

      // Right column: BUY button + price, occupies rightmost 100px
      const rightColX = W - 8;
      const buyBtn = this.add.text(rightColX, rowY + 22, "BUY", {
        fontFamily: "monospace", fontSize: "19px", fontStyle: "bold",
        color: "#0f172a", backgroundColor: "#fbbf24",
        padding: { left: 12, right: 12, top: 8, bottom: 8 }
      }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
      buyBtn.on("pointerover", () => buyBtn.setStyle({ backgroundColor: "#f59e0b" }));
      buyBtn.on("pointerout",  () => buyBtn.setStyle({ backgroundColor: "#fbbf24" }));

      // Price below BUY button
      push(this.add.text(rightColX, rowY + 50, `₽${item.price}`, {
        fontFamily: "monospace", fontSize: "15px", fontStyle: "bold", color: "#fde68a"
      }).setOrigin(1, 0));

      // Left column: name + description, capped so it never reaches the right column
      const textMaxW = W - 118;
      push(this.add.text(16, rowY + 10, item.name, {
        fontFamily: "monospace", fontSize: "22px", fontStyle: "bold", color: "#f1f5f9",
        fixedWidth: textMaxW, wordWrap: { width: textMaxW }
      }));
      push(this.add.text(16, rowY + 40, item.desc, {
        fontFamily: "monospace", fontSize: "14px", color: "#64748b",
        fixedWidth: textMaxW, wordWrap: { width: textMaxW }
      }));
      buyBtn.on("pointerdown", () => {
        const money = gameState.money ?? 0;
        if (money < item.price) {
          this.showNotification("Not enough money! 💸", 1500);
          return;
        }
        gameState.money = money - item.price;
        gameState.inventory[item.key] = (gameState.inventory[item.key] ?? 0) + 1;
        Sound.playMenuSelect();
        moneyText.setText(`₽ ${gameState.money}`);
        this.showNotification(`Got ${item.name}! 🎉`, 1200);
      });
      push(buyBtn);
    });

    // Pagination — its own row above the close button (vertically centred items).
    if (pageCount > 1) {
      const pageY = H - 104;
      push(this.add.text(cx, pageY, `Page ${this.martPage + 1} of ${pageCount}`, {
        fontFamily: "monospace", fontSize: "16px", color: "#64748b"
      }).setOrigin(0.5));

      if (this.martPage > 0) {
        const prev = this.add.text(20, pageY, "◀ Prev", {
          fontFamily: "monospace", fontSize: "20px", fontStyle: "bold",
          color: "#0f172a", backgroundColor: "#94a3b8",
          padding: { left: 14, right: 14, top: 8, bottom: 8 }
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
        prev.on("pointerdown", () => { this.martPage--; this.renderMart(); });
        push(prev);
      }
      if (this.martPage < pageCount - 1) {
        const next = this.add.text(W - 20, pageY, "Next ▶", {
          fontFamily: "monospace", fontSize: "20px", fontStyle: "bold",
          color: "#0f172a", backgroundColor: "#94a3b8",
          padding: { left: 14, right: 14, top: 8, bottom: 8 }
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
        next.setData("testid", "mart-next");
        next.on("pointerdown", () => { this.martPage++; this.renderMart(); });
        push(next);
      }
    }

    // Close — full-width footer
    const closeBtn = this.add.text(cx, H - 40, "✕  Leave Shop", {
      fontFamily: "monospace", fontSize: "22px", fontStyle: "bold",
      color: "#f8fafc", backgroundColor: "#374151",
      padding: { left: 40, right: 40, top: 14, bottom: 14 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.setData("testid", "close-mart");
    closeBtn.on("pointerover", () => closeBtn.setStyle({ backgroundColor: "#4b5563" }));
    closeBtn.on("pointerout",  () => closeBtn.setStyle({ backgroundColor: "#374151" }));
    closeBtn.on("pointerdown", () => this.closeMart());
    push(closeBtn);

    this.martContainer = this.add.container(0, 0, [bg, ...this.martElements]);
    this.martContainer.setDepth(DEPTH);
  }

  private closeMart(): void {
    this.martOpen = false;
    this.touch?.setVisible(true);
    this.setHudVisible(true);
    if (this.martContainer) {
      this.martContainer.destroy(true);
      this.martContainer = undefined;
    }
    this.martOverlay = undefined;
    this.martElements = [];
  }

  private showTutorial(): void {
    this.touch?.setVisible(false);
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
        desc: "Earn all 8 Gym Badges then challenge\nthe Elite Four at the Indigo Plateau!"
      }
    ];

    let tipIndex = 0;
    const margin = 14;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const cardW = Math.min(420, this.scale.width - margin * 2);
    const cardH = Math.min(300, this.scale.height - margin * 2);
    const top = centerY - cardH / 2;
    const fs = Math.max(16, Math.min(20, Math.round(cardW / 24)));
    const titleFs = Math.max(22, Math.min(28, fs + 8));

    // Dark overlay
    const overlay = this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.82)
      .setScrollFactor(0).setDepth(1000).setInteractive();
    this.tutorialElements.push(overlay);

    // Card background
    const card = this.add.rectangle(centerX, centerY, cardW, cardH, 0x1e293b, 1)
      .setScrollFactor(0).setDepth(1001).setStrokeStyle(2, 0xfbbf24);
    this.tutorialElements.push(card);

    // Title text
    const titleText = this.add.text(centerX, top + 58, tips[0].title, {
      fontFamily: "monospace",
      fontSize: `${titleFs}px`,
      color: "#fbbf24",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
    this.tutorialElements.push(titleText);

    // Description text
    const descText = this.add.text(centerX, top + cardH / 2, tips[0].desc, {
      fontFamily: "monospace",
      fontSize: `${fs}px`,
      color: "#e2e8f0",
      align: "center",
      lineSpacing: 7,
      wordWrap: { width: cardW - 34, useAdvancedWrap: true }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
    this.tutorialElements.push(descText);

    // Progress indicator
    const progressText = this.add.text(centerX, top + cardH - 78, "1 / 4", {
      fontFamily: "monospace",
      fontSize: `${Math.max(14, fs - 2)}px`,
      color: "#94a3b8"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
    this.tutorialElements.push(progressText);

    // Next button
    const nextBtn = this.add.text(centerX + cardW / 2 - 90, top + cardH - 38, "Next →", {
      fontFamily: "monospace",
      fontSize: `${Math.max(18, fs + 1)}px`,
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
        if (!this.starterOpen) this.touch?.setVisible(true);
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

    const padding = 48;
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    };
  }
}
