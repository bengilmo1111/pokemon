/**
 * Test bridge — test-only instrumentation that makes the running game
 * observable and controllable from outside (Playwright, other agents).
 *
 * IMPORTANT: none of this is wired into production play. The bridge is only
 * installed when {@link isTestMode} is true (URL `?test=1` or a localStorage
 * flag), and every `emitTestEvent` call is a cheap no-op until then. Game code
 * may call `emitTestEvent(...)` freely at meaningful state transitions; the
 * calls cost almost nothing when the bridge is off.
 *
 * What it exposes on `window.__GAME__` (see TestBridgeApi):
 *  - a snapshot of the real state machine (active scenes, menu flags, inBattle…)
 *  - an append-only event log of semantic transitions (encounter, battle, save…)
 *  - control helpers (seed the RNG, reset, load a partial state)
 *
 * This is what lets a test assert "walking into a wild Pokémon produced
 * encounter → battle:launch → battle:active and did NOT fire a save" instead of
 * squinting at a screenshot.
 */
import type Phaser from "phaser";
import { gameState } from "./store";
import { getSeed, setSeed } from "./rng";
import { createInitialState, makePokemon } from "./state";

/** A starter spec for {@link TestBridgeApi.bootIntoOverworld}. */
export interface TeamSpec {
  speciesId: string;
  level: number;
}

export interface TestEvent {
  /** Monotonic sequence number (1-based). */
  seq: number;
  /** ms since navigation start, for ordering / timing assertions. */
  t: number;
  /** Dotted event name, e.g. "battle:launch", "save:fired". */
  type: string;
  /** Optional structured payload. */
  data?: Record<string, unknown>;
}

export interface GameSnapshot {
  /** Keys of all currently active (running, not paused) scenes. */
  activeScenes: string[];
  /** Keys of scenes that exist and are paused. */
  pausedScenes: string[];
  /** Overworld flags, when the Overworld scene exists. */
  overworld?: {
    isPaused: boolean;
    inBattle: boolean;
    battleStarting: boolean;
    encounterCooldown: number;
    hudVisible: boolean;
    menus: Record<string, boolean>;
    anyMenuOpen: boolean;
    player: { x: number; y: number };
    notification: { text: string; visible: boolean };
  };
  /** True when the Battle scene is instantiated and running. */
  battleActive: boolean;
  /** Selected slice of gameState for assertions. */
  game: {
    teamSize: number;
    teamHp: number[];
    anyAliveTeamMember: boolean;
    regionIndex: number;
    badges: number;
    wildMonCount: number;
    money: number;
  };
  rngSeed: number;
}

export interface TestBridgeApi {
  readonly version: number;
  /** The Phaser game instance. */
  readonly game: Phaser.Game;
  /** A fresh structured snapshot of the current state machine + game state. */
  snapshot(): GameSnapshot;
  /** A copy of the event log (optionally only events at/after `sinceSeq`). */
  events(sinceSeq?: number): TestEvent[];
  /** Drop all recorded events; returns the seq it was cleared at. */
  clearEvents(): number;
  /** Re-seed the RNG for deterministic runs. */
  seedRng(seed: number): void;
  /** Current RNG seed. */
  rngSeed(): number;
  /** Direct (mutable) reference to the live gameState, for setup/teardown. */
  readonly gameState: typeof gameState;

  // --- Control helpers: drop the game into a known scenario ---------------

