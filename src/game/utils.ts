import { rng } from "./rng";
export function randRange(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function pick<T>(list: T[]): T {
  return list[Math.floor(rng() * list.length)];
}

export function pickWeighted<T extends { weight: number }>(entries: T[]): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
}
