/**
 * Scene music (sprint 10 F2, decision D65): one calm generative style, varied per scene.
 * Everything is synthesised with WebAudio from oscillators and the shared noise buffer: no
 * samples, and no melody from anywhere else. The notes are a seeded walk over each scene's
 * scale, in eight-step phrases with rests and cadences, so there is no loop to hear.
 *
 * DOM-free on purpose: it takes an injected `BaseAudioContext` (a real one in the game, an
 * `OfflineAudioContext` for the rendered sign-off clips, a fake one in the unit tests), the
 * node to play into (`GameAudio`'s `musicBus`) and timers.
 *
 * Example:
 * ```ts
 * const music = new SceneMusic(ctx, musicBus, noise);
 * music.start('midday');
 * music.setScene('softrain'); // an equal-power crossfade of CROSSFADE_SECONDS
 * music.stop();
 * ```
 *
 * Scheduling is the usual WebAudio look-ahead pattern: a coarse timer calls `pump()`, which
 * places every note due before `currentTime + LOOKAHEAD` at its exact sample time, so timer
 * jitter never reaches the rhythm. `pump(until)` is public so an offline render can schedule
 * a whole clip up front.
 */

/** Tempo bounds for every scene, in ms per step (D65). */
export const MIN_STEP_MS = 480;
export const MAX_STEP_MS = 900;
/** Length of the equal-power crossfade when the scene changes while music plays. */
export const CROSSFADE_SECONDS = 2;
/** Fade-in on start, and the fade on stop. */
const START_FADE = 2;
const STOP_FADE = 0.4;
/** How fast a third scene is cleared when the player flicks through previews. */
const QUICK_FADE = 0.12;
/** The scheduler: how often it wakes, and how far ahead it places notes. */
const TICK_MS = 100;
const LOOKAHEAD = 0.35;
/** Steps per phrase: notes, rests, a cadence on the second-last step and a breath on the last. */
const PHRASE_STEPS = 8;
/** Points in each fade curve. */
const CURVE_POINTS = 64;

/** One step of a phrase: a scale degree (0 is the root, `scale.length` is the octave), or a rest. */
export type Step = number | null;

/** An extra sound bed over the tune. */
export type Layer = 'rain' | 'sparkle' | 'thump' | 'streak';

/** How the lead voice sounds. */
export interface LeadTimbre {
  /** Oscillator wave of the lead. */
  type: OscillatorType;
  /** Low-pass cut-off in Hz, for a softer or darker lead. Not used with `partial` (node budget). */
  filter?: number;
  /** A second, quieter partial at this frequency ratio: makes the lead bell-like. */
  partial?: number;
  /** Amplitude of that partial against the fundamental (0..1). */
  partialLevel?: number;
}

/** One scene's variation of the music. */
export interface SceneVariation {
  /** Frequency in Hz of scale degree 0 for the lead. The pad plays an octave lower. */
  root: number;
  /** The scale: semitones above the root, ascending from 0, all below 12. */
  scale: readonly number[];
  /** Tempo in ms per step, between MIN_STEP_MS and MAX_STEP_MS. */
  stepMs: number;
  /** The lead voice. */
  lead: LeadTimbre;
  /** Peak gain of a lead note. Set by ear and by the loudness table (README in the F2 evidence). */
  vol: number;
  /** Average gain of the sea swell (low-passed noise with a slow rise and fall). */
  swell: number;
  /** An optional layer, with its gain. */
  layer?: Layer;
  layerLevel?: number;
}

