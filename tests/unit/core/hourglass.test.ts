// Story: production/sprints/sprint-13.md M1 (hourglass jar, D96, D97). Design: design/gdd/jar-mechanics.md
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import early from '../../fixtures/boards-1-100.json';
import saturdays from '../../fixtures/daily-saturdays.json';
import { type Board, type Jar, boardKey, isSealed, isStuck, isWon, lostReason, makeBoard, pour, usefulMoves } from '../../../src/core/board';
import { type DailyConfig, dailySpec, generateDaily } from '../../../src/core/daily';
import { applyMechanics, generateLevel, levelSteps } from '../../../src/core/generator';
import { type GameConfig, levelSpec, pickMechanics } from '../../../src/core/levels';
import { createRng } from '../../../src/core/rng';
import { GameSession, findShuffle } from '../../../src/core/session';
import { solve } from '../../../src/core/solver';

const cfg = config as unknown as GameConfig & DailyConfig;
const hourglassTune = cfg.mechanics.list.find((m) => m.id === 'hourglass');
const EVERY = hourglassTune?.every ?? 3;
const options = { hintNodeBudget: cfg.hint.solverNodeBudget, shuffleNodeBudget: cfg.shuffle.solverNodeBudget, shuffleAttempts: cfg.shuffle.maxAttempts };

/** FNV-1a over JSON.stringify, matching the fixture generators. */
const hash = (b: Board) => {
  const s = JSON.stringify(b);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};

/** A board whose jar `glass` is an hourglass that flips every `every` pours, `left` pours from now. */
function withGlass(capacity: number, jars: number[][], glass: number, every = EVERY, left = every): Board {
  const b = makeBoard(capacity, jars);
  return { capacity, jars: b.jars.map((j, i): Jar => (i === glass ? { ...j, hourglass: { every, left } } : j)) };
}

// Jar 0 is the hourglass [0, 1, 2] (top 2). Jars 1-3 give free pours that don't touch it.
const base = () => withGlass(4, [[0, 1, 2], [3, 3], [3], [], [0, 0, 0]], 0);

