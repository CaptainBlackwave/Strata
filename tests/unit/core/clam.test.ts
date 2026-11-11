// Story: production/sprints/sprint-13.md M3 (clam jar, D96, D97). Design: design/gdd/jar-mechanics.md §2.6
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import pins from '../../fixtures/boards-141-180.json';
import { type Board, type Jar, boardKey, canPour, isSealed, isStuck, isWon, legalMoves, lostReason, makeBoard, pour, pourRefusal, usefulMoves } from '../../../src/core/board';
import { type DailyConfig, dailySpec } from '../../../src/core/daily';
import { applyMechanics, generateLevel, hasMechanics, levelSteps } from '../../../src/core/generator';
import { type GameConfig, type LevelSpec, hasMechanicCard, isClassicMechanic, levelSpec, pickMechanics, specMechanics } from '../../../src/core/levels';
import { createRng } from '../../../src/core/rng';
import { GameSession, findShuffle } from '../../../src/core/session';
import { solve } from '../../../src/core/solver';

const cfg = config as unknown as GameConfig & DailyConfig;
const clamTune = cfg.mechanics.list.find((m) => m.id === 'clam');
const options = { hintNodeBudget: cfg.hint.solverNodeBudget, shuffleNodeBudget: cfg.shuffle.solverNodeBudget, shuffleAttempts: cfg.shuffle.maxAttempts };
const UNLOCK = clamTune?.unlockAt ?? 181;
const OPENS = clamTune?.opensAfter ?? 6;

/** FNV-1a over JSON.stringify, matching the fixture generators. */
const hash = (b: Board) => {
  const s = JSON.stringify(b);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};

/** A board whose jar `at` is a closed clam that opens after `left` more pours. */
function withClam(capacity: number, jars: number[][], at: number, left: number, hidden: number[] = [], extra: Partial<Jar>[] = []): Board {
  const b = makeBoard(capacity, jars, hidden);
  return { capacity, jars: b.jars.map((j, i): Jar => ({ ...j, ...(extra[i] ?? {}), ...(i === at ? { clam: left } : {}) })) };
}

const clamIndex = (b: Board) => b.jars.findIndex((j) => j.clam !== undefined);

// Jar 0 is a closed clam [0, 1] (top 1). Jars 1 and 2 hold the rest; only after it opens can it be sorted.
// While it is closed the only pours are swaps of [1] and [0] with the empty jar 3: waits that count it down.
const waiting = (left = 3) => withClam(2, [[0, 1], [1], [0], []], 0, left);

