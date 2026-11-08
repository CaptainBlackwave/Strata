// Stories: production/epics/strata/story-002-solvable-generator.md, story-003-difficulty-curve.md
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { isSealed, isWon, pour } from '../../../src/core/board';
import { dealBoard, generateLevel } from '../../../src/core/generator';
import { type GameConfig, levelSpec } from '../../../src/core/levels';
import { solve } from '../../../src/core/solver';
import { makeBoard } from '../../../src/core/board';

const cfg = config as unknown as GameConfig;

describe('levelSpec', () => {
  it('level 1 is the gentle opener', () => {
    expect(levelSpec(1, cfg)).toMatchObject({ colors: 3, capacity: 4, spare: 2, buriedDepth: 0, challenge: false });
  });
  it('inherits omitted fields from earlier rows', () => {
    expect(levelSpec(4, cfg)).toMatchObject({ colors: 4, capacity: 4, spare: 2 });
  });
  it('introduces buried sand at level 8', () => {
    expect(levelSpec(7, cfg).buriedDepth).toBe(0);
    expect(levelSpec(8, cfg).buriedDepth).toBe(1);
  });
  it('every 10th level is a tall-jar challenge', () => {
    expect(levelSpec(10, cfg)).toMatchObject({ challenge: true, capacity: 8 });
    expect(levelSpec(11, cfg).challenge).toBe(false);
  });
  it('clamps colours to the palette size', () => {
    expect(levelSpec(999, cfg).colors).toBeLessThanOrEqual(cfg.palette.length);
  });
  it('rejects non-positive levels', () => {
    expect(() => levelSpec(0, cfg)).toThrow(RangeError);
  });
  it('colour count never decreases across normal levels', () => {
    let prev = 0;
    for (let l = 1; l <= 60; l++) {
      const s = levelSpec(l, cfg);
      if (s.challenge) continue;
      expect(s.colors).toBeGreaterThanOrEqual(prev);
      prev = s.colors;
    }
  });
});

describe('dealBoard', () => {
  it('deals exactly capacity units of each colour plus spare empties', () => {
    const spec = levelSpec(5, cfg);
    const b = dealBoard(spec, 123);
    expect(b.jars).toHaveLength(spec.colors + spec.spare);
    const counts = new Map<number, number>();
    for (const j of b.jars) for (const u of j.units) counts.set(u, (counts.get(u) ?? 0) + 1);
    expect(counts.size).toBe(spec.colors);
    for (const n of counts.values()) expect(n).toBe(spec.capacity);
  });
  it('is deterministic for a seed', () => {
    const spec = levelSpec(5, cfg);
    expect(dealBoard(spec, 7)).toEqual(dealBoard(spec, 7));
  });
  it('keeps every jar top visible when burying', () => {
    const b = dealBoard(levelSpec(25, cfg), 99);
    for (const j of b.jars) if (j.units.length) expect(j.hidden).toBeLessThan(j.units.length);
  });
});

describe('solve', () => {
  it('solves a trivial board and its path really wins', () => {
    const b = makeBoard(2, [[0, 1], [1, 0], []]);
    const r = solve(b, 10_000);
    expect(r.solvable).toBe(true);
    let cur = b;
    for (const m of r.path) cur = pour(cur, m.from, m.to).board;
    expect(isWon(cur)).toBe(true);
  });
  it('proves a dead board unsolvable', () => {
    expect(solve(makeBoard(2, [[0, 1], [1, 0]]), 10_000).solvable).toBe(false);
  });
  it('reports budget exhaustion as null rather than false', () => {
    const b = dealBoard(levelSpec(45, cfg), 1);
    expect(solve(b, 1).solvable).toBeNull();
  });
});

describe('generateLevel', () => {
  it('levels 1-40 are all solver-proven solvable, with no jar sealed at the start', () => {
    for (let l = 1; l <= 40; l++) {
      const g = generateLevel(l, cfg);
      expect(g.board.jars.some((j) => isSealed(j, g.board.capacity))).toBe(false);
      const replay = solve(g.board, cfg.generator.solverNodeBudget);
      expect(replay.solvable, `level ${l}`).toBe(true);
      let cur = g.board;
      for (const m of replay.path) cur = pour(cur, m.from, m.to).board;
      expect(isWon(cur)).toBe(true);
    }
  });
  it('is deterministic per level', () => {
    expect(generateLevel(12, cfg).board).toEqual(generateLevel(12, cfg).board);
  });
  it('different levels give different boards', () => {
    expect(generateLevel(3, cfg).board).not.toEqual(generateLevel(4, cfg).board);
  });
});

describe('tutorial board', () => {
  // Story: production/epics/competitive/story-003-tutorial.md
  it('is a one-pour win built from config', async () => {
    const { tutorialBoard } = await import('../../../src/core/generator');
    const b = tutorialBoard(cfg);
    const r = solve(b, 1000);
    expect(r.solvable).toBe(true);
    expect(r.path).toHaveLength(1);
  });
});