  /**
   * Reset to a fresh game with a known team and seed, then boot straight into
   * the Overworld (skipping Title/starter-select). Resolves via the returned
   * promise once the Overworld scene is live. The harness should still poll
   * snapshot() until `overworld` is present.
   */
  bootIntoOverworld(opts?: { team?: TeamSpec[]; seed?: number }): void;
  /** Replace the active team with freshly built Pokémon. */
  giveTeam(team: TeamSpec[]): void;
  /** Set every team member's HP to 0 (reproduces the fully-fainted state). */
  faintTeam(): void;
  /** Fully heal the team. */
  healTeam(): void;
  /**
   * Deterministically trigger a wild encounter through the *real* collision
   * path: move a wild Pokémon onto the player and clear the cooldown so the
   * next update() tick starts a battle. Returns the wildId, or null if no
   * wild Pokémon / player is available.
   */
  forceEncounter(): string | null;
  /**
   * Screen-space positions of the on-screen touch buttons, so the harness can
   * tap them where a real thumb would. Empty when touch controls are inactive.
   */
  touchButtons(): Array<{ id: string; x: number; y: number; r: number }>;
  /**
   * Screen-space centres of any visible UI element tagged with a `testid`
   * (via setData("testid", ...)), e.g. the in-panel menu close buttons. Lets
   * the harness tap real controls inside menus, including ones nested in
   * scaled/positioned containers.
   */
  uiTargets(): Array<{ testid: string; x: number; y: number }>;
}

const MAX_EVENTS = 2000;
let log: TestEvent[] = [];
let seq = 0;
let enabled = false;

/** True when the bridge should be active (test harness, not real play). */
export function isTestMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("test") === "1") return true;
    return window.localStorage.getItem("__test_mode__") === "1";
  } catch {
    return false;
  }
}

/**
 * Record a semantic transition. No-op (one boolean check) when the bridge is
 * off, so this is safe to call from hot game paths.
 */
export function emitTestEvent(type: string, data?: Record<string, unknown>): void {
  if (!enabled) return;
  seq += 1;
  log.push({
    seq,
    t: typeof performance !== "undefined" ? Math.round(performance.now()) : Date.now(),
    type,
    data
  });
  if (log.length > MAX_EVENTS) log.shift();
}

function readOverworld(game: Phaser.Game): GameSnapshot["overworld"] {
  const scene = game.scene.getScene("Overworld") as unknown as Record<string, unknown> | null;
  if (!scene) return undefined;
  const menuKeys = [
    "starterOpen", "isPaused", "teamOpen", "martOpen",
    "pokedexOpen", "mapOpen", "serviceMenuOpen"
  ];
  const menus: Record<string, boolean> = {};
  for (const k of menuKeys) menus[k] = Boolean(scene[k]);
  const player = scene["player"] as { x?: number; y?: number } | undefined;
  return {
    isPaused: Boolean(scene["isPaused"]),
    inBattle: Boolean(scene["inBattle"]),
    battleStarting: Boolean(scene["battleStarting"]),
    encounterCooldown: Number(scene["encounterCooldown"]) || 0,
    hudVisible: Boolean(scene["hudVisible"]),
    menus,
    anyMenuOpen: Object.values(menus).some(Boolean),
    player: { x: Math.round(player?.x ?? 0), y: Math.round(player?.y ?? 0) },
    notification: (() => {
      const n = scene["notificationText"] as { text?: string; visible?: boolean } | undefined;
      return { text: n?.text ?? "", visible: Boolean(n?.visible) };
    })()
  };
}

function snapshot(game: Phaser.Game): GameSnapshot {
  const active: string[] = [];
  const paused: string[] = [];
  for (const s of game.scene.getScenes(false)) {
    const key = s.scene.key;
    if (game.scene.isActive(key)) active.push(key);
    else if (game.scene.isPaused(key)) paused.push(key);
  }
  const teamHp = gameState.team.map((m) => m.hp);
  return {
    activeScenes: active,
    pausedScenes: paused,
    overworld: readOverworld(game),
    battleActive: game.scene.isActive("Battle"),
    game: {
      teamSize: gameState.team.length,
      teamHp,
      anyAliveTeamMember: teamHp.some((hp) => hp > 0),
      regionIndex: gameState.regionIndex,
      badges: gameState.badges.length,
      wildMonCount: gameState.wildMons.length,
      money: gameState.money
    },
    rngSeed: getSeed()
  };
}