describe('clam rules (D96)', () => {
  it('config: the clam unlocks at level 181 and opens after 6 pours', () => {
    expect(clamTune).toMatchObject({ id: 'clam', unlockAt: 181, opensAfter: 6 });
  });

  it('a closed clam cannot be poured into or out of: the reason is "clam"', () => {
    const b = withClam(4, [[0, 1], [1], [0], []], 0, 2);
    expect(pourRefusal(b, 0, 1)).toBe('clam'); // its top 1 would fit on [1]
    expect(pourRefusal(b, 1, 0)).toBe('clam'); // a 1 would fit on its top
    expect(pourRefusal(b, 0, 3)).toBe('clam');
    expect(canPour(b, 0, 1)).toBe(false);
    expect(legalMoves(b).some((m) => m.from === 0 || m.to === 0)).toBe(false);
    expect(() => pour(b, 0, 1)).toThrow();
  });

  it('every successful pour anywhere counts down; the pour that reaches zero opens it for good', () => {
    let b = withClam(4, [[0, 1], [1], [0], []], 0, 3);
    let r = pour(b, 1, 3);
    expect(r.board.jars[0].clam).toBe(2);
    expect(r.opened).toEqual([]);
    b = pour(r.board, 3, 1).board;
    expect(b.jars[0].clam).toBe(1);
    r = pour(b, 2, 3);
    expect(r.opened).toEqual([0]);
    expect(r.board.jars[0]).toEqual({ units: [0, 1], hidden: 0 }); // an ordinary jar now: no clam field
    expect(pourRefusal(r.board, 0, 1)).toBeNull();
    expect(pour(r.board, 0, 1).opened).toEqual([]);
  });

  it('opening keeps the burial: buried units stay buried, the top shows', () => {
    const b = withClam(4, [[2, 0, 1], [1], [2], []], 0, 1, [2]);
    expect(b.jars[0].hidden).toBe(2);
    const opened = pour(b, 1, 3).board.jars[0];
    expect(opened).toEqual({ units: [2, 0, 1], hidden: 2 });
  });

  it('a refused pour does not count; undo and restart bring the count back (it is board state)', () => {
    const b = withClam(4, [[0, 1], [1], [0], []], 0, 2);
    const s = new GameSession(b, options);
    expect(s.pour(0, 1)).toBe(false);
    expect(s.board.jars[0].clam).toBe(2);
    expect(s.pour(1, 3)).toBe(true);
    expect(s.board.jars[0].clam).toBe(1);
    s.undo();
    expect(s.board.jars[0]).toEqual(b.jars[0]);
    s.pour(1, 3);
    s.pour(3, 1);
    expect(s.board.jars[0].clam).toBeUndefined();
    s.restart();
    expect(s.board.jars[0]).toEqual(b.jars[0]);
  });

  it('the count is board state: the same sand with another count, or open, is another state', () => {
    const keys = [withClam(4, [[0, 1], [1]], 0, 2), withClam(4, [[0, 1], [1]], 0, 1), makeBoard(4, [[0, 1], [1]])].map(boardKey);
    expect(new Set(keys).size).toBe(3);
  });

  it('while a clam is closed every legal pour is useful (it brings the clam closer to opening), so the board is not stuck', () => {
    const b = waiting();
    expect(usefulMoves(b).length).toBe(legalMoves(b).length);
    expect(usefulMoves(b).some((m) => m.from === 1 && m.to === 3)).toBe(true); // a swap, kept as a wait
    expect(isStuck(b)).toBe(false);
    // The same sand with the clam already open: the swaps are pruned again and the board is not stuck.
    const open = makeBoard(2, [[0, 1], [1], [0], []]);
    expect(usefulMoves(open).some((m) => m.from === 1 && m.to === 3)).toBe(false);
    expect(isStuck(open)).toBe(false);
  });

  it('a closed clam with no legal pour anywhere is stuck: it can never open', () => {
    const b = withClam(2, [[0, 1], [1, 0], [2, 3], [3, 2]], 0, 2);
    expect(legalMoves(b)).toEqual([]);
    expect(isStuck(b)).toBe(true);
  });

  it('a board is not won while a closed clam holds sand', () => {
    const b = withClam(2, [[0, 1], [2, 2], []], 0, 1);
    expect(isWon(b)).toBe(false);
  });

  it('adds no dead end of its own: sand inside a closed clam still counts as reachable for a lock', () => {
    // Jar 1 is locked by colour 0, and every 0 is inside the closed clam: it opens, the 0s seal, the lock opens.
    const b = withClam(2, [[0, 0], [1, 1], [], []], 0, 2, [], [{}, { lock: 0 }]);
    expect(lostReason(b)).toBeNull();
  });

  it('shuffle keeps a closed clam as it is (sand and count); the free jars are re-dealt', () => {
    const b = withClam(4, [[0, 1, 2, 3], [3, 2, 1, 0], [], [0, 1, 2, 3], [3, 2, 1, 0], []], 3, 4);
    const next = findShuffle(b, options, createRng(7));
    expect(next).not.toBeNull();
    expect(next!.jars[3]).toEqual(b.jars[3]);
    expect(boardKey(next!)).not.toBe(boardKey(b));
    expect(solve(next!, cfg.shuffle.solverNodeBudget).solvable).toBe(true);
  });
});

