import { GameState } from "./state";
import { gameState } from "./store";

const SAVE_KEY = "pokemon_game_save";
const SAVE_VERSION = 1;

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

    // Version migration if needed
    if (saveData.version !== SAVE_VERSION) {
      console.warn("Save version mismatch, attempting migration...");
    }

    // Copy all properties from saved state to current gameState
    Object.assign(gameState, saveData.state);
    return true;
  } catch (e) {
    console.error("Failed to load game:", e);
    return false;
  }
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
