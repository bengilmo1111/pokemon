// Retro-style sound system using Web Audio API
// Generates chiptune-like sounds without external audio files

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let currentMusic: OscillatorNode[] = [];
let musicInterval: number | null = null;

// Settings
let musicVolume = 0.3;
let sfxVolume = 0.5;
let musicEnabled = true;
let sfxEnabled = true;

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    masterGain.gain.value = 0.5;

    musicGain = audioContext.createGain();
    musicGain.connect(masterGain);
    musicGain.gain.value = musicVolume;

    sfxGain = audioContext.createGain();
    sfxGain.connect(masterGain);
    sfxGain.gain.value = sfxVolume;
  }
  return audioContext;
}

// Resume audio context (needed for browsers that require user interaction)
export function resumeAudio(): void {
  const ctx = getContext();
  if (ctx.state === "suspended") {
    ctx.resume();
  }
}

// Play a simple tone
function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "square",
  gainNode: GainNode = sfxGain!,
  delay = 0
): OscillatorNode {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(gainNode);

  const startTime = ctx.currentTime + delay;
  gain.gain.setValueAtTime(0.3, startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);

  return osc;
}

// Play a note with attack/decay envelope
function playNote(
  frequency: number,
  duration: number,
  attack = 0.01,
  decay = 0.1,
  sustain = 0.3,
  release = 0.1,
  type: OscillatorType = "square"
): void {
  if (!sfxEnabled) return;
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(sfxGain!);

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.4, now + attack);
  gain.gain.linearRampToValueAtTime(sustain, now + attack + decay);
  gain.gain.setValueAtTime(sustain, now + duration - release);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  osc.start(now);
  osc.stop(now + duration);
}

// Sound Effects

export function playMenuSelect(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  playTone(800, 0.08, "square");
  playTone(1200, 0.08, "square", sfxGain!, 0.04);
}

export function playMenuBack(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  playTone(600, 0.08, "square");
  playTone(400, 0.1, "square", sfxGain!, 0.05);
}

export function playHit(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  // Impact sound - noise burst
  const ctx = getContext();
  const bufferSize = ctx.sampleRate * 0.1;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = 0.3;
  noise.connect(gain);
  gain.connect(sfxGain!);
  noise.start();
}

export function playCriticalHit(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  playHit();
  // Extra punch for critical
  playTone(150, 0.15, "sawtooth");
  playTone(100, 0.2, "sawtooth", sfxGain!, 0.05);
  // High ping
  playTone(1500, 0.1, "sine", sfxGain!, 0.1);
}

export function playMiss(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  playTone(200, 0.15, "sine");
  playTone(150, 0.2, "sine", sfxGain!, 0.1);
}

export function playLevelUp(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    playTone(freq, 0.2, "square", sfxGain!, i * 0.1);
  });
}

export function playEvolution(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  // Ascending arpeggio
  const notes = [262, 330, 392, 523, 659, 784, 1047, 1319];
  notes.forEach((freq, i) => {
    playTone(freq, 0.3, "square", sfxGain!, i * 0.08);
  });
  // Triumphant final chord
  setTimeout(() => {
    playTone(523, 0.5, "square");
    playTone(659, 0.5, "square");
    playTone(784, 0.5, "square");
  }, 700);
}

export function playCatch(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  // Click sounds for ball shaking
  playTone(800, 0.05, "square");
  playTone(600, 0.05, "square", sfxGain!, 0.3);
  playTone(800, 0.05, "square", sfxGain!, 0.6);
  // Success jingle
  setTimeout(() => {
    playTone(523, 0.15, "square");
    playTone(659, 0.15, "square", sfxGain!, 0.12);
    playTone(784, 0.15, "square", sfxGain!, 0.24);
    playTone(1047, 0.3, "square", sfxGain!, 0.36);
  }, 800);
}

export function playCatchFail(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  playTone(400, 0.1, "square");
  playTone(300, 0.15, "square", sfxGain!, 0.1);
  playTone(200, 0.2, "sawtooth", sfxGain!, 0.2);
}

export function playFaint(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  // Descending sad tones
  playTone(400, 0.2, "square");
  playTone(350, 0.2, "square", sfxGain!, 0.15);
  playTone(300, 0.2, "square", sfxGain!, 0.3);
  playTone(250, 0.3, "square", sfxGain!, 0.45);
}

export function playVictory(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  // Victory fanfare
  const melody = [
    { freq: 523, dur: 0.15 },  // C
    { freq: 523, dur: 0.15 },  // C
    { freq: 523, dur: 0.15 },  // C
    { freq: 523, dur: 0.4 },   // C (held)
    { freq: 415, dur: 0.4 },   // Ab
    { freq: 466, dur: 0.4 },   // Bb
    { freq: 523, dur: 0.6 },   // C (held)
  ];
  let time = 0;
  melody.forEach(note => {
    playTone(note.freq, note.dur, "square", sfxGain!, time);
    time += note.dur * 0.9;
  });
}

export function playDefeat(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  // Sad descending melody
  const notes = [392, 349, 330, 294, 262];
  notes.forEach((freq, i) => {
    playTone(freq, 0.3, "triangle", sfxGain!, i * 0.25);
  });
}

export function playItemGet(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  playTone(880, 0.1, "square");
  playTone(1100, 0.1, "square", sfxGain!, 0.08);
  playTone(1320, 0.15, "square", sfxGain!, 0.16);
}

export function playHeal(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  // Healing chime
  const notes = [523, 659, 784, 880, 1047];
  notes.forEach((freq, i) => {
    playTone(freq, 0.12, "sine", sfxGain!, i * 0.06);
  });
}

