// Pokémon Abilities. A curated, high-impact subset wired into the battle
// engine. Each species references one ability id (see species.ts `ability`).
// Hooks consumed in game/battle.ts and scenes/Battle.ts.

import { TypeId } from "./types";

export interface AbilityData {
  name: string;
  desc: string;
  /** Incoming move types this ability grants full immunity to. */
  immuneTo?: TypeId[];
  /** Lower the opposing Pokémon's Attack by 1 stage on switch-in. */
  intimidate?: boolean;
  /**
   * Pinch boost: when HP <= 1/3, moves of this type deal 1.5x.
   * (Blaze/Torrent/Overgrow/Swarm.)
   */
  pinchType?: TypeId;
  /** % chance to paralyze an attacker that lands a contact/physical move. */
  contactParalyze?: number;
  /** Negates incoming damage of this type and instead boosts it (Flash Fire). */
  absorbType?: TypeId;
}

export const ABILITIES: Record<string, AbilityData> = {
  overgrow: { name: "Overgrow", desc: "Powers up Grass moves in a pinch.", pinchType: "grass" },
  blaze: { name: "Blaze", desc: "Powers up Fire moves in a pinch.", pinchType: "fire" },
  torrent: { name: "Torrent", desc: "Powers up Water moves in a pinch.", pinchType: "water" },
  swarm: { name: "Swarm", desc: "Powers up Bug moves in a pinch.", pinchType: "bug" },
  static: { name: "Static", desc: "May paralyze on contact.", contactParalyze: 0.3 },
  levitate: { name: "Levitate", desc: "Gives immunity to Ground moves.", immuneTo: ["ground"] },
  intimidate: { name: "Intimidate", desc: "Lowers the foe's Attack on entry.", intimidate: true },
  "flash-fire": { name: "Flash Fire", desc: "Absorbs Fire moves to power up its own.", absorbType: "fire" },
  "water-absorb": { name: "Water Absorb", desc: "Restores HP from Water moves.", immuneTo: ["water"] },
  "volt-absorb": { name: "Volt Absorb", desc: "Restores HP from Electric moves.", immuneTo: ["electric"] },
  sturdy: { name: "Sturdy", desc: "Resists being knocked out in one hit." },
  "thick-fat": { name: "Thick Fat", desc: "Halves Fire and Ice damage taken." },
  guts: { name: "Guts", desc: "Boosts Attack if it has a status condition." },
  keen: { name: "Keen Eye", desc: "Keeps its accuracy high." }
};

export function getAbilityName(id?: string): string {
  return (id && ABILITIES[id]?.name) || "";
}

export function getAbility(id?: string): AbilityData | undefined {
  return id ? ABILITIES[id] : undefined;
}
