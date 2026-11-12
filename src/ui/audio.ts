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
import { HAPTICS_CONFIG, MASTER_GAIN, SOUNDS, type Haptic, type SoundDetail, type SoundEvent, type Voice } from './sfx';
import { hapticFor } from './logic/haptics';
import { SceneMusic, type SceneVariation, eventMusicKey, musicFor } from './music';

export type { SoundDetail, SoundEvent } from './sfx';


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
  /** Whether the player asks for reduced motion; haptics stay off then (sprint 21 A4). Default: the media query. */
  reducedMotion?: () => boolean;
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

/** Whether the browser can vibrate at all (no iPhone browser can). */
export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** `prefers-reduced-motion: reduce`, false where there is no matchMedia (Node). */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  private readonly random: () => number;
  private music: SceneMusic | null = null;
  private scene = 'midday';
  /** A seasonal event whose music plays instead of the scene's while it runs (sprint 18 W1), or null. */
  private event: string | null = null;

  /** What the music plays: the running event's variation, else the scene's. */
  private musicKey(): string {
    return this.event ? eventMusicKey(this.event) : this.scene;
  }
  private watchingVisibility = false;

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

  /**
   * Creates or resumes the AudioContext. Must be called from a user gesture. With sound and music both
   * off it does nothing (sprint 22 L1, D181: building the context and its noise buffer cost a ~37 ms task
   * on the first tap at 4x throttle); the first unlock after the player turns either on builds it.
   */
  unlock(): void {
    if (!this.ctx && !this.options.sound && !this.options.music) return;
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
      this.resumeIfNeeded();
      if (this.options.music) this.startMusic();
    } catch {
      // Audio unavailable: the game stays silent. Drop everything tied to this context, so a later
      // unlock builds fresh nodes and a fresh music engine instead of keeping a dead one.
      this.music?.stop();
      this.music = null;
      this.ctx = null;
      this.master = this.sfxBus = this.musicBus = this.musicLevel = null;
    }
  }

  /**
   * Resumes the context unless it is running: "suspended" before a gesture, and "interrupted" on
   * iOS after the page was backgrounded or a call came in. An offline context is never resumed.
   */
  private resumeIfNeeded(): void {
    const live = this.ctx as AudioContext | null;
    if (!live || isOffline(live) || live.state === 'running' || typeof live.resume !== 'function') return;
    void live.resume().catch(() => undefined);
  }

  /**
   * Plays one event's sound and haptic. Safe to call before unlock (it only vibrates).
   * Example: `audio.play('shell', { delay: 0.8 })` lets the win chime ring first.
   */
  play(event: SoundEvent, detail: SoundDetail = {}): void {
    this.vibrate(
      hapticFor(event, HAPTICS_CONFIG, {
        enabled: this.options.haptics,
        reducedMotion: (this.deps.reducedMotion ?? prefersReducedMotion)(),
        supported: this.deps.vibrate !== undefined || canVibrate(),
      }),
    );
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

  /** Starts the scene music (music.ts, D65) into the music bus. It waits while the page is hidden. */
  private startMusic(): void {
    if (!this.ctx || !this.musicBus || !this.noise) return;
    this.watchVisibility();
    if (document.hidden) return;
    // A music slider at 0 is silent: schedule nothing (battery), and start again when it is raised.
    if (clampVolume(this.options.musicVolume) === 0) return this.stopMusic();
    this.music ??= new SceneMusic(this.ctx, this.musicBus, this.noise);
    if (this.music.playing) return;
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(0.5, this.ctx.currentTime, 1.5);
    this.music.start(this.musicKey());
  }

  private stopMusic(): void {
    this.music?.stop();
    if (this.ctx && this.musicBus) this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }

  /**
   * Music pauses while the page is hidden or the window has lost focus, and resumes when it is shown
   * and focused again, if the switch is on. Focus matters because an in-app browser (a link opened
   * inside another app) can leave the page "visible" in the background, so visibilitychange never
   * fires there; it still reports blur (P1 phone check, sprint 13).
   */
  private watchVisibility(): void {
    if (this.watchingVisibility) return;
    this.watchingVisibility = true;
    const pause = () => this.stopMusic();
    const resume = () => {
      if (document.hidden) return;
      this.resumeIfNeeded(); // iOS leaves the context "interrupted" after the page was hidden
      if (this.options.music) this.startMusic();
    };
    document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()));
    window.addEventListener('blur', pause);
    window.addEventListener('focus', resume);
    window.addEventListener('pagehide', pause);
    window.addEventListener('pageshow', resume);
  }

  /** Follows the scene shown: the music crossfades to its variation (D65). Safe before unlock. */
  setScene(id: string): void {
    this.scene = id;
    this.music?.setScene(this.musicKey());
  }

  /**
   * Plays an event's music variation instead of the scene's while it runs (`null` when none), with
   * the usual crossfade (sprint 18 W1, D151). The music switch and volume apply as always. Safe before unlock.
   */
  setEvent(id: string | null): void {
    if (id === this.event) return;
    this.event = id;
    this.music?.setScene(this.musicKey());
  }

  /** The key the music is in now (root and scale), for the win's final chord (sprint 18 F3). */
  musicVariation(): SceneVariation {
    return musicFor(this.musicKey());
  }
}
