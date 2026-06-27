// Read-aloud narration using the browser's built-in Web Speech API
// (window.speechSynthesis). Like sound.ts this needs no external assets and no
// network — it just speaks the game's own text. It exists for our youngest
// players (≈7) who can follow the game by ear while their reading catches up.
//
// All game text already funnels through two sinks (Battle.setMessage and
// Overworld.showNotification), so wiring speak() in there narrates the whole
// game from one place.
import { emitTestEvent } from "./testBridge";

const STORAGE_KEY = "pokemon_narration_enabled";

// Default ON for our audience; a saved preference (set via the pause menu)
// overrides it and sticks across sessions.
let narrationEnabled = readStoredPreference();

function readStoredPreference(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
}

function persistPreference(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, narrationEnabled ? "1" : "0");
  } catch {
    /* storage may be unavailable (private mode); narration still works in-session */
  }
}

/** True when the Web Speech API is present (older/embedded webviews lack it). */
function synthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Strip emoji, decorative symbols and UI glyphs so the voice reads the words
 * cleanly ("You earned the Boulder Badge!" not "trophy You earned…"). Collapses
 * leftover whitespace.
 */
function cleanForSpeech(text: string): string {
  return text
    // Emoji and pictographs
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}️]/gu, " ")
    // Arrows and the UI glyphs we use on buttons/badges
    .replace(/[\u{2190}-\u{21FF}]/gu, " ")
    .replace(/[▲▼✕•·☰＋◀▶➜→★🔊🔇]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Speak a line of game text. No-op when narration is off or unavailable. Any
 * in-flight utterance is cancelled first so messages never queue up and lag
 * behind the action on screen.
 */
export function speak(text: string): void {
  if (!narrationEnabled) return;
  const spoken = cleanForSpeech(text);
  if (!spoken) return;

  emitTestEvent("narrate:speak", { text: spoken });

  if (!synthesisAvailable()) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.rate = 0.95; // a touch slower for young listeners
    utterance.pitch = 1.05; // friendly, slightly bright
    window.speechSynthesis.speak(utterance);
  } catch {
    /* speech can throw if the engine isn't ready; narration is best-effort */
  }
}

/** Cancel any in-flight narration (e.g. when leaving a scene). */
export function stopSpeaking(): void {
  if (!synthesisAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export function isNarrationEnabled(): boolean {
  return narrationEnabled;
}

export function setNarrationEnabled(enabled: boolean): void {
  narrationEnabled = enabled;
  persistPreference();
  if (!enabled) stopSpeaking();
}

/** Flip narration on/off (used by the pause-menu toggle). Returns the new state. */
export function toggleNarration(): boolean {
  setNarrationEnabled(!narrationEnabled);
  return narrationEnabled;
}
