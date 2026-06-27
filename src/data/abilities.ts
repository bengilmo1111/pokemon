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
  /** Negates incoming damage of this type and instead powers up its own (Flash Fire). */
  absorbType?: TypeId;
  /** Negates incoming damage of this type and restores HP instead (Water/Volt Absorb). */
  absorbHeal?: TypeId;
  /** Survives a would-be one-hit KO from full HP, hanging on with 1 HP (Sturdy). */
  sturdy?: boolean;
  /** Boosts physical Attack by 50% while statused and ignores burn's attack drop (Guts). */
  guts?: boolean;
  /** Softens incoming damage of the listed types by `factor` (Thick Fat). */
  resist?: { types: TypeId[]; factor: number };
  /** Prevents the holder's accuracy from being lowered (Keen Eye). */
  keenEye?: boolean;
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
  "water-absorb": { name: "Water Absorb", desc: "Restores HP from Water moves.", immuneTo: ["water"], absorbHeal: "water" },
  "volt-absorb": { name: "Volt Absorb", desc: "Restores HP from Electric moves.", immuneTo: ["electric"], absorbHeal: "electric" },
  sturdy: { name: "Sturdy", desc: "Resists being knocked out in one hit.", sturdy: true },
  "thick-fat": { name: "Thick Fat", desc: "Halves Fire and Ice damage taken.", resist: { types: ["fire", "ice"], factor: 0.5 } },
  guts: { name: "Guts", desc: "Boosts Attack if it has a status condition.", guts: true },
  keen: { name: "Keen Eye", desc: "Keeps its accuracy high.", keenEye: true }
};

export function getAbilityName(id?: string): string {
  return (id && ABILITIES[id]?.name) || "";
}

export function getAbility(id?: string): AbilityData | undefined {
  return id ? ABILITIES[id] : undefined;
}