describe('solver and hint with the clam', () => {
  it('the solver waits for the clam: it pours swaps to count it down, then sorts it, and the path replays to a win', () => {
    const b = waiting(3);
    const r = solve(b, 50_000);
    expect(r.solvable).toBe(true);
    expect(r.path.length).toBeGreaterThanOrEqual(5); // three waits, then two pours
    let s = b;
    for (const m of r.path) {
      expect(canPour(s, m.from, m.to)).toBe(true);
      s = pour(s, m.from, m.to).board;
    }
    expect(isWon(s)).toBe(true);
  });

  it('the solver never pours into or out of a closed clam: no wait available, no win', () => {
    // The only legal pours would touch the clam, so it never opens.
    expect(solve(withClam(2, [[0, 1], [1, 0], [2, 3], [3, 2]], 0, 2), 50_000).solvable).toBe(false);
  });

  it('every hint is a legal move and following the hints wins the clam level', () => {
    const level = generateLevel(UNLOCK, cfg);
    expect(clamIndex(level.board)).toBeGreaterThanOrEqual(0);
    const s = new GameSession(level.board, options);
    for (let i = 0; i < 200 && s.status === 'playing'; i++) {
      const m = s.hint();
      expect(m).not.toBeNull();
      expect(s.pour(m!.from, m!.to)).toBe(true);
    }
    expect(s.status).toBe('won');
  }, 60_000);
});

