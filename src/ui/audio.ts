/**
 * Strata's audio event system (.claude/rules/ui-code.md: UI sounds go through events).
 * Everything is synthesised with WebAudio: no audio files, nothing sampled from another game.
 * Implements design/competitive-roadmap.md item C1 (game feel: sound, music, haptics) and
 * sprint 10 F1/F3/F4 (D64, D66, D68): the sound recipes and haptics are data in src/ui/sfx.ts.
 *
 * Signal path: each sound effect → `sfxBus` (sound volume) → `master` → destination;
 * music → `musicBus` (the music's own fades) → `musicLevel` (music volume) → `master`.
 *
 * Example: `audio.play('pour', { units: 2 })` after `audio.unlock()` inside a tap handler.
 */
import { HAPTICS, MASTER_GAIN, SOUNDS, type Haptic, type SoundDetail, type SoundEvent, type Voice } from './sfx';

export type { SoundDetail, SoundEvent } from './sfx';

/** Pentatonic scale (C major pentatonic, 2 octaves) used by the music. */
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

/** The player's audio and haptics settings, as passed to the audio engine (from the saved settings). */
export interface AudioOptions {
  /** Sound effects on; off mutes them (the switch next to the slider). */
  sound: boolean;
  /** Music on; off mutes it. */
  music: boolean;
  haptics: boolean;
  /** Sound effects volume, 0..1 (clamped). */
  soundVolume: number;
  /** Music volume, 0..1 (clamped). */
  musicVolume: number;
}

/** What the engine needs from outside, injectable for tests and offline measurement. */
export interface AudioDeps {
  /**
   * Makes the context on the first unlock. Default: the browser's AudioContext. Tests pass a
   * fake; the loudness measurement passes an OfflineAudioContext. `null` means no audio.
   */
  createContext?: () => BaseAudioContext | null;
  /** Default: navigator.vibrate, if the browser has it. */
  vibrate?: (pattern: number | number[]) => void;
  /** Fills the noise buffer and picks its start offsets. Default: Math.random. */
  random?: () => number;
}

