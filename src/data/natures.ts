import { rng } from "../game/rng";
// Pokémon Natures: each raises one stat by 10% and lowers another by 10%.
// "neutral" natures (up === down) have no net effect. Mirrors the canonical
// 25-nature table, mapped onto this game's stat keys.

export type NatureStat = "atk" | "def" | "spd" | "spAtk" | "spDef";

export interface NatureData {
  name: string;
  up?: NatureStat;
  down?: NatureStat;
}

export const NATURES: Record<string, NatureData> = {
  hardy: { name: "Hardy" },
  lonely: { name: "Lonely", up: "atk", down: "def" },
  brave: { name: "Brave", up: "atk", down: "spd" },
  adamant: { name: "Adamant", up: "atk", down: "spAtk" },
  naughty: { name: "Naughty", up: "atk", down: "spDef" },
  bold: { name: "Bold", up: "def", down: "atk" },
  docile: { name: "Docile" },
  relaxed: { name: "Relaxed", up: "def", down: "spd" },
  impish: { name: "Impish", up: "def", down: "spAtk" },
  lax: { name: "Lax", up: "def", down: "spDef" },
  timid: { name: "Timid", up: "spd", down: "atk" },
  hasty: { name: "Hasty", up: "spd", down: "def" },
  serious: { name: "Serious" },
  jolly: { name: "Jolly", up: "spd", down: "spAtk" },
  naive: { name: "Naive", up: "spd", down: "spDef" },
  modest: { name: "Modest", up: "spAtk", down: "atk" },
  mild: { name: "Mild", up: "spAtk", down: "def" },
  quiet: { name: "Quiet", up: "spAtk", down: "spd" },
  bashful: { name: "Bashful" },
  rash: { name: "Rash", up: "spAtk", down: "spDef" },
  calm: { name: "Calm", up: "spDef", down: "atk" },
  gentle: { name: "Gentle", up: "spDef", down: "def" },
  sassy: { name: "Sassy", up: "spDef", down: "spd" },
  careful: { name: "Careful", up: "spDef", down: "spAtk" },
  quirky: { name: "Quirky" }
};

const NATURE_IDS = Object.keys(NATURES);

export function randomNature(): string {
  return NATURE_IDS[Math.floor(rng() * NATURE_IDS.length)];
}

export function getNatureName(id?: string): string {
  return (id && NATURES[id]?.name) || "Hardy";
}
