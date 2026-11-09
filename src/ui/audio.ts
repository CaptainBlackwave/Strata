/**
 * Strata's audio event system (.claude/rules/ui-code.md: UI sounds go through events).
 * Everything is synthesised with WebAudio: no audio files, nothing sampled from another game.
 * Implements design/competitive-roadmap.md item C1 (game feel: sound, music, haptics).
 *
 * Example: `audio.play('pour', { units: 2 })` after `audio.unlock()` inside a tap handler.
 */
import { SceneMusic } from './music';

/** Every sound the game can make. */
export type SoundEvent = 'select' | 'deselect' | 'nope' | 'pour' | 'land' | 'seal' | 'win' | 'coin' | 'booster' | 'shuffle';

/** Haptic patterns per event, in milliseconds (navigator.vibrate). */
const HAPTICS: Partial<Record<SoundEvent, number | number[]>> = {
  select: 8,
  nope: [12, 40, 12],
  land: 10,
  seal: [18, 30, 28],
  win: [30, 50, 30, 50, 60],
  booster: 14,
};

/** Pentatonic scale (C major pentatonic, 2 octaves) used by chimes and music. */
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

/** The player's audio and haptics toggles, as passed to the audio engine (from the saved settings). */
export interface AudioOptions {
  sound: boolean;
  music: boolean;
  haptics: boolean;
}

/** Audio engine. Construct once, call `unlock()` on the first user gesture. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private music: SceneMusic | null = null;
  private scene = 'midday';
  private watchingVisibility = false;

  constructor(private options: AudioOptions) {}

  /** Applies new settings immediately (music starts or stops). */
  configure(options: AudioOptions): void {
    this.options = options;
    if (options.music) this.startMusic();
    else this.stopMusic();
  }

  /** Creates or resumes the AudioContext. Must be called from a user gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.0;
        this.musicBus.connect(this.master);
        this.noise = this.makeNoise(2);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.options.music) this.startMusic();
    } catch {
      this.ctx = null; // audio unavailable; the game stays silent
    }
  }

  /** Plays one event's sound and haptic. Safe to call before unlock (it does nothing). */
  play(event: SoundEvent, detail: { units?: number; pitch?: number } = {}): void {
    if (this.options.haptics) this.vibrate(HAPTICS[event]);
    if (!this.options.sound || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    switch (event) {
      case 'select':
        this.tone(SCALE[4 + (detail.pitch ?? 0) % 3], t, 0.07, 'triangle', 0.18);
        break;
      case 'deselect':
        this.tone(SCALE[2], t, 0.06, 'triangle', 0.12);
        break;
      case 'nope':
        this.tone(140, t, 0.12, 'sine', 0.3, 90);
        break;
      case 'pour':
        this.sandHiss(t, 0.28 + 0.12 * Math.min(4, detail.units ?? 1));
        break;
      case 'land':
        this.tone(SCALE[Math.min(SCALE.length - 1, 3 + (detail.pitch ?? 0))], t, 0.09, 'sine', 0.14);
        break;
      case 'seal':
        this.pop(t);
        [5, 7, 9].forEach((n, i) => this.tone(SCALE[n], t + 0.06 + i * 0.07, 0.25, 'triangle', 0.16));
        break;
      case 'win':
        [0, 2, 4, 5, 7, 9].forEach((n, i) => this.tone(SCALE[n], t + i * 0.09, 0.5, 'triangle', 0.2));
        this.tone(SCALE[9] * 2, t + 0.6, 0.8, 'sine', 0.08);
        break;
      case 'coin':
        this.tone(1318.5, t, 0.06, 'square', 0.05);
        this.tone(1975.5, t + 0.05, 0.12, 'square', 0.05);
        break;
      case 'booster':
        this.tone(SCALE[3], t, 0.08, 'triangle', 0.15);
        this.tone(SCALE[6], t + 0.07, 0.14, 'triangle', 0.15);
        break;
      case 'shuffle':
        for (let i = 0; i < 6; i++) this.sandHiss(t + i * 0.05, 0.08);
        break;
    }
  }

  private vibrate(pattern: number | number[] | undefined): void {
    if (pattern === undefined) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* not supported */
    }
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** A pitched blip with a fast attack and exponential decay. */
  private tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, endFreq?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  /** Falling sand: band-passed noise with a slow swell and a falling filter. */
  private sandHiss(at: number, dur: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(5200, at);
    bp.frequency.exponentialRampToValueAtTime(1800, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.22, at + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp).connect(g).connect(this.master!);
    src.start(at, Math.random());
    src.stop(at + dur + 0.05);
  }

  /** Cork pop: a short noise click plus a quick downward chirp. */
  private pop(at: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
    src.connect(hp).connect(g).connect(this.master!);
    src.start(at);
    src.stop(at + 0.05);
    this.tone(620, at, 0.09, 'sine', 0.25, 260);
  }

  /** Starts the scene music (music.ts, D65) into the music bus. It waits while the page is hidden. */
  private startMusic(): void {
    if (!this.ctx || !this.musicBus || !this.noise) return;
    this.watchVisibility();
    if (document.hidden) return;
    this.music ??= new SceneMusic(this.ctx, this.musicBus, this.noise);
    if (this.music.playing) return;
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(0.5, this.ctx.currentTime, 1.5);
    this.music.start(this.scene);
  }

  private stopMusic(): void {
    this.music?.stop();
    if (this.ctx && this.musicBus) this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }

  /** Music pauses while the page is hidden and resumes when it is shown, if the switch is on. */
  private watchVisibility(): void {
    if (this.watchingVisibility) return;
    this.watchingVisibility = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stopMusic();
      else if (this.options.music) this.startMusic();
    });
  }

  /** Follows the scene shown: the music crossfades to its variation (D65). Safe before unlock. */
  setScene(id: string): void {
    this.scene = id;
    this.music?.setScene(id);
  }
}
