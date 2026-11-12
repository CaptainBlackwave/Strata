// Story: production/sprints/sprint-20.md, D167, D169, D173: the Home hero, a tiny sorting game playing itself.
import { describe, expect, it } from 'vitest';
import { canPour, isSealed, isWon, pour } from '../../../../src/core/board';
import {
  HERO_START, type HeroLoop, boardAfter, fallbackDeal, heroDeal, heroLayout, heroMode, heroRuns, heroStill, heroTuning, nextPhase, phaseMs, remixSeed,
} from '../../../../src/ui/logic/home-hero';

const deal = heroDeal(heroTuning, remixSeed(heroTuning, 0));

describe('heroDeal (D173)', () => {
  it('deals colors full jars plus the empty ones, capacity units each, with no jar sealed at the start', () => {
    expect(deal.board.capacity).toBe(heroTuning.capacity);
    expect(deal.board.jars).toHaveLength(heroTuning.colors + heroTuning.empty);
    expect(deal.board.jars.filter((j) => j.units.length === 0)).toHaveLength(heroTuning.empty);
    for (const j of deal.board.jars.filter((x) => x.units.length)) {
      expect(j.units).toHaveLength(heroTuning.capacity);
      expect(isSealed(j, deal.board.capacity)).toBe(false);
    }
    expect(new Set(deal.board.jars.flatMap((j) => j.units)).size).toBe(heroTuning.colors);
  });
  it('every pour of the solution is legal, and they sort the board', () => {
    let b = deal.board;
    for (const m of deal.moves) {
      expect(canPour(b, m.from, m.to)).toBe(true);
      b = pour(b, m.from, m.to).board;
    }
    expect(isWon(b)).toBe(true);
  });
  it('keeps the pours between minMoves and maxMoves', () => {
    expect(deal.moves.length).toBeGreaterThanOrEqual(heroTuning.minMoves);
    expect(deal.moves.length).toBeLessThanOrEqual(heroTuning.maxMoves);
  });
  it('is deterministic, and each re-mix deals from the next seed', () => {
    expect(heroDeal(heroTuning, remixSeed(heroTuning, 0))).toEqual(deal);
    expect(remixSeed(heroTuning, 1)).not.toBe(remixSeed(heroTuning, 0));
    for (let loop = 1; loop < 6; loop++) {
      const d = heroDeal(heroTuning, remixSeed(heroTuning, loop));
      expect(isWon(boardAfter(d, d.moves.length))).toBe(true);
    }
  });
  it('the colours come from the tuning palette', () => {
    for (const c of deal.board.jars.flatMap((j) => j.units)) expect(heroTuning.palette).toContain(c);
  });
  it('falls back to a fixed solvable board when no try is kept', () => {
    const d = heroDeal({ ...heroTuning, minMoves: 999 }, 1);
    expect(d).toEqual(fallbackDeal({ ...heroTuning, minMoves: 999 }));
    expect(isWon(boardAfter(d, d.moves.length))).toBe(true);
  });
});

describe('heroStill', () => {
  it('is the board mid-sort: some pours played, not yet solved', () => {
    const still = heroStill(deal);
    expect(isWon(still)).toBe(false);
    expect(still).not.toEqual(deal.board);
  });
});

describe('the loop (nextPhase, phaseMs)', () => {
  it('waits, pours, waits … then rests solved, fades out, deals the next loop and fades in', () => {
    const moves = 2;
    const seen: HeroLoop[] = [];
    let l = HERO_START;
    for (let i = 0; i < 8; i++) seen.push((l = nextPhase(l, moves)));
    expect(seen.map((x) => x.phase)).toEqual(['pour', 'wait', 'pour', 'solved', 'fadeOut', 'fadeIn', 'wait', 'pour']);
    expect(seen[5]).toEqual({ phase: 'fadeIn', loop: 1, step: 0 });
  });
  it('a deal with no pours goes straight to solved', () => {
    expect(nextPhase(HERO_START, 0).phase).toBe('solved');
  });
  it('times come from the tuning; a pour lasts as long as it plays', () => {
    expect(phaseMs('wait', heroTuning)).toBe(heroTuning.paceMs);
    expect(phaseMs('solved', heroTuning)).toBe(heroTuning.solvedMs);
    expect(phaseMs('fadeOut', heroTuning)).toBe(heroTuning.fadeMs);
    expect(phaseMs('pour', heroTuning)).toBeNull();
  });
  it('the pace is calm: two to three seconds a pour', () => {
    expect(heroTuning.paceMs).toBeGreaterThanOrEqual(2000);
    expect(heroTuning.paceMs).toBeLessThanOrEqual(3000);
  });
});

describe('heroMode', () => {
  const on = { search: '', webgl: true, realistic: true, lost: false };
  it('is live on Realistic with WebGL, still on Classic, without WebGL or with the context lost', () => {
    expect(heroMode(on)).toBe('live');
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
  it('plays only while Home, the Play tab and the page are visible, never under reduced motion', () => {
    expect(heroRuns(all)).toBe(true);
    for (const off of [{ homeShown: false }, { onPlay: false }, { pageVisible: false }, { reduced: true }]) expect(heroRuns({ ...all, ...off })).toBe(false);
  });
});

describe('heroLayout', () => {
  it.each([
    [412, 353],
    [320, 285],
    [560, 408],
  ])('fits %ix%i: a centred row of five jars whose glass fills most of the height, with room above for the pour', (w, h) => {
    const jars = heroLayout(w, h, 5, 4, heroTuning.glassShare);
    expect(jars).toHaveLength(5);
    for (const j of jars) {
      expect(j.left).toBeGreaterThanOrEqual(0);
      expect(j.left + j.width).toBeLessThanOrEqual(w);
      expect(j.top + j.height).toBeLessThanOrEqual(h);
      expect(j.height / h).toBeGreaterThanOrEqual(0.6);
      expect(j.height / h).toBeLessThanOrEqual(0.75);
      expect(j.top).toBeGreaterThanOrEqual(h * 0.15);
      expect(j.unitHeight * 4).toBeLessThan(j.height);
    }
    expect(jars[0].left).toBeCloseTo(w - (jars[4].left + jars[4].width));
  });
  it('tips less and drops less than the board, so the tipped jar stays inside the hero', () => {
    expect(heroTuning.maxTiltDeg).toBeLessThan(110);
    expect(heroTuning.maxTiltDeg).toBeGreaterThan(90);
    expect(heroTuning.airRows).toBeLessThan(24);
  });
});
