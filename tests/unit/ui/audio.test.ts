// Story: production/sprints/sprint-10.md F1 and F3 (D64, D66): the audio engine's buses and volume contract.
// A small fake AudioContext records every node and gain, so this runs in Node.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AudioOptions, GameAudio, clampVolume } from '../../../src/ui/audio';
import { HAPTICS, MASTER_GAIN, SOUNDS } from '../../../src/ui/sfx';

class FakeParam {
  value = 0;
  target: number | null = null;
  calls: string[] = [];
  setValueAtTime(v: number, t: number) {
    this.calls.push(`set ${v} @${t}`);
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.calls.push(`exp ${v} @${t}`);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(`lin ${v} @${t}`);
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    this.calls.push(`target ${v} @${t}`);
    this.target = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  out: FakeNode[] = [];
  starts: number[] = [];
  constructor(
    public kind: string,
    public ctx: FakeContext,
  ) {
    ctx.nodes.push(this);
  }
  connect<T>(n: T): T {
    this.out.push(n as unknown as FakeNode);
    return n;
  }
  disconnect() {}
  start(t = 0) {
    this.starts.push(t);
  }
  stop() {}
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  playbackRate = new FakeParam();
  type = '';
  buffer: unknown = null;
  loop = false;
}

class FakeContext {
  nodes: FakeNode[] = [];
  currentTime = 1;
  sampleRate = 800;
  state = 'running';
  destination = new FakeNode('destination', this);
  createGain() {
    return new FakeNode('gain', this);
  }
  createOscillator() {
    return new FakeNode('osc', this);
  }
  createBiquadFilter() {
    return new FakeNode('biquad', this);
  }
  createBufferSource() {
    return new FakeNode('source', this);
  }
  createBuffer(_ch: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
}

const OPTS: AudioOptions = { sound: true, music: false, haptics: true, soundVolume: 0.6, musicVolume: 0.3 };

function setup(opts: Partial<AudioOptions> = {}) {
  const ctx = new FakeContext();
  const buzz: (number | number[])[] = [];
  const audio = new GameAudio({ ...OPTS, ...opts }, { createContext: () => ctx as unknown as BaseAudioContext, vibrate: (p) => void buzz.push(p), random: () => 0.5 });
  return { ctx, audio, buzz };
}

/** The gains wired straight into the destination (master), and into master (the buses). */
function buses(ctx: FakeContext) {
  const master = ctx.nodes.find((n) => n.kind === 'gain' && n.out.includes(ctx.destination))!;
  const intoMaster = ctx.nodes.filter((n) => n.kind === 'gain' && n.out.includes(master));
  return { master, intoMaster };
}

beforeEach(() => {
  vi.stubGlobal('window', { setInterval: () => 1, clearInterval: () => undefined, addEventListener: () => undefined }); // the music timer and focus events
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clampVolume', () => {
  it('clamps to 0..1 and treats a non-number as silent', () => {
    expect(clampVolume(0.4)).toBe(0.4);
    expect(clampVolume(1.5)).toBe(1);
    expect(clampVolume(-2)).toBe(0);
    expect(clampVolume(Number.NaN)).toBe(0);
  });
});

describe('GameAudio buses (D66)', () => {
  it('unlock builds master, then an sfx bus at the sound volume and a music level at the music volume', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    const { master, intoMaster } = buses(ctx);
    expect(master.gain.value).toBe(MASTER_GAIN);
    expect(intoMaster.map((n) => n.gain.value).sort()).toEqual([0.3, 0.6]);
    const musicLevel = intoMaster.find((n) => n.gain.value === 0.3)!;
    const musicBus = ctx.nodes.find((n) => n.kind === 'gain' && n.out.includes(musicLevel));
    expect(musicBus, 'musicBus feeds musicLevel').toBeDefined();
  });
  it('clamps the starting volumes', () => {
    const { ctx, audio } = setup({ soundVolume: 4, musicVolume: -1 });
    audio.unlock();
    expect(buses(ctx).intoMaster.map((n) => n.gain.value).sort()).toEqual([0, 1]);
  });
  it('configure applies new volumes to the two gains, clamped', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    const [a, b] = buses(ctx).intoMaster;
    const sfx = a.gain.value === 0.6 ? a : b;
    const music = sfx === a ? b : a;
    audio.configure({ ...OPTS, soundVolume: 0.25, musicVolume: 1.4 });
    expect(sfx.gain.target).toBe(0.25);
    expect(music.gain.target).toBe(1);
  });
  it('configure before unlock is safe and the next unlock uses the new volumes', () => {
    const { ctx, audio } = setup();
    audio.configure({ ...OPTS, soundVolume: 0.1, musicVolume: 0.9 });
    audio.unlock();
    expect(buses(ctx).intoMaster.map((n) => n.gain.value).sort()).toEqual([0.1, 0.9]);
  });
  it('a missing context factory result leaves the game silent', () => {
    const audio = new GameAudio(OPTS, { createContext: () => null, vibrate: () => undefined });
    expect(() => {
      audio.unlock();
      audio.play('win');
    }).not.toThrow();
  });
});

