// Stories: production/sprints/sprint-3.md T2, T9, T10 — split from placement.test.ts (the D1 ramp, spare-jar swap and debut blocks)
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type Board } from '../../../src/core/board';
import { type DailyConfig } from '../../../src/core/daily';
import { generateLevel } from '../../../src/core/generator';
import { solve } from '../../../src/core/solver';
import { type GameConfig, isBreather, isClassicMechanic, levelSpec } from '../../../src/core/levels';

const cfg = config as unknown as GameConfig & DailyConfig;
const has = (b: Board, id: string) =>
  id === 'narrow' ? b.jars.some((j) => j.cap !== undefined) : id === 'frozen' ? b.jars.some((j) => j.frozen) : id === 'locked' ? b.jars.some((j) => j.lock !== undefined) : b.jars.some((j) => j.funnel);

describe('difficulty ramp past level 45 (D1)', () => {
  // Ordinary levels: no tall jars and no breathers, which never get the spare-jar swap (D106).
  const normal = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((l) => !isBreather(l, cfg)).map((l) => levelSpec(l, cfg)).filter((x) => !x.challenge);
  it('breather levels always have 2 spare jars (D106)', () => {
    for (let l = 60; l <= 400; l++) if (isBreather(l, cfg)) expect(levelSpec(l, cfg).spare, `level ${l}`).toBe(2);
  });
  it('levels before 60 always have 2 spare jars', () => {
    for (const s of normal(1, 59)) expect(s.spare).toBe(2);
  });
  it('from level 60 some levels have 1 spare jar, rising toward three quarters by 150', () => {
    const early = normal(60, 90).filter((s) => s.spare === 1).length / normal(60, 90).length;
    const late = normal(150, 400).filter((s) => s.spare === 1).length / normal(150, 400).length;
    expect(early).toBeGreaterThan(0.05);
    expect(early).toBeLessThan(0.5);
    expect(late).toBeGreaterThan(0.6);
    expect(late).toBeLessThan(0.9);
  });
  it('tall-jar levels keep 2 spare jars', () => {
    for (let l = 60; l <= 400; l += 10) expect(levelSpec(l, cfg).spare).toBe(2);
  });
  it('buried sand goes to 3 layers from level 110 (75 before the gentler curve, D107)', () => {
    expect(levelSpec(109, cfg).buriedDepth).toBe(2);
    expect(levelSpec(111, cfg).buriedDepth).toBe(3);
  });
  it('colours rise to 13 at level 130 and 14 at level 170 (D105), using new palette colours', () => {
    expect(levelSpec(129, cfg).colors).toBe(12);
    expect(levelSpec(131, cfg).colors).toBe(13);
    expect(levelSpec(171, cfg).colors).toBe(14);
    expect(cfg.palette.length).toBeGreaterThanOrEqual(14);
    expect(new Set(cfg.palette.map((p) => p.hex.toLowerCase())).size).toBe(cfg.palette.length);
  });
  it('difficulty keeps changing past level 45', () => {
    const score = (s: ReturnType<typeof levelSpec>) => s.colors + s.buriedDepth + (2 - s.spare) * 3 + s.mechanics.length;
    const avg = (xs: ReturnType<typeof levelSpec>[]) => xs.reduce((n, s) => n + score(s), 0) / xs.length;
    expect(avg(normal(150, 250))).toBeGreaterThan(avg(normal(46, 58)) + 2);
  });
  it('a level that drops to 1 spare jar still generates (falling back to 2 if no 1-spare deal is proven)', () => {
    for (let l = 60; l <= 200; l++) {
      const g = generateLevel(l, cfg);
      expect([1, 2], `level ${l}`).toContain(g.spec.spare);
      expect(g.board.jars.filter((j) => j.units.length === 0 && j.cap === undefined && !j.funnel).length, `level ${l}`).toBe(g.spec.spare);
    }
  }, 60_000);
});

describe('spare-jar swap and generation fallback (D1 revised, sweep regressions)', () => {
  it('a 1-spare level swaps its missing spare for a narrow jar (or a funnel from level 81)', () => {
    for (let l = 60; l <= 300; l++) {
      const s = levelSpec(l, cfg);
      if (s.spare !== 1) continue;
      expect(s.mechanics.some((m) => m === 'narrow' || m === 'funnel'), `level ${l}`).toBe(true);
      if (l < 81) expect(s.mechanics, `level ${l}`).not.toContain('funnel');
    }
  });
  it('most ordinary levels from 150 really play with one ordinary spare jar', () => {
    let n = 0;
    let one = 0;
    for (let l = 150; l <= 260; l++) {
      if (levelSpec(l, cfg).challenge || isBreather(l, cfg)) continue;
      n++;
      const g = generateLevel(l, cfg);
      const ordinarySpares = g.board.jars.filter((j) => j.units.length === 0 && j.cap === undefined && !j.funnel).length;
      if (ordinarySpares === 1) one++;
    }
    expect(one / n).toBeGreaterThan(0.6);
  }, 60_000);
  it('tall-jar levels 460 and 470 generate (they threw "No solvable board" before the fallback)', () => {
    expect(() => generateLevel(460, cfg)).not.toThrow();
    expect(() => generateLevel(470, cfg)).not.toThrow();
  });
});

describe('a debut level shows its new mechanic alone (D28, GA-LG-7)', () => {
  // production/sprints/sprint-7.md B1; design/gdd/jar-mechanics.md. No spare-jar swap on an unlockAt level.
  // Classic mechanics; the hourglass debut (level 101, LevelSpec.hourglass) is pinned in hourglass.test.ts.
  const debuts = cfg.mechanics.list.filter((m) => isClassicMechanic(m.id)).map((m) => ({ id: m.id, level: m.unlockAt }));
  /** The ramp always swaps a spare from level 1, so the old code would swap on every debut level. */
  const alwaysSwap = { ...cfg, ramp: { ...cfg.ramp, spareOne: { ...cfg.ramp.spareOne, from: 1, chanceFrom: 1, chanceTo: 1 } } } as typeof cfg;
  it('with the swap forced on, every debut level keeps 2 spares and only its debut mechanic', () => {
    for (const { id, level } of debuts) {
      const s = levelSpec(level, alwaysSwap);
      expect(s.mechanics, `level ${level}`).toEqual([id]);
      expect(s.spare, `level ${level}`).toBe(2);
    }
  });
  it('with the swap forced on, a non-debut level still swaps (the rule is debut-only)', () => {
    const s = levelSpec(62, alwaysSwap);
    expect(s.spare).toBe(1);
    expect(s.mechanics.some((m) => m === 'narrow' || m === 'funnel')).toBe(true);
  });
  it('the real debut levels from 60 (locked 61, funnel 81) have 2 spares, their mechanic alone, and are solver-proven', () => {
    for (const { id, level } of debuts.filter((d) => d.level >= cfg.ramp.spareOne.from)) {
      const g = generateLevel(level, cfg);
      expect(g.spec.mechanics, `level ${level}`).toEqual([id]);
      expect(g.spec.spare, `level ${level}`).toBe(2);
      expect(has(g.board, id), `level ${level}`).toBe(true);
      expect(g.board.jars.filter((j) => j.units.length === 0 && j.cap === undefined && !j.funnel).length, `level ${level}`).toBe(2);
      expect(solve(g.board, cfg.generator.solverNodeBudget).solvable, `level ${level}`).toBe(true);
    }
  }, 60_000);
});