describe('clam placement and generation', () => {
  it('is a card mechanic since its UI (sprint 13 M3), but not classic, so never in the daily rotation', () => {
    expect(isClassicMechanic('clam')).toBe(false);
    expect(hasMechanicCard('clam')).toBe(true);
    expect(hasMechanicCard('sieve')).toBe(true);
    expect(specMechanics(levelSpec(UNLOCK, cfg))).toEqual(['clam']);
  });

  it('debuts alone on level 181 (no spare-jar swap, D28) and the board has one clam, closed for opensAfter pours', () => {
    const spec = levelSpec(UNLOCK, cfg);
    expect(spec.clam).toBe(true);
    expect(spec.hourglass).toBeFalsy();
    expect(spec.sieve).toBeFalsy();
    expect(spec.mechanics).toEqual([]);
    expect(spec.spare).toBe(2);
    const clams = generateLevel(UNLOCK, cfg).board.jars.filter((j) => j.clam !== undefined);
    expect(clams.length).toBe(1);
    expect(clams[0].clam).toBe(OPENS);
  });

  it('never rolls before level 181', () => {
    for (let l = 1; l < UNLOCK; l++) {
      expect(levelSpec(l, cfg).clam, `level ${l}`).toBeFalsy();
      expect(pickMechanics(l, cfg)).not.toContain('clam');
    }
  });

  it('places one clam on a filled, unsealed, plain jar (not frozen, locked, narrow, a funnel, the hourglass or the sieve), burial kept', () => {
    const dealt = makeBoard(4, [[0, 1, 2, 3], [1, 1, 1, 1], [3, 2, 1, 0], [2, 3, 0, 1], [0, 0, 2, 3], [1, 2, 3, 0], [], []], [3, 0, 3, 3, 3, 3, 0, 0]);
    for (let seed = 1; seed <= 60; seed++) {
      const spec: LevelSpec = { ...levelSpec(UNLOCK, cfg), colors: 4, mechanics: ['frozen', 'locked', 'narrow', 'funnel'], hourglass: true, sieve: true, clam: true };
      const b = applyMechanics(dealt, spec, createRng(seed), cfg);
      const at = clamIndex(b);
      expect(b.jars.filter((j) => j.clam !== undefined).length).toBe(1);
      const c = b.jars[at];
      expect(c.clam).toBe(OPENS);
      expect(c.units.length).toBeGreaterThan(0);
      expect(isSealed(c, 4)).toBe(false);
      expect(c.frozen || c.lock !== undefined || c.funnel || c.cap !== undefined || c.hourglass !== undefined || c.sieve !== undefined).toBeFalsy();
      expect(c.hidden).toBe(dealt.jars[at].hidden);
      expect(hasMechanics(b, spec)).toBe(true);
      expect(hasMechanics({ ...b, jars: b.jars.map(({ clam: _c, ...rest }) => rest) }, spec)).toBe(false);
    }
  });

  it('draws from the placement stream only after every other mechanic, so the rest of the board is unchanged', () => {
    const dealt = makeBoard(4, [[0, 1, 2, 3], [3, 2, 1, 0], [2, 3, 0, 1], [1, 0, 3, 2], [0, 2, 1, 3], [], []], [3, 3, 3, 3, 3, 0, 0]);
    for (let seed = 1; seed <= 20; seed++) {
      const spec: LevelSpec = { ...levelSpec(UNLOCK, cfg), colors: 4, mechanics: ['frozen', 'locked'], hourglass: true, sieve: true, clam: false };
      const without = applyMechanics(dealt, spec, createRng(seed), cfg);
      const withIt = applyMechanics(dealt, { ...spec, clam: true }, createRng(seed), cfg);
      expect(withIt.jars.map(({ clam: _c, ...rest }) => rest)).toEqual(without.jars);
    }
  });

  it('opensAfter is tunable from config', () => {
    const tuned = { ...cfg, mechanics: { ...cfg.mechanics, list: cfg.mechanics.list.map((m) => (m.id === 'clam' ? { ...m, opensAfter: 2 } : m)) } } as GameConfig;
    const dealt = makeBoard(4, [[0, 1, 2, 3], [3, 2, 1, 0], [], []]);
    const b = applyMechanics(dealt, { ...levelSpec(UNLOCK, cfg), colors: 4, mechanics: [], clam: true }, createRng(1), tuned);
    expect(b.jars[clamIndex(b)].clam).toBe(2);
  });

  it('fallback: a clam with classic mechanics first keeps the classic ones alone, then none', () => {
    const base = levelSpec(200, cfg);
    const row = (spec: LevelSpec) => levelSteps(spec, cfg).map((st) => [st.spec.mechanics.join('+'), st.spec.sieve === true, st.spec.clam === true]);
    expect(row({ ...base, mechanics: ['frozen'], hourglass: false, sieve: false, clam: true })).toEqual([['frozen', false, true], ['frozen', false, false], ['', false, false]]);
    expect(row({ ...base, mechanics: [], hourglass: false, sieve: false, clam: true })).toEqual([['', false, true], ['', false, false]]);
    expect(row({ ...base, mechanics: [], hourglass: false, sieve: true, clam: true })).toEqual([['', true, true], ['', false, false]]);
  });

  it('levels 181-400: every board with a clam is solver-proven, has one closed clam, and its solution replays to a win', () => {
    let withClamCount = 0;
    for (let l = UNLOCK; l <= 400; l++) {
      const g = generateLevel(l, cfg);
      const at = clamIndex(g.board);
      if (at < 0) continue;
      withClamCount++;
      expect(g.board.jars.filter((j) => j.clam !== undefined).length, `level ${l}`).toBe(1);
      expect(g.board.jars[at].clam, `level ${l}`).toBe(OPENS);
      const r = solve(g.board, cfg.generator.solverNodeBudget);
      expect(r.solvable, `level ${l}`).toBe(true);
      let b = g.board;
      for (const m of r.path) {
        expect(canPour(b, m.from, m.to), `level ${l}`).toBe(true);
        b = pour(b, m.from, m.to).board;
      }
      expect(isWon(b), `level ${l}`).toBe(true);
    }
    expect(withClamCount).toBeGreaterThanOrEqual(5);
  }, 60_000);
});

describe('no earlier board changes (sprint 13 M3 hard constraints)', () => {
  it('levels 141-180 are byte-identical to boards-141-180.json', () => {
    const hashes = pins.hashes as Record<string, string>;
    expect(Object.keys(hashes).length).toBe(40);
    for (const [l, h] of Object.entries(hashes)) expect(hash(generateLevel(Number(l), cfg).board), `level ${l}`).toBe(h);
  }, 60_000);

  it('the daily Saturday rotation never picks the clam before its start date (2026-11-28, sprint 13 W1)', () => {
    // Ten years of Saturdays up to 2026-11-21; from 2026-11-28 see tests/unit/weekly/new-jars-rotation.test.ts.
    for (let w = 0; w < 520; w++) {
      const key = new Date(Date.UTC(2026, 10, 21 - 7 * w)).toISOString().slice(0, 10);
      const spec = dailySpec(key, cfg);
      expect(spec.mechanics).not.toContain('clam');
      expect(spec.clam).toBeFalsy();
    }
  });

  it('no weekly theme features the clam yet', () => {
    expect((config.weekly.themes as { mechanic?: string }[]).some((t) => t.mechanic === 'clam')).toBe(false);
  });
});
