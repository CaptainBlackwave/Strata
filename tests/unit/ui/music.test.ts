// Story: production/sprints/sprint-10.md F2 (D65): music that varies by scene, with crossfades.
import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../../../src/config/game-config.json';
import {
  CROSSFADE_SECONDS,
  FALLBACK_SCENES,
  MAX_STEP_MS,
  MIN_STEP_MS,
  MUSIC,
  PhraseWalker,
  SceneMusic,
  type Step,
  type Timers,
  musicFor,
  seededRng,
} from '../../../src/ui/music';

const SCENE_IDS: string[] = config.themes.list.map((t: { id: string }) => t.id);

// ---- A fake WebAudio graph, just enough for SceneMusic ------------------------------------------

type ParamEvent = { kind: string; value?: number; curve?: number[]; at: number; duration?: number };

class FakeParam {
  value = 0;
  events: ParamEvent[] = [];
  setValueAtTime(value: number, at: number) { this.events.push({ kind: 'set', value, at }); return this; }
  linearRampToValueAtTime(value: number, at: number) { this.events.push({ kind: 'linear', value, at }); return this; }
  exponentialRampToValueAtTime(value: number, at: number) { this.events.push({ kind: 'exp', value, at }); return this; }
  setTargetAtTime(value: number, at: number) { this.events.push({ kind: 'target', value, at }); return this; }
  setValueCurveAtTime(curve: Float32Array | number[], at: number, duration: number) {
    this.events.push({ kind: 'curve', curve: Array.from(curve), at, duration });
    return this;
  }
  cancelScheduledValues(at: number) { this.events.push({ kind: 'cancel', at }); return this; }
  cancelAndHoldAtTime(at: number) { this.events.push({ kind: 'hold', at }); return this; }
}

class FakeNode {
  out: FakeNode[] = [];
  disconnected = false;
  constructor(public kind: string, public born: number) {}
  connect<T>(target: T): T {
    this.out.push(target as unknown as FakeNode);
    return target;
  }
  disconnect() {
    this.disconnected = true;
    this.out = [];
  }
}

class FakeSource extends FakeNode {
  type = 'sine';
  buffer: unknown = null;
  loop = false;
  frequency = new FakeParam();
  detune = new FakeParam();
  playbackRate = new FakeParam();
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  ended = false;
  onended: (() => void) | null = null;
  setPeriodicWave(wave: unknown) { this.buffer = wave; }
  start(at = 0) { this.startedAt = at; }
  stop(at = 0) { this.stoppedAt = at; }
}

class FakeContext {
  currentTime = 0;
  sampleRate = 48000;
  nodes: FakeNode[] = [];
  destination = new FakeNode('destination', 0);
  private add<T extends FakeNode>(n: T): T { this.nodes.push(n); return n; }
  createGain() { return this.add(Object.assign(new FakeNode('gain', this.currentTime), { gain: new FakeParam() })); }
  createBiquadFilter() {
    return this.add(Object.assign(new FakeNode('filter', this.currentTime), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam(), gain: new FakeParam() }));
  }
  createOscillator() { return this.add(new FakeSource('osc', this.currentTime)); }
  createBufferSource() { return this.add(new FakeSource('buffer', this.currentTime)); }
  createPeriodicWave() { return {}; }
  /** Moves the clock, firing `onended` for every source whose stop time has passed (like the real graph). */
  advance(to: number) {
    this.currentTime = to;
    for (const n of this.nodes) {
      if (n instanceof FakeSource && n.stoppedAt !== null && n.stoppedAt <= to && !n.ended) {
        n.ended = true;
        n.onended?.();
      }
    }
  }
  sources() { return this.nodes.filter((n): n is FakeSource => n instanceof FakeSource); }
  gains() { return this.nodes.filter((n) => n.kind === 'gain') as (FakeNode & { gain: FakeParam })[]; }
}

