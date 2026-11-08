// Stories: production/sprints/sprint-3.md T1, T3-T6
import { describe, expect, it } from 'vitest';
import { type Board, type Jar, boardKey, canPour, isSealed, isStuck, isWon, jarCapacity, makeBoard, pour, pourAmount } from '../../../src/core/board';
import { solve } from '../../../src/core/solver';

/** Builds a board and applies jar states by index. */
function withJars(capacity: number, jars: number[][], states: Record<number, Partial<Jar>>): Board {
  const b = makeBoard(capacity, jars);
  return { capacity, jars: b.jars.map((j, i) => ({ ...j, ...(states[i] ?? {}) })) };
}

describe('narrow jar (cap 2)', () => {
  const b = withJars(4, [[0, 1, 1], [0, 0, 0], []], { 2: { cap: 2 } });
  it('holds only its own capacity', () => {
    expect(jarCapacity(b, 2)).toBe(2);
    expect(pourAmount(b, 0, 2)).toBe(2);
    const r = pour(b, 0, 2).board;
    expect(r.jars[2].units).toEqual([1, 1]);
    expect(canPour(r, 1, 2)).toBe(false);
  });
  it('never counts as sealed, so it must end empty', () => {
    const full = withJars(4, [[1, 1]], { 0: { cap: 2 } });
    expect(isSealed(full.jars[0], full.capacity)).toBe(false);
    expect(isWon(full)).toBe(false);
  });
});

describe('frozen jar', () => {
  const b = withJars(4, [[1, 0, 0, 0], [0], [1, 1, 1], []], { 0: { frozen: true } });
  it('refuses pours in and out', () => {
    expect(canPour(b, 0, 3)).toBe(false);
    expect(canPour(b, 1, 0)).toBe(false);
  });
  it('stays frozen while nothing seals', () => {
    const r = pour(b, 1, 3).board; // jar 3 = [0], no seal
    expect(r.jars[0].frozen).toBe(true);
  });
  it('thaws (all frozen jars) the moment any jar seals', () => {
    const two = withJars(4, [[1, 0, 0, 0], [1], [1, 1, 1], [], [2, 2]], { 0: { frozen: true }, 4: { frozen: true } });
    const done = pour(two, 1, 2).board; // jar 2 becomes [1,1,1,1]
    expect(isSealed(done.jars[2], 4)).toBe(true);
    expect(done.jars[0].frozen).toBeFalsy();
    expect(done.jars[4].frozen).toBeFalsy();
  });
});

describe('locked lid', () => {
  const b = withJars(4, [[2, 2], [1, 1, 1], [1], []], { 0: { lock: 1 } });
  it('is closed until a jar of its colour seals', () => {
    expect(canPour(b, 0, 3)).toBe(false);
    expect(canPour(b, 3, 0)).toBe(false);
    const r = pour(b, 2, 1).board; // seals colour 1
    expect(r.jars[0].lock).toBeUndefined();
    expect(canPour(r, 0, 3)).toBe(true);
  });
  it('a seal of another colour leaves it locked', () => {
    const c = withJars(4, [[2], [0, 0, 0], [0], []], { 0: { lock: 1 } });
    expect(pour(c, 2, 1).board.jars[0].lock).toBe(1);
  });
});

describe('one-way funnel', () => {
  const b = withJars(4, [[0, 0], [1, 0], []], { 2: { funnel: true } });
  it('accepts pours but can never be poured from', () => {
    expect(canPour(b, 1, 2)).toBe(true);
    const r = pour(b, 1, 2).board;
    expect(canPour(r, 2, 0)).toBe(false);
  });
  it('seals normally when full of one colour', () => {
    const f = withJars(4, [[0, 0, 0, 0]], { 0: { funnel: true } });
    expect(isSealed(f.jars[0], 4)).toBe(true);
  });
  it('a mixed funnel with nothing else to do is stuck', () => {
    const dead = withJars(2, [[0, 1]], { 0: { funnel: true } });
    expect(isStuck(dead)).toBe(true);
  });
});

describe('solver and keys with jar states', () => {
  it('jar state is part of the board key', () => {
    const plain = makeBoard(4, [[0], []]);
    const frozen = withJars(4, [[0], []], { 0: { frozen: true } });
    expect(boardKey(plain)).not.toBe(boardKey(frozen));
  });
  it('solves a board that needs a seal to open a lock', () => {
    const b = withJars(4, [[0, 1, 1, 1], [1], [0, 0, 0], []], { 2: { lock: 1 } });
    const r = solve(b, 20_000);
    expect(r.solvable).toBe(true);
    let cur = b;
    for (const m of r.path) cur = pour(cur, m.from, m.to).board;
    expect(isWon(cur)).toBe(true);
  });
  it('proves a deadlocked lock unsolvable (its key colour is trapped inside)', () => {
    const b = withJars(4, [[1, 0, 0, 0], [1, 1, 1], []], { 0: { lock: 1 } });
    expect(solve(b, 20_000).solvable).toBe(false);
  });
});
