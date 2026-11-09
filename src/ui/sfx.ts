/**
 * Strata's sound-effect recipes and haptic patterns, as data (sprint 10 F1 and F4; D64, D68).
 * src/ui/audio.ts synthesises every sound from these voices with WebAudio: no audio files,
 * nothing sampled, nothing taken from another game. This module is pure and DOM-free, so
 * tests/unit/ui/sfx.test.ts checks every event in Node. The real loudness of each event is
 * measured in Chromium with an OfflineAudioContext (production/qa/evidence/sprint-10/f1/).
 */

/** Every sound event the game can make. Adding one means a recipe in {@link SOUNDS} and an entry in {@link HAPTICS}. */
export const SOUND_EVENTS = [
  'select',
  'deselect',
  'nope',
  'pour',
  'land',
  'seal',
  'win',
  'coin',
  'booster',
  'shuffle',
  'mapStone',
  'locked',
  'unlock',
  'shell',
  'sceneBought',
  'playHere',
] as const;

/** One sound event (see {@link SOUND_EVENTS}). */
export type SoundEvent = (typeof SOUND_EVENTS)[number];

/** What a call site may pass with an event. */
export interface SoundDetail {
  /** Sand units poured (the pour follows it, capped at 6). */
  units?: number;
  /** A pitch step: the jar index for select, the stack height for land. */
  pitch?: number;
  /** Seconds to wait before the sound starts (0 to 2), e.g. a shell row after the win chime. */
  delay?: number;
}

/** A pitched voice: an oscillator with a quick attack and an exponential decay. Times in seconds. */
export interface ToneVoice {
  kind: 'tone';
  wave: 'sine' | 'triangle' | 'square';
  freq: number;
  /** Glides to this frequency over the voice, if set. */
  endFreq?: number;
  at: number;
  attack: number;
  dur: number;
  /** Peak level, linear, before the sfx bus and master. */
  vol: number;
}

/** A noise voice: the shared noise buffer through one filter whose frequency sweeps `from` → `to`. */
export interface NoiseVoice {
  kind: 'noise';
  filter: 'bandpass' | 'lowpass' | 'highpass';
  from: number;
  to: number;
  q: number;
  at: number;
  attack: number;
  dur: number;
  vol: number;
}

/** One layer of a sound. */
export type Voice = ToneVoice | NoiseVoice;

/** One event's sound: its voices for a detail, and the peak it must stay under. */
export interface SoundRecipe {
  /** The highest peak this event may reach at full sound volume, in dBFS (always below -1). */
  capDb: number;
  voices: (detail: SoundDetail) => Voice[];
}

/** The master gain shared by sound and music, before the destination. */
export const MASTER_GAIN = 0.7;

/** C major pentatonic, two octaves from middle C: every chime is drawn from it, as the music is. */
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

/** A note of {@link PENTA}, clamped to its range. */
const note = (i: number): number => PENTA[Math.max(0, Math.min(PENTA.length - 1, Math.floor(i)))];

