import Phaser from "phaser";

/**
 * Painterly terrain helpers.
 *
 * The overworld is drawn with no tilemap — everything is composited from soft
 * "stamp" textures baked once and drawn into a RenderTexture. Stamping
 * overlapping radial-gradient discs gives a feathered union (one organic
 * coastline instead of N hard circles) and lets adjacent biomes blend at their
 * seams, which plain `Graphics.fillCircle` can't do.
 */

export const SOFT_CIRCLE_KEY = "terrain-soft-circle";
export const SOFT_CIRCLE_SIZE = 192;
export const NOISE_KEY = "terrain-noise";
export const OCEAN_GRADIENT_KEY = "terrain-ocean-gradient";

/** Deterministic PRNG independent of the gameplay `rng()` so baking textures
 * never disturbs the seeded game sequence the tests rely on. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A white radial-gradient disc: opaque core feathering to a transparent rim.
 * Drawn tinted/scaled to paint feathered land, biomes, mottling and scatter. */
export function ensureSoftCircle(scene: Phaser.Scene): void {
  if (scene.textures.exists(SOFT_CIRCLE_KEY)) return;
  const size = SOFT_CIRCLE_SIZE;
  const tex = scene.textures.createCanvas(SOFT_CIRCLE_KEY, size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  const c = size / 2;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.62, "rgba(255,255,255,0.97)");
  grad.addColorStop(0.85, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
  // Smooth scaling despite the game's global pixelArt/NEAREST default.
  scene.textures.get(SOFT_CIRCLE_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** A subtle tiling grain used as a MULTIPLY overlay for painterly texture.
 * Kept light (values near white) so it only gently mottles the land. */
export function ensureNoise(scene: Phaser.Scene, size = 256): void {
  if (scene.textures.exists(NOISE_KEY)) return;
  const tex = scene.textures.createCanvas(NOISE_KEY, size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  const img = ctx.createImageData(size, size);
  const rand = mulberry32(0x9e3779b1);
  for (let i = 0; i < img.data.length; i += 4) {
    // Soft speckle in the 200..255 range → multiply darkens by at most ~20%.
    const v = 205 + Math.floor(rand() * 50);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  scene.textures.get(NOISE_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** A tall 1px vertical gradient stretched across the sea for depth. */
export function ensureOceanGradient(scene: Phaser.Scene, height = 256): void {
  if (scene.textures.exists(OCEAN_GRADIENT_KEY)) return;
  const tex = scene.textures.createCanvas(OCEAN_GRADIENT_KEY, 1, height);
  if (!tex) return;
  const ctx = tex.getContext();
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#0a2238");
  grad.addColorStop(0.5, "#0e3454");
  grad.addColorStop(1, "#125075");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1, height);
  tex.refresh();
  scene.textures.get(OCEAN_GRADIENT_KEY).setFilter(Phaser.Textures.FilterMode.LINEAR);
}

export function ensureTerrainTextures(scene: Phaser.Scene): void {
  ensureSoftCircle(scene);
  ensureNoise(scene);
  ensureOceanGradient(scene);
}

/** Lighten an integer RGB colour toward white by `amt` (0..1). */
export function lighten(color: number, amt: number): number {
  return Phaser.Display.Color.IntegerToColor(color)
    .lighten(Math.round(Phaser.Math.Clamp(amt, 0, 1) * 100)).color;
}

/** Darken an integer RGB colour toward black by `amt` (0..1). */
export function darken(color: number, amt: number): number {
  return Phaser.Display.Color.IntegerToColor(color)
    .darken(Math.round(Phaser.Math.Clamp(amt, 0, 1) * 100)).color;
}

/** Linear blend between two integer RGB colours (`t` 0 = a, 1 = b). */
export function mix(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const k = Phaser.Math.Clamp(t, 0, 1);
  return Phaser.Display.Color.GetColor(
    Math.round(ca.red + (cb.red - ca.red) * k),
    Math.round(ca.green + (cb.green - ca.green) * k),
    Math.round(ca.blue + (cb.blue - ca.blue) * k)
  );
}
