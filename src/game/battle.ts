import { rng } from "./rng";
import { MOVES, MoveData } from "../data/moves";
import { SPECIES } from "../data/species";
import { getEffectivenessText, getTypeEffectiveness } from "../data/types";
import { getAbility } from "../data/abilities";
import { PokemonInstance, StatusEffect } from "./state";

export interface DamageResult {
  damage: number;
  effectivenessText: string;
  effectiveness: number;
  isCritical: boolean;
  statusInflicted?: StatusEffect;
  /** Defender ability absorbed the hit (no damage). "heal" restores HP; "flash-fire" powers up Fire. */
  absorbed?: "heal" | "flash-fire";
  /** HP the defender should recover when `absorbed === "heal"`. */
  healAmount?: number;
}

export function getMove(moveId: string): MoveData {
  return MOVES[moveId];
}

// Stage multiplier: standard Gen formula — max(2, 2+stage) / max(2, 2-stage)
export function stageMultiplier(stage: number): number {
  return Math.max(2, 2 + stage) / Math.max(2, 2 - stage);
}

export interface StatStages {
  atk: number;
  def: number;
  spd: number;
  spAtk: number;
  spDef: number;
  acc: number;
}

// Accuracy/evasion stages use the 3/(3±stage) ratio table, not the standard one.
export function accStageMultiplier(stage: number): number {
  return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
}

export type Weather = "none" | "rain" | "sun" | "sandstorm";

export function calculateDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  moveId: string,
  attackerStages?: StatStages,
  defenderStages?: StatStages,
  weather: Weather = "none",
  flashFireActive = false
): DamageResult {
  const move = MOVES[moveId];
  if (!move || move.power <= 0) {
    return { damage: 0, effectivenessText: "", effectiveness: 1, isCritical: false };
  }

  const isSpecial = move.category === "special";

  // Type effectiveness (computed early so abilities can grant immunity)
  let effectiveness = getTypeEffectiveness(move.type, defender.types);

  // Defender ability: damage-negating absorption.
  const defAbility = getAbility(defender.ability);
  // Water/Volt Absorb: negate the hit and restore HP.
  if (defAbility?.absorbHeal === move.type && defender.hp < defender.maxHp) {
    const healAmount = Math.min(defender.maxHp - defender.hp, Math.max(1, Math.floor(defender.maxHp / 4)));
    return { damage: 0, effectivenessText: "", effectiveness: 0, isCritical: false, absorbed: "heal", healAmount };
  }
  // Flash Fire: negate the Fire hit and power up the defender's own Fire moves.
  if (defAbility?.absorbType === move.type) {
    return { damage: 0, effectivenessText: "", effectiveness: 0, isCritical: false, absorbed: "flash-fire" };
  }
  // Other full type immunities (Levitate, and a topped-off Water/Volt Absorb).
  if (defAbility?.immuneTo?.includes(move.type)) {
    return { damage: 0, effectivenessText: "It doesn't affect " + defender.name + "…", effectiveness: 0, isCritical: false };
  }

  // Check for critical hit (6.25% chance, 1.5x damage)
  const isCritical = rng() < 0.0625;
  const critMultiplier = isCritical ? 1.5 : 1;

  // Pick offensive/defensive stats and stages by move category.
  const atkStage = (isSpecial ? attackerStages?.spAtk : attackerStages?.atk) ?? 0;
  const defStage = (isSpecial ? defenderStages?.spDef : defenderStages?.def) ?? 0;
  const atkBase = isSpecial ? attacker.stats.spAtk : attacker.stats.atk;
  const defBase = isSpecial ? defender.stats.spDef : defender.stats.def;

  const atkAbility = getAbility(attacker.ability);
  // Guts: 50% physical Attack boost while the attacker carries a status condition.
  const gutsBoost = atkAbility?.guts && attacker.status !== "none" && !isSpecial ? 1.5 : 1;
  const atk = Math.floor(atkBase * stageMultiplier(atkStage) * gutsBoost);
  let def = Math.max(1, Math.floor(defBase * stageMultiplier(defStage)));
  // Sandstorm raises Sp. Def of Rock-type defenders by 50%.
  if (weather === "sandstorm" && isSpecial && defender.types.includes("rock")) {
    def = Math.floor(def * 1.5);
  }
  const levelFactor = (2 * attacker.level) / 5 + 2;
  const base = ((levelFactor * move.power * (atk / def)) / 50) + 2;

  let modifier = 1;

  // Weather damage modifiers
  if (weather === "rain") {
    if (move.type === "water") modifier *= 1.5;
    else if (move.type === "fire") modifier *= 0.5;
  } else if (weather === "sun") {
    if (move.type === "fire") modifier *= 1.5;
    else if (move.type === "water") modifier *= 0.5;
  }

  // STAB (Same Type Attack Bonus)
  if (attacker.types.includes(move.type)) modifier *= 1.2;

  // Type effectiveness
  modifier *= effectiveness;

  // Critical hit
  modifier *= critMultiplier;

  // Random variance (85-100%)
  modifier *= 0.85 + rng() * 0.15;

  // Burn halves physical damage (Guts shrugs off the burn penalty).
  if (attacker.status === "burn" && move.category === "physical" && !atkAbility?.guts) {
    modifier *= 0.5;
  }

  // Attacker ability: pinch boost (Blaze/Torrent/Overgrow/Swarm) when low HP
  if (atkAbility?.pinchType === move.type && attacker.hp <= attacker.maxHp / 3) {
    modifier *= 1.5;
  }

  // Flash Fire: a previously-absorbed Fire hit powers up this Fire-type move.
  if (flashFireActive && move.type === "fire") {
    modifier *= 1.5;
  }

  // Defender ability: Thick Fat (and any resist ability) softens listed types.
  if (defAbility?.resist?.types.includes(move.type)) {
    modifier *= defAbility.resist.factor;
  }

  const damage = Math.max(1, Math.floor(base * modifier));

  // Move-driven status infliction (per-move chance + effect), replacing the
  // old flat type-based heuristic. Falls back to legacy type behavior when a
  // move declares no explicit effect, so existing content still inflicts status.
  let statusInflicted: StatusEffect | undefined;
  if (defender.status === "none") {
    if (move.effect?.status && move.effectChance) {
      if (rng() < move.effectChance) statusInflicted = move.effect.status;
    } else if (!move.effect && rng() < 0.1) {
      if (move.type === "fire") statusInflicted = "burn";
      else if (move.type === "electric") statusInflicted = "paralysis";
      else if (move.type === "ice") statusInflicted = "freeze";
      else if (move.type === "poison") statusInflicted = "poison";
    }
  }

  return { damage, effectivenessText: getEffectivenessText(effectiveness), effectiveness, isCritical, statusInflicted };
}

