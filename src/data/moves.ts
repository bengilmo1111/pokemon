import type { TypeId } from "./types";
import moveList from "./moves.json";

export type MoveCategory = "physical" | "special" | "status";

export interface MoveData {
  id: string;
  name: string;
  type: TypeId;
  power: number;
  accuracy: number;
  category: MoveCategory;
}

export const MOVES: Record<string, MoveData> = Object.fromEntries(
  (moveList as MoveData[]).map((move) => [move.id, move])
);
