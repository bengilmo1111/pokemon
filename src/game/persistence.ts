import { GameState, PokemonInstance, calculateStats, createInitialState } from "./state";
import { SPECIES } from "../data/species";
import { randomNature } from "../data/natures";
import { gameState } from "./store";

const SAVE_KEY = "pokemon_game_save";
const SAVE_VERSION = 3;

interface SaveData {
  version: number;
  timestamp: number;
  state: GameState;
}

export function saveGame(): boolean {
  try {
    const saveData: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      state: JSON.parse(JSON.stringify(gameState)) // Deep clone
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    return true;
  } catch (e) {
    console.error("Failed to save game:", e);
    return false;
  }
}

export function loadGame(): boolean {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return false;

    const saveData: SaveData = JSON.parse(saved);

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

/** Backfill v1 Pokémon with nature/IVs/ability and recompute split stats. */
function migrateToV2(state: GameState): void {
  const upgrade = (mon: PokemonInstance) => {
    if (!mon) return;
    if (!mon.nature) mon.nature = randomNature();
    if (!mon.ivs) {
      const r = () => Math.floor(Math.random() * 32);
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

export function hasSaveData(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function getSaveInfo(): { timestamp: number; teamSize: number; badges: number } | null {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return null;
    const saveData: SaveData = JSON.parse(saved);
    return {
      timestamp: saveData.timestamp,
      teamSize: saveData.state.team.length,
      badges: saveData.state.badges.length
    };
  } catch {
    return null;
  }
}
