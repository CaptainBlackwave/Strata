// Story: production/sprints/sprint-23.md W2, W3 (wet sand, D189, D190). Design: design/gdd/jar-mechanics.md §2.7
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import pins from '../../fixtures/boards-1-200.json';
import { type Board, type Jar, boardKey, canPour, hasWet, isComplete, isRunWet, isSealed, isStuck, isWon, legalMoves, makeBoard, pour, pourRefusal, usefulMoves } from '../../../src/core/board';
import { type DailyConfig, dailySpec } from '../../../src/core/daily';
import { applyMechanics, generateLevel, hasMechanics, levelSteps, maxPoursFor } from '../../../src/core/generator';
import { type GameConfig, type LevelSpec, isClassicMechanic, levelSpec, pickMechanics, specMechanics, splitMechanics } from '../../../src/core/levels';
import { createRng } from '../../../src/core/rng';
import { GameSession, type SessionEvent, findShuffle } from '../../../src/core/session';
import { solve } from '../../../src/core/solver';
import { type WeeklyConfig, weeklySpec } from '../../../src/core/weekly';

const cfg = config as unknown as GameConfig & DailyConfig & WeeklyConfig;
const wetTune = cfg.mechanics.list.find((m) => m.id === 'wet');
const options = { hintNodeBudget: cfg.hint.solverNodeBudget, shuffleNodeBudget: cfg.shuffle.solverNodeBudget, shuffleAttempts: cfg.shuffle.maxAttempts };
const UNLOCK = wetTune?.unlockAt ?? 201;
const DRY = wetTune?.dryAfter ?? 5;
const UNITS = wetTune?.units ?? 3;
const DEBUT_UNITS = wetTune?.debutUnits ?? UNITS;

/** FNV-1a over JSON.stringify, matching the fixture generators. */
const hash = (b: Board) => {
  const s = JSON.stringify(b);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};

/** A board from colour arrays, with per-jar wet counts (bottom first, 0 = dry) and optional extra jar fields. */
function wetBoard(capacity: number, jars: number[][], wet: (number[] | undefined)[], extra: Partial<Jar>[] = []): Board {
  const b = makeBoard(capacity, jars);
  return { capacity, jars: b.jars.map((j, i): Jar => ({ ...j, ...(extra[i] ?? {}), ...(wet[i] && wet[i]!.some((w) => w > 0) ? { wet: wet[i] } : {}) })) };
}

/** Every wet unit on a board as `colour:count`, sorted: what a shuffle must keep. */
const wetPairs = (b: Board) => b.jars.flatMap((j) => j.units.map((c, k) => `${c}:${j.wet?.[k] ?? 0}`)).sort();
const wetCount = (b: Board) => b.jars.reduce((n, j) => n + (j.wet?.filter((w) => w > 0).length ?? 0), 0);