const clampInt = (v: number | undefined, lo: number, hi: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : fallback;

/** A tone voice with an 8 ms attack unless `attack` says otherwise. */
function tone(freq: number, at: number, dur: number, vol: number, wave: ToneVoice['wave'] = 'sine', extra: Partial<ToneVoice> = {}): ToneVoice {
  return { kind: 'tone', wave, freq, at, attack: 0.008, dur, vol, ...extra };
}

/** A noise voice. */
function noise(filter: NoiseVoice['filter'], from: number, to: number, at: number, dur: number, vol: number, q = 0.9, attack = 0.004): NoiseVoice {
  return { kind: 'noise', filter, from, to, q, at, attack, dur, vol };
}

/**
 * A warm chime: a sine fundamental, a slightly detuned triangle for body, and a quieter
 * octave and twelfth that fade first, so the note softens as it rings.
 */
function bell(freq: number, at: number, vol: number, dur: number): ToneVoice[] {
  return [
    tone(freq, at, dur, vol),
    tone(freq * 1.004, at, dur * 0.7, vol * 0.3, 'triangle', { attack: 0.012 }),
    tone(freq * 2, at, dur * 0.45, vol * 0.25),
    tone(freq * 3, at, dur * 0.22, vol * 0.08),
  ];
}

/** A repeatable 0..1 jitter for grain `i`, so a recipe gives the same voices every time. */
const jitter = (i: number): number => {
  const x = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return x - Math.floor(x);
};

/** The soft coin tick: a rising major third, sine and triangle (no square edge). */
const coinVoices = (at = 0): Voice[] => [tone(1046.5, at, 0.07, 0.05, 'triangle'), tone(1318.5, at + 0.045, 0.16, 0.06), tone(2637, at + 0.045, 0.07, 0.012)];

/**
 * Every event's recipe. Levels are linear peaks before the sfx bus (the sound volume) and
 * {@link MASTER_GAIN}; each cap was set from the measured peak with headroom (D68: calm).
 */
export const SOUNDS: Record<SoundEvent, SoundRecipe> = {
  select: {
    capDb: -16,
    voices: ({ pitch = 0 }) => {
      const f = note(4 + (clampInt(pitch, 0, 99, 0) % 3));
      return [tone(f, 0, 0.07, 0.15, 'triangle'), tone(f * 2, 0, 0.04, 0.03)];
    },
  },
  deselect: { capDb: -18, voices: () => [tone(note(2), 0, 0.06, 0.11, 'triangle')] },
  nope: { capDb: -12, voices: () => [tone(150, 0, 0.13, 0.22, 'sine', { endFreq: 95 }), noise('lowpass', 400, 200, 0, 0.05, 0.05, 0.7, 0.003)] },
  pour: {
    capDb: -12,
    voices: ({ units }) => {
      const u = clampInt(units, 1, 6, 1);
      const dur = 0.3 + 0.05 * u;
      const out: Voice[] = [
        noise('bandpass', 4200, 1500, 0, dur, 0.09, 0.8, dur * 0.25), // the hiss of the stream
        noise('lowpass', 900, 450, 0.03, dur * 0.9, 0.03 + 0.01 * u, 0.7, dur * 0.3), // body: more sand, more weight
      ];
      const grains = 4 + 3 * u; // the grains: more sand, more of them
      for (let i = 0; i < grains; i++) {
        out.push(noise('bandpass', 6500 - 1500 * jitter(i + 7), 4000, (dur * 0.85 * (i + jitter(i))) / grains, 0.022, 0.04 + 0.03 * jitter(i + 3), 1.6, 0.002));
      }
      return out;
    },
  },
  land: {
    capDb: -14,
    voices: ({ pitch = 0 }) => {
      const f = note(3 + clampInt(pitch, 0, 99, 0));
      return [tone(f, 0, 0.12, 0.11), tone(f * 2, 0, 0.06, 0.025, 'triangle'), noise('lowpass', 500, 180, 0, 0.07, 0.06, 0.7, 0.003)];
    },
  },
  seal: {
    capDb: -8,
    voices: () => [
      noise('highpass', 1400, 1400, 0, 0.035, 0.12, 0.7, 0.002), // the cork
      tone(560, 0, 0.08, 0.1, 'sine', { endFreq: 280 }),
      ...[5, 7, 9].flatMap((n, i) => bell(note(n), 0.07 + i * 0.08, 0.09, 0.75)), // the warm chime (D68)
    ],
  },
  win: {
    capDb: -6,
    voices: () => [
      ...[0, 2, 4].map((n) => tone(note(n), 0, 1.6, 0.035, 'sine', { attack: 0.35 })), // the bloom: a chord that swells in
      ...[0, 2, 4, 5, 7, 9].flatMap((n, i) => bell(note(n), i * 0.1, 0.075, 0.6)),
      tone(note(9) * 2, 0.66, 0.9, 0.035, 'sine', { attack: 0.02 }),
    ],
  },
  coin: { capDb: -18, voices: () => coinVoices() },
  booster: {
    capDb: -14,
    voices: () => [tone(note(3), 0, 0.09, 0.12, 'triangle'), tone(note(6), 0.07, 0.16, 0.12, 'triangle'), noise('bandpass', 1500, 4500, 0, 0.16, 0.04, 0.8, 0.06)],
  },
  shuffle: { capDb: -16, voices: () => Array.from({ length: 6 }, (_, i) => noise('bandpass', 2500 + 600 * i, 1800, i * 0.05, 0.09, 0.08, 1, 0.02)) },
  mapStone: {
    capDb: -18,
    voices: () => [tone(note(6), 0, 0.06, 0.08, 'sine', { endFreq: note(6) * 0.85 }), tone(note(8), 0, 0.14, 0.04, 'triangle'), noise('bandpass', 2400, 1600, 0, 0.03, 0.04, 1.2, 0.002)],
  },
  locked: { capDb: -18, voices: () => [tone(220, 0, 0.09, 0.1, 'sine', { endFreq: 175 }), noise('lowpass', 600, 300, 0, 0.05, 0.06, 0.7, 0.002)] },
  unlock: { capDb: -12, voices: () => [...bell(note(6), 0, 0.075, 0.5), ...bell(note(8), 0.09, 0.075, 0.6), tone(note(9) * 2, 0.18, 0.4, 0.02)] },
  shell: {
    capDb: -12,
    voices: () => [noise('bandpass', 1800, 700, 0, 0.45, 0.03, 0.7, 0.15), tone(note(7), 0, 0.2, 0.06, 'sine', { endFreq: note(9) }), ...bell(note(9), 0.12, 0.07, 0.55)],
  },
  sceneBought: { capDb: -12, voices: () => [...coinVoices(), ...[4, 6, 8].flatMap((n, i) => bell(note(n), 0.08 + i * 0.06, 0.055, 0.65))] },
  playHere: { capDb: -14, voices: () => [...bell(note(2), 0, 0.07, 0.35), ...bell(note(5), 0.1, 0.07, 0.45)] },
};

/** A vibration pattern in milliseconds (navigator.vibrate), or `null` for an explicit none. */
export type Haptic = number | number[] | null;

/**
 * Haptic patterns per event (F4, D64): short and soft. Seal is a double tap, win a triple
 * one, so the two feel distinct. Android only: iPhone browsers ignore navigator.vibrate.
 */
export const HAPTICS: Record<SoundEvent, Haptic> = {
  select: 6,
  deselect: null,
  nope: [10, 40, 10],
  pour: null, // the land that follows carries the touch
  land: 8,
  seal: [12, 40, 24],
  win: [16, 50, 16, 50, 36],
  coin: null, // the count-up plays it many times
  booster: 12,
  shuffle: [6, 30, 6, 30, 6],
  mapStone: 6,
  locked: [6, 30, 6],
  unlock: [10, 50, 10],
  shell: [8, 40, 16],
  sceneBought: [10, 40, 20],
  playHere: 10,
};

/** A voice's envelope level at `t` seconds: the same exponential ramps audio.ts schedules. */
export function envelopeAt(v: Voice, t: number): number {
  const floor = 0.0001;
  const s = t - v.at;
  if (s < 0 || s > v.dur) return 0;
  if (s < v.attack) return floor * (v.vol / floor) ** (s / v.attack);
  return v.vol * (floor / v.vol) ** ((s - v.attack) / (v.dur - v.attack));
}

/**
 * The worst-case peak of a set of voices: the highest sum of their envelopes, sampled every
 * millisecond, as if every voice peaked in phase. An upper bound for tones; noise is taken
 * at its full ±1 range before its filter. Linear, before the sfx bus and master.
 */
export function peakEstimate(voices: Voice[]): number {
  const end = Math.max(0, ...voices.map((v) => v.at + v.dur));
  let peak = 0;
  for (let t = 0; t <= end; t += 0.001) {
    let sum = 0;
    for (const v of voices) sum += envelopeAt(v, t);
    peak = Math.max(peak, sum);
  }
  for (const v of voices) peak = Math.max(peak, envelopeAt(v, v.at + v.attack)); // the exact attack tops
  return peak;
}

/** A linear level in dBFS (`-Infinity` for 0). */
export const toDb = (linear: number): number => 20 * Math.log10(linear);
