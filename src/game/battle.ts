import { MOVES, MoveData } from "../data/moves";
import { SPECIES } from "../data/species";
import { getEffectivenessText, getTypeEffectiveness } from "../data/types";
import { PokemonInstance, StatusEffect } from "./state";

export interface DamageResult {
  damage: number;
  effectivenessText: string;
  isCritical: boolean;
  statusInflicted?: StatusEffect;
}

export function getMove(moveId: string): MoveData {
  return MOVES[moveId];
}

export function calculateDamage(attacker: PokemonInstance, defender: PokemonInstance, moveId: string): DamageResult {
  const move = MOVES[moveId];
  if (!move || move.power <= 0) {
    return { damage: 0, effectivenessText: "", isCritical: false };
  }

  // Check for critical hit (6.25% chance, 1.5x damage)
  const isCritical = Math.random() < 0.0625;
  const critMultiplier = isCritical ? 1.5 : 1;

  const atk = move.category === "special" ? attacker.stats.atk : attacker.stats.atk;
  const def = move.category === "special" ? defender.stats.def : defender.stats.def;
  const levelFactor = (2 * attacker.level) / 5 + 2;
  const base = ((levelFactor * move.power * (atk / def)) / 50) + 2;

  let modifier = 1;

  // STAB (Same Type Attack Bonus)
  if (attacker.types.includes(move.type)) modifier *= 1.2;

  // Type effectiveness
  const effectiveness = getTypeEffectiveness(move.type, defender.types);
  modifier *= effectiveness;

  // Critical hit
  modifier *= critMultiplier;

  // Random variance (85-100%)
  modifier *= 0.85 + Math.random() * 0.15;

  // Status effect penalties
  if (attacker.status === "burn" && move.category === "physical") {
    modifier *= 0.5;
  }

  const damage = Math.max(1, Math.floor(base * modifier));

  // Check for status effect infliction from certain moves
  let statusInflicted: StatusEffect | undefined;
  if (Math.random() < 0.1) { // 10% chance for status from damaging moves
    if (move.type === "fire" && defender.status === "none") {
      statusInflicted = "burn";
    } else if (move.type === "electric" && defender.status === "none") {
      statusInflicted = "paralysis";
    } else if (move.type === "ice" && defender.status === "none") {
      statusInflicted = "freeze";
    } else if (move.type === "poison" && defender.status === "none") {
      statusInflicted = "poison";
    }
  }

  return { damage, effectivenessText: getEffectivenessText(effectiveness), isCritical, statusInflicted };
}

export function rollAccuracy(moveId: string, attacker: PokemonInstance): boolean {
  const move = MOVES[moveId];
  if (!move) return false;

  let accuracy = move.accuracy;

  // Paralysis reduces accuracy
  if (attacker.status === "paralysis") {
    accuracy *= 0.75;
  }

  return Math.random() <= accuracy;
}

export function canAct(pokemon: PokemonInstance): { canAct: boolean; reason?: string } {
  switch (pokemon.status) {
    case "sleep":
      // 33% chance to wake up each turn
      if (Math.random() < 0.33) {
        pokemon.status = "none";
        return { canAct: true, reason: `${pokemon.name} woke up!` };
      }
      return { canAct: false, reason: `${pokemon.name} is fast asleep!` };

    case "freeze":
      // 20% chance to thaw each turn
      if (Math.random() < 0.2) {
        pokemon.status = "none";
        return { canAct: true, reason: `${pokemon.name} thawed out!` };
      }
      return { canAct: false, reason: `${pokemon.name} is frozen solid!` };

    case "paralysis":
      // 25% chance to be fully paralyzed
      if (Math.random() < 0.25) {
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

  return Math.random() < chance;
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