const MAJOR_PENT = [0, 2, 4, 7, 9];
const MINOR_PENT = [0, 3, 5, 7, 10];
const MAJOR_HEX = [0, 2, 4, 7, 9, 11];
const MINOR_HEX = [0, 2, 3, 5, 7, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

/**
 * The per-scene table, keyed by scene id (`themes.list` in game-config.json). Presentation
 * values, so they live here rather than in the config (exempt from the data-driven rule, D31).
 *
 * | Scene | Key, scale | Step | Lead | Layer |
 * |---|---|---|---|---|
 * | midday | C4 major pentatonic | 620 ms | sine (the 0.9 music's key and tempo) | none |
 * | dawn | D4 major hexatonic | 680 ms | soft triangle | none |
 * | sunset | B♭3 major pentatonic | 720 ms | warm triangle | none |
 * | moonlit | A3 minor pentatonic | 860 ms | dark triangle | none: slower and darker |
 * | seafog | D4 dorian | 820 ms | muffled sine | a louder sea |
 * | wintersnow | E4 major pentatonic | 760 ms | sine | soft sparkle |
 * | harvestmoon | G3 minor hexatonic | 800 ms | warm triangle | none |
 * | newyear | C4 major hexatonic | 580 ms | bright triangle | an occasional low thump |
 * | highsummer | A3 major pentatonic | 520 ms | bright triangle | none |
 * | springblossom | F4 major pentatonic | 560 ms | sine | none |
 * | autumnshore | B3 minor hexatonic | 740 ms | warm triangle | none |
 * | rainbowafterrain | E♭4 major pentatonic | 600 ms | sine | soft sparkle |
 * | softrain | D4 minor pentatonic | 800 ms | soft sine | a rain hiss |
 * | winterlights | G4 major pentatonic | 680 ms | bell (sine + 2.76× partial) | none |
 * | meteorshower | C♯4 minor pentatonic | 780 ms | sine | an occasional falling streak |
 * | auroranight | A♭3 major hexatonic | 840 ms | sine | a high sparkle |
 * | lighthousenight | F3 minor pentatonic | 880 ms | dark triangle | none: slow, like the beam |
 *
 * An id not in the table (a scene added later) plays midday's variation (`musicFor`).
 */
export const MUSIC: Readonly<Record<string, SceneVariation>> = {
  midday: { root: 261.63, scale: MAJOR_PENT, stepMs: 620, lead: { type: 'sine' }, vol: 0.0841, swell: 0.0421 },
  dawn: { root: 293.66, scale: MAJOR_HEX, stepMs: 680, lead: { type: 'triangle', filter: 1600 }, vol: 0.09, swell: 0.045 },
  sunset: { root: 233.08, scale: MAJOR_PENT, stepMs: 720, lead: { type: 'triangle', filter: 1300 }, vol: 0.0918, swell: 0.0483 },
  moonlit: { root: 220.0, scale: MINOR_PENT, stepMs: 860, lead: { type: 'triangle', filter: 700 }, vol: 0.0879, swell: 0.044 },
  seafog: { root: 293.66, scale: DORIAN, stepMs: 820, lead: { type: 'sine', filter: 1200 }, vol: 0.0755, swell: 0.0596 },
  wintersnow: { root: 329.63, scale: MAJOR_PENT, stepMs: 760, lead: { type: 'sine' }, vol: 0.085, swell: 0.035, layer: 'sparkle', layerLevel: 0.012 },
  harvestmoon: { root: 196.0, scale: MINOR_HEX, stepMs: 800, lead: { type: 'triangle', filter: 1000 }, vol: 0.0947, swell: 0.043 },
  newyear: { root: 261.63, scale: MAJOR_HEX, stepMs: 580, lead: { type: 'triangle', filter: 2400 }, vol: 0.0871, swell: 0.0465, layer: 'thump', layerLevel: 0.2323 },
  highsummer: { root: 220.0, scale: MAJOR_PENT, stepMs: 520, lead: { type: 'triangle', filter: 2800 }, vol: 0.0891, swell: 0.0654 },
  springblossom: { root: 349.23, scale: MAJOR_PENT, stepMs: 560, lead: { type: 'sine' }, vol: 0.0828, swell: 0.0414 },
  autumnshore: { root: 246.94, scale: MINOR_HEX, stepMs: 740, lead: { type: 'triangle', filter: 1100 }, vol: 0.0902, swell: 0.0496 },
  rainbowafterrain: { root: 311.13, scale: MAJOR_PENT, stepMs: 600, lead: { type: 'sine' }, vol: 0.085, swell: 0.045, layer: 'sparkle', layerLevel: 0.012 },
  softrain: { root: 293.66, scale: MINOR_PENT, stepMs: 800, lead: { type: 'sine', filter: 1500 }, vol: 0.0723, swell: 0.0321, layer: 'rain', layerLevel: 0.0241 },
  winterlights: { root: 392.0, scale: MAJOR_PENT, stepMs: 680, lead: { type: 'sine', partial: 2.76, partialLevel: 0.28 }, vol: 0.0776, swell: 0.0388 },
  meteorshower: { root: 277.18, scale: MINOR_PENT, stepMs: 780, lead: { type: 'sine' }, vol: 0.0856, swell: 0.0406, layer: 'streak', layerLevel: 0.0162 },
  auroranight: { root: 207.65, scale: MAJOR_HEX, stepMs: 840, lead: { type: 'sine' }, vol: 0.0871, swell: 0.0392, layer: 'sparkle', layerLevel: 0.0139 },
  lighthousenight: { root: 174.61, scale: MINOR_PENT, stepMs: 880, lead: { type: 'triangle', filter: 800 }, vol: 0.0879, swell: 0.044 },
};

/** Scenes that knowingly use the fallback (midday). Empty: every scene has its own variation. */
export const FALLBACK_SCENES: readonly string[] = [];

/** The variation for a scene id; unknown ids get midday's. */
export function musicFor(sceneId: string): SceneVariation {
  return MUSIC[sceneId] ?? MUSIC.midday;
}

/** A small seeded random source (mulberry32): the same seed gives the same music. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Writes phrases: a random walk over the scale in small steps, with rests. Phrases come in
 * pairs: the first ends open (on the fifth, or the nearest degree), the answer ends home (on
 * the root or its octave) and often starts with the first one's opening notes. A phrase is
 * never the same as the one before it.
 */
export class PhraseWalker {
  /** The highest degree a phrase uses: an octave and a half above the root. */
  readonly top: number;
  /** Degrees a phrase may end on. */
  readonly cadenceNotes: readonly number[];
  private readonly n: number;
  private readonly open: number;
  private prev: Step[] | null = null;
  private count = 0;
  private last = 0;

  /** `scale` is the scale itself (to find its fifth) or just its number of notes. */
  constructor(private readonly rng: () => number, scale: number | readonly number[]) {
    const steps = typeof scale === 'number' ? null : scale;
    this.n = steps ? steps.length : (scale as number);
    this.top = this.n + Math.ceil(this.n / 2);
    if (steps) {
      let best = 0;
      steps.forEach((s, i) => (Math.abs(s - 7) < Math.abs(steps[best] - 7) ? (best = i) : 0));
      this.open = best;
    } else this.open = Math.floor(this.n * 0.6);
    this.cadenceNotes = [0, this.open, this.n];
  }

  /** The next phrase: PHRASE_STEPS steps, the last one always a rest. */
  next(): Step[] {
    const home = this.count % 2 === 1;
    let p = this.compose(home);
    for (let i = 0; i < 4 && this.same(p); i++) p = this.compose(home);
    if (this.same(p)) p = this.vary(p);
    this.prev = p;
    this.count++;
    this.last = [...p].reverse().find((s) => s !== null) ?? 0;
    return p;
  }

  private compose(home: boolean): Step[] {
    const len = PHRASE_STEPS;
    const p: Step[] = new Array<Step>(len).fill(null);
    // The answer often echoes the question's first notes (a motif), then goes its own way.
    const echo = home && this.prev !== null && this.rng() < 0.55 ? 3 : 0;
    let d = this.count === 0 ? [0, 2, this.n][Math.floor(this.rng() * 3)] : this.clamp(this.last + Math.round(this.rng() * 4 - 2));
    for (let i = 0; i < len - 2; i++) {
      if (i < echo) {
        p[i] = this.prev![i];
        if (p[i] !== null) d = p[i]!;
        continue;
      }
      if (i > 0 && p[i - 1] !== null && this.rng() < 0.2) continue; // a rest, never two in a row
      if (i > 0) d = this.walk(d);
      p[i] = d;
    }
    const target = home ? (Math.abs(d - this.n) < Math.abs(d) ? this.n : 0) : this.open;
    // Lead into the cadence by step when the walk ended far from it.
    if (p[len - 3] === null || Math.abs(p[len - 3]! - target) > 3) p[len - 3] = this.clamp(target + (d > target ? 1 : -1) * (1 + Math.floor(this.rng() * 2)));
    p[len - 2] = target;
    return p;
  }

  private walk(d: number): number {
    const r = this.rng();
    const move = r < 0.12 ? -2 : r < 0.38 ? -1 : r < 0.48 ? 0 : r < 0.74 ? 1 : r < 0.86 ? 2 : this.rng() < 0.5 ? -3 : 3;
    let next = d + move;
    if (next < 0) next = -next;
    if (next > this.top) next = 2 * this.top - next;
    return this.clamp(next);
  }

  private clamp(d: number): number {
    return Math.max(0, Math.min(this.top, d));
  }

  private same(p: Step[]): boolean {
    return this.prev !== null && p.every((s, i) => s === this.prev![i]);
  }

  /** Changes one inner note, so the phrase differs from the last one. */
  private vary(p: Step[]): Step[] {
    const q = [...p];
    const i = 1 + Math.floor(this.rng() * (q.length - 4));
    const d = q[i];
    q[i] = d === null ? q[i - 1] ?? 0 : d === this.top ? d - 1 : d + 1;
    return q;
  }
}

/** Timers, injectable for tests. */
export interface Timers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

/** Options for SceneMusic. */
export interface SceneMusicOptions {
  /** Random source for the walk and the layers (default Math.random). */
  rng?: () => number;
  /** Timer functions (default the global ones). */
  timers?: Timers;
}

const DEFAULT_TIMERS: Timers = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (id) => globalThis.clearInterval(id as number),
};

