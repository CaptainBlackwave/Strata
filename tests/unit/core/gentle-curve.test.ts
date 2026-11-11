// Story: owner decisions D104-D109 (design/gdd/systems-index.md), design/gdd/level-generation.md §2.1.
// The gentler climb: colours reach 12 near level 95, hidden sand deepens later, tall jars stay
// 4 x 8 through level 40, and breather levels give an easier board twice in every ten.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { generateLevel, maxPoursFor } from '../../../src/core/generator';
import { type GameConfig, isBreather, levelSpec, specMechanics } from '../../../src/core/levels';

const cfg = config as unknown as GameConfig;
/** Colour count of the ordinary (non-breather, non-tall) level `l`. */
const colors = (l: number) => levelSpec(l, cfg).colors;

describe('the gentler colour climb (D105)', () => {
  it('colours step up slowly: 8 at 18, 9 at 30, 10 at 45, 11 at 65, 12 at 95, 13 at 130, 14 at 170', () => {
    const steps: [number, number][] = [[17, 7], [19, 8], [29, 8], [31, 9], [44, 9], [46, 10], [64, 10], [66, 11], [94, 11], [96, 12], [129, 12], [131, 13], [169, 13], [171, 14]];
    for (const [level, want] of steps) expect(colors(level), `level ${level}`).toBe(want);
  });
  it('levels 1-11 keep their recipe', () => {
    expect([1, 3, 5, 8, 11].map(colors)).toEqual([3, 4, 5, 6, 6]);
    expect(levelSpec(11, cfg).buriedDepth).toBe(1);
  });
  it('hidden sand: one buried layer until level 30, three from level 110 (D107)', () => {
    expect([12, 20 + 1, 29].map((l) => levelSpec(l, cfg).buriedDepth)).toEqual([1, 1, 1]);
    expect([31, 109].map((l) => levelSpec(l, cfg).buriedDepth)).toEqual([2, 2]);
    expect(levelSpec(111, cfg).buriedDepth).toBe(3);
  });
  it('tall jars are 4 x 8 through level 40 and 5 x 8 from level 50 (D108)', () => {
    for (const l of [10, 20, 30, 40]) expect(levelSpec(l, cfg), `level ${l}`).toMatchObject({ challenge: true, colors: 4, capacity: 8 });
    for (const l of [50, 60, 200]) expect(levelSpec(l, cfg), `level ${l}`).toMatchObject({ challenge: true, colors: 5, capacity: 8 });
  });
  it('levels 21-40 are capped at 48 pours and 41-100 at 58 (D108)', () => {
    expect([20, 21, 40, 41, 99, 101].map((l) => maxPoursFor(l, cfg))).toEqual([45, 48, 48, 58, 58, 70]);
  });
});

describe('tall-jar levels stay near their neighbours (D111)', () => {
  it('a tall-jar level is capped at challenge.maxPours, below its band', () => {
    expect(cfg.challenge.maxPours).toBe(50);
    expect([10, 40, 60, 100, 120, 500].map((l) => maxPoursFor(l, cfg))).toEqual([45, 48, 50, 50, 50, 50]);
    expect([59, 61, 101].map((l) => maxPoursFor(l, cfg))).toEqual([58, 58, 70]);
  });
  it('the daily (level 0) and the weekly band levels keep their caps', () => {
    expect([0, 1, 41, 101].map((l) => maxPoursFor(l, cfg))).toEqual([70, 45, 58, 70]);
  });
  it('no tall-jar level from 10 to 300 needs more than 50 pours, and the cap costs none of them a special jar', () => {
    const uncapped = { ...cfg, challenge: { ...cfg.challenge, maxPours: undefined } };
    for (let l = 10; l <= 300; l += 10) {
      const g = generateLevel(l, cfg);
      expect(g.solutionLength, `level ${l}`).toBeLessThanOrEqual(50);
      expect(specMechanics(g.spec), `level ${l}`).toEqual(specMechanics(generateLevel(l, uncapped).spec));
    }
  }, 60_000);
});

describe('breather levels (D106)', () => {
  const br = cfg.breather!;
  it('from level 21, every level ending in 3 or 8 is a breather', () => {
    expect(br).toMatchObject({ from: 21, every: 5, offset: 3, fewerColors: 2, late: { from: 101, fewerColors: 3 }, maxMechanics: 1 });
    expect([13, 18, 21, 22, 24, 25, 30].map((l) => isBreather(l, cfg))).toEqual([false, false, false, false, false, false, false]);
    expect([23, 28, 33, 98, 203].map((l) => isBreather(l, cfg))).toEqual([true, true, true, true, true]);
  });
  it('a breather has two fewer colours than its neighbour and both ordinary spare jars', () => {
    for (let l = br.from; l <= 400; l++) {
      if (!isBreather(l, cfg)) continue;
      const s = levelSpec(l, cfg);
      expect(s.colors, `level ${l}`).toBe(colors(l - 1) - (l >= br.late!.from ? br.late!.fewerColors : br.fewerColors));
      expect(s.spare, `level ${l}`).toBe(2);
      expect(s.challenge).toBe(false);
    }
  });
  it('a breather never has more than one special jar, even where combos are rolled (D110)', () => {
    let rolledTwo = 0;
    for (let l = 101; l <= 600; l++) {
      if (!isBreather(l, cfg)) continue;
      expect(specMechanics(levelSpec(l, cfg)).length, `level ${l}`).toBeLessThanOrEqual(1);
      if (specMechanics(levelSpec(l, { ...cfg, breather: { ...br, maxMechanics: undefined } })).length > 1) rolledTwo++;
    }
    expect(rolledTwo, 'the cap is doing something').toBeGreaterThan(0);
  });
  it('late breathers stay clearly shorter than the levels around them (levels 101-200, D110)', () => {
    const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const easy: number[] = [];
    const rest: number[] = [];
    for (let l = 101; l <= 200; l++) {
      if (levelSpec(l, cfg).challenge) continue;
      (isBreather(l, cfg) ? easy : rest).push(generateLevel(l, cfg).solutionLength);
    }
    expect(median(easy)).toBeLessThan(median(rest) - 5);
  }, 60_000);
  it('never lands on a tall-jar level, a shell milestone or a mechanic debut', () => {
    for (let l = 1; l <= 400; l++) {
      if (!isBreather(l, cfg)) continue;
      expect(l % cfg.challenge.every, `level ${l}`).not.toBe(0);
      expect(l % 5).not.toBe(0);
      expect(cfg.mechanics.list.some((m) => m.unlockAt === l)).toBe(false);
    }
  });
  it('without a breather block no level is a breather', () => {
    const none = { ...cfg, breather: undefined };
    expect(isBreather(23, none)).toBe(false);
    expect(levelSpec(23, none).colors).toBe(colors(22));
  });
  it('breathers are shorter than the levels around them (levels 21-100)', () => {
    const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const easy: number[] = [];
    const rest: number[] = [];
    for (let l = 21; l <= 100; l++) {
      if (levelSpec(l, cfg).challenge) continue;
      (isBreather(l, cfg) ? easy : rest).push(generateLevel(l, cfg).solutionLength);
    }
    expect(median(easy)).toBeLessThan(median(rest) - 5);
  });
});