describe('hourglass rules (D96)', () => {
  it('config: the hourglass unlocks at level 101 and flips every 3 pours', () => {
    expect(hourglassTune).toMatchObject({ id: 'hourglass', unlockAt: 101, every: 3 });
  });

  it('every successful pour anywhere counts down; the third flips the stack and restarts the count', () => {
    let b = base();
    b = pour(b, 2, 3).board; // [3] -> empty
    expect(b.jars[0].hourglass).toEqual({ every: 3, left: 2 });
    expect(b.jars[0].units).toEqual([0, 1, 2]);
    b = pour(b, 3, 1).board; // back onto [3, 3]
    expect(b.jars[0].hourglass).toEqual({ every: 3, left: 1 });
    const r = pour(b, 1, 3);
    expect(r.board.jars[0].units).toEqual([2, 1, 0]);
    expect(r.board.jars[0].hourglass).toEqual({ every: 3, left: 3 });
    expect(r.flipped).toEqual([0]);
    expect(pour(r.board, 3, 1).flipped).toEqual([]);
  });

  it('a pour out of or into the hourglass counts too, and the flip comes after the pour', () => {
    let b = withGlass(4, [[0, 1, 2], [2], []], 0, 3, 1);
    const r = pour(b, 0, 1); // the 2 leaves first, then [0, 1] flips to [1, 0]
    expect(r.board.jars[0].units).toEqual([1, 0]);
    expect(r.board.jars[1].units).toEqual([2, 2]);
    b = withGlass(4, [[0, 1], [1], []], 0, 3, 1);
    expect(pour(b, 1, 0).board.jars[0].units).toEqual([1, 1, 0]); // in, then flipped
  });

  it('a refused pour does not count', () => {
    const s = new GameSession(base(), options);
    expect(s.pour(0, 1)).toBe(false); // 2 onto 3: refused
    expect(s.pour(4, 4)).toBe(false);
    expect(s.board.jars[0].hourglass).toEqual({ every: 3, left: 3 });
    expect(s.moves).toBe(0);
  });

  it('undo restores the count and the order, including across a flip', () => {
    const s = new GameSession(base(), options);
    s.pour(2, 3);
    s.pour(3, 1);
    s.pour(1, 3);
    expect(s.board.jars[0].units).toEqual([2, 1, 0]);
    s.undo();
    expect(s.board.jars[0].units).toEqual([0, 1, 2]);
    expect(s.board.jars[0].hourglass).toEqual({ every: 3, left: 1 });
    s.undo();
    expect(s.board.jars[0].hourglass).toEqual({ every: 3, left: 2 });
  });

  it('restart resets the count and the order', () => {
    const s = new GameSession(base(), options);
    s.pour(2, 3);
    s.pour(3, 1);
    s.pour(1, 3);
    s.restart();
    expect(s.board.jars[0]).toEqual(base().jars[0]);
  });

  it('a monochrome hourglass stays sealed through a flip, and the pour that seals it can be the flip', () => {
    let b = withGlass(4, [[1, 1, 1, 1], [3, 3], [3], []], 0, 3, 1);
    expect(isSealed(b.jars[0], 4)).toBe(true);
    b = pour(b, 2, 3).board;
    expect(b.jars[0].units).toEqual([1, 1, 1, 1]);
    expect(isSealed(b.jars[0], 4)).toBe(true);
    const seal = pour(withGlass(4, [[1, 1, 1], [1], []], 0, 3, 1), 1, 0).board;
    expect(isSealed(seal.jars[0], 4)).toBe(true);
    expect(isWon(seal)).toBe(true);
  });

  it('a flip reveals a buried hourglass stack (its sand is never buried by placement)', () => {
    const b0 = withGlass(4, [[0, 1, 2], [3], []], 0, 3, 1);
    const b: Board = { ...b0, jars: b0.jars.map((j, i) => (i === 0 ? { ...j, hidden: 2 } : j)) };
    expect(pour(b, 1, 2).board.jars[0].hidden).toBe(0);
  });

  it('the count is board state: two boards that differ only in the count have different keys', () => {
    const a = base();
    const b = withGlass(4, [[0, 1, 2], [3, 3], [3], [], [0, 0, 0]], 0, 3, 2);
    expect(boardKey(a)).not.toBe(boardKey(b));
  });

  it('with a live hourglass every legal pour is useful, since any pour moves the count', () => {
    // Without the hourglass, [3] -> empty only swaps two jars. Here it is a wait move.
    const b = withGlass(4, [[0, 1, 2], [3], [], [0, 0, 0], [1, 1, 1], [2, 2, 2]], 0);
    expect(usefulMoves(b).some((m) => m.from === 1 && m.to === 2)).toBe(true);
    expect(isStuck(b)).toBe(false);
  });

  it('adds no dead end of its own (D21): a flip never makes sand unreachable', () => {
    expect(lostReason(base())).toBeNull();
  });

  it('shuffle re-deals the hourglass like any free jar and keeps its count', () => {
    const b = withGlass(4, [[0, 1, 2, 3], [3, 2, 1, 0], [], [0, 1, 2, 3], [3, 2, 1, 0], []], 0, 3, 2);
    const next = findShuffle(b, options, createRng(7));
    expect(next).not.toBeNull();
    expect(next!.jars[0].hourglass).toEqual({ every: 3, left: 2 });
    expect(next!.jars[0].units.length).toBe(4);
  });
});

describe('solver and hint with the flip', () => {
  it('the solver plans through a flip: its path replays to a win with the flip rule', () => {
    // Flips every pour, so the hourglass turns over between every two moves of the plan.
    const b = withGlass(4, [[0, 1, 0, 1], [1, 0, 1, 0], [], [2, 2], [2, 2]], 0, 1, 1);
    const r = solve(b, 50_000);
    expect(r.solvable).toBe(true);
    expect(r.path.length).toBeGreaterThan(1);
    let s = b;
    for (const m of r.path) s = pour(s, m.from, m.to).board;
    expect(isWon(s)).toBe(true);
  });

  it('the solver key keeps the count: a state seen at another count is searched again', () => {
    // Same sand, different count: the solver must not treat them as one state.
    const a = solve(withGlass(4, [[0, 1, 0, 1], [1, 0, 1, 0], [], [2, 2], [2, 2]], 0, 3, 1), 50_000);
    const c = solve(withGlass(4, [[0, 1, 0, 1], [1, 0, 1, 0], [], [2, 2], [2, 2]], 0, 3, 3), 50_000);
    for (const [r, left] of [[a, 1], [c, 3]] as const) {
      let s = withGlass(4, [[0, 1, 0, 1], [1, 0, 1, 0], [], [2, 2], [2, 2]], 0, 3, left);
      for (const m of r.path) s = pour(s, m.from, m.to).board;
      expect(r.solvable).toBe(true);
      expect(isWon(s)).toBe(true);
    }
  });

  it('every hint is a legal move and following the hints wins', () => {
    const level = Array.from({ length: 60 }, (_, i) => 101 + i).map((l) => generateLevel(l, cfg)).find((g) => g.board.jars.some((j) => j.hourglass));
    expect(level).toBeDefined();
    const s = new GameSession(level!.board, options);
    for (let i = 0; i < 200 && s.status === 'playing'; i++) {
      const m = s.hint();
      expect(m).not.toBeNull();
      expect(s.pour(m!.from, m!.to)).toBe(true);
    }
    expect(s.status).toBe('won');
  });
});