export function playEncounter(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  // Dramatic encounter sound
  playTone(200, 0.1, "square");
  playTone(250, 0.1, "square", sfxGain!, 0.08);
  playTone(300, 0.1, "square", sfxGain!, 0.16);
  playTone(400, 0.15, "square", sfxGain!, 0.24);
  playTone(500, 0.2, "square", sfxGain!, 0.35);
}

export function playTextBlip(): void {
  if (!sfxEnabled) return;
  resumeAudio();
  playTone(600, 0.03, "square");
}

// Background Music

const overworldMelody = [
  // Simple cheerful melody in C major
  { note: 523, dur: 0.25 }, // C5
  { note: 587, dur: 0.25 }, // D5
  { note: 659, dur: 0.25 }, // E5
  { note: 523, dur: 0.25 }, // C5
  { note: 659, dur: 0.25 }, // E5
  { note: 784, dur: 0.5 },  // G5
  { note: 784, dur: 0.5 },  // G5
  { note: 698, dur: 0.25 }, // F5
  { note: 659, dur: 0.25 }, // E5
  { note: 587, dur: 0.25 }, // D5
  { note: 523, dur: 0.25 }, // C5
  { note: 587, dur: 0.5 },  // D5
  { note: 523, dur: 0.5 },  // C5
];

const battleMelody = [
  // Intense battle theme
  { note: 330, dur: 0.15 }, // E4
  { note: 330, dur: 0.15 }, // E4
  { note: 392, dur: 0.15 }, // G4
  { note: 330, dur: 0.15 }, // E4
  { note: 294, dur: 0.15 }, // D4
  { note: 330, dur: 0.3 },  // E4
  { note: 392, dur: 0.15 }, // G4
  { note: 440, dur: 0.15 }, // A4
  { note: 392, dur: 0.15 }, // G4
  { note: 330, dur: 0.15 }, // E4
  { note: 294, dur: 0.3 },  // D4
  { note: 262, dur: 0.15 }, // C4
  { note: 294, dur: 0.15 }, // D4
  { note: 330, dur: 0.3 },  // E4
];

const victoryMelody = [
  // Triumphant victory theme
  { note: 523, dur: 0.2 },  // C5
  { note: 523, dur: 0.2 },  // C5
  { note: 523, dur: 0.2 },  // C5
  { note: 523, dur: 0.4 },  // C5
  { note: 415, dur: 0.4 },  // Ab4
  { note: 466, dur: 0.4 },  // Bb4
  { note: 523, dur: 0.4 },  // C5
  { note: 466, dur: 0.2 },  // Bb4
  { note: 523, dur: 0.6 },  // C5
];

function playMusicLoop(melody: { note: number; dur: number }[], tempo = 1): void {
  if (!musicEnabled) return;

  const ctx = getContext();
  let time = ctx.currentTime;

  melody.forEach(({ note, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.value = note;
    osc.connect(gain);
    gain.connect(musicGain!);

    const duration = dur * tempo;
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.setValueAtTime(0.15, time + duration * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    osc.start(time);
    osc.stop(time + duration);
    currentMusic.push(osc);

    time += duration;
  });

  // Calculate total duration and schedule next loop
  const totalDuration = melody.reduce((sum, n) => sum + n.dur * tempo, 0) * 1000;
  musicInterval = window.setTimeout(() => {
    if (musicEnabled) {
      playMusicLoop(melody, tempo);
    }
  }, totalDuration - 50);
}

// Add bass line for fuller sound
function playBassLine(root: number, pattern: number[], tempo = 1): void {
  if (!musicEnabled) return;

  const ctx = getContext();
  let time = ctx.currentTime;

  pattern.forEach((interval) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.value = root * Math.pow(2, interval / 12);
    osc.connect(gain);
    gain.connect(musicGain!);

    const duration = 0.5 * tempo;
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration * 0.9);

    osc.start(time);
    osc.stop(time + duration);

    time += duration;
  });
}

export function stopMusic(): void {
  if (musicInterval) {
    clearTimeout(musicInterval);
    musicInterval = null;
  }
  currentMusic.forEach(osc => {
    try { osc.stop(); } catch {}
  });
  currentMusic = [];
}

export function playOverworldMusic(): void {
  if (!musicEnabled) return;
  resumeAudio();
  stopMusic();
  playMusicLoop(overworldMelody, 1.2);
}

export function playBattleMusic(): void {
  if (!musicEnabled) return;
  resumeAudio();
  stopMusic();
  playMusicLoop(battleMelody, 0.8);
}

export function playVictoryMusic(): void {
  if (!musicEnabled) return;
  resumeAudio();
  stopMusic();
  playMusicLoop(victoryMelody, 1);
}

// Volume controls
export function setMusicVolume(volume: number): void {
  musicVolume = Math.max(0, Math.min(1, volume));
  if (musicGain) {
    musicGain.gain.value = musicVolume;
  }
}

export function setSfxVolume(volume: number): void {
  sfxVolume = Math.max(0, Math.min(1, volume));
  if (sfxGain) {
    sfxGain.gain.value = sfxVolume;
  }
}

export function toggleMusic(): boolean {
  musicEnabled = !musicEnabled;
  if (!musicEnabled) {
    stopMusic();
  }
  return musicEnabled;
}

export function toggleSfx(): boolean {
  sfxEnabled = !sfxEnabled;
  return sfxEnabled;
}

export function isMusicEnabled(): boolean {
  return musicEnabled;
}

export function isSfxEnabled(): boolean {
  return sfxEnabled;
}
