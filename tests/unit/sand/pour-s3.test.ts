// Story: production/sprints/sprint-19.md (S3): the sim plays out only what the rules allow on
// mechanic boards. Frozen, locked, funnel (out), closed clam and wrong-colour sieve pours are refused,
// so their sand never moves; and a narrow jar's sand stays inside its shorter glass (its mouth row).
import { describe, expect, it } from 'vitest';
import { type Board, type Jar, makeBoard, pour } from '../../../src/core/board';
import { generateLevel } from '../../../src/core/generator';
import { legalMoves } from '../../../src/core/board';
import { EMPTY, defaultDims, done, finish, gridFromJar, planPour, step } from '../../../src/ui/sand';
import { gameConfig, totalGrains } from './fixtures';

const dims = defaultDims();
const SEED = 31;
const withJar = (board: Board, i: number, extra: Partial<Jar>): Board => ({ ...board, jars: board.jars.map((j, k) => (k === i ? { ...j, ...extra } : j)) });

describe('mechanic jars never move in the sim', () => {
  const base = makeBoard(4, [[0, 1, 1], [1], []]);
  it.each([
    ['a frozen source', withJar(base, 0, { frozen: true }), 0, 2],
    ['a frozen target', withJar(base, 2, { frozen: true }), 0, 2],
    ['a locked source', withJar(base, 0, { lock: 3 }), 0, 2],
    ['a locked target', withJar(base, 2, { lock: 3 }), 0, 2],
    ['out of a funnel', withJar(base, 0, { funnel: true }), 0, 2],
    ['a closed clam source', withJar(base, 0, { clam: 2 }), 0, 2],
    ['into a closed clam', withJar(base, 2, { clam: 2 }), 0, 2],
    ['a wrong colour into a sieve', withJar(base, 2, { sieve: 0 }), 0, 2],
  ])('refuses %s, so no grain of it moves', (_name, board, from, to) => {
    expect(() => planPour(board, from, to, dims, SEED)).toThrow();
  });

  it('on generated frozen and locked levels, every legal pour leaves the frozen and locked jars as they were', () => {
    // Arrange: the debut levels of frozen (41) and locked (61).
    for (const level of [41, 48, 61, 65]) {
      const board = generateLevel(level, gameConfig).board;
      const held = board.jars.map((j, i) => (j.frozen || j.lock !== undefined ? i : -1)).filter((i) => i >= 0);
      expect(held.length, `level ${level} has a frozen or locked jar`).toBeGreaterThan(0);
      for (const { from, to } of legalMoves(board).slice(0, 4)) {
        // Act
        expect(held).not.toContain(from);
        expect(held).not.toContain(to);
        const sim = planPour(board, from, to, dims, SEED);
        while (!done(sim)) step(sim);
        const after = pour(board, from, to).board;
        finish(sim, after);
        // Assert: the rules left them alone, and the sim only ever drew the two pour jars.
        for (const i of held) expect(after.jars[i]).toEqual(board.jars[i]);
      }
    }
  });
});

describe('a narrow jar (shorter glass)', () => {
  const board = makeBoard(4, [[0, 1], [1], []]);
  const MOUTH = 30; // rows above this are outside a narrow jar's glass

  it('the source spills at its own mouth: no grain ever enters the rows above it', () => {
    // Arrange
    const sim = planPour(board, 0, 1, dims, SEED, { sourceMouth: MOUTH });
    const total = totalGrains(sim);
    // Act / Assert
    while (!done(sim)) {
      step(sim);
      for (let i = 0; i < MOUTH * dims.cols; i++) expect(sim.source.cells[i]).toBe(EMPTY);
      expect(totalGrains(sim)).toBe(total);
    }
    expect(sim.emitted).toBe(sim.required);
  });

  it('a grain falling into a narrow target lands inside its glass and never above its mouth', () => {
    // Arrange
    const sim = planPour(board, 0, 1, dims, SEED, { targetMouth: MOUTH, streamCol: 16, streamWidth: 1 });
    // Act / Assert
    while (!done(sim)) {
      step(sim);
      for (let i = 0; i < MOUTH * dims.cols; i++) expect(sim.target.cells[i]).toBe(EMPTY);
    }
    expect(sim.landed).toBe(sim.required);
    const after = pour(board, 0, 1).board;
    finish(sim, after);
    expect(sim.target.cells).toEqual(gridFromJar(after.jars[1], 4, dims).cells);
  });

  it('the stream starts airRows above the narrow target mouth, not above its grid', () => {
    const sim = planPour(board, 0, 1, dims, SEED, { targetMouth: MOUTH, streamCol: 16, streamWidth: 1 });
    while (sim.particles.count === 0) step(sim);
    expect(sim.particles.y[0]).toBeGreaterThan(MOUTH - 24 - 1);
  });
});