describe('hourglass placement and generation', () => {
  it('debuts alone on level 101 (no spare-jar swap, D28)', () => {
    const spec = levelSpec(101, cfg);
    expect(spec.hourglass).toBe(true);
    expect(spec.mechanics).toEqual([]);
    expect(spec.spare).toBe(2);
    expect(generateLevel(101, cfg).board.jars.filter((j) => j.hourglass).length).toBe(1);
  });

  it('never rolls before level 101', () => {
    for (let l = 1; l <= 100; l++) {
      expect(levelSpec(l, cfg).hourglass).toBeFalsy();
      expect(pickMechanics(l, cfg)).not.toContain('hourglass');
    }
  });

  it('places one hourglass on a filled, unsealed, plain jar and shows its sand', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const spec = { ...levelSpec(101, cfg), mechanics: ['frozen', 'locked'] as const, hourglass: true };
      const dealt = makeBoard(4, [[0, 1, 2, 3], [1, 1, 1, 1], [3, 2, 1, 0], [2, 3, 0, 1], [0, 0, 2, 3], [], []], [3, 0, 3, 3, 3, 0, 0]);
      const b = applyMechanics(dealt, { ...spec, colors: 4 }, createRng(seed), cfg);
      const glasses = b.jars.filter((j) => j.hourglass);
      expect(glasses.length).toBe(1);
      const g = glasses[0];
      expect(g.units.length).toBeGreaterThan(0);
      expect(isSealed(g, 4)).toBe(false);
      expect(g.hidden).toBe(0);
      expect(g.frozen || g.lock !== undefined || g.funnel || g.cap !== undefined).toBeFalsy();
      expect(g.hourglass).toEqual({ every: EVERY, left: EVERY });
    }
  });

  it('a level with the hourglass and another mechanic first falls back to the other mechanic alone', () => {
    const spec = { ...levelSpec(170, cfg), mechanics: ['frozen'] as const, hourglass: true };
    const steps = levelSteps(spec, cfg).map((st) => [st.spec.mechanics.join('+'), st.spec.hourglass === true]);
    expect(steps).toEqual([['frozen', true], ['frozen', false], ['', false]]);
    expect(levelSteps({ ...spec, mechanics: [] }, cfg).map((st) => st.spec.hourglass === true)).toEqual([true, false]);
  });

  // Widened from 101-160 in sprint 13 M2: the sieve (141) rerolled levels 141+, leaving 4 hourglass boards there.
  it('levels 101-200: every board with an hourglass is solver-proven and its solution replays to a win', () => {
    let withGlass = 0;
    for (let l = 101; l <= 200; l++) {
      const g = generateLevel(l, cfg);
      if (!g.board.jars.some((j) => j.hourglass)) continue;
      withGlass++;
      expect(g.board.jars.filter((j) => j.hourglass).length).toBe(1);
      const r = solve(g.board, cfg.generator.solverNodeBudget);
      expect(r.solvable, `level ${l}`).toBe(true);
      let b = g.board;
      for (const m of r.path) b = pour(b, m.from, m.to).board;
      expect(isWon(b), `level ${l}`).toBe(true);
    }
    expect(withGlass).toBeGreaterThanOrEqual(5);
  }, 60_000);
});

describe('no existing board changes (sprint 13 M1 hard constraints)', () => {
  it('levels 1-100 are byte-identical to boards-1-100.json', () => {
    const hashes = early.hashes as Record<string, string>;
    expect(Object.keys(hashes).length).toBe(100);
    for (const [l, h] of Object.entries(hashes)) expect(hash(generateLevel(Number(l), cfg).board), `level ${l}`).toBe(h);
  });

  it('the daily Saturday rotation never picks the hourglass yet (W1 adds it from a start date)', () => {
    for (let w = 0; w < 520; w++) {
      const key = new Date(Date.UTC(2026, 10, 7 + 7 * w)).toISOString().slice(0, 10);
      const spec = dailySpec(key, cfg);
      expect(spec.mechanics).not.toContain('hourglass');
      expect(spec.hourglass).toBeFalsy();
    }
  });

  it('the Saturday dailies are byte-identical to the fixture', () => {
    for (const [key, d] of Object.entries(saturdays.days as Record<string, { mechanic: string; hash: string }>)) {
      expect(dailySpec(key, cfg).mechanics).toEqual([d.mechanic]);
      expect(hash(generateDaily(key, cfg).board), key).toBe(d.hash);
    }
  });

  it('no weekly theme features the hourglass yet', () => {
    expect((config.weekly.themes as { mechanic?: string }[]).some((t) => t.mechanic === 'hourglass')).toBe(false);
  });
});
