// Story: production/epics/strata/story-001-pour-rules.md
import { describe, expect, it } from 'vitest';
import {
  addEmptyJar,
  boardKey,
  canPour,
  isSealed,
  isStuck,
  isWon,
  makeBoard,
  pour,
  pourAmount,
  topRun,
  usefulMoves,
} from '../../../src/core/board';

describe('topRun', () => {
  it('empty jar has no run', () => {
    expect(topRun({ units: [], hidden: 0 })).toBeNull();
  });
  it('counts the contiguous top colour only', () => {
    expect(topRun({ units: [1, 0, 0, 0], hidden: 0 })).toEqual({ color: 0, count: 3 });
    expect(topRun({ units: [0, 1], hidden: 0 })).toEqual({ color: 1, count: 1 });
  });
});

describe('canPour / pourAmount', () => {
  const b = makeBoard(4, [[0, 1], [2, 1], [], [3, 3, 3, 3], [0]]);
  it('allows pouring onto a matching top', () => {
    expect(canPour(b, 0, 1)).toBe(true);
    expect(pourAmount(b, 0, 1)).toBe(1);
  });
  it('allows pouring into an empty jar', () => {
    expect(canPour(b, 0, 2)).toBe(true);
  });
  it('rejects a mismatched top', () => {
    expect(canPour(b, 0, 4)).toBe(false);
  });
  it('rejects a full target', () => {
    expect(canPour(b, 4, 3)).toBe(false);
  });
  it('rejects an empty source and self-pours', () => {
    expect(canPour(b, 2, 0)).toBe(false);
    expect(canPour(b, 0, 0)).toBe(false);
  });
  it('rejects out-of-range indices', () => {
    expect(canPour(b, 0, 99)).toBe(false);
  });
  it('moves min(run, free space) units', () => {
    const c = makeBoard(4, [[2, 0, 0, 0], [1, 1, 0]]);
    expect(pourAmount(c, 0, 1)).toBe(1);
    const r = pour(c, 0, 1);
    expect(r.board.jars[0].units).toEqual([2, 0, 0]);
    expect(r.board.jars[1].units).toEqual([1, 1, 0, 0]);
  });
});

describe('pour', () => {
  it('moves the whole run when it fits and does not mutate the input', () => {
    const b = makeBoard(4, [[1, 0, 0], []]);
    const r = pour(b, 0, 1);
    expect(r.moved).toBe(2);
    expect(r.color).toBe(0);
    expect(r.board.jars[0].units).toEqual([1]);
    expect(r.board.jars[1].units).toEqual([0, 0]);
    expect(b.jars[0].units).toEqual([1, 0, 0]);
  });
  it('throws on an illegal pour', () => {
    const b = makeBoard(4, [[1], [0]]);
    expect(() => pour(b, 0, 1)).toThrow();
  });
  it('reveals a buried unit once it becomes the top', () => {
    const b = makeBoard(4, [[2, 1, 0, 0], []], [3]);
    expect(b.jars[0].hidden).toBe(3);
    const r = pour(b, 0, 1);
    expect(r.board.jars[0].units).toEqual([2, 1]);
    expect(r.board.jars[0].hidden).toBe(1);
  });
});

describe('win and stuck', () => {
  it('won when every jar is empty or sealed', () => {
    expect(isWon(makeBoard(4, [[0, 0, 0, 0], [], [1, 1, 1, 1]]))).toBe(true);
  });
  it('not won with a partial single-colour jar', () => {
    expect(isWon(makeBoard(4, [[0, 0, 0], [0], [1, 1, 1, 1]]))).toBe(false);
  });
  it('isSealed requires full and single colour', () => {
    expect(isSealed({ units: [0, 0, 0, 0], hidden: 0 }, 4)).toBe(true);
    expect(isSealed({ units: [0, 0, 0], hidden: 0 }, 4)).toBe(false);
    expect(isSealed({ units: [0, 0, 1, 0], hidden: 0 }, 4)).toBe(false);
  });
  it('stuck when no useful pour exists', () => {
    const b = makeBoard(2, [[0, 1], [1, 0]]);
    expect(isStuck(b)).toBe(true);
  });
  it('moving a monochrome jar into an empty jar is not useful', () => {
    const b = makeBoard(4, [[0, 0], []]);
    expect(usefulMoves(b)).toEqual([]);
    expect(isStuck(b)).toBe(true);
  });
  it('not stuck when a useful pour exists', () => {
    expect(isStuck(makeBoard(4, [[0, 1], [1], []]))).toBe(false);
  });
});

describe('boardKey and addEmptyJar', () => {
  it('is independent of jar order', () => {
    expect(boardKey(makeBoard(4, [[0, 1], [1]]))).toBe(boardKey(makeBoard(4, [[1], [0, 1]])));
  });
  it('adds an empty jar', () => {
    const b = addEmptyJar(makeBoard(4, [[0]]));
    expect(b.jars).toHaveLength(2);
    expect(b.jars[1].units).toEqual([]);
  });
});