/** Timers that never fire on their own; the test calls `fire()`. Tracks what is still running. */
function fakeTimers() {
  const live = new Map<number, () => void>();
  let next = 1;
  const timers: Timers = {
    setInterval: (fn) => { live.set(next, fn); return next++; },
    clearInterval: (id) => { live.delete(id as number); },
  };
  return { timers, live, fire: () => [...live.values()].forEach((fn) => fn()) };
}

function rig(seed = 7) {
  const ctx = new FakeContext();
  const bus = ctx.createGain();
  const t = fakeTimers();
  const music = new SceneMusic(ctx as unknown as BaseAudioContext, bus as unknown as AudioNode, {} as AudioBuffer, {
    rng: seededRng(seed),
    timers: t.timers,
  });
  return { ctx, bus, music, ...t };
}

/** Runs the scheduler the way the timer would, in small steps, up to `seconds`. */
function play(r: ReturnType<typeof rig>, seconds: number) {
  const end = r.ctx.currentTime + seconds;
  while (r.ctx.currentTime < end) {
    r.ctx.advance(Math.min(end, r.ctx.currentTime + 0.1));
    r.fire();
  }
}

afterEach(() => {
  vi.useRealTimers();
});

// ---- The table ----------------------------------------------------------------------------------

describe('scene music table (D65)', () => {
  it('gives every scene in the config its own entry, or lists it as knowingly using the fallback', () => {
    for (const id of SCENE_IDS) expect(id in MUSIC || FALLBACK_SCENES.includes(id), `${id} has no music entry`).toBe(true);
  });

  it('has no entry for a scene that no longer exists, and no fallback scene that also has an entry', () => {
    for (const id of Object.keys(MUSIC)) expect(SCENE_IDS, `${id} is not a scene`).toContain(id);
    for (const id of FALLBACK_SCENES) expect(MUSIC[id]).toBeUndefined();
  });

  it('falls back to midday for an unknown scene', () => {
    expect(musicFor('no-such-scene')).toBe(MUSIC.midday);
    expect(musicFor('moonlit')).toBe(MUSIC.moonlit);
  });

  it('keeps every tempo between 480 and 900 ms per step, and every scale ascending from the root', () => {
    expect([MIN_STEP_MS, MAX_STEP_MS]).toEqual([480, 900]);
    for (const [id, v] of Object.entries(MUSIC)) {
      expect(v.stepMs, id).toBeGreaterThanOrEqual(MIN_STEP_MS);
      expect(v.stepMs, id).toBeLessThanOrEqual(MAX_STEP_MS);
      expect(v.scale[0], id).toBe(0);
      expect(v.scale.every((s, i) => i === 0 || s > v.scale[i - 1]), id).toBe(true);
      expect(v.scale[v.scale.length - 1], id).toBeLessThan(12);
    }
  });

  it('gives the scenes the design names their layer or tone', () => {
    expect(MUSIC.softrain.layer).toBe('rain');
    expect(MUSIC.auroranight.layer).toBe('sparkle');
    expect(MUSIC.winterlights.lead.partial).toBeGreaterThan(1); // the bell-like lead
    expect(MUSIC.newyear.layer).toBe('thump');
    expect(MUSIC.moonlit.stepMs).toBeGreaterThan(MUSIC.midday.stepMs); // slower
    expect(MUSIC.moonlit.lead.filter ?? Infinity).toBeLessThan(MUSIC.midday.lead.filter ?? Infinity); // darker
  });
});

// ---- Phrases ------------------------------------------------------------------------------------