export function rollAccuracy(moveId: string, attacker: PokemonInstance, accStage = 0): boolean {
  const move = MOVES[moveId];
  if (!move) return false;

  let accuracy = move.accuracy;

  // Accuracy stage changes (Sand-Attack and friends).
  if (accStage !== 0) accuracy *= accStageMultiplier(accStage);

  // Paralysis reduces accuracy
  if (attacker.status === "paralysis") {
    accuracy *= 0.75;
  }

  return rng() <= accuracy;
}

export function canAct(pokemon: PokemonInstance): { canAct: boolean; reason?: string } {
  switch (pokemon.status) {
    case "sleep":
      // 33% chance to wake up each turn
      if (rng() < 0.33) {
        pokemon.status = "none";
        return { canAct: true, reason: `${pokemon.name} woke up!` };
      }
      return { canAct: false, reason: `${pokemon.name} is fast asleep!` };

    case "freeze":
      // 20% chance to thaw each turn
      if (rng() < 0.2) {
        pokemon.status = "none";
        return { canAct: true, reason: `${pokemon.name} thawed out!` };
      }
      return { canAct: false, reason: `${pokemon.name} is frozen solid!` };

    case "paralysis":
      // 25% chance to be fully paralyzed
      if (rng() < 0.25) {
        return { canAct: false, reason: `${pokemon.name} is paralyzed and can't move!` };
      }
      return { canAct: true };

    default:
      return { canAct: true };
  }
}

export function applyStatusDamage(pokemon: PokemonInstance): { damage: number; message?: string } {
  switch (pokemon.status) {
    case "poison":
      const poisonDamage = Math.max(1, Math.floor(pokemon.maxHp / 8));
      pokemon.hp = Math.max(0, pokemon.hp - poisonDamage);
      return { damage: poisonDamage, message: `${pokemon.name} is hurt by poison!` };

    case "burn":
      const burnDamage = Math.max(1, Math.floor(pokemon.maxHp / 16));
      pokemon.hp = Math.max(0, pokemon.hp - burnDamage);
      return { damage: burnDamage, message: `${pokemon.name} is hurt by its burn!` };

    default:
      return { damage: 0 };
  }
}

export function tryInflictStatus(target: PokemonInstance, status: StatusEffect, moveId?: string): boolean {
  // Can't inflict status on Pokemon that already have one
  if (target.status !== "none") return false;

  // Type immunities
  if (status === "burn" && target.types.includes("fire")) return false;
  if (status === "freeze" && target.types.includes("ice")) return false;
  if (status === "paralysis" && target.types.includes("electric")) return false;
  if (status === "poison" && (target.types.includes("poison") || target.types.includes("steel"))) return false;

  target.status = status;
  return true;
}

export function attemptCatch(target: PokemonInstance, ballType: "pokeball" | "greatball" | "ultraball" = "pokeball"): boolean {
  const species = SPECIES[target.speciesId];
  const rate = species?.catchRate ?? 45;

  // Ball modifiers
  const ballMod = ballType === "ultraball" ? 2.0 : ballType === "greatball" ? 1.5 : 1.0;

  // Status bonuses
  let statusMod = 1;
  if (target.status === "sleep" || target.status === "freeze") {
    statusMod = 2.5;
  } else if (target.status === "paralysis" || target.status === "burn" || target.status === "poison") {
    statusMod = 1.5;
  }

  const hpFactor = 1 - target.hp / target.maxHp;
  const chance = Math.min(0.95, 0.15 + hpFactor * (rate / 255) * ballMod * statusMod);

  return rng() < chance;
}

export function getStatusDisplayText(status: StatusEffect): string {
  switch (status) {
    case "poison": return "PSN";
    case "burn": return "BRN";
    case "paralysis": return "PAR";
    case "sleep": return "SLP";
    case "freeze": return "FRZ";
    default: return "";
  }
}

export function getStatusColor(status: StatusEffect): number {
  switch (status) {
    case "poison": return 0xa855f7;
    case "burn": return 0xf97316;
    case "paralysis": return 0xeab308;
    case "sleep": return 0x6b7280;
    case "freeze": return 0x22d3ee;
    default: return 0xffffff;
  }
}