/** A volume clamped to 0..1; anything that isn't a finite number is silent. */
export function clampVolume(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

/** The browser's AudioContext, or null where there is none. */
function browserContext(): BaseAudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/** navigator.vibrate, guarded: unsupported browsers (every iPhone browser) do nothing. */
function browserVibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

/** Whether `ctx` renders offline (it has no resume before rendering starts). */
function isOffline(ctx: BaseAudioContext): boolean {
  return typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
}

/** Seconds a volume change takes to settle (a time constant), so dragging a slider doesn't click. */
const LEVEL_GLIDE = 0.015;

/** Audio engine. Construct once, call `unlock()` on the first user gesture. */
export class GameAudio {
  private ctx: BaseAudioContext | null = null;
  private master: GainNode | null = null;
  /** Every sound effect goes through this gain, set to the sound volume. */
  private sfxBus: GainNode | null = null;
  /** The music's own bus: the music code fades it in and out. */
  private musicBus: GainNode | null = null;
  /** Between musicBus and master, set to the music volume. */
  private musicLevel: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer = 0;
  private musicStep = 0;
  private waves: AudioBufferSourceNode | null = null;
  private readonly random: () => number;

  constructor(
    private options: AudioOptions,
    private readonly deps: AudioDeps = {},
  ) {
    this.random = deps.random ?? Math.random;
  }

  /** Applies new settings immediately: the volumes glide to their new levels, music starts or stops. */
  configure(options: AudioOptions): void {
    this.options = options;
    this.applyLevels();
    if (options.music) this.startMusic();
    else this.stopMusic();
  }

  /** Creates or resumes the AudioContext. Must be called from a user gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const ctx = (this.deps.createContext ?? browserContext)();
        if (!ctx) return;
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = MASTER_GAIN;
        this.master.connect(ctx.destination);
        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = clampVolume(this.options.soundVolume);
        this.sfxBus.connect(this.master);
        this.musicLevel = ctx.createGain();
        this.musicLevel.gain.value = clampVolume(this.options.musicVolume);
        this.musicLevel.connect(this.master);
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = 0.0;
        this.musicBus.connect(this.musicLevel);
        this.noise = this.makeNoise(2);
      }
      const live = this.ctx as AudioContext;
      if (live.state === 'suspended' && typeof live.resume === 'function' && !isOffline(this.ctx)) void live.resume();
      if (this.options.music) this.startMusic();
    } catch {
      this.ctx = null; // audio unavailable; the game stays silent
    }
  }

  /**
   * Plays one event's sound and haptic. Safe to call before unlock (it only vibrates).
   * Example: `audio.play('shell', { delay: 0.8 })` lets the win chime ring first.
   */
  play(event: SoundEvent, detail: SoundDetail = {}): void {
    if (this.options.haptics) this.vibrate(HAPTICS[event]);
    if (!this.options.sound || clampVolume(this.options.soundVolume) === 0 || !this.ctx || !this.sfxBus) return;
    const delay = Math.min(2, Math.max(0, detail.delay ?? 0));
    const t = this.ctx.currentTime + delay;
    for (const v of SOUNDS[event].voices(detail)) this.voice(v, t);
  }

  /** Glides the sfx bus and music level to the current volumes. */
  private applyLevels(): void {
    if (!this.ctx || !this.sfxBus || !this.musicLevel) return;
    const now = this.ctx.currentTime;
    for (const [node, v] of [
      [this.sfxBus, this.options.soundVolume],
      [this.musicLevel, this.options.musicVolume],
    ] as const) {
      node.gain.cancelScheduledValues(now);
      node.gain.setTargetAtTime(clampVolume(v), now, LEVEL_GLIDE);
    }
  }

  private vibrate(pattern: Haptic): void {
    if (pattern === null) return;
    (this.deps.vibrate ?? browserVibrate)(pattern);
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = this.random() * 2 - 1;
    return buf;
  }

  /** Schedules one voice of a recipe at `t0` plus its offset, into the sfx bus. */
  private voice(v: Voice, t0: number): void {
    const ctx = this.ctx!;
    const at = t0 + v.at;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(v.vol, at + v.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + v.dur);
    g.connect(this.sfxBus!);
    if (v.kind === 'tone') {
      const o = ctx.createOscillator();
      o.type = v.wave;
      o.frequency.setValueAtTime(v.freq, at);
      if (v.endFreq) o.frequency.exponentialRampToValueAtTime(v.endFreq, at + v.dur);
      o.connect(g);
      o.start(at);
      o.stop(at + v.dur + 0.02);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = v.filter;
    f.Q.value = v.q;
    f.frequency.setValueAtTime(v.from, at);
    if (v.to !== v.from) f.frequency.exponentialRampToValueAtTime(v.to, at + v.dur);
    src.connect(f).connect(g);
    src.start(at, this.random() * 1.5);
    src.stop(at + v.dur + 0.05);
  }

  /** Gentle generative music: soft pentatonic notes over a slow ocean swell. */
  private startMusic(): void {
    if (!this.ctx || !this.musicBus || this.musicTimer) return;
    const ctx = this.ctx;
    this.musicBus.gain.cancelScheduledValues(ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);
    // Ocean: looped low-passed noise with a slow LFO on the volume.
    const waves = ctx.createBufferSource();
    waves.buffer = this.noise;
    waves.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const swell = ctx.createGain();
    swell.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.04;
    lfo.connect(lfoDepth).connect(swell.gain);
    waves.connect(lp).connect(swell).connect(this.musicBus);
    waves.start();
    lfo.start();
    this.waves = waves;
    const pattern = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 7, 5, 4, 2, 4];
    const tick = () => {
      if (!this.ctx || !this.musicBus || !this.options.music) return;
      const t = this.ctx.currentTime + 0.05;
      const n = pattern[this.musicStep % pattern.length];
      if (this.musicStep % 4 !== 3) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = SCALE[n] / 2;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        o.connect(g).connect(this.musicBus);
        o.start(t);
        o.stop(t + 1.7);
      }
      this.musicStep++;
    };
    this.musicTimer = window.setInterval(tick, 620);
  }

  private stopMusic(): void {
    window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
    if (this.ctx && this.musicBus) this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    try {
      this.waves?.stop();
    } catch {
      /* already stopped */
    }
    this.waves = null;
  }
}
