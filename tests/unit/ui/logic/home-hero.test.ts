// Story: production/sprints/sprint-20.md H2 (D167, D169): the Home hero's live/still choice, when it runs, its layout and loop.
import { describe, expect, it } from 'vitest';
import config from '../../../../src/config/game-config.json';
import { pourAmount } from '../../../../src/core/board';
import { HERO_START, type HeroTuning, advanceLoop, heroBoard, heroLayout, heroMode, heroRuns, heroTuning } from '../../../../src/ui/logic/home-hero';

const on = { search: '', webgl: true, realistic: true, lost: false };

describe('heroMode', () => {
  it('is live on Realistic with WebGL', () => {
    expect(heroMode(on)).toBe('live');
  });
  it('is still on Classic, without WebGL, or with the context lost', () => {
    expect(heroMode({ ...on, realistic: false })).toBe('still');
    expect(heroMode({ ...on, webgl: false })).toBe('still');
    expect(heroMode({ ...on, lost: true })).toBe('still');
  });
  it('follows the board switch in the address', () => {
    expect(heroMode({ ...on, search: '?board=dom' })).toBe('still');
    expect(heroMode({ ...on, realistic: false, search: '?board=gpu' })).toBe('live');
  });
});

describe('heroRuns (D169)', () => {
  const all = { homeShown: true, onPlay: true, pageVisible: true, reduced: false };
  it('runs only while Home, the Play tab and the page are visible', () => {
    expect(heroRuns(all)).toBe(true);
    expect(heroRuns({ ...all, homeShown: false })).toBe(false);
    expect(heroRuns({ ...all, onPlay: false })).toBe(false);
    expect(heroRuns({ ...all, pageVisible: false })).toBe(false);
  });
  it('never runs under reduced motion', () => {
    expect(heroRuns({ ...all, reduced: true })).toBe(false);
  });
});

describe('heroLayout', () => {
  const rows = (config as { sand: { rows: number } }).sand.rows;
  it.each([
    [412, 305],
    [320, 230],
    [560, 360],
  ])('fits a %ix%i stage: three jars inside, the middle one tallest, the funnel above it', (w, h) => {
    const { jars, funnel } = heroLayout(w, h, heroTuning.airRows, rows);
    for (const j of jars) {
      expect(j.left).toBeGreaterThanOrEqual(0);
      expect(j.left + j.width).toBeLessThanOrEqual(w);
      expect(j.top + j.height).toBeLessThanOrEqual(h);
    }
    expect(jars[1].height).toBeGreaterThan(jars[0].height);
    expect(jars[0].left).toBeLessThan(jars[1].left);
    expect(jars[2].left).toBeGreaterThan(jars[1].left);
    expect(funnel.x).toBeCloseTo(w / 2);
    expect(funnel.y).toBeLessThan(jars[1].top + 6);
    expect(funnel.y - funnel.coneHeight - funnel.neckHeight).toBeGreaterThan(0);
  });
});

describe('heroBoard', () => {
  it('every loop is a legal one-band pour (planned into an empty jar; the scene lays the middle bands under it)', () => {
    for (let cycle = 0; cycle < heroTuning.tops.length * 2; cycle++) {
      const b = heroBoard(heroTuning, cycle);
      expect(b.jars[1].units).toEqual([]);
      expect(pourAmount(b, 0, 1)).toBe(1);
    }
  });
  it('the middle bands and one poured band fill the jar, and no poured colour repeats the band under it', () => {
    expect(heroTuning.middle.length + 1).toBe(4);
    for (const top of heroTuning.tops) expect(top).not.toBe(heroTuning.middle.at(-1));
  });
  it('cycles through the tops', () => {
    expect(heroBoard(heroTuning, 0).jars[0].units).toEqual([heroTuning.tops[0]]);
    expect(heroBoard(heroTuning, heroTuning.tops.length + 1).jars[0].units).toEqual([heroTuning.tops[1]]);
  });
  it('the config colours are palette indexes', () => {
    const n = (config as { palette: unknown[] }).palette.length;
    for (const c of [...heroTuning.middle, ...heroTuning.tops, ...heroTuning.left, ...heroTuning.right]) expect(c).toBeLessThan(n);
  });
});

describe('advanceLoop', () => {
  const tuning: HeroTuning = { ...heroTuning, restMs: 1000, fadeMs: 500 };
  it('pours until settled, rests, fades into the next cycle, then pours again', () => {
    let loop = advanceLoop(HERO_START, 16, false, tuning);
    expect(loop.phase).toBe('pour');
    loop = advanceLoop(loop, 16, true, tuning);
    expect(loop).toEqual({ phase: 'rest', ms: 0, cycle: 0 });
    loop = advanceLoop(loop, 999, true, tuning);
    expect(loop.phase).toBe('rest');
    loop = advanceLoop(loop, 1, true, tuning);
    expect(loop).toEqual({ phase: 'fade', ms: 0, cycle: 1 });
    loop = advanceLoop(loop, 500, false, tuning);
    expect(loop).toEqual({ phase: 'pour', ms: 0, cycle: 1 });
  });
  it('ignores a negative time step', () => {
    expect(advanceLoop({ phase: 'rest', ms: 10, cycle: 0 }, -50, true, tuning).ms).toBe(10);
  });
});
