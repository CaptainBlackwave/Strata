// Sprint 10 F5 (production/sprints/sprint-10.md), decision D68: calm, a little richer; nothing
// loud or long; reduced motion respected. These are the pure plans behind the DOM effects in fx.ts.
import { describe, expect, it } from 'vitest';
import {
  FX_BUDGET,
  FX_COUNT,
  FX_MS,
  coinFlightPlan,
  effectAllowed,
  noteFirstClear,
  pathPoint,
  revealStretch,
  stretchDots,
  winBloomPlan,
  worstCaseParticles,
  pourGrainCount,
  SNOW,
  snowShows,
  winGlowPlan,
} from '../../../src/ui/fx-plan';

describe('timing table (D68: short)', () => {
  it('the seal shimmer is about 600 ms', () => {
    expect(FX_MS.seal).toBeGreaterThanOrEqual(500);
    expect(FX_MS.seal).toBeLessThanOrEqual(700);
  });
  it('the win bloom is about 1 s', () => {
    expect(FX_MS.winBloom).toBeGreaterThanOrEqual(800);
    expect(FX_MS.winBloom).toBeLessThanOrEqual(1100);
  });
  it('screen transitions are 150-220 ms', () => {
    expect(FX_MS.transition).toBeGreaterThanOrEqual(150);
    expect(FX_MS.transition).toBeLessThanOrEqual(220);
  });
  it('map touches stay under a second', () => {
    expect(FX_MS.mapPop).toBeLessThan(1000);
    expect(FX_MS.mapDelay + FX_MS.pathReveal).toBeLessThan(1000);
  });
});

describe('particle budget (same order as scene-fx: at most 60)', () => {
  it('the budget is 60', () => {
    expect(FX_BUDGET).toBe(60);
  });
  it('a last pour that seals and wins never has more than the budget alive at once', () => {
    expect(worstCaseParticles()).toBeLessThanOrEqual(FX_BUDGET);
  });
  it('a seal throws only a few motes', () => {
    expect(FX_COUNT.sealMotes).toBeGreaterThanOrEqual(3);
    expect(FX_COUNT.sealMotes).toBeLessThanOrEqual(8);
  });
});

describe('effectAllowed: the reduced-motion switch', () => {
  it('runs with motion allowed and the page visible', () => {
    expect(effectAllowed({ reduced: false, hidden: false })).toBe(true);
  });
  it('never runs under reduced motion', () => {
    expect(effectAllowed({ reduced: true, hidden: false })).toBe(false);
    expect(effectAllowed({ reduced: true, hidden: true })).toBe(false);
  });
  it('does not start while the page is hidden', () => {
    expect(effectAllowed({ reduced: false, hidden: true })).toBe(false);
  });
});

describe('coinFlightPlan', () => {
  it('no coins, no flight', () => {
    expect(coinFlightPlan(0).count).toBe(0);
  });
  it('3 to 5 coins, more for a bigger reward', () => {
    expect(coinFlightPlan(5).count).toBe(3);
    expect(coinFlightPlan(20).count).toBe(3);
    expect(coinFlightPlan(40).count).toBe(4);
    expect(coinFlightPlan(500).count).toBe(5);
  });
  it('the whole flight takes about 500 ms whatever the count', () => {
    for (const reward of [5, 40, 500]) {
      const p = coinFlightPlan(reward);
      expect(p.each + p.stagger * (p.count - 1)).toBe(FX_MS.coinFlight);
      expect(p.each).toBeGreaterThan(0);
    }
  });
});

describe('winBloomPlan: no stacking with a scene win display (D40)', () => {
  it('glow and motes when no scene display runs', () => {
    expect(winBloomPlan(false)).toEqual({ glow: true, motes: FX_COUNT.winMotes });
  });
  it('nothing when the scene layer draws its own win display', () => {
    expect(winBloomPlan(true)).toEqual({ glow: false, motes: 0 });
  });
});

describe('newly unlocked stretch on the map', () => {
  it('remembers the lowest level first-cleared since the map was last seen', () => {
    expect(noteFirstClear(null, 7)).toBe(7);
    expect(noteFirstClear(7, 8)).toBe(7);
    expect(noteFirstClear(9, 8)).toBe(8);
  });
  it('the stretch runs from that level to the next stone', () => {
    expect(revealStretch(7, 8)).toEqual({ from: 7, to: 8 });
    expect(revealStretch(7, 10)).toEqual({ from: 7, to: 10 });
  });
  it('no stretch with nothing cleared, or nothing ahead of it', () => {
    expect(revealStretch(null, 8)).toBeNull();
    expect(revealStretch(8, 8)).toBeNull();
  });
});

