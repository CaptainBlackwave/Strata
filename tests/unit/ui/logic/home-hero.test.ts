// Story: production/sprints/sprint-21.md H1, D175, D176: the Home hero is the three logo jars, still, with a rare sparkle.
import { describe, expect, it } from 'vitest';
import { isSealed } from '../../../../src/core/board';
import rawConfig from '../../../../src/config/game-config.json';
import {
  type HeroTuning, LOGO, heroLayout, heroMode, heroTuning, logoBoard, sparkleDelay, sparkleRuns, sparkleSpot,
} from '../../../../src/ui/logic/home-hero';

/** The pre-0.19 logo's colours, bottom first, per jar (git 15cb9c0 style.css `.logo-jars i:nth-child`). */
const LOGO_HEX = [
  ['#c8553d', '#f2a541', '#2a9d8f'],
  ['#2a9d8f', '#c8553d', '#f2a541'],
  ['#f2a541', '#2a9d8f', '#c8553d'],
];

describe('logoBoard (D175)', () => {
  it('is the logo: three jars of three layers, red, amber and teal permuted, none sealed', () => {
    const b = logoBoard();
    expect(b.capacity).toBe(3);
    expect(b.jars.map((j) => j.units.map((c) => rawConfig.palette[c].hex))).toEqual(LOGO_HEX);
    for (const j of b.jars) {
      expect(j.hidden).toBe(0);
      expect(isSealed(j, b.capacity)).toBe(false);
    }
  });
});

describe('heroMode', () => {
  const on = { search: '', webgl: true, realistic: true, lost: false };
  it('draws the Realistic jars when the board would be Realistic', () => {
    expect(heroMode(on)).toBe('realistic');
    expect(heroMode({ ...on, realistic: false, search: '?board=gpu' })).toBe('realistic');
  });
  it('falls back to the CSS logo jars on Classic, without WebGL or with the context lost', () => {
    expect(heroMode({ ...on, realistic: false })).toBe('css');
    expect(heroMode({ ...on, search: '?board=dom' })).toBe('css');
    expect(heroMode({ ...on, webgl: false })).toBe('css');
    expect(heroMode({ ...on, lost: true })).toBe('css');
  });
});

describe('sparkleRuns (D176)', () => {
  const seen = { realistic: true, homeShown: true, onPlay: true, pageVisible: true, reduced: false };
  it('runs only on the Realistic jars while they can be seen', () => {
    expect(sparkleRuns(seen)).toBe(true);
    for (const k of ['realistic', 'homeShown', 'onPlay', 'pageVisible'] as const) expect(sparkleRuns({ ...seen, [k]: false }), k).toBe(false);
  });
  it('never runs under reduced motion', () => {
    expect(sparkleRuns({ ...seen, reduced: true })).toBe(false);
  });
});

describe('sparkleDelay (D176: rare)', () => {
  it('waits firstSparkleMs for the first, then every sparkleEveryMs give or take the jitter', () => {
    expect(sparkleDelay(heroTuning, 0)).toBe(heroTuning.firstSparkleMs);
    const waits = Array.from({ length: 50 }, (_, n) => sparkleDelay(heroTuning, n + 1));
    for (const w of waits) {
      expect(w).toBeGreaterThanOrEqual(heroTuning.sparkleEveryMs - heroTuning.sparkleJitterMs);
      expect(w).toBeLessThanOrEqual(heroTuning.sparkleEveryMs + heroTuning.sparkleJitterMs);
    }
    expect(new Set(waits).size).toBeGreaterThan(10); // no fixed beat
  });
  it('is deterministic', () => {
    expect(sparkleDelay(heroTuning, 7)).toBe(sparkleDelay(heroTuning, 7));
  });
  it('never comes sooner than a sparkle lasts, so two never overlap', () => {
    const tight: HeroTuning = { ...heroTuning, sparkleEveryMs: 500, sparkleJitterMs: 2000, sparkleMs: 1400 };
    for (let n = 1; n < 40; n++) expect(sparkleDelay(tight, n)).toBeGreaterThanOrEqual(1400);
  });
  it('is rare: the shipped tuning sparkles at most once every few seconds', () => {
    expect(heroTuning.sparkleEveryMs - heroTuning.sparkleJitterMs).toBeGreaterThanOrEqual(4 * heroTuning.sparkleMs);
  });
});

describe('heroLayout', () => {
  for (const [w, h] of [[390, 336], [320, 285], [412, 360], [768, 408]] as const) {
    it(`centres three jars inside ${w}×${h}, the middle taller, along the bottom`, () => {
      const boxes = heroLayout(w, h, 3);
      expect(boxes).toHaveLength(3);
      const [a, m, c] = boxes;
      expect(m.height / a.height).toBeCloseTo(LOGO.middle, 6);
      expect(c.height).toBeCloseTo(a.height, 6);
      for (const b of boxes) {
        expect(b.top + b.height).toBeCloseTo(h - LOGO.foot, 6);
        expect(b.width).toBeCloseTo(a.width, 6);
        expect(b.top).toBeGreaterThan(0);
        // the sand fills the glass to LOGO.fill
        expect(b.unitHeight * 3 + 5.5).toBeCloseTo(b.height * LOGO.fill, 6);
      }
      expect(a.left).toBeGreaterThanOrEqual(16 - 1e-6);
      expect(c.left + c.width).toBeLessThanOrEqual(w - 16 + 1e-6);
      expect(a.left + (c.left + c.width)).toBeCloseTo(w, 6);
      expect(a.height).toBeLessThanOrEqual(LOGO.maxHeight);
    });
  }
  it('gives way to a narrow stage: the row stays 16 px clear of each side', () => {
    const [a, , c] = heroLayout(200, 400, 3);
    expect(a.left).toBeCloseTo(16, 6);
    expect(c.left + c.width).toBeCloseTo(184, 6);
  });
});

describe('sparkleSpot', () => {
  const boxes = heroLayout(390, 336, 3);
  it('always lands on a jar\'s sand, inside its walls', () => {
    for (let n = 0; n < 60; n++) {
      const s = sparkleSpot(boxes, 3, n);
      const b = boxes[s.jar];
      expect(s.x).toBeGreaterThan(b.left + 5.5);
      expect(s.x).toBeLessThan(b.left + b.width - 5.5);
      expect(s.y).toBeGreaterThan(b.top + b.height - 5.5 - 3 * b.unitHeight);
      expect(s.y).toBeLessThan(b.top + b.height - 5.5);
      expect(s.size).toBeGreaterThanOrEqual(10);
    }
  });
  it('visits every jar and is deterministic', () => {
    expect(new Set(Array.from({ length: 30 }, (_, n) => sparkleSpot(boxes, 3, n).jar)).size).toBe(3);
    expect(sparkleSpot(boxes, 3, 4)).toEqual(sparkleSpot(boxes, 3, 4));
  });
});
