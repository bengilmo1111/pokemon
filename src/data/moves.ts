import type { TypeId } from "./types";
import type { StatusEffect } from "../game/state";
import type { NatureStat } from "./natures";
import moveList from "./moves.json";

export type MoveCategory = "physical" | "special" | "status";

export interface MoveEffect {
  /** Status condition this move can inflict. */
  status?: StatusEffect;
  /** Stat stage change applied to the target (negative) or self (positive). */
  statStage?: { stat: NatureStat | "acc"; delta: number; target: "self" | "enemy" };
  /** Weather this move sets, if any. */
  weather?: "rain" | "sun" | "sandstorm";
}

export interface MoveData {
  id: string;
  name: string;
  type: TypeId;
  power: number;
  accuracy: number;
  category: MoveCategory;
  /** Optional secondary/primary effect (status, stat change, weather). */
  effect?: MoveEffect;
  /** Probability (0–1) the `effect` triggers on a damaging move. */
  effectChance?: number;
  /** Max power points; defaults applied at load if absent. */
  pp?: number;
}

export const MOVES: Record<string, MoveData> = Object.fromEntries(
  (moveList as MoveData[]).map((move) => [move.id, move])
);
