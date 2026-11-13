// Story: production/sprints/sprint-28.md S1, S2 (the sieve is a goal, D214, D215). Design: design/gdd/jar-mechanics.md §2.5
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type Board, type Jar, isSealed, isSieveDone, isStuck, isWon, lostReason, makeBoard, pour, sieveLostColor } from '../../../src/core/board';
import { type DailyConfig, generateDaily } from '../../../src/core/daily';
import { generateLevel } from '../../../src/core/generator';
import { type GameConfig } from '../../../src/core/levels';
import { solve } from '../../../src/core/solver';

const cfg = config as unknown as GameConfig;

/** A board whose jar `at` is a sieve banded in `color`. */
function withSieve(capacity: number, jars: number[][], at: number, color: number, extra: Partial<Jar>[] = []): Board {
  const b = makeBoard(capacity, jars);
  return { capacity, jars: b.jars.map((j, i): Jar => ({ ...j, ...(extra[i] ?? {}), ...(i === at ? { sieve: color } : {}) })) };
}

/** Level 145's jars, re-filled as a sorted end state: `sieveFilled` puts the band in the sieve, else the band goes in a plain jar. */
function level145End(sieveFilled: boolean): Board {
  const start = generateLevel(145, cfg).board;
  const at = start.jars.findIndex((j) => j.sieve !== undefined);
  const band = start.jars[at].sieve!;
  const colors = [...new Set(start.jars.flatMap((j) => j.units))].sort((a, b) => a - b);
  const rest = colors.filter((c) => sieveFilled ? c !== band : true);
  let k = 0;
  const jars = start.jars.map((j, i): Jar => {
    const { hidden: _h, ...jar } = j;
    if (i === at) return { ...jar, hidden: 0, units: sieveFilled ? new Array<number>(start.capacity).fill(band) : [] };
    const c = rest[k++];
    return { ...jar, hidden: 0, units: c === undefined ? [] : new Array<number>(start.capacity).fill(c) };
  });
  return { capacity: start.capacity, jars };
}

describe('the sieve is a goal (S1, D214)', () => {
  it('level 145 has a sieve', () => {
    expect(generateLevel(145, cfg).board.jars.some((j) => j.sieve !== undefined)).toBe(true);
  });

  it('the level-145 end state from the player video (sieve empty, everything else sorted) is not won', () => {
    const b = level145End(false);
    expect(b.jars.every((j) => j.units.length === 0 || isSealed(j, b.capacity))).toBe(true);
    expect(isWon(b)).toBe(false);
    expect(isStuck(b)).toBe(true);
    expect(lostReason(b)).toBe('sieve');
  });

  it('the same board with the sieve sealed in its band is won', () => {
    const b = level145End(true);
    expect(isWon(b)).toBe(true);
    expect(lostReason(b)).toBeNull();
  });

  it('an empty sieve is not done; a sieve complete in its band is, wet or dry', () => {
    expect(isSieveDone({ units: [], hidden: 0, sieve: 1 }, 2)).toBe(false);
    expect(isSieveDone({ units: [1, 1], hidden: 0, sieve: 1 }, 2)).toBe(true);
    expect(isSieveDone({ units: [1, 1], hidden: 0, sieve: 1, wet: [0, 2] }, 2)).toBe(true);
    expect(isSieveDone({ units: [1, 1], hidden: 0 }, 2)).toBe(false);
  });

  it('a board without a sieve wins exactly as before (every jar empty or complete)', () => {
    expect(isWon(makeBoard(2, [[0, 0], [], [1, 1]]))).toBe(true);
    expect(isWon(makeBoard(2, [[0, 1], [1, 0], []]))).toBe(false);
  });

  it('the solver seals the sieve: a band that can only end empty is unwinnable', () => {
    // Pink (1) can be sorted in jar 2, but the sieve [0, 1] can never take it: its 0 has no room to go.
    const b = withSieve(2, [[0, 1], [1, 0], []], 0, 1);
    expect(solve(b, 50_000).solvable).toBe(false);
    const ok = withSieve(2, [[0, 1], [1, 0], []], 0, 0);
    const r = solve(ok, 50_000);
    expect(r.solvable).toBe(true);
    let s = ok;
    for (const m of r.path) s = pour(s, m.from, m.to).board;
    expect(isSealed(s.jars[0], 2)).toBe(true);
  });

  it('levels 141-1000: every sieve level is built with its sieve and its proof ends with the sieve sealed', async () => {
    let count = 0;
    for (let l = 141; l <= 1000; l++) {
      // Yield between levels: a synchronous minutes-long loop starves Vitest's worker RPC
      // ("Timeout calling onTaskUpdate"), as in placement-ramp.test.ts.
      await new Promise((r) => setTimeout(r, 0));
      const g = generateLevel(l, cfg);
      const at = g.board.jars.findIndex((j) => j.sieve !== undefined);
      if (at < 0) continue;
      count++;
      const r = solve(g.board, cfg.generator.solverNodeBudget);
      expect(r.solvable, `level ${l}`).toBe(true);
      let b = g.board;
      for (const m of r.path) b = pour(b, m.from, m.to).board;
      expect(isWon(b), `level ${l}`).toBe(true);
      expect(isSealed(b.jars[at], b.capacity), `level ${l}`).toBe(true);
    }
    expect(count).toBeGreaterThan(30);
  }, 600_000);
});