describe('wet sand rules (D189)', () => {
  it('config: wet sand unlocks at level 201 (D190) with 3 wet units, 2 on its debut, drying after 5 pours', () => {
    expect(wetTune).toMatchObject({ id: 'wet', unlockAt: 201, units: 3, debutUnits: 2, dryAfter: 5 });
  });

  it('a run holding a wet unit cannot go into an empty jar: the reason is "wet"', () => {
    const b = wetBoard(4, [[0, 1], [], [1], [2]], [[0, 3]]);
    expect(isRunWet(b.jars[0])).toBe(true);
    expect(pourRefusal(b, 0, 1)).toBe('wet');
    expect(canPour(b, 0, 1)).toBe(false);
    expect(() => pour(b, 0, 1)).toThrow();
  });

  it('a wet run may go onto its own colour, but not onto another colour', () => {
    const b = wetBoard(4, [[0, 1], [], [1], [2]], [[0, 3]]);
    expect(pourRefusal(b, 0, 2)).toBeNull();
    expect(pourRefusal(b, 0, 3)).toBe('colour');
  });

  it('no empty jar of any kind takes wet sand: narrow, funnel or a sieve of its band', () => {
    const b = wetBoard(4, [[0, 1], [], [], []], [[0, 2]], [{}, { cap: 2 }, { funnel: true }, { sieve: 1 }]);
    expect(pourRefusal(b, 0, 1)).toBe('wet');
    expect(pourRefusal(b, 0, 2)).toBe('wet');
    expect(pourRefusal(b, 0, 3)).toBe('wet');
  });

  it('the whole top run follows the rule when any unit in it is wet, even one under dry units of its colour', () => {
    const b = wetBoard(4, [[0, 1, 1, 1], []], [[0, 2, 0, 0]]);
    expect(isRunWet(b.jars[0])).toBe(true);
    expect(pourRefusal(b, 0, 1)).toBe('wet');
  });

  it('dry sand over or under wet sand pours as usual: a wet unit below the top run does not count', () => {
    const b = wetBoard(4, [[1, 0, 2], [], [2]], [[0, 4, 0]]);
    expect(isRunWet(b.jars[0])).toBe(false);
    expect(pourRefusal(b, 0, 1)).toBeNull();
    const r = pour(b, 0, 1).board;
    expect(r.jars[0]).toEqual({ units: [1, 0], hidden: 0, wet: [0, 3] });
    expect(isRunWet(r.jars[0])).toBe(true); // now on top, it is the moving run
    expect(pourRefusal(r, 0, 2)).toBe('colour');
  });

  it('every successful pour counts every wet unit on the board down one, moved units included; at 0 it is dry', () => {
    const b = wetBoard(4, [[0, 1], [1], [2, 3], [], [3]], [[0, 2], undefined, [1, 0]]);
    const r = pour(b, 0, 1); // the wet 1 moves onto 1 and dries a step
    expect(r.board.jars[1]).toEqual({ units: [1, 1], hidden: 0, wet: [0, 1] });
    expect(r.board.jars[2].wet).toBeUndefined(); // the 2 at 1 dried: the field is dropped
    expect(r.dried).toEqual([2]);
    const r2 = pour(r.board, 2, 4); // a pour elsewhere
    expect(r2.board.jars[1].wet).toBeUndefined();
    expect(r2.dried).toEqual([1]);
    expect(hasWet(r2.board)).toBe(false);
    expect(pourRefusal(r2.board, 1, 3)).toBeNull(); // dry: it pours into an empty jar again
  });

  it('a partial pour moves the top units with their own counts and leaves the rest behind', () => {
    const b = wetBoard(4, [[2, 1, 1, 1], [0, 0, 1]], [[0, 5, 0, 3]]);
    const r = pour(b, 0, 1).board; // one free space: only the top unit moves
    expect(r.jars[1]).toEqual({ units: [0, 0, 1, 1], hidden: 0, wet: [0, 0, 0, 2] });
    expect(r.jars[0]).toEqual({ units: [2, 1, 1], hidden: 0, wet: [0, 4, 0] });
  });

  it('a board without wet sand pours exactly as before: no wet field appears and nothing dries', () => {
    const b = makeBoard(4, [[0, 1], [1], []]);
    const r = pour(b, 0, 1);
    expect(r.dried).toEqual([]);
    expect(r.board.jars.some((j) => 'wet' in j)).toBe(false);
  });

  it('a complete jar of one colour seals only once all its units are dry; then a frozen jar thaws', () => {
    // Pouring the dry 0 onto [0, 0, 0w] completes it, still wet (2 -> 1), so it is not sealed and nothing thaws.
    const b = wetBoard(4, [[0, 0, 0], [1, 0], [2], [2, 1, 1, 1], []], [[0, 0, 2]], [{}, {}, {}, { frozen: true }]);
    const r = pour(b, 1, 0).board;
    expect(isComplete(r.jars[0], 4)).toBe(true);
    expect(isSealed(r.jars[0], 4)).toBe(false);
    expect(r.jars[3].frozen).toBe(true);
    const r2 = pour(r, 2, 4).board; // any pour dries it: now it seals, and the frozen jar thaws
    expect(isSealed(r2.jars[0], 4)).toBe(true);
    expect(r2.jars[3].frozen).toBeUndefined();
  });

  it('the session reports drying and a seal by drying on the pour event', () => {
    const b = wetBoard(4, [[0, 0, 0, 0], [1, 2], [2], [1, 1, 1], []], [[0, 0, 0, 1]]);
    const s = new GameSession(b, options);
    const events: SessionEvent[] = [];
    s.onChange((e) => events.push(e));
    s.pour(1, 2);
    const e = events.find((x) => x.type === 'pour');
    expect(e).toMatchObject({ type: 'pour', dried: [0], sealedDry: [0] });
  });

  it('the winning pour dries the board: a board of empty and complete jars is won and ends all sealed', () => {
    const b = wetBoard(2, [[0, 0], [1, 1], []], [[3, 3]]);
    expect(isWon(b)).toBe(true); // complete counts, wet or dry
    const nearly = wetBoard(2, [[0, 0], [1], [1]], [[4, 0]]);
    expect(isWon(nearly)).toBe(false);
    const r = pour(nearly, 1, 2);
    expect(isWon(r.board)).toBe(true);
    expect(hasWet(r.board)).toBe(false);
    expect(r.board.jars.every((j) => j.units.length === 0 || isSealed(j, 2))).toBe(true);
    expect(r.dried).toEqual([0]);
  });

  it('a refused pour does not count; undo and restart bring every count back (it is board state)', () => {
    const b = wetBoard(4, [[0, 1], [], [1], [2], [3]], [[0, 3]]);
    const s = new GameSession(b, options);
    expect(s.pour(0, 1)).toBe(false);
    expect(s.board.jars[0].wet).toEqual([0, 3]);
    expect(s.pour(3, 1)).toBe(true);
    expect(s.board.jars[0].wet).toEqual([0, 2]);
    s.undo();
    expect(s.board).toEqual(b);
    s.pour(0, 2);
    s.pour(3, 1);
    s.restart();
    expect(s.board).toEqual(b);
  });

  it('an hourglass flip turns the wet counts over with their units', () => {
    const b = wetBoard(4, [[0, 1, 2], [3], []], [[4, 0, 0]], [{ hourglass: { every: 1, left: 1 } }]);
    const r = pour(b, 1, 2).board;
    expect(r.jars[0].units).toEqual([2, 1, 0]);
    expect(r.jars[0].wet).toEqual([0, 0, 3]);
  });

  it('the counts are board state: the same sand with other counts, or dry, is another state', () => {
    const keys = [wetBoard(4, [[0, 1], [1]], [[0, 2]]), wetBoard(4, [[0, 1], [1]], [[0, 1]]), wetBoard(4, [[0, 1], [1]], [[2, 0]]), makeBoard(4, [[0, 1], [1]])].map(boardKey);
    expect(new Set(keys).size).toBe(4);
  });

  it('while sand is wet every legal pour is useful (it dries the sand), so swaps are kept and the board is not stuck', () => {
    const b = wetBoard(2, [[0, 1], [1, 1], [0], []], [[0, 2]]);
    const dry = makeBoard(2, [[0, 1], [1, 1], [0], []]);
    expect(usefulMoves(b).length).toBe(legalMoves(b).length);
    expect(usefulMoves(b).some((m) => m.from === 1 && m.to === 3)).toBe(false); // [1, 1] is sealed, never poured
    expect(usefulMoves(b).some((m) => m.from === 2 && m.to === 3)).toBe(true); // a swap, kept as a wait
    expect(usefulMoves(dry).some((m) => m.from === 2 && m.to === 3)).toBe(false);
    expect(isStuck(b)).toBe(false);
  });

  it('a board whose only pours are wet runs into empty jars is stuck, and the solver proves it lost', () => {
    const b = wetBoard(2, [[0, 1], [1, 0], []], [[0, 5], [0, 5]]);
    expect(legalMoves(b)).toEqual([]);
    expect(isStuck(b)).toBe(true);
    expect(solve(b, 50_000).solvable).toBe(false);
    expect(solve(makeBoard(2, [[0, 1], [1, 0], []]), 50_000).solvable).toBe(true); // dry, it is winnable
  });

  it('shuffle keeps each wet unit with its count (a shuffle is not a pour, so nothing dries)', () => {
    const b = wetBoard(4, [[0, 1, 2, 3], [3, 2, 1, 0], [], [0, 1, 2, 3], [3, 2, 1, 0], []], [[0, 0, 0, 2], undefined, undefined, [3, 0, 0, 0]]);
    const next = findShuffle(b, options, createRng(7));
    expect(next).not.toBeNull();
    expect(wetPairs(next!)).toEqual(wetPairs(b));
    expect(wetCount(next!)).toBe(2);
    expect(boardKey(next!)).not.toBe(boardKey(b));
    expect(solve(next!, cfg.shuffle.solverNodeBudget).solvable).toBe(true);
  });
});

