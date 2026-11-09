// Story: production/sprints/sprint-10.md F1 (sound effects) and F4 (haptics), D64, D68.
// The recipe and haptic tables are pure data, so every event is checked here without a browser.
// The real loudness is measured in Chromium (production/qa/evidence/sprint-10/f1/loudness.md).
import { describe, expect, it } from 'vitest';
import { HAPTICS, MASTER_GAIN, SOUNDS, SOUND_EVENTS, type SoundDetail, type SoundEvent, peakEstimate, toDb } from '../../../src/ui/sfx';

/** Details the game passes: jar indexes and stack heights for pitch, pour sizes for units. */
const DETAILS: SoundDetail[] = [{}, ...[0, 1, 2, 3, 5, 8, 12].map((pitch) => ({ pitch })), ...[1, 2, 3, 4, 6, 9, 16].map((units) => ({ units }))];

/** Every event the game makes, before (sprint 4) and after sprint 10, and the hourglass flip (sprint 13 M1). */
const EXPECTED: SoundEvent[] = ['select', 'deselect', 'nope', 'pour', 'land', 'seal', 'win', 'coin', 'booster', 'shuffle', 'mapStone', 'locked', 'unlock', 'shell', 'sceneBought', 'playHere', 'flip'];

describe('sound recipes (F1)', () => {
  it('lists every event, old and new', () => {
    expect([...SOUND_EVENTS].sort()).toEqual([...EXPECTED].sort());
  });
  it('every event has a recipe with at least one voice, for every detail', () => {
    for (const e of SOUND_EVENTS) for (const d of DETAILS) expect(SOUNDS[e].voices(d).length, e).toBeGreaterThan(0);
  });
  it('every voice is well formed: starts at or after 0, a positive level, decays after its attack', () => {
    for (const e of SOUND_EVENTS)
      for (const d of DETAILS)
        for (const v of SOUNDS[e].voices(d)) {
          expect(v.at, e).toBeGreaterThanOrEqual(0);
          expect(v.vol, e).toBeGreaterThan(0);
          expect(v.attack, e).toBeGreaterThan(0);
          expect(v.dur, e).toBeGreaterThan(v.attack);
          if (v.kind === 'tone') expect(v.freq, e).toBeGreaterThan(20);
          else expect(Math.min(v.from, v.to), e).toBeGreaterThan(20);
        }
  });
  it('every sound is short and calm: over within 2 seconds (D68)', () => {
    for (const e of SOUND_EVENTS) for (const d of DETAILS) expect(Math.max(...SOUNDS[e].voices(d).map((v) => v.at + v.dur)), e).toBeLessThanOrEqual(2);
  });
  it('every event has its own peak cap, below -1 dBFS', () => {
    for (const e of SOUND_EVENTS) expect(SOUNDS[e].capDb, e).toBeLessThanOrEqual(-1);
  });
  it('the worst-case summed envelope at full volume stays under each cap (no clipping)', () => {
    for (const e of SOUND_EVENTS)
      for (const d of DETAILS) {
        const db = toDb(peakEstimate(SOUNDS[e].voices(d)) * MASTER_GAIN);
        expect(db, `${e} ${JSON.stringify(d)}`).toBeLessThanOrEqual(SOUNDS[e].capDb);
        expect(db, `${e} is audible`).toBeGreaterThan(-40);
      }
  });
  it('the pour follows the units poured: more sand is longer and has more grains', () => {
    const one = SOUNDS.pour.voices({ units: 1 });
    const four = SOUNDS.pour.voices({ units: 4 });
    const end = (vs: typeof one) => Math.max(...vs.map((v) => v.at + v.dur));
    expect(four.length).toBeGreaterThan(one.length);
    expect(end(four)).toBeGreaterThan(end(one));
  });
  it('the recipes are deterministic (the same detail gives the same voices)', () => {
    for (const e of SOUND_EVENTS) expect(SOUNDS[e].voices({ units: 3, pitch: 2 })).toEqual(SOUNDS[e].voices({ units: 3, pitch: 2 }));
  });
});

describe('peakEstimate', () => {
  it('is the highest sum of overlapping envelopes', () => {
    const v = { kind: 'tone', wave: 'sine', freq: 440, at: 0, attack: 0.01, dur: 0.5, vol: 0.2 } as const;
    expect(peakEstimate([v])).toBeCloseTo(0.2, 2);
    expect(peakEstimate([v, v])).toBeCloseTo(0.4, 2);
    expect(peakEstimate([v, { ...v, at: 1 }])).toBeCloseTo(0.2, 2); // no overlap
  });
  it('toDb converts a linear peak to dBFS', () => {
    expect(toDb(1)).toBeCloseTo(0, 5);
    expect(toDb(0.5)).toBeCloseTo(-6.02, 1);
  });
});

describe('haptics table (F4)', () => {
  it('every event has a pattern or an explicit none (null)', () => {
    expect(Object.keys(HAPTICS).sort()).toEqual([...SOUND_EVENTS].sort());
    for (const e of SOUND_EVENTS) expect(HAPTICS[e] === null || typeof HAPTICS[e] === 'number' || Array.isArray(HAPTICS[e]), e).toBe(true);
  });
  it('every pattern is short and soft: pulses of at most 40 ms, at most 200 ms in all', () => {
    for (const e of SOUND_EVENTS) {
      const p = HAPTICS[e];
      if (p === null) continue;
      const parts = Array.isArray(p) ? p : [p];
      parts.forEach((ms, i) => {
        expect(Number.isInteger(ms) && ms > 0, e).toBe(true);
        if (i % 2 === 0) expect(ms, `${e} pulse`).toBeLessThanOrEqual(40);
      });
      expect(parts.reduce((a, b) => a + b, 0), e).toBeLessThanOrEqual(200);
    }
  });
  it('seal and win are distinct patterns', () => {
    expect(HAPTICS.seal).not.toEqual(HAPTICS.win);
    expect(Array.isArray(HAPTICS.win) && Array.isArray(HAPTICS.seal) && HAPTICS.win.length > HAPTICS.seal.length).toBe(true);
  });
  it('the frequent, quiet events do not vibrate (the coin count-up, a pour before its land)', () => {
    expect(HAPTICS.coin).toBeNull();
    expect(HAPTICS.pour).toBeNull();
  });
});
