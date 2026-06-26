/**
 * Shapes mirrored from src/game/testBridge.ts. Kept as a small local copy so
 * the harness stays self-contained and doesn't pull Phaser/game runtime into
 * the Playwright process just to read types.
 */

export interface TestEvent {
  seq: number;
  t: number;
  type: string;
  data?: Record<string, unknown>;
}

export interface GameSnapshot {
  activeScenes: string[];
  pausedScenes: string[];
  overworld?: {
    isPaused: boolean;
    inBattle: boolean;
    battleStarting: boolean;
    encounterCooldown: number;
    hudVisible: boolean;
    menus: Record<string, boolean>;
    anyMenuOpen: boolean;
    player: { x: number; y: number; flipX: boolean };
    notification: { text: string; visible: boolean };
  };
  battleActive: boolean;
  game: {
    teamSize: number;
    teamHp: number[];
    anyAliveTeamMember: boolean;
    regionIndex: number;
    badges: number;
    wildMonCount: number;
    money: number;
    legendariesCompleted: number;
    visitedRegions: number[];
  };
  rngSeed: number;
}

export interface TeamSpec {
  speciesId: string;
  level: number;
}

export interface TouchButton {
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface UiTarget {
  testid: string;
  /** screen-space centre */
  x: number;
  y: number;
  /** rendered size */
  w: number;
  h: number;
}