describe('PhraseWalker', () => {
  const phrases = (seed: number, scaleLength: number, count: number): Step[][] => {
    const w = new PhraseWalker(seededRng(seed), scaleLength);
    return Array.from({ length: count }, () => w.next());
  };

  it('is deterministic for a seed', () => {
    expect(phrases(42, 5, 50)).toEqual(phrases(42, 5, 50));
    expect(phrases(42, 5, 20)).not.toEqual(phrases(43, 5, 20));
  });

  it('never plays the same whole phrase twice in a row', () => {
    for (const seed of [1, 2, 3, 99, 2026]) {
      for (const len of [5, 6, 7]) {
        const list = phrases(seed, len, 400);
        for (let i = 1; i < list.length; i++) expect(list[i], `seed ${seed}, scale ${len}, phrase ${i}`).not.toEqual(list[i - 1]);
      }
    }
  });

  it('breathes: every phrase has a rest, stays in range and lands on a cadence note', () => {
    for (const len of [5, 6, 7]) {
      const w = new PhraseWalker(seededRng(5), len);
      for (let i = 0; i < 100; i++) {
        const p = w.next();
        expect(p.some((s) => s === null)).toBe(true);
        for (const s of p) if (s !== null) expect(s >= 0 && s <= w.top).toBe(true);
        const last = [...p].reverse().find((s) => s !== null)!;
        expect(w.cadenceNotes).toContain(last);
      }
    }
  });

  it('varies over two minutes: no fixed loop of phrases', () => {
    const list = phrases(11, 5, 32).map((p) => p.join(','));
    expect(new Set(list).size).toBeGreaterThan(24);
  });
});

// ---- SceneMusic ---------------------------------------------------------------------------------