describe('dailies with a sieve follow the goal (S4)', () => {
  // The first sieve daily (2026-12-05) and one whose board changed with the goal (2027-05-01).
  for (const day of ['2026-12-05', '2027-05-01']) {
    it(`the ${day} daily has a sieve and plays to a win with it sealed`, () => {
      const g = generateDaily(day, cfg as GameConfig & DailyConfig);
      const at = g.board.jars.findIndex((j) => j.sieve !== undefined);
      expect(at).toBeGreaterThanOrEqual(0);
      const r = solve(g.board, cfg.generator.solverNodeBudget);
      expect(r.solvable).toBe(true);
      let b = g.board;
      for (const m of r.path) b = pour(b, m.from, m.to).board;
      expect(isWon(b)).toBe(true);
      expect(isSealed(b.jars[at], b.capacity)).toBe(true);
    });
  }
});

describe('sealed outside its sieve is a dead end (S2, D215)', () => {
  // Capacity 2. Jar 0 is a sieve banded pink (1).
  it('pink sealed in a plain jar while the sieve is open: lost, reason "sieve"', () => {
    const b = withSieve(2, [[0], [1, 1], [0], []], 0, 1);
    expect(lostReason(b)).toBe('sieve');
    expect(sieveLostColor(b)).toBe(1);
  });

  it('pink still open (not sealed anywhere): not lost', () => {
    expect(lostReason(withSieve(2, [[0], [1], [0, 1], []], 0, 1))).toBeNull();
    expect(lostReason(withSieve(2, [[], [1], [0, 0], [1]], 0, 1))).toBeNull();
  });

  it('a complete pink jar that is still wet is not sealed yet, so not lost (§2.7)', () => {
    expect(lostReason(withSieve(2, [[], [1, 1], [0, 0], []], 0, 1, [{}, { wet: [1, 0] }]))).toBeNull();
  });

  it('the sieve sealed in pink, or a sieve of another band, is not lost', () => {
    expect(lostReason(withSieve(2, [[1, 1], [0, 0], []], 0, 1))).toBeNull();
    expect(lostReason(withSieve(2, [[], [1, 1], [0], [0]], 0, 0))).toBeNull();
  });

  it('with more pink than one jar holds, one pink jar sealed outside still leaves enough for the sieve', () => {
    // Four pink units: one sealed jar outside, two loose ones can still fill the sieve.
    expect(lostReason(withSieve(2, [[], [1, 1], [1], [1], [0, 0]], 0, 1))).toBeNull();
    // Both pink pairs sealed outside: lost.
    expect(lostReason(withSieve(2, [[], [1, 1], [1, 1], [0, 0]], 0, 1))).toBe('sieve');
  });

  it('never reports a board the solver can win (sound): small sieve boards', () => {
    const boards = [
      withSieve(2, [[0, 1], [1, 0], []], 0, 0),
      withSieve(2, [[], [1, 1], [1], [1], [0, 0]], 0, 1),
      withSieve(3, [[1, 0], [0, 1, 1], [0], []], 0, 1),
    ];
    for (const b of boards) if (solve(b, 50_000).solvable) expect(lostReason(b)).toBeNull();
  });
});