/** A level automation, so a fade can start from wherever the last one had got to. */
interface Fade {
  from: number;
  to: number;
  at: number;
  dur: number;
}

/** One scene's music while it sounds: its own bus (for crossfades), sea, layer and notes. */
interface Voice {
  v: SceneVariation;
  bus: GainNode;
  walker: PhraseWalker;
  phrase: Step[];
  pos: number;
  phraseCount: number;
  next: number;
  /** Notes are scheduled until this time; the voice is dropped once it passes. */
  end: number;
  fade: Fade;
  sinceLayer: number;
  /** Long-lived sources (sea, rain, the swell's LFO) and the nodes to disconnect with them. */
  beds: AudioScheduledSourceNode[];
  bedNodes: AudioNode[];
  /** Notes still able to sound, so a retired voice can cut them at the end of its fade. */
  notes: Set<AudioScheduledSourceNode>;
  wave: PeriodicWave | null;
}

/** Plays the scene music. See the file comment. */
export class SceneMusic {
  private readonly rng: () => number;
  private readonly timers: Timers;
  private voices: Voice[] = [];
  private timer: unknown = null;
  private current = 'midday';

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly output: AudioNode,
    private readonly noise: AudioBuffer,
    options: SceneMusicOptions = {},
  ) {
    this.rng = options.rng ?? Math.random;
    this.timers = options.timers ?? DEFAULT_TIMERS;
  }

  /** True between `start` and `stop`. */
  get playing(): boolean {
    return this.timer !== null;
  }

  /** The scene asked for last (playing or not). */
  get scene(): string {
    return this.current;
  }

  /** Scenes still sounding: 1 while steady, 2 during a crossfade. */
  get voiceCount(): number {
    return this.voices.length;
  }

  /** Starts the music for a scene, fading in. While already playing this is `setScene`. */
  start(sceneId: string): void {
    if (this.playing) {
      this.setScene(sceneId);
      return;
    }
    this.current = sceneId;
    const at = this.ctx.currentTime + 0.05;
    this.voices.push(this.voice(musicFor(sceneId), at, START_FADE));
    this.timer = this.timers.setInterval(() => this.pump(this.ctx.currentTime + LOOKAHEAD), TICK_MS);
    this.pump(this.ctx.currentTime + LOOKAHEAD);
  }

  /**
   * Changes scene. While playing, the old scene fades out as the new one fades in (equal power,
   * CROSSFADE_SECONDS); any older scene still fading is cleared at once. While stopped it only
   * remembers the scene for the next `start`.
   */
  setScene(sceneId: string): void {
    const same = musicFor(sceneId) === musicFor(this.current);
    this.current = sceneId;
    if (!this.playing || (same && this.voices.length > 0 && this.voices[this.voices.length - 1].end === Infinity)) return;
    const now = this.ctx.currentTime;
    const at = now + 0.05;
    for (const voice of this.voices) {
      if (voice.end === Infinity) this.fadeOut(voice, at, CROSSFADE_SECONDS);
      else if (voice.end > at + QUICK_FADE) this.fadeOut(voice, at, QUICK_FADE);
    }
    this.voices.push(this.voice(musicFor(sceneId), at, CROSSFADE_SECONDS));
  }

  /** Stops: fades everything out quickly, stops every source and the timer. */
  stop(): void {
    if (this.timer !== null) this.timers.clearInterval(this.timer);
    this.timer = null;
    const at = this.ctx.currentTime;
    for (const voice of this.voices) this.fadeOut(voice, at, STOP_FADE);
    this.voices = [];
  }

  /** Schedules every note due before context time `until`. The timer calls this; an offline render may too. */
  pump(until: number): void {
    if (!this.playing) return;
    for (const voice of this.voices) {
      const step = voice.v.stepMs / 1000;
      while (voice.next < until && voice.next < voice.end) {
        this.step(voice, voice.next, step);
        voice.next += step;
      }
    }
    const now = this.ctx.currentTime;
    this.voices = this.voices.filter((voice) => voice.end > now);
  }

  // ---- Voices -----------------------------------------------------------------------------------

  private voice(v: SceneVariation, at: number, fadeIn: number): Voice {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.connect(this.output);
    const voice: Voice = {
      v, bus, walker: new PhraseWalker(this.rng, v.scale), phrase: [], pos: 0, phraseCount: 0, next: at, end: Infinity,
      fade: { from: 0, to: 0, at, dur: 0 }, sinceLayer: 0, beds: [], bedNodes: [bus], notes: new Set(), wave: null,
    };
    this.applyFade(voice, 0, 1, at, fadeIn);
    if (v.lead.partial) voice.wave = this.partialWave(v.lead.partialLevel ?? 0.3);
    if (v.swell > 0) this.sea(voice, at);
    if (v.layer === 'rain') this.rain(voice, at);
    return voice;
  }

  /** Fades a voice out from its present level and cuts everything it owns when the fade ends. */
  private fadeOut(voice: Voice, at: number, dur: number): void {
    this.applyFade(voice, this.levelAt(voice, at), 0, at, dur);
    voice.end = at + dur;
    const cut = voice.end + 0.02;
    for (const src of [...voice.beds, ...voice.notes]) {
      try {
        src.stop(cut);
      } catch {
        /* already stopped */
      }
    }
  }

  /** The voice's fade level at time `t`, following the curve applyFade wrote. */
  private levelAt(voice: Voice, t: number): number {
    const f = voice.fade;
    if (f.dur <= 0 || t >= f.at + f.dur) return f.to;
    if (t <= f.at) return f.from;
    return this.curveValue(f, (t - f.at) / f.dur);
  }

  /** Equal power: a rise follows sin, a fall follows cos, scaled from the level the fade starts at. */
  private curveValue(f: Fade, x: number): number {
    return f.to > f.from ? f.from + (f.to - f.from) * Math.sin((x * Math.PI) / 2) : f.to + (f.from - f.to) * Math.cos((x * Math.PI) / 2);
  }

  private applyFade(voice: Voice, from: number, to: number, at: number, dur: number): void {
    const fade = { from, to, at, dur };
    voice.fade = fade;
    const curve = new Float32Array(CURVE_POINTS);
    for (let i = 0; i < CURVE_POINTS; i++) curve[i] = this.curveValue(fade, i / (CURVE_POINTS - 1));
    const g = voice.bus.gain;
    const now = this.ctx.currentTime;
    try {
      g.cancelScheduledValues(now);
      g.setValueAtTime(from, now);
      g.setValueCurveAtTime(curve, at, dur);
    } catch {
      g.cancelScheduledValues(now);
      g.setTargetAtTime(to, at, dur / 3); // a browser that rejects the curve still fades
    }
  }

  // ---- Beds (long-lived per voice) --------------------------------------------------------------

  /** Sea swell: two copies of the noise at different speeds (so the 2 s buffer never repeats), low-passed, slowly rising and falling. */
  private sea(voice: Voice, at: number): void {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const swell = ctx.createGain();
    swell.gain.value = voice.v.swell;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07 + this.rng() * 0.04;
    const depth = ctx.createGain();
    depth.gain.value = voice.v.swell * 0.8;
    lfo.connect(depth).connect(swell.gain);
    const beds: AudioScheduledSourceNode[] = [lfo];
    for (const rate of [1, 0.71]) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      src.playbackRate.value = rate;
      src.connect(lp);
      src.start(at, this.rng() * 1.5);
      beds.push(src);
    }
    lp.connect(swell).connect(voice.bus);
    lfo.start(at);
    this.addBeds(voice, beds, [lp, swell, depth]);
  }

  /** Rain: the noise, band-passed high and quiet, steady. */
  private rain(voice: Voice, at: number): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.87;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 0.35;
    const g = ctx.createGain();
    g.gain.value = voice.v.layerLevel ?? 0.03;
    src.connect(bp).connect(g).connect(voice.bus);
    src.start(at, this.rng());
    this.addBeds(voice, [src], [bp, g]);
  }

  /** Registers long-lived sources; when the first ends, every bed node and the voice bus are disconnected. */
  private addBeds(voice: Voice, sources: AudioScheduledSourceNode[], nodes: AudioNode[]): void {
    voice.bedNodes.push(...nodes, ...sources);
    if (voice.beds.length === 0) {
      sources[0].onended = () => {
        for (const n of voice.bedNodes) n.disconnect();
      };
    }
    voice.beds.push(...sources);
  }

  // ---- Notes (at most 3 nodes each; disconnected when they end) ---------------------------------

  private step(voice: Voice, t: number, step: number): void {
    if (voice.pos >= voice.phrase.length) {
      voice.phrase = voice.walker.next();
      voice.pos = 0;
      this.pad(voice, t, step);
      voice.phraseCount++;
    }
    const d = voice.phrase[voice.pos];
    if (d !== null) {
      const cadence = voice.pos === voice.phrase.length - 2;
      const accent = voice.pos === 0 ? 1 : voice.pos % 2 === 0 ? 0.85 : 0.72;
      const vel = accent * (0.88 + this.rng() * 0.2);
      const humanise = (this.rng() - 0.5) * 0.016;
      this.lead(voice, this.hz(voice.v, d), t + Math.max(0, humanise), step * (cadence ? 3.4 : 2.4), voice.v.vol * vel);
    }
    this.layerStep(voice, t, step);
    voice.pos++;
  }

  /** Frequency of a scale degree; degrees past the scale continue into the next octave. */
  private hz(v: SceneVariation, d: number): number {
    const n = v.scale.length;
    return v.root * 2 ** ((Math.floor(d / n) * 12 + v.scale[d % n]) / 12);
  }

  private lead(voice: Voice, f: number, at: number, dur: number, vol: number): void {
    const ctx = this.ctx;
    const lead = voice.v.lead;
    const o = ctx.createOscillator();
    o.type = lead.type;
    o.frequency.value = f;
    const g = ctx.createGain();
    const nodes: AudioNode[] = [o, g];
    const sources: AudioScheduledSourceNode[] = [o];
    let into: AudioNode = g;
    if (voice.wave) {
      const p = ctx.createOscillator(); // the bell partial, quieter via its wave's amplitude
      p.setPeriodicWave(voice.wave);
      p.frequency.value = f * lead.partial!;
      p.connect(g);
      p.start(at);
      p.stop(at + dur + 0.02);
      nodes.push(p);
      sources.push(p);
    } else if (lead.filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lead.filter;
      lp.Q.value = 0.5;
      o.connect(lp);
      into = lp;
      nodes.push(lp);
    }
    if (into !== g) into.connect(g);
    else o.connect(g);
    this.envelope(g.gain, at, dur, vol, lead.type === 'sine' ? 0.012 : 0.025);
    g.connect(voice.bus);
    o.start(at);
    o.stop(at + dur + 0.02);
    this.track(voice, sources, nodes);
  }

  /** A soft low note under each phrase: the root, or (under a question) a neighbouring chord tone. */
  private pad(voice: Voice, at: number, step: number): void {
    const v = voice.v;
    const n = v.scale.length;
    const degree = voice.phraseCount % 2 === 0 ? 0 : [0, Math.floor(n * 0.6), n - 2][Math.floor(this.rng() * 3)];
    const dur = step * PHRASE_STEPS + 0.6;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = this.hz(v, degree) / 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(v.vol * 0.32, at + Math.min(1.2, dur / 3));
    g.gain.setTargetAtTime(0.0001, at + dur - 1.4, 0.35);
    o.connect(g).connect(voice.bus);
    o.start(at);
    o.stop(at + dur);
    this.track(voice, [o], [o, g]);
  }

  private layerStep(voice: Voice, t: number, step: number): void {
    const v = voice.v;
    const level = v.layerLevel ?? 0;
    voice.sinceLayer++;
    if (v.layer === 'sparkle' && this.rng() < 0.2) {
      const d = v.scale.length + Math.floor(this.rng() * Math.ceil(v.scale.length / 2 + 1));
      this.ping(voice, this.hz(v, d) * 4, t + step / 2, 0.9, level, 'sine');
    } else if (v.layer === 'thump' && voice.sinceLayer > 10 && this.rng() < 0.12) {
      voice.sinceLayer = 0;
      this.ping(voice, 74, t, 0.7, level, 'sine', 38);
    } else if (v.layer === 'streak' && voice.sinceLayer > 6 && this.rng() < 0.08) {
      voice.sinceLayer = 0;
      const f = this.hz(v, v.scale.length * 2) * 2;
      this.ping(voice, f, t + step / 3, 1.1, level, 'sine', f / 2, 0.25);
    }
  }

  /** A short layer note: an oscillator and a gain, with an optional glide. */
  private ping(voice: Voice, f: number, at: number, dur: number, vol: number, type: OscillatorType, endF?: number, attack = 0.01): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    if (endF) o.frequency.exponentialRampToValueAtTime(endF, at + dur * 0.8);
    const g = ctx.createGain();
    this.envelope(g.gain, at, dur, vol, attack);
    o.connect(g).connect(voice.bus);
    o.start(at);
    o.stop(at + dur + 0.02);
    this.track(voice, [o], [o, g]);
  }

  private envelope(p: AudioParam, at: number, dur: number, vol: number, attack: number): void {
    p.setValueAtTime(0.0001, at);
    p.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + attack);
    p.exponentialRampToValueAtTime(0.0001, at + dur);
  }

  /**
   * Remembers a note's sources (all stopping together) until they end, so a retired voice can
   * cut them; when the first one ends, every node of the note is disconnected.
   */
  private track(voice: Voice, sources: AudioScheduledSourceNode[], nodes: AudioNode[]): void {
    for (const src of sources) voice.notes.add(src);
    sources[0].onended = () => {
      for (const src of sources) voice.notes.delete(src);
      for (const n of nodes) n.disconnect();
    };
  }

  /** A sine with a set amplitude (normalisation off), for the bell partial. */
  private partialWave(level: number): PeriodicWave {
    return this.ctx.createPeriodicWave(new Float32Array([0, 0]), new Float32Array([0, level]), { disableNormalization: true });
  }
}
