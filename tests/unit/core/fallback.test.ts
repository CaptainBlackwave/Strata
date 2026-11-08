// F7, findings GA-LG-3 and GA-DP-1 (production/qa/sprint-6-findings.md): a level or a daily always loads.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type Board, isSealed, isWon, pour } from '../../../src/core/board';
import { type DailyConfig, generateDaily } from '../../../src/core/daily';
import { fallbackBoard, generateLevel } from '../../../src/core/generator';
import { type GameConfig, type LevelSpec, levelSpec } from '../../../src/core/levels';
import { solve } from '../../../src/core/solver';

const cfg = config as unknown as GameConfig & DailyConfig;
/** A config where no random deal can ever be proven, so every step of the fallback chain fails. */
const starved: GameConfig & DailyConfig = {
  ...cfg,
  generator: { ...cfg.generator, maxAttempts: 0 },
  ramp: { ...cfg.ramp, spareOne: { ...cfg.ramp.spareOne, maxAttempts: 0 } },
};
const colorCounts = (b: Board) => {
  const n = new Map<number, number>();
  for (const j of b.jars) for (const u of j.units) n.set(u, (n.get(u) ?? 0) + 1);
  return n;
};
const spec = (colors: number, capacity: number, buriedDepth: number): LevelSpec => ({ level: 0, colors, capacity, spare: 2, buriedDepth, challenge: capacity > 4, mechanics: [] });

describe('fallbackBoard (the guaranteed last step)', () => {
  it('is winnable, unsolved and has nothing sealed, for every colour count and both jar heights', () => {
    for (const capacity of [4, 8]) {
      for (let colors = 2; colors <= cfg.palette.length; colors++) {
        const b = fallbackBoard(spec(colors, capacity, 2), 12345 + colors);
        const label = `${colors} colours, capacity ${capacity}`;
        expect(isWon(b), label).toBe(false);
        expect(b.jars.some((j) => isSealed(j, b.capacity)), label).toBe(false);
        expect(b.jars, label).toHaveLength(colors + 2);
        expect([...colorCounts(b).values()].every((n) => n === capacity), label).toBe(true);
        expect(solve(b, 100_000).solvable, label).toBe(true);
      }
    }
  });
  it('is the same board for the same seed, and buries units as the spec asks (top always visible)', () => {
    const s = spec(9, 4, 2);
    expect(fallbackBoard(s, 7)).toEqual(fallbackBoard(s, 7));
    expect(fallbackBoard(s, 7)).not.toEqual(fallbackBoard(s, 8));
    for (const j of fallbackBoard(s, 7).jars) expect(j.hidden).toBe(j.units.length ? Math.min(2, j.units.length - 1) : 0);
  });
});

describe('generateLevel never throws (GA-LG-3)', () => {
  it('falls back to a winnable board when every solver-proven step fails', () => {
    for (const level of [1, 21, 41, 61, 81, 100, 152, 460]) {
      const g = generateLevel(level, starved);
      expect(isWon(g.board), `level ${level}`).toBe(false);
      expect(g.spec.mechanics, `level ${level}`).toEqual([]);
      expect(g.spec.colors, `level ${level}`).toBe(levelSpec(level, cfg).colors);
      expect(solve(g.board, 100_000).solvable, `level ${level}`).toBe(true);
      expect(generateLevel(level, starved).board, `level ${level}`).toEqual(g.board);
    }
  });
  it('the reported solution length of the fallback is a real solution length', () => {
    const g = generateLevel(152, starved);
    const r = solve(g.board, 100_000);
    let b = g.board;
    for (const m of r.path) b = pour(b, m.from, m.to).board;
    expect(isWon(b)).toBe(true);
    expect(g.solutionLength).toBeGreaterThan(0);
  });
});

describe('generateDaily never throws (GA-DP-1)', () => {
  it('falls back to a winnable board, keeping the day name and date, when every step fails', () => {
    for (const date of ['2027-01-03', '2027-01-04', '2027-01-09', '2027-06-12']) {
      const g = generateDaily(date, starved);
      expect(g.spec.date).toBe(date);
      expect(g.spec.name).toBe(generateDaily(date, cfg).spec.name);
      expect(g.spec.mechanics).toEqual([]);
      expect(isWon(g.board), date).toBe(false);
      expect(solve(g.board, 100_000).solvable, date).toBe(true);
    }
  });
});