describe('GameAudio.play (F1)', () => {
  it('routes every voice of every event into the sfx bus, never straight to master', () => {
    for (const e of Object.keys(SOUNDS) as (keyof typeof SOUNDS)[]) {
      const { ctx, audio } = setup();
      audio.unlock();
      const { master, intoMaster } = buses(ctx);
      const sfx = intoMaster.find((n) => n.gain.value === 0.6)!;
      const before = ctx.nodes.length;
      audio.play(e, { units: 3, pitch: 2 });
      const made = ctx.nodes.slice(before);
      const envelopes = made.filter((n) => n.kind === 'gain');
      expect(envelopes.length, e).toBe(SOUNDS[e].voices({ units: 3, pitch: 2 }).length);
      for (const g of envelopes) expect(g.out, e).toEqual([sfx]);
      expect(made.some((n) => n.out.includes(master)), e).toBe(false);
    }
  });
  it('starts voices at the context time plus their offset and the detail delay', () => {
    const { ctx, audio } = setup();
    audio.unlock();
    const before = ctx.nodes.length;
    audio.play('shell', { delay: 0.5 });
    const starts = ctx.nodes.slice(before).flatMap((n) => n.starts);
    const first = Math.min(...SOUNDS.shell.voices({}).map((v) => v.at));
    expect(Math.min(...starts)).toBeCloseTo(1 + 0.5 + first, 6);
  });
  it('sound off makes no nodes but still vibrates; haptics off does not vibrate', () => {
    const { ctx, audio, buzz } = setup({ sound: false });
    audio.unlock();
    const before = ctx.nodes.length;
    audio.play('seal');
    expect(ctx.nodes.length).toBe(before);
    expect(buzz).toEqual([HAPTICS.seal]);
    const quiet = setup({ haptics: false });
    quiet.audio.play('seal');
    expect(quiet.buzz).toEqual([]);
  });
  it('reduced motion keeps every haptic off, sound or not (sprint 21 A4)', () => {
    const ctx = new FakeContext();
    const buzz: (number | number[])[] = [];
    const audio = new GameAudio(OPTS, { createContext: () => ctx as unknown as BaseAudioContext, vibrate: (p) => void buzz.push(p), reducedMotion: () => true, random: () => 0.5 });
    audio.play('seal');
    audio.play('win');
    expect(buzz).toEqual([]);
  });
  it('an event whose haptic is none does not vibrate', () => {
    const { audio, buzz } = setup();
    audio.play('coin');
    expect(buzz).toEqual([]);
  });
  it('a sound volume of 0 makes no nodes', () => {
    const { ctx, audio } = setup({ soundVolume: 0 });
    audio.unlock();
    const before = ctx.nodes.length;
    audio.play('win');
    expect(ctx.nodes.length).toBe(before);
  });
  it('play before unlock is a no-op for sound', () => {
    const { ctx, audio } = setup();
    audio.play('pour', { units: 2 });
    expect(ctx.nodes.filter((n) => n.kind !== 'destination')).toEqual([]);
  });
});

describe('review of PR #8: music lifecycle', () => {
  // The music engine reads document.hidden and listens for visibilitychange.
  let onVisibility: (() => void) | null = null;
  const doc = { hidden: false, addEventListener: (_: string, fn: () => void) => void (onVisibility = fn) };
  beforeEach(() => {
    onVisibility = null;
    doc.hidden = false;
    vi.stubGlobal('document', doc);
  });
  const sources = (ctx: FakeContext) => ctx.nodes.filter((n) => n.kind === 'source').length;

  it('music at volume 0 schedules nothing, and raising the slider starts it', () => {
    const { ctx, audio } = setup({ music: true, musicVolume: 0 });
    audio.unlock();
    expect(sources(ctx)).toBe(0);
    audio.configure({ ...OPTS, music: true, musicVolume: 0.5 });
    expect(sources(ctx)).toBeGreaterThan(0);
  });

  it('a failed first unlock does not keep a dead music engine: the next unlock plays on the new context', () => {
    const broken = new FakeContext();
    broken.createBufferSource = () => {
      throw new Error('context lost');
    };
    const fresh = new FakeContext();
    let calls = 0;
    const audio = new GameAudio({ ...OPTS, music: true }, { createContext: () => (calls++ === 0 ? broken : fresh) as unknown as BaseAudioContext, vibrate: () => undefined, random: () => 0.5 });
    audio.unlock();
    audio.unlock();
    expect(sources(fresh)).toBeGreaterThan(0);
  });

  it('unlock resumes a context in any non-running state (iOS "interrupted"), not only "suspended"', () => {
    const { ctx, audio } = setup();
    const resume = vi.fn(() => Promise.resolve());
    Object.assign(ctx, { state: 'interrupted', resume });
    audio.unlock();
    expect(resume).toHaveBeenCalled();
  });

  it('music pauses when the window loses focus and resumes on focus, even if the page never reports hidden (P1, sprint 13)', () => {
    // An in-app browser can leave the page "visible" in the background, so visibilitychange never fires.
    const on: Record<string, () => void> = {};
    vi.stubGlobal('window', { setInterval: () => 1, clearInterval: () => undefined, addEventListener: (type: string, fn: () => void) => void (on[type] = fn) });
    const { ctx, audio } = setup({ music: true, musicVolume: 0.3 });
    audio.unlock();
    const musicLevel = buses(ctx).intoMaster.find((n) => n.gain.value === 0.3)!;
    const musicBus = ctx.nodes.find((n) => n.kind === 'gain' && n.out.includes(musicLevel))!;
    expect(musicBus.gain.target).toBe(0.5);
    on.blur?.();
    expect(musicBus.gain.target).toBe(0);
    on.focus?.();
    expect(musicBus.gain.target).toBe(0.5);
    on.pagehide?.();
    expect(musicBus.gain.target).toBe(0);
  });

  it('coming back to the page resumes a context the system interrupted', () => {
    const { ctx, audio } = setup({ music: true });
    const resume = vi.fn(() => Promise.resolve());
    Object.assign(ctx, { resume });
    audio.unlock();
    Object.assign(ctx, { state: 'interrupted' });
    doc.hidden = true;
    onVisibility?.();
    doc.hidden = false;
    onVisibility?.();
    expect(resume).toHaveBeenCalled();
  });
});
