// Sticker book — a kid-friendly achievements screen. Each sticker is a little
// milestone earned through normal play. Everything here is derived from the
// existing GameState at render time, so there's nothing extra to persist and it
// works for saves made before the feature existed.
import type { GameState } from "./state";
import { getPokedexCount } from "./state";
import { SPECIES } from "../data/species";

export interface Sticker {
  id: string;
  /** Emoji shown on the sticker. */
  icon: string;
  /** Short, celebratory name. */
  title: string;
  /** What you do to earn it (shown as a hint while it's still locked). */
  hint: string;
  earned: (state: GameState) => boolean;
}

/** Every species that is the result of an evolution (an "evolved form"). */
const EVOLVED_FORMS = new Set<string>(
  Object.values(SPECIES).flatMap((s) => (s.evolution ? [s.evolution.to] : []))
);

const owned = (s: GameState) => [...s.team, ...s.box];
const caughtCount = (s: GameState) => getPokedexCount(s).caught;
const maxOwnedLevel = (s: GameState) => owned(s).reduce((m, mon) => Math.max(m, mon.level), 0);
const ownsEvolved = (s: GameState) => owned(s).some((mon) => EVOLVED_FORMS.has(mon.speciesId));
const ownsLegendary = (s: GameState) => Object.values(s.legendariesCompleted ?? {}).some(Boolean);

/** The sticker book, in display order. */
export const STICKERS: Sticker[] = [
  { id: "first-catch", icon: "🐾", title: "First Catch",   hint: "Catch your first Pokémon",      earned: (s) => caughtCount(s) >= 1 },
  { id: "catch-10",    icon: "🎒", title: "Collector",     hint: "Catch 10 Pokémon",              earned: (s) => caughtCount(s) >= 10 },
  { id: "catch-50",    icon: "📦", title: "Super Collector", hint: "Catch 50 Pokémon",            earned: (s) => caughtCount(s) >= 50 },
  { id: "catch-all",   icon: "🌟", title: "Living Dex",    hint: "Catch all 151 Pokémon",         earned: (s) => caughtCount(s) >= 151 },
  { id: "team-six",    icon: "👫", title: "Full Team",     hint: "Have 6 Pokémon on your team",   earned: (s) => s.team.length >= 6 },
  { id: "evolve",      icon: "✨", title: "Grew Up!",      hint: "Own an evolved Pokémon",        earned: ownsEvolved },
  { id: "level-50",    icon: "💪", title: "Powerhouse",    hint: "Get a Pokémon to Level 50",     earned: (s) => maxOwnedLevel(s) >= 50 },
  { id: "first-badge", icon: "🥉", title: "First Badge",   hint: "Win your first Gym Badge",      earned: (s) => s.badges.length >= 1 },
  { id: "all-badges",  icon: "🥇", title: "Gym Master",    hint: "Win all 8 Gym Badges",          earned: (s) => s.badges.length >= 8 },
  { id: "elite-four",  icon: "⚔️", title: "Elite Beater",  hint: "Defeat the Elite Four",         earned: (s) => s.eliteFourDefeated || s.e4Progress >= 4 },
  { id: "champion",    icon: "👑", title: "Champion!",     hint: "Become the Champion",           earned: (s) => s.isChampion },
  { id: "legendary",   icon: "🐉", title: "Legend Tamer",  hint: "Catch a legendary Pokémon",     earned: ownsLegendary },
];

/** How many stickers are earned out of the total. */
export function stickerProgress(state: GameState): { earned: number; total: number } {
  return { earned: STICKERS.filter((s) => s.earned(state)).length, total: STICKERS.length };
}
