// F7, finding GA-SB-4 (production/qa/sprint-6-findings.md): shuffle can't freeze the game on a hard late board.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { Board } from '../../../src/core/board';
import { generateLevel } from '../../../src/core/generator';
import type { GameConfig } from '../../../src/core/levels';
import { createRng } from '../../../src/core/rng';
import { GameSession, sessionOptions } from '../../../src/core/session';

/** Every solver call the session makes: the budget it was given and the states it expanded. */
const calls = vi.hoisted(() => [] as { budget: number; nodes: number }[]);
vi.mock('../../../src/core/solver', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../src/core/solver')>();
  return {
    ...real,
    solve: (board: Board, budget: number) => {
      const r = real.solve(board, budget);
      calls.push({ budget, nodes: r.nodes });
      return r;
    },
  };
});

const cfg = config as unknown as GameConfig;
/** States actually charged: a solve that runs out reports one past its budget. */
const spent = () => calls.reduce((sum, c) => sum + Math.min(c.nodes, c.budget), 0);

/** Level 491 (14 colours, 16 jars; level 152 before 0.14.1, D128) with its ordinary spare removed: no re-deal of it is winnable. */
function hopelessLateBoard(): Board {
  const b = generateLevel(491, cfg).board;
  const spare = b.jars.findIndex((j) => j.units.length === 0 && j.cap === undefined && !j.funnel);
  return { capacity: b.capacity, jars: b.jars.filter((_, i) => i !== spare) };
}
/** Generated once; the generator's own solver calls are cleared before each test. */
const hopeless = hopelessLateBoard();
const late = generateLevel(491, cfg).board;

beforeEach(() => {
  calls.length = 0;
});

describe('shuffle total node budget', () => {
  it('on a hopeless 15-jar late board, gives up cleanly within shuffleTotalNodeBudget', () => {
    // Arrange: production attempts and per-attempt budget; a total smaller than 40 failed proofs cost.
    const total = 1_000;
    const s = new GameSession(hopeless, { ...sessionOptions(cfg), shuffleTotalNodeBudget: total });
    const before = s.board;
    // Act
    const ok = s.shuffle(createRng(1));
    // Assert
    expect(ok).toBe(false);
    expect(s.board).toBe(before);
    expect(spent()).toBeLessThanOrEqual(total);
    expect(calls.length).toBeLessThan(cfg.shuffle.maxAttempts);
  });

  it('never gives one attempt more than what is left of the total', () => {
    const total = 1_000;
    new GameSession(hopeless, { ...sessionOptions(cfg), shuffleTotalNodeBudget: total }).shuffle(createRng(2));
    let used = 0;
    for (const c of calls) {
      expect(c.budget).toBeLessThanOrEqual(total - used);
      used += Math.min(c.nodes, c.budget);
    }
  });

  it('with the shipped config, a late 16-jar board still shuffles, within config.shuffle.totalNodeBudget', () => {
    const s = new GameSession(late, sessionOptions(cfg));
    expect(s.shuffle(createRng(3))).toBe(true);
    expect(spent()).toBeLessThanOrEqual(cfg.shuffle.totalNodeBudget!);
  });

  it('without shuffleTotalNodeBudget, the total defaults to the per-attempt budget', () => {
    const { shuffleTotalNodeBudget: _omit, ...opts } = sessionOptions(cfg);
    new GameSession(hopeless, { ...opts, shuffleNodeBudget: 500 }).shuffle(createRng(4));
    expect(spent()).toBeLessThanOrEqual(500);
  });
});
