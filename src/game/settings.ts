// Player display settings that persist across sessions. Kept tiny and
// dependency-free, mirroring the narrator's localStorage pattern. Audio
// on/off lives in sound.ts and read-aloud in narrator.ts; this module owns the
// battle text-reveal speed, which the typewriter in Battle reads each line.

export type TextSpeed = "slow" | "normal" | "fast";

const STORAGE_KEY = "pokemon_text_speed";
const ORDER: TextSpeed[] = ["slow", "normal", "fast"];

// ms between revealed characters. "fast" is brisk but still reads as a reveal;
// most battle lines finish within the existing between-message pauses.
const CHAR_DELAY: Record<TextSpeed, number> = { slow: 34, normal: 18, fast: 6 };

let textSpeed: TextSpeed = readStored();

function readStored(): TextSpeed {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY) as TextSpeed | null;
    return v && ORDER.includes(v) ? v : "normal";
  } catch {
    return "normal";
  }
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, textSpeed);
  } catch {
    /* storage unavailable (private mode); setting still applies this session */
  }
}

export function getTextSpeed(): TextSpeed {
  return textSpeed;
}

export function setTextSpeed(speed: TextSpeed): void {
  textSpeed = speed;
  persist();
}

/** Advance Slow → Normal → Fast → Slow … and return the new value. */
export function cycleTextSpeed(): TextSpeed {
  setTextSpeed(ORDER[(ORDER.indexOf(textSpeed) + 1) % ORDER.length]);
  return textSpeed;
}

/** Per-character delay (ms) for the battle text typewriter. */
export function charDelayMs(): number {
  return CHAR_DELAY[textSpeed];
}
