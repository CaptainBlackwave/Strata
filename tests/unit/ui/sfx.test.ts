// Story: production/sprints/sprint-10.md F1 (sound effects) and F4 (haptics), D64, D68.
// The recipe and haptic tables are pure data, so every event is checked here without a browser.
// The real loudness is measured in Chromium (production/qa/evidence/sprint-10/f1/loudness.md).
import { describe, expect, it } from 'vitest';
import { HAPTICS, MASTER_GAIN, SEAL_BASE, SEAL_TOP, SOUNDS, SOUND_EVENTS, type SoundDetail, type SoundEvent, landShape, peakEstimate, pourShape, sealChimeNotes, toDb } from '../../../src/ui/sfx';

/** Details the game passes: jar indexes and stack heights for pitch, pour sizes for units. */
const DETAILS: SoundDetail[] = [{}, ...[0, 1, 2, 3, 5, 8, 12].map((pitch) => ({ pitch })), ...[1, 2, 3, 4, 6, 9, 16].map((units) => ({ units })), ...[0, 1, 3, 6, 20].map((step) => ({ step })), { key: { root: 207.65, scale: [0, 2, 4, 7, 9, 11] } }, { key: { root: 329.63, scale: [0, 2, 4, 7, 9] } }];

/** Every event the game makes, before (sprint 4) and after sprint 10, the hourglass flip (sprint 13 M1) and the clam opening (M3). */
const EXPECTED: SoundEvent[] = ['select', 'deselect', 'nope', 'pour', 'land', 'seal', 'win', 'coin', 'booster', 'shuffle', 'mapStone', 'locked', 'unlock', 'shell', 'sceneBought', 'playHere', 'flip', 'clamOpen'];

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

// Sprint 18 F1, F2, F3 (D149): the pour and land follow the sand moved; the seal chime climbs; the win chord is in the music's key.
describe('pour and land follow the units moved (F1)', () => {
  it('the pour is longer and lower for more sand, and its hiss voice uses that shape', () => {
    for (let u = 1; u < 6; u++) {
      expect(pourShape(u + 1).dur).toBeGreaterThan(pourShape(u).dur);
      expect(pourShape(u + 1).from).toBeLessThan(pourShape(u).from);
      expect(pourShape(u + 1).to).toBeLessThan(pourShape(u).to);
    }
    expect(pourShape(99)).toEqual(pourShape(6)); // capped at 6
    const hiss = SOUNDS.pour.voices({ units: 4 })[0];
    expect(hiss).toMatchObject({ kind: 'noise', from: pourShape(4).from, to: pourShape(4).to, dur: pourShape(4).dur });
  });
  it('the land is longer and weightier for more sand', () => {
    for (let u = 1; u < 6; u++) {
      expect(landShape(u + 1).dur).toBeGreaterThan(landShape(u).dur);
      expect(landShape(u + 1).thump).toBeGreaterThan(landShape(u).thump);
    }
    const end = (d: SoundDetail) => Math.max(...SOUNDS.land.voices(d).map((v) => v.at + v.dur));
    expect(end({ pitch: 1, units: 4 })).toBeGreaterThan(end({ pitch: 1, units: 1 }));
  });
});

describe('the seal chime climbs (F2)', () => {
  it('starts at today\'s chime and rises one scale step per jar sealed, then holds at the top', () => {
    expect(sealChimeNotes(0)).toEqual([5, 7, 9]);
    expect(sealChimeNotes(undefined)).toEqual([5, 7, 9]);
    const firsts = Array.from({ length: 9 }, (_, s) => sealChimeNotes(s)[0]);
    expect(firsts).toEqual([5, 6, 7, 8, 9, 10, 10, 10, 10]);
    expect(SEAL_TOP - SEAL_BASE).toBe(5);
  });
  it('the chime\'s bells sound those notes, higher each step', () => {
    const top = (step: number) => Math.max(...SOUNDS.seal.voices({ step }).filter((v) => v.kind === 'tone').map((v) => (v as { freq: number }).freq));
    for (let s = 0; s < 5; s++) expect(top(s + 1)).toBeGreaterThan(top(s));
    expect(top(5)).toBe(top(9));
  });
});

describe('the win chord in the music\'s key (F3)', () => {
  it('uses the key\'s root and scale; without one it is unchanged', () => {
    const tones = (d: SoundDetail) => SOUNDS.win.voices(d).filter((v) => v.kind === 'tone').map((v) => (v as { freq: number }).freq);
    expect(tones({})[0]).toBeCloseTo(261.63, 1);
    expect(tones({ key: { root: 207.65, scale: [0, 2, 4, 7, 9, 11] } })[0]).toBeCloseTo(207.65, 1);
    expect(tones({ key: { root: 207.65, scale: [0, 2, 4, 7, 9, 11] } })[1]).toBeCloseTo(207.65 * 2 ** (4 / 12), 1); // degree 2
  });
});
