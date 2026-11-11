// Story: production/sprints/sprint-7.md B7 (owner decision D36): the length cap at generation.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type DailyConfig, dailySeed, dailySpec, generateDaily } from '../../../src/core/daily';
import { NoDealError, generateFromSpec, generateLevel, lastResort, maxPoursFor } from '../../../src/core/generator';
import { type GameConfig, levelSpec } from '../../../src/core/levels';
import { solve } from '../../../src/core/solver';

const cfg = config as unknown as GameConfig & DailyConfig;
/** A cap no proven deal can meet, so every attempt of every step is over it. */
const impossible: GameConfig & DailyConfig = { ...cfg, generator: { ...cfg.generator, pourBands: [{ from: 1, median: 1, max: 1 }] } };

describe('maxPoursFor', () => {
  it('returns the max of the band a level falls in', () => {
    const bands = cfg.generator.pourBands ?? [];
    const [a, b, c] = bands;
    expect(maxPoursFor(a.from, cfg)).toBe(a.max);
    expect(maxPoursFor(b.from - 1, cfg)).toBe(a.max);
    expect(maxPoursFor(b.from, cfg)).toBe(b.max);
    expect(maxPoursFor(c.from, cfg)).toBe(c.max);
    expect(maxPoursFor(10_001, cfg)).toBe(bands[bands.length - 1].max); // not a tall-jar level (D111)
  });
  it('gives the daily (level 0, below every band) the last band max', () => {
    const bands = cfg.generator.pourBands ?? [];
    expect(maxPoursFor(0, cfg)).toBe(bands[bands.length - 1].max);
  });
  it('is unlimited when no bands are configured', () => {
    expect(maxPoursFor(153, { ...cfg, generator: { ...cfg.generator, pourBands: undefined } })).toBe(Infinity);
  });
});

describe('length cap at generation', () => {
  it('re-deals the levels whose first proven deal was over the cap (93, 153, 161, 177 in the B2 sweep)', () => {
    for (const level of [93, 153, 161, 177]) {
      const g = generateLevel(level, cfg);
      expect(g.solutionLength, `level ${level}`).toBeLessThanOrEqual(maxPoursFor(level, cfg));
      expect(solve(g.board, cfg.generator.solverNodeBudget).solvable, `level ${level}`).toBe(true);
    }
  });
  it('re-deals a daily whose first proven deal was over the cap (2026-09-26 was 71 pours)', () => {
    const g = generateDaily('2026-09-26', cfg);
    expect(g.solutionLength).toBeLessThanOrEqual(maxPoursFor(0, cfg));
    expect(solve(g.board, cfg.generator.solverNodeBudget).solvable).toBe(true);
  });
  it('generateFromSpec throws a NoDealError carrying the shortest proven deal when every deal is over the cap', () => {
    const spec = levelSpec(5, cfg);
    const uncapped = generateFromSpec(spec, 1234, cfg);
    let caught: unknown;
    try {
      generateFromSpec(spec, 1234, impossible);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(NoDealError);
    const shortest = (caught as NoDealError).shortest;
    expect(shortest).toBeDefined();
    expect(shortest!.solutionLength).toBeLessThanOrEqual(uncapped.solutionLength);
    expect(solve(shortest!.board, cfg.generator.solverNodeBudget).solvable).toBe(true);
  });
  it('generateLevel keeps the shortest proven deal, not the unproven fallback board, when every attempt of every step is over the cap', () => {
    const g = generateLevel(5, impossible);
    expect(g.attempts).toBeGreaterThan(0); // fallbackBoard reports 0 attempts
    expect(g.solutionLength).toBeLessThanOrEqual(generateLevel(5, cfg).solutionLength);
    expect(solve(g.board, cfg.generator.solverNodeBudget).solvable).toBe(true);
  });
  it('generateDaily keeps a proven deal when every deal is over the cap', () => {
    const g = generateDaily('2026-11-08', impossible);
    expect(g.attempts).toBeGreaterThan(0);
    expect(solve(g.board, cfg.generator.solverNodeBudget).solvable).toBe(true);
  });
  it('the capped board is the same on every call', () => {
    expect(generateLevel(153, cfg).board).toEqual(generateLevel(153, cfg).board);
  });
});

describe('the daily keeps the shortest deal from every step (D36)', () => {
  // With a cap nothing can meet, every step throws its shortest over-cap deal; the daily must
  // return the shortest of all of them, not just the last resort's own.
  const shortestOf = (fn: () => unknown): number => {
    try {
      fn();
    } catch (e) {
      if (e instanceof NoDealError && e.shortest) return e.shortest.solutionLength;
    }
    return Infinity;
  };
  it('returns the shortest proven deal across all its steps when the cap is impossible', () => {
    const g = impossible.generator;
    const cap = g.stepNodeBudget ?? g.solverNodeBudget;
    const per = g.stepAttemptNodeBudget ?? g.solverNodeBudget;
    for (let day = 1; day <= 14; day++) {
      const key = `2026-11-${String(day).padStart(2, '0')}`;
      const spec = dailySpec(key, impossible);
      const seed = dailySeed(key, impossible);
      const step1 = shortestOf(() => generateFromSpec(spec, seed, impossible));
      const step2 = spec.mechanics.length ? shortestOf(() => generateFromSpec({ ...spec, mechanics: [] }, seed, impossible, g.maxAttempts, cap, per)) : Infinity;
      const last = lastResort(spec, seed, impossible).solutionLength;
      expect(generateDaily(key, impossible).solutionLength, key).toBe(Math.min(step1, step2, last));
    }
  });
});