describe('SceneMusic', () => {
  it('plays notes into the output once started, and nothing before', () => {
    const r = rig();
    play(r, 2);
    expect(r.ctx.nodes.length).toBe(1); // only the bus the test made
    r.music.start('midday');
    play(r, 6);
    expect(r.music.playing).toBe(true);
    expect(r.music.scene).toBe('midday');
    expect(r.ctx.sources().filter((s) => s.kind === 'osc' && s.startedAt !== null).length).toBeGreaterThan(5);
  });

  it('schedules an equal-power crossfade of about 2 s when the scene changes while playing', () => {
    const r = rig();
    r.music.start('midday');
    play(r, 5);
    const before = r.ctx.gains().length;
    r.music.setScene('softrain');
    expect(r.music.scene).toBe('softrain');
    const curves = r.ctx.gains().flatMap((g) => g.gain.events.filter((e) => e.kind === 'curve' && e.at >= 5));
    expect(curves.length).toBe(2);
    for (const c of curves) expect(c.duration).toBeCloseTo(CROSSFADE_SECONDS, 5);
    expect(CROSSFADE_SECONDS).toBeGreaterThanOrEqual(1.5);
    expect(CROSSFADE_SECONDS).toBeLessThanOrEqual(2.5);
    const [a, b] = curves.map((c) => c.curve!);
    const rising = a[0] < a[a.length - 1] ? a : b;
    const falling = rising === a ? b : a;
    expect(rising[0]).toBeCloseTo(0, 3);
    expect(falling[falling.length - 1]).toBeCloseTo(0, 3);
    for (let i = 0; i < rising.length; i++) expect(rising[i] ** 2 + falling[i] ** 2).toBeCloseTo(1, 3);
    expect(r.ctx.gains().length).toBeGreaterThan(before);
  });

  it('retires the old scene after the crossfade: its sources stop and every node is disconnected', () => {
    const r = rig();
    r.music.start('midday');
    play(r, 4);
    r.music.setScene('auroranight');
    play(r, CROSSFADE_SECONDS + 2);
    expect(r.music.voiceCount).toBe(1);
    const old = r.ctx.nodes.filter((n) => n.born < 4);
    const oldSources = old.filter((n): n is FakeSource => n instanceof FakeSource);
    expect(oldSources.every((s) => s.stoppedAt !== null && s.stoppedAt <= 4 + CROSSFADE_SECONDS + 0.5)).toBe(true);
    expect(old.filter((n) => n !== r.bus).every((n) => n.disconnected)).toBe(true);
  });

  it('does nothing when asked for the scene already playing, and only remembers a scene while stopped', () => {
    const r = rig();
    r.music.setScene('dawn');
    expect(r.ctx.nodes.length).toBe(1);
    r.music.start('dawn');
    play(r, 3);
    const n = r.ctx.gains().length;
    const curvesBefore = r.ctx.gains().flatMap((g) => g.gain.events.filter((e) => e.kind === 'curve')).length;
    r.music.setScene('dawn');
    expect(r.ctx.gains().flatMap((g) => g.gain.events.filter((e) => e.kind === 'curve')).length).toBe(curvesBefore);
    expect(r.ctx.gains().length).toBe(n);
  });

  it('keeps at most two scenes sounding when the player flicks through previews', () => {
    const r = rig();
    r.music.start('midday');
    play(r, 3);
    for (const id of ['dawn', 'sunset', 'moonlit', 'seafog', 'wintersnow']) {
      r.music.setScene(id);
      play(r, 0.2);
    }
    expect(r.music.voiceCount).toBeLessThanOrEqual(2);
    play(r, CROSSFADE_SECONDS + 1);
    expect(r.music.voiceCount).toBe(1);
    expect(r.music.scene).toBe('wintersnow');
  });

  it('stop() leaves no running timers and stops every source', () => {
    const r = rig();
    r.music.start('newyear');
    play(r, 3);
    r.music.setScene('softrain');
    play(r, 0.5);
    expect(r.live.size).toBe(1);
    r.music.stop();
    expect(r.live.size).toBe(0);
    expect(r.music.playing).toBe(false);
    r.ctx.advance(r.ctx.currentTime + 2);
    expect(r.ctx.sources().every((s) => s.stoppedAt !== null)).toBe(true);
    expect(r.ctx.nodes.filter((n) => n !== r.bus).every((n) => n.disconnected)).toBe(true);
    const count = r.ctx.nodes.length;
    r.music.pump(r.ctx.currentTime + 10);
    expect(r.ctx.nodes.length).toBe(count); // nothing more is scheduled
  });

  it('stop() with the default timers leaves no timer running', () => {
    vi.useFakeTimers();
    const ctx = new FakeContext();
    const music = new SceneMusic(ctx as unknown as BaseAudioContext, ctx.createGain() as unknown as AudioNode, {} as AudioBuffer, { rng: seededRng(1) });
    music.start('midday');
    expect(vi.getTimerCount()).toBe(1);
    music.start('midday'); // a second start does not add a timer
    expect(vi.getTimerCount()).toBe(1);
    music.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses no more than 3 nodes per note in every scene', () => {
    for (const id of SCENE_IDS) {
      const r = rig(3);
      r.music.start(id);
      play(r, 0.05);
      const setup = r.ctx.nodes.length; // the scene's long-lived nodes (sea swell, layer)
      play(r, 60);
      const notes = r.ctx.sources().filter((s) => s.born > 0.05 && s.onended).length;
      expect(notes, id).toBeGreaterThan(20);
      expect((r.ctx.nodes.length - setup) / notes, id).toBeLessThanOrEqual(3);
      r.music.stop();
    }
  });

  it('restarts cleanly after a stop, in the scene last asked for', () => {
    const r = rig();
    r.music.start('midday');
    play(r, 2);
    r.music.stop();
    r.music.setScene('moonlit');
    play(r, 1);
    r.music.start(r.music.scene);
    expect(r.music.scene).toBe('moonlit');
    expect(r.live.size).toBe(1);
    play(r, 3);
    expect(r.music.voiceCount).toBe(1);
  });
});

// Sprint 18 W1 (D151): Winter Tide's own variation, used while the event runs.
import { EVENT_MUSIC, eventMusicKey } from '../../../src/ui/music';
describe('event music (W1)', () => {
  it('Winter Tide has a brighter bell lead and slower steps than midday, within the tempo range', () => {
    const w = musicFor(eventMusicKey('wintertide'));
    expect(w).toBe(EVENT_MUSIC.wintertide);
    expect(w.lead.partial).toBeGreaterThan(1);
    expect(w.stepMs).toBeGreaterThan(MUSIC.midday.stepMs);
    expect(w.stepMs).toBeLessThanOrEqual(MAX_STEP_MS);
  });
  it('an unknown event falls back to midday', () => {
    expect(musicFor(eventMusicKey('nope'))).toBe(MUSIC.midday);
  });
});
