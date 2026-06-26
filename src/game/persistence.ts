import { rng } from "./rng";
import { GameState, PokemonInstance, calculateStats, createInitialState } from "./state";
import { SPECIES } from "../data/species";
import { randomNature } from "../data/natures";
import { gameState } from "./store";

const LEGACY_SAVE_KEY = "pokemon_game_save";
const SAVE_KEY_PREFIX = "pokemon_game_save_slot_";
const ACTIVE_SLOT_KEY = "pokemon_game_active_slot";
const SAVE_VERSION = 4;
export const SAVE_SLOT_COUNT = 3;

interface SaveData {
  version: number;
  timestamp: number;
  slotName?: string;
  state: GameState;
}

export interface SaveSlotInfo {
  slot: number;
  name: string;
  timestamp: number;
  teamSize: number;
  badges: number;
}

function slotKey(slot: number): string {
  return `${SAVE_KEY_PREFIX}${slot}`;
}

function normalizeSlot(slot: number): number {
  return Math.min(SAVE_SLOT_COUNT, Math.max(1, Math.floor(slot) || 1));
}

function defaultSlotName(slot: number): string {
  return `Save Slot ${slot}`;
}

function readSave(slot = getActiveSaveSlot()): SaveData | null {
  try {
    migrateLegacySaveIfNeeded();
    const saved = localStorage.getItem(slotKey(normalizeSlot(slot)));
    return saved ? JSON.parse(saved) as SaveData : null;
  } catch {
    return null;
  }
}

function cleanSlotName(name: string, slot: number): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return trimmed.slice(0, 24) || defaultSlotName(slot);
}

function migrateLegacySaveIfNeeded(): void {
  const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
  if (!legacy || localStorage.getItem(slotKey(1))) return;
  try {
    const parsed = JSON.parse(legacy) as SaveData;
    parsed.slotName = parsed.slotName || defaultSlotName(1);
    localStorage.setItem(slotKey(1), JSON.stringify(parsed));
    localStorage.setItem(ACTIVE_SLOT_KEY, "1");
  } catch {
    // Leave malformed legacy data untouched; normal load paths will report no save.
  }
}

export function getActiveSaveSlot(): number {
  return normalizeSlot(Number(localStorage.getItem(ACTIVE_SLOT_KEY) || "1"));
}

export function setActiveSaveSlot(slot: number): void {
  localStorage.setItem(ACTIVE_SLOT_KEY, String(normalizeSlot(slot)));
}

export function renameSaveSlot(slot: number, name: string): boolean {
  try {
    const normalized = normalizeSlot(slot);
    const saveData = readSave(normalized);
    if (!saveData) return false;
    saveData.slotName = cleanSlotName(name, normalized);
    localStorage.setItem(slotKey(normalized), JSON.stringify(saveData));
    return true;
  } catch (e) {
    console.error("Failed to rename save slot:", e);
    return false;
  }
}

export function saveGame(slot = getActiveSaveSlot(), slotName?: string): boolean {
  try {
    const normalized = normalizeSlot(slot);
    const existing = readSave(normalized);
    const saveData: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      slotName: cleanSlotName(slotName || existing?.slotName || defaultSlotName(normalized), normalized),
      state: JSON.parse(JSON.stringify(gameState)) // Deep clone
    };
    localStorage.setItem(slotKey(normalized), JSON.stringify(saveData));
    setActiveSaveSlot(normalized);
    return true;
  } catch (e) {
    console.error("Failed to save game:", e);
    return false;
  }
}

export function loadGame(slot = getActiveSaveSlot()): boolean {
  try {
    const normalized = normalizeSlot(slot);
    const saveData = readSave(normalized);
    if (!saveData) return false;

    // Copy all properties from saved state to current gameState
    Object.assign(gameState, saveData.state);

    // Version migration: v1 saves predate the special Atk/Def split, natures,
    // abilities and IVs. Backfill those fields and recompute derived stats so
    // older teams gain the new attributes without losing progress.
    if (saveData.version < 2) {
      migrateToV2(gameState);
    }
    // v3 adds evolution-stone inventory slots and the storyFlags map.
    if (saveData.version < 3) {
      migrateToV3(gameState);
    }
    // v4 adds legendary-sanctum completion tracking and visited-region travel unlocks.
    if (saveData.version < 4) {
      migrateToV4(gameState);
    }
    setActiveSaveSlot(normalized);
    return true;
  } catch (e) {
    console.error("Failed to load game:", e);
    return false;
  }
}

/** Backfill new inventory slots (evolution stones) and the storyFlags map. */
function migrateToV3(state: GameState): void {
  const defaults = createInitialState();
  // Merge any inventory keys missing from the old save (defaults to 0).
  state.inventory = { ...defaults.inventory, ...state.inventory };
  if (!state.storyFlags) state.storyFlags = {};
}

/** Backfill legendary-sanctum progress and the visited-region travel list. */
function migrateToV4(state: GameState): void {
  if (!state.legendariesCompleted) state.legendariesCompleted = {};
  if (!state.visitedRegions || state.visitedRegions.length === 0) {
    // Old saves have explored at least their current region; seed it plus the
    // starting region so paid travel has somewhere to go straight away.
    state.visitedRegions = Array.from(new Set([0, state.regionIndex]));
  }
}

/** Backfill v1 Pokémon with nature/IVs/ability and recompute split stats. */
function migrateToV2(state: GameState): void {
  const upgrade = (mon: PokemonInstance) => {
    if (!mon) return;
    if (!mon.nature) mon.nature = randomNature();
    if (!mon.ivs) {
      const r = () => Math.floor(rng() * 32);
      mon.ivs = { hp: r(), atk: r(), def: r(), spd: r(), spAtk: r(), spDef: r() };
    }
    if (mon.ability === undefined) mon.ability = SPECIES[mon.speciesId]?.ability;
    if (mon.friendship === undefined) mon.friendship = 70;
    // Recompute stats (now including spAtk/spDef), preserving current HP ratio.
    const ratio = mon.maxHp > 0 ? mon.hp / mon.maxHp : 1;
    const stats = calculateStats(mon.speciesId, mon.level, mon.ivs, mon.nature);
    mon.stats = stats;
    mon.maxHp = stats.hp;
    mon.hp = Math.max(1, Math.round(stats.hp * ratio));
  };
  state.team?.forEach(upgrade);
  state.box?.forEach(upgrade);
}

export function hasSaveData(slot = getActiveSaveSlot()): boolean {
  migrateLegacySaveIfNeeded();
  return localStorage.getItem(slotKey(normalizeSlot(slot))) !== null;
}

export function deleteSave(slot = getActiveSaveSlot()): void {
  localStorage.removeItem(slotKey(normalizeSlot(slot)));
}

export function getSaveSlots(): SaveSlotInfo[] {
  return Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => i + 1).map((slot) => {
    const saveData = readSave(slot);
    return {
      slot,
      name: saveData?.slotName || defaultSlotName(slot),
      timestamp: saveData?.timestamp || 0,
      teamSize: saveData?.state.team.length || 0,
      badges: saveData?.state.badges.length || 0
    };
  });
}

export function getSaveInfo(slot = getActiveSaveSlot()): SaveSlotInfo | null {
  const saveData = readSave(slot);
  if (!saveData) return null;
  const normalized = normalizeSlot(slot);
  return {
    slot: normalized,
    name: saveData.slotName || defaultSlotName(normalized),
    timestamp: saveData.timestamp,
    teamSize: saveData.state.team.length,
    badges: saveData.state.badges.length
  };
}