describe('solver and hint with wet sand', () => {
  it('the solver never pours wet sand into an empty jar and its path replays to a win', () => {
    // Without the rule the quickest win starts by moving the wet 1 into the empty jar.
    const b = wetBoard(2, [[0, 1], [1, 0], []], [[0, 3]]);
    const r = solve(b, 50_000);
    expect(r.solvable).toBe(true);
    let s = b;
    for (const m of r.path) {
      expect(pourRefusal(s, m.from, m.to), JSON.stringify(m)).toBeNull();
      s = pour(s, m.from, m.to).board;
    }
    expect(isWon(s)).toBe(true);
  });

  it('every hint is a legal move and following the hints wins the debut level', () => {
    const level = generateLevel(UNLOCK, cfg);
    expect(hasWet(level.board)).toBe(true);
    const s = new GameSession(level.board, options);
    for (let i = 0; i < 200 && s.status === 'playing'; i++) {
      const m = s.hint();
      expect(m).not.toBeNull();
      expect(s.pour(m!.from, m!.to)).toBe(true);
    }
    expect(s.status).toBe('won');
  }, 60_000);
});

describe('wet sand placement and generation (W3)', () => {
  it('is not classic, so it is in no daily rotation, and has its intro card on level 201 (sprint 23 W5)', () => {
    expect(isClassicMechanic('wet')).toBe(false);
    expect(splitMechanics(['wet'])).toEqual({ mechanics: [], wet: true });
    expect(specMechanics(levelSpec(UNLOCK, cfg))).toEqual(['wet']);
  });

  it('debuts alone on level 201 with two spares (D28), gently: debutUnits wet units, each at dryAfter, all visible', () => {
    const spec = levelSpec(UNLOCK, cfg);
    expect(spec).toMatchObject({ wet: true, mechanics: [], spare: 2, challenge: false });
    expect(spec.hourglass || spec.sieve || spec.clam).toBeFalsy();
    const g = generateLevel(UNLOCK, cfg);
    expect(g.spec.wet).toBe(true);
    expect(g.attempts).toBeGreaterThan(0); // solver-proven, not a fallback board
    expect(DEBUT_UNITS).toBeLessThan(UNITS);
    expect(wetCount(g.board)).toBe(DEBUT_UNITS);
    for (const j of g.board.jars) j.wet?.forEach((w, k) => w > 0 && expect([w, k >= j.hidden]).toEqual([DRY, true]));
    // Gentle: no longer than the median length target of its pour band.
    const band = [...(cfg.generator.pourBands ?? [])].filter((b) => b.from <= UNLOCK).pop()!;
    expect(g.solutionLength).toBeLessThanOrEqual(band.median);
  });

  it('never rolls before level 201', () => {
    for (let l = 1; l < UNLOCK; l++) {
      expect(levelSpec(l, cfg).wet, `level ${l}`).toBeFalsy();
      expect(pickMechanics(l, cfg)).not.toContain('wet');
    }
  });

  it('places units on distinct visible units of filled jars that are not frozen, locked, a closed clam, sealed or a funnel', () => {
    const dealt = makeBoard(4, [[0, 1, 2, 3], [1, 1, 1, 1], [3, 2, 1, 0], [2, 3, 0, 1], [0, 0, 2, 3], [1, 2, 3, 0], [], []], [2, 0, 2, 2, 2, 2, 0, 0]);
    for (let seed = 1; seed <= 60; seed++) {
      const spec: LevelSpec = { ...levelSpec(UNLOCK + 1, cfg), colors: 4, mechanics: ['frozen', 'locked', 'funnel'], clam: true, wet: true };
      const b = applyMechanics(dealt, spec, createRng(seed), cfg);
      expect(wetCount(b), `seed ${seed}`).toBe(UNITS);
      b.jars.forEach((j) => {
        if (!j.wet) return;
        expect(j.wet.length).toBe(j.units.length);
        expect(j.frozen || j.lock !== undefined || j.clam !== undefined || j.funnel || isComplete(j, 4)).toBeFalsy();
        j.wet.forEach((w, k) => {
          expect([0, DRY]).toContain(w);
          if (w > 0) expect(k).toBeGreaterThanOrEqual(j.hidden);
        });
      });
      expect(hasMechanics(b, spec)).toBe(true);
      expect(hasMechanics({ ...b, jars: b.jars.map(({ wet: _w, ...rest }) => rest) }, spec)).toBe(false);
    }
  });

  it('draws from the placement stream only after every other mechanic, so the rest of the board is unchanged', () => {
    const dealt = makeBoard(4, [[0, 1, 2, 3], [3, 2, 1, 0], [2, 3, 0, 1], [1, 0, 3, 2], [0, 2, 1, 3], [], []], [2, 2, 2, 2, 2, 0, 0]);
    for (let seed = 1; seed <= 20; seed++) {
      const spec: LevelSpec = { ...levelSpec(UNLOCK + 1, cfg), colors: 4, mechanics: ['frozen', 'locked'], hourglass: true, sieve: true, clam: true };
      const without = applyMechanics(dealt, spec, createRng(seed), cfg);
      const withIt = applyMechanics(dealt, { ...spec, wet: true }, createRng(seed), cfg);
      expect(withIt.jars.map(({ wet: _w, ...rest }) => rest)).toEqual(without.jars);
    }
  });

  it('units, debutUnits and dryAfter are tunable from config', () => {
    const tuned = { ...cfg, mechanics: { ...cfg.mechanics, list: cfg.mechanics.list.map((m) => (m.id === 'wet' ? { ...m, units: 4, debutUnits: 1, dryAfter: 2 } : m)) } } as GameConfig;
    const dealt = makeBoard(4, [[0, 1, 2, 3], [3, 2, 1, 0], [], []]);
    const later = applyMechanics(dealt, { ...levelSpec(UNLOCK + 1, cfg), colors: 4, mechanics: [], wet: true }, createRng(1), tuned);
    expect(wetCount(later)).toBe(4);
    expect(later.jars.flatMap((j) => j.wet ?? []).filter((w) => w > 0)).toEqual([2, 2, 2, 2]);
    const debut = applyMechanics(dealt, { ...levelSpec(UNLOCK, cfg), colors: 4, mechanics: [], wet: true }, createRng(1), tuned);
    expect(wetCount(debut)).toBe(1);
  });

  it('fallback: wet sand with classic mechanics first keeps the classic ones alone, then none', () => {
    const base = levelSpec(UNLOCK, cfg);
    const row = (spec: LevelSpec) => levelSteps(spec, cfg).map((st) => [st.spec.mechanics.join('+'), st.spec.wet === true]);
    expect(row({ ...base, mechanics: ['frozen'], wet: true })).toEqual([['frozen', true], ['frozen', false], ['', false]]);
    expect(row({ ...base, mechanics: [], wet: true })).toEqual([['', true], ['', false]]);
  });

  it('levels 201-260 all generate solver-proven within their pour cap; every board with wet sand replays to a win', () => {
    let wetLevels = 0;
    for (let l = UNLOCK; l <= 260; l++) {
      const g = generateLevel(l, cfg);
      expect(g.attempts, `level ${l}`).toBeGreaterThan(0);
      expect(g.solutionLength, `level ${l}`).toBeLessThanOrEqual(maxPoursFor(l, cfg));
      if (levelSpec(l, cfg).wet) expect(g.spec.wet, `level ${l} keeps wet sand`).toBe(true);
      if (!hasWet(g.board)) continue;
      wetLevels++;
      const r = solve(g.board, cfg.generator.solverNodeBudget);
      expect(r.solvable, `level ${l}`).toBe(true);
      let b = g.board;
      for (const m of r.path) {
        expect(canPour(b, m.from, m.to), `level ${l}`).toBe(true);
        b = pour(b, m.from, m.to).board;
      }
      expect(isWon(b), `level ${l}`).toBe(true);
    }
    expect(wetLevels).toBeGreaterThanOrEqual(2); // the debut and 259
  }, 120_000);

  it('its own roll (D192) puts wet sand on about 1 level in 8 from 201: between 10% and 15% of 201-1000', () => {
    let wet = 0;
    for (let l = UNLOCK; l <= 1000; l++) if (levelSpec(l, cfg).wet) wet++;
    expect(wet / 800).toBeGreaterThanOrEqual(0.1);
    expect(wet / 800).toBeLessThanOrEqual(0.15);
  });

  it('without its own roll it is rarer: ownChance 0 leaves only the shared roll', () => {
    const off = { ...cfg, mechanics: { ...cfg.mechanics, list: cfg.mechanics.list.map((m) => (m.id === 'wet' ? { ...m, ownChance: 0 } : m)) } } as GameConfig;
    let on = 0;
    let without = 0;
    for (let l = UNLOCK; l <= 1000; l++) {
      if (levelSpec(l, cfg).wet) on++;
      if (levelSpec(l, off).wet) without++;
    }
    expect(without).toBeLessThan(on);
  });

  it('every wet level of 261-400 is built with wet sand and its solution replays to a win', () => {
    let wetLevels = 0;
    for (let l = 261; l <= 400; l++) {
      if (!levelSpec(l, cfg).wet) continue;
      const g = generateLevel(l, cfg);
      expect(g.spec.wet, `level ${l} keeps wet sand`).toBe(true);
      expect(hasWet(g.board), `level ${l}`).toBe(true);
      expect(g.solutionLength, `level ${l}`).toBeLessThanOrEqual(maxPoursFor(l, cfg));
      const r = solve(g.board, cfg.generator.solverNodeBudget);
      expect(r.solvable, `level ${l}`).toBe(true);
      let b = g.board;
      for (const m of r.path) b = pour(b, m.from, m.to).board;
      expect(isWon(b), `level ${l}`).toBe(true);
      wetLevels++;
    }
    expect(wetLevels).toBeGreaterThanOrEqual(8);
  }, 240_000);
});

describe('no earlier board changes (sprint 23 W3 hard constraints)', () => {
  it('levels 1-200 are byte-identical to boards-1-200.json (hashed on the base commit, before wet sand)', () => {
    const hashes = pins.hashes as Record<string, string>;
    expect(Object.keys(hashes).length).toBe(200);
    for (const [l, h] of Object.entries(hashes)) expect(hash(generateLevel(Number(l), cfg).board), `level ${l}`).toBe(h);
  }, 120_000);

  it('the daily never features wet sand (two years of days from 2026-11-01)', () => {
    for (let d = 0; d < 730; d++) {
      const key = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10);
      expect(dailySpec(key, cfg).wet, key).toBeFalsy();
    }
  });

  it('no weekly theme features wet sand, and no weekly board has it', () => {
    expect((config.weekly.themes as { mechanic?: string }[]).some((t) => t.mechanic === 'wet')).toBe(false);
    for (let w = 1; w <= 52; w++) {
      const week = `2027-W${String(w).padStart(2, '0')}`;
      for (let i = 0; i < 3; i++) expect(weeklySpec(week, i, cfg).wet, `${week} #${i}`).toBeFalsy();
    }
  });
});
