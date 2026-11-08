// Decision D-c, finding GA-JAR-3 (production/qa/sprint-6-findings.md): say when a board can no longer be won.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type Board, type Jar, lostReason, makeBoard, pour } from '../../../src/core/board';
import { generateLevel } from '../../../src/core/generator';
import type { GameConfig } from '../../../src/core/levels';
import { GameSession } from '../../../src/core/session';
import { solve } from '../../../src/core/solver';

const cfg = config as unknown as GameConfig;
/** Builds a board and applies jar states by index. */
function withJars(capacity: number, jars: number[][], states: Record<number, Partial<Jar>>): Board {
  const b = makeBoard(capacity, jars);
  return { capacity, jars: b.jars.map((j, i) => ({ ...j, ...(states[i] ?? {}) })) };
}
/** A budget big enough to settle these small boards exactly. */
const PROOF = 200_000;

describe('lostReason: funnel', () => {
  it('a funnel holding two colours is lost', () => {
    const b = withJars(4, [[0, 0, 0], [1, 1, 1], [], [0, 1]], { 3: { funnel: true } });
    expect(lostReason(b)).toBe('funnel');
    expect(solve(b, PROOF).solvable).toBe(false);
  });
  it('look-alike: a one-colour funnel that can still fill is not lost, and is winnable', () => {
    const b = withJars(4, [[0, 0, 1], [1, 1, 1], [], [0, 0]], { 3: { funnel: true } });
    expect(lostReason(b)).toBeNull();
    expect(solve(b, PROOF).solvable).toBe(true);
  });
  it('two one-colour funnels sharing a colour that can only fill one of them are lost', () => {
    const b = withJars(4, [[1, 1, 1, 1], [], [0, 0], [0, 0]], { 2: { funnel: true }, 3: { funnel: true } });
    expect(lostReason(b)).toBe('funnel');
    expect(solve(b, PROOF).solvable).toBe(false);
  });
  it('look-alike: one funnel and a normal jar sharing that colour is not lost, and is winnable', () => {
    const b = withJars(4, [[1, 1, 1, 1], [], [0, 0], [0, 0]], { 3: { funnel: true } });
    expect(lostReason(b)).toBeNull();
    expect(solve(b, PROOF).solvable).toBe(true);
  });
});

describe('lostReason: lock', () => {
  it('a lock whose key colour is partly inside the locked jar itself is lost', () => {
    const b = withJars(4, [[1, 0, 0, 0], [1, 1, 1], []], { 0: { lock: 1 } });
    expect(lostReason(b)).toBe('lock');
    expect(solve(b, PROOF).solvable).toBe(false);
  });
  it('look-alike: a lock whose key colour is all reachable is not lost, and is winnable', () => {
    const b = withJars(4, [[0, 1, 1, 1], [1], [0, 0, 0], []], { 2: { lock: 1 } });
    expect(lostReason(b)).toBeNull();
    expect(solve(b, PROOF).solvable).toBe(true);
  });
  it('a lock whose key colour sits in a mixed funnel is lost (reported as the funnel)', () => {
    const b = withJars(4, [[0, 0, 0, 2], [1, 1, 1], [2, 2, 2], [], [2, 1]], { 0: { lock: 1 }, 4: { funnel: true } });
    expect(lostReason(b)).toBe('funnel');
    expect(solve(b, PROOF).solvable).toBe(false);
  });
  it('a lock whose key colour is split between a one-colour funnel and its own jar is lost', () => {
    // The funnel [1,1] could seal colour 1, but the other two 1s are behind the lock that needs that seal.
    const b = withJars(4, [[0, 0, 1, 1], [0, 0], [], [1, 1]], { 0: { lock: 1 }, 3: { funnel: true } });
    expect(lostReason(b)).toBe('lock');
    expect(solve(b, PROOF).solvable).toBe(false);
  });
  it('look-alike: key colour split between a one-colour funnel and a free jar is not lost, and is winnable', () => {
    const b = withJars(4, [[0, 0, 0], [1, 1, 0], [], [1, 1]], { 0: { lock: 1 }, 3: { funnel: true } });
    expect(lostReason(b)).toBeNull();
    expect(solve(b, PROOF).solvable).toBe(true);
  });
  it('two locks that hold each other’s key colours are lost', () => {
    // Jar 1 (key 2) holds the 1s that jar 0 needs; jar 0 (key 1) holds the 2s that jar 1 needs.
    const b = withJars(4, [[0, 2, 2, 2], [1, 1, 1, 2], [1, 0, 0, 0], [], []], { 0: { lock: 1 }, 1: { lock: 2 } });
    expect(lostReason(b)).toBe('lock');
    expect(solve(b, PROOF).solvable).toBe(false);
  });
  it('look-alike: a chain of locks that opens in order is not lost, and is winnable', () => {
    // Jar 1 (key 0) holds 1s that jar 0 (key 1) needs. Colour 0 is free, so the chain unwinds.
    const b = withJars(4, [[2, 2, 2], [1, 1, 1], [0, 0, 0, 1], [0], [2], []], { 0: { lock: 1 }, 1: { lock: 0 } });
    expect(lostReason(b)).toBeNull();
    expect(solve(b, PROOF).solvable).toBe(true);
  });
  it('a locked jar already full of one other colour never needs to open, so is not lost', () => {
    // Colour 1 doesn't exist here, so the lock can never open, but the jar is already sealed.
    const b = withJars(4, [[2, 2, 2, 2], [0, 0, 0, 3], [3, 3, 3], [0], []], { 0: { lock: 1 } });
    expect(lostReason(b)).toBeNull();
    expect(solve(b, PROOF).solvable).toBe(true);
  });
});

describe('lostReason on real levels', () => {
  it('never fires on a generated board with locks or funnels, nor along its proven solution (levels 81-130)', () => {
    let checked = 0;
    for (let level = 81; level <= 130; level++) {
      const g = generateLevel(level, cfg);
      if (!g.board.jars.some((j) => j.funnel || j.lock !== undefined)) continue;
      checked++;
      let b = g.board;
      expect(lostReason(b), `level ${level}`).toBeNull();
      for (const m of solve(b, cfg.generator.solverNodeBudget).path) {
        b = pour(b, m.from, m.to).board;
        expect(lostReason(b), `level ${level}`).toBeNull();
      }
    }
    expect(checked).toBeGreaterThan(5);
  });
});

describe('GameSession.lostReason', () => {
  // Jars: [0,0,0] [1,1,1] [0] funnel[1] funnel[]. Winnable: 1->3 seals the first funnel, 2->0 seals the 0s.
  const board = () => withJars(4, [[0, 0, 0], [1, 1, 1], [0], [1], []], { 3: { funnel: true }, 4: { funnel: true } });

  it('is null while the board can still be won', () => {
    const s = new GameSession(board(), { hintNodeBudget: 10_000 });
    expect(s.lostReason).toBeNull();
    expect(solve(s.board, PROOF).solvable).toBe(true);
  });
  it('becomes "funnel" after a pour splits a colour between two funnels, and undo clears it', () => {
    const s = new GameSession(board(), { hintNodeBudget: 10_000 });
    expect(s.pour(1, 4)).toBe(true); // three 1s into the empty funnel: neither funnel can fill now
    expect(s.lostReason).toBe('funnel');
    expect(s.undo()).toBe(true);
    expect(s.lostReason).toBeNull();
  });
});