/**
 * Install the bridge on `window.__GAME__`. Called once from main.ts when
 * {@link isTestMode} is true. Also honours `?seed=<n>` for a deterministic boot.
 */
export function installTestBridge(game: Phaser.Game): void {
  if (typeof window === "undefined") return;
  enabled = true;

  try {
    const seedParam = new URLSearchParams(window.location.search).get("seed");
    if (seedParam !== null && seedParam !== "") setSeed(Number(seedParam) >>> 0);
  } catch {
    /* ignore */
  }

  const api: TestBridgeApi = {
    version: 1,
    game,
    snapshot: () => snapshot(game),
    events: (sinceSeq = 0) => log.filter((e) => e.seq > sinceSeq).map((e) => ({ ...e })),
    clearEvents: () => {
      log = [];
      return seq;
    },
    seedRng: (s: number) => setSeed(s >>> 0),
    rngSeed: () => getSeed(),
    gameState,

    bootIntoOverworld: (opts) => {
      if (opts?.seed !== undefined) setSeed(opts.seed >>> 0);
      Object.assign(gameState, createInitialState());
      const team = opts?.team ?? [{ speciesId: "charmander", level: 12 }];
      gameState.team = team.map((s) => makePokemon(s.speciesId, s.level));
      gameState.tutorialSeen = true;
      log = [];
      emitTestEvent("scenario:boot", { team });
      game.scene.start("Boot");
    },
    giveTeam: (team) => {
      gameState.team = team.map((s) => makePokemon(s.speciesId, s.level));
    },
    faintTeam: () => {
      gameState.team.forEach((m) => { m.hp = 0; });
      emitTestEvent("scenario:faint-team");
    },
    healTeam: () => {
      gameState.team.forEach((m) => { m.hp = m.maxHp; m.status = "none"; });
    },
    forceEncounter: () => {
      const scene = game.scene.getScene("Overworld") as unknown as {
        player?: { x: number; y: number };
        encounterCooldown?: number;
      } | null;
      const wild = gameState.wildMons[0];
      if (!scene?.player || !wild) return null;
      wild.x = scene.player.x;
      wild.y = scene.player.y;
      scene.encounterCooldown = 0;
      emitTestEvent("scenario:force-encounter", { wildId: wild.id });
      return wild.id;
    },
    touchButtons: () => {
      const scene = game.scene.getScene("Overworld") as unknown as {
        touch?: { buttons?: Array<{ cfg: { id: string }; bg: { x: number; y: number; radius: number } }> };
      } | null;
      const buttons = scene?.touch?.buttons ?? [];
      return buttons.map((b) => ({ id: b.cfg.id, x: b.bg.x, y: b.bg.y, r: b.bg.radius }));
    },
    uiTargets: () => {
      const scene = game.scene.getScene("Overworld") as unknown as Phaser.Scene | null;
      if (!scene) return [];
      const out: Array<{ testid: string; x: number; y: number }> = [];
      const visit = (obj: Phaser.GameObjects.GameObject) => {
        const go = obj as Phaser.GameObjects.GameObject & {
          visible?: boolean;
          getData?: (k: string) => unknown;
          getWorldTransformMatrix?: () => { tx: number; ty: number };
          list?: Phaser.GameObjects.GameObject[];
        };
        if (go.visible === false) return;
        const testid = go.getData?.("testid");
        if (typeof testid === "string" && go.getWorldTransformMatrix) {
          const m = go.getWorldTransformMatrix();
          out.push({ testid, x: Math.round(m.tx), y: Math.round(m.ty) });
        }
        if (Array.isArray(go.list)) go.list.forEach(visit);
      };
      scene.children.list.forEach(visit);
      return out;
    }
  };

  (window as unknown as { __GAME__: TestBridgeApi }).__GAME__ = api;
  emitTestEvent("bridge:installed", { seed: getSeed() });
}

declare global {
  interface Window {
    __GAME__?: TestBridgeApi;
  }
}
