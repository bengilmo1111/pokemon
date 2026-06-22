/**
 * Seedable pseudo-random number generator.
 *
 * The whole game routes randomness through `rng()` instead of `Math.random()`
 * so that automated tests can pin a seed and get bit-for-bit reproducible
 * encounters, battles, and world generation. In normal play the seed is taken
 * from the clock at startup, so behaviour is indistinguishable from Math.random.
 *
 * Algorithm: mulberry32 — tiny, fast, and good enough for game randomness.
 */

let currentSeed = (Date.now() ^ 0x9e3779b9) >>> 0;
let state = currentSeed || 1;

/** Re-seed the generator. Tests call this (via the test bridge) for determinism. */
export function setSeed(seed: number): void {
  currentSeed = seed >>> 0;
  state = currentSeed || 1;
}

/** The seed the generator was last initialised with. */
export function getSeed(): number {
  return currentSeed;
}

/** Uniform random float in [0, 1) — drop-in replacement for Math.random(). */
export function rng(): number {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