describe('pathPoint: the map path curve between two stones', () => {
  it('starts and ends on the stones', () => {
    expect(pathPoint([0, 100], [50, 0], 0)).toEqual([0, 100]);
    expect(pathPoint([0, 100], [50, 0], 1)).toEqual([50, 0]);
  });
  it('passes the midpoint halfway', () => {
    expect(pathPoint([0, 100], [50, 0], 0.5)).toEqual([25, 50]);
  });
});

describe('stretchDots', () => {
  const pt = (lv: number) => [lv * 10, 1000 - lv * 100] as const;
  it('puts the dots between the stones, never on them, in path order', () => {
    const dots = stretchDots(3, 4, pt);
    expect(dots).toHaveLength(FX_COUNT.pathDotsPerGap);
    for (const [, y] of dots) {
      expect(y).toBeLessThan(pt(3)[1]);
      expect(y).toBeGreaterThan(pt(4)[1]);
    }
    const ys = dots.map(([, y]) => y);
    expect([...ys].sort((a, b) => b - a)).toEqual(ys);
  });
  it('covers every gap of a longer stretch', () => {
    expect(stretchDots(3, 5, pt)).toHaveLength(2 * FX_COUNT.pathDotsPerGap);
  });
  it('a very long stretch stays within the dot cap', () => {
    const dots = stretchDots(1, 40, pt);
    expect(dots.length).toBeLessThanOrEqual(FX_COUNT.pathDotsMax);
    expect(dots.length).toBeGreaterThan(0);
    expect(dots.at(-1)![1]).toBeGreaterThan(pt(40)[1]); // the end nearest the next stone is kept
  });
  it('an empty stretch has no dots', () => {
    expect(stretchDots(4, 4, pt)).toEqual([]);
  });
});

// Sprint 18 F1, F3 (D149): the pour's grains and the win's glow run.
describe('pourGrainCount (F1)', () => {
  it('more sand streams more grains, within the cap', () => {
    expect(pourGrainCount(1)).toBe(8);
    expect(pourGrainCount(3)).toBe(12);
    expect(pourGrainCount(9)).toBe(FX_COUNT.pourGrains);
    expect(FX_COUNT.pourGrains + FX_COUNT.pourSplash + FX_COUNT.sealMotes + FX_COUNT.corkSparkle).toBeLessThanOrEqual(FX_BUDGET);
  });
});

describe('winGlowPlan (F3)', () => {
  it('glows each sealed jar in order, then the chord, then the card, within 1.2 s', () => {
    const p = winGlowPlan([0, 2, 3], false);
    expect(p.steps).toEqual([{ jar: 0, at: 0 }, { jar: 2, at: 90 }, { jar: 3, at: 180 }]);
    expect(p.chordAt).toBe(180 + FX_MS.winGlowEach / 2);
    expect(p.total).toBe(p.chordAt + FX_MS.winChordLead);
    expect(p.total).toBeLessThanOrEqual(1200);
  });
  it('a 16-jar board still fits in 1.2 s, steps evenly spaced and rising', () => {
    const p = winGlowPlan(Array.from({ length: 16 }, (_, i) => i), false);
    expect(p.total).toBeLessThanOrEqual(FX_MS.winGlowMax);
    const gaps = p.steps.slice(1).map((s, i) => s.at - p.steps[i].at);
    expect(new Set(gaps).size).toBe(1);
    expect(gaps[0]).toBeGreaterThan(0);
    expect(p.chordAt).toBeLessThan(p.total);
  });
  it('reduced motion skips the run: no glow, the chord and the card at once', () => {
    expect(winGlowPlan([0, 1, 2], true)).toEqual({ steps: [], chordAt: 0, total: 0 });
    expect(winGlowPlan([], false).total).toBe(0);
  });
});

describe('snowShows (W1)', () => {
  const env = { reduced: false, hidden: false };
  it('snows on Home and event boards only while Winter Tide runs', () => {
    expect(snowShows(env, 'wintertide', 'home', false)).toBe(true);
    expect(snowShows(env, 'wintertide', 'event', false)).toBe(true);
    expect(snowShows(env, 'wintertide', 'off', false)).toBe(false);
    expect(snowShows(env, null, 'home', false)).toBe(false);
    expect(snowShows(env, 'summer', 'home', false)).toBe(false);
  });
  it('never under reduced motion, in a hidden tab, or over a scene that already snows', () => {
    expect(snowShows({ reduced: true, hidden: false }, 'wintertide', 'home', false)).toBe(false);
    expect(snowShows({ reduced: false, hidden: true }, 'wintertide', 'home', false)).toBe(false);
    expect(snowShows(env, 'wintertide', 'home', true)).toBe(false);
  });
  it('is light: about 40 flakes at 30 frames a second', () => {
    expect(SNOW.flakes).toBe(40);
    expect(SNOW.fps).toBeLessThanOrEqual(30);
  });
});
