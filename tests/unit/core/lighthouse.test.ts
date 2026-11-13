// Story: production/sprints/sprint-27.md K2, K3 (the lighthouse jar, D208-D210). Design: design/gdd/jar-mechanics.md §2.10
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type Board, type Jar, boardKey, canPour, isLit, isSealed, isWon, legalMoves, makeBoard, pour, pourRefusal } from '../../../src/core/board';
import { type DailyConfig, dailySpec } from '../../../src/core/daily';
import { type EventsConfig, eventSpec } from '../../../src/core/events';
import { applyMechanics, generateLevel, hasMechanics, levelSteps, maxPoursFor } from '../../../src/core/generator';
import { type GameConfig, type LevelSpec, isClassicMechanic, levelSpec, pickMechanics, specMechanics, splitMechanics, withOwnRolls } from '../../../src/core/levels';
import { createRng } from '../../../src/core/rng';
import { GameSession, type SessionEvent, findShuffle } from '../../../src/core/session';
import { solve } from '../../../src/core/solver';
import { type WeeklyConfig, weeklySpec } from '../../../src/core/weekly';

const cfg = config as unknown as GameConfig & DailyConfig & WeeklyConfig & EventsConfig;
const tune = cfg.mechanics.list.find((m) => m.id === 'lighthouse');
const options = { hintNodeBudget: cfg.hint.solverNodeBudget, shuffleNodeBudget: cfg.shuffle.solverNodeBudget, shuffleAttempts: cfg.shuffle.maxAttempts };
const UNLOCK = tune?.unlockAt ?? 321;
const EVERY = tune?.every ?? 4;

/** A board from colour arrays where jar `at` is a dark lighthouse jar with `left` of `every` pours to go. */
function lightBoard(capacity: number, jars: number[][], at: number, left: number, every = EVERY, lit = false, extra: Partial<Jar>[] = []): Board {
  const b = makeBoard(capacity, jars);
  return { capacity, jars: b.jars.map((j, i): Jar => ({ ...j, ...(extra[i] ?? {}), ...(i === at ? { lighthouse: { every, left, lit } } : {}) })) };
}

/** Pours back and forth between jars `a` and `b` `n` times, starting a -> b. */
function shuttle(board: Board, a: number, b: number, n: number) {
  let r = pour(board, a, b);
  for (let k = 1; k < n; k++) r = k % 2 ? pour(r.board, b, a) : pour(r.board, a, b);
  return r;
}

describe('lighthouse jar rules (D208, D209)', () => {
  it('config: the lighthouse jar unlocks at 321 (D206), lit every 4 pours (D208), from its own roll only with its own salt (D210)', () => {
    expect(tune).toMatchObject({ id: 'lighthouse', unlockAt: 321, every: 4, shared: false });
    expect(tune!.ownChance).toBeGreaterThan(0);
    const salts = cfg.mechanics.list.map((m) => m.ownSalt).filter((s) => s !== undefined);
    expect(new Set(salts).size).toBe(salts.length);
  });

  it('it starts dark; every 4th pour lights it for one pour, then it is dark again', () => {
    const b = lightBoard(4, [[0, 1, 2], [3], []], 0, 4);
    expect(isLit(b.jars[0], 4)).toBe(false);
    const lit: boolean[] = [];
    let s = b;
    const sweeps: number[] = [];
    for (let k = 1; k <= 9; k++) {
      const r = k % 2 ? pour(s, 1, 2) : pour(s, 2, 1);
      s = r.board;
      lit.push(isLit(s.jars[0], 4));
      if (r.swept.length) sweeps.push(k);
    }
    expect(lit).toEqual([false, false, false, true, false, false, false, true, false]);
    expect(sweeps).toEqual([4, 8]);
    expect(s.jars[0].lighthouse).toEqual({ every: 4, left: 3, lit: false });
  });

  it('it is always pourable: dark or lit, it pours exactly like an ordinary jar', () => {
    const dark = lightBoard(4, [[0, 1, 1], [1], [2], []], 0, 3);
    const plain = makeBoard(4, [[0, 1, 1], [1], [2], []]);
    expect(legalMoves(dark)).toEqual(legalMoves(plain));
    for (const [f, t] of [[0, 1], [1, 0], [0, 3], [2, 0]]) expect(pourRefusal(dark, f, t)).toBe(pourRefusal(plain, f, t));
    expect(pour(dark, 0, 1).board.jars.map((j) => j.units)).toEqual(pour(plain, 0, 1).board.jars.map((j) => j.units));
  });

  it('a pour into or out of it counts, and a refused pour does not', () => {
    const s = new GameSession(lightBoard(4, [[0, 1], [1], [2], []], 0, 2), options);
    expect(s.pour(2, 1)).toBe(false);
    expect(s.board.jars[0].lighthouse).toEqual({ every: 4, left: 2, lit: false });
    expect(s.pour(1, 0)).toBe(true);
    expect(s.board.jars[0].lighthouse).toEqual({ every: 4, left: 1, lit: false });
    expect(s.pour(0, 3)).toBe(true);
    expect(s.board.jars[0].lighthouse).toEqual({ every: 4, left: 4, lit: true });
  });

  it('once sealed it is lit for good and its beam stops, also when it seals on a sweeping pour', () => {
    const b = lightBoard(4, [[0, 0, 0], [0], [1, 2], [2], []], 0, 1);
    const r = pour(b, 1, 0);
    expect(isSealed(r.board.jars[0], 4)).toBe(true);
    expect(r.swept).toEqual([]);
    expect(r.board.jars[0].lighthouse).toEqual({ every: 4, left: 1, lit: false });
    expect(isLit(r.board.jars[0], 4)).toBe(true);
    const later = shuttle(r.board, 3, 4, 5);
    expect(later.board.jars[0]).toEqual(r.board.jars[0]);
  });

  it('a complete jar that is still wet is not sealed, so it stays dark until it dries (§2.7)', () => {
    const b = lightBoard(4, [[0, 0, 0, 0], [1], [], [2]], 0, 4, EVERY, false, [{ wet: [0, 0, 0, 2] }]);
    const r1 = pour(b, 1, 2);
    expect(isLit(r1.board.jars[0], 4)).toBe(false);
    const r2 = pour(r1.board, 2, 1); // the last wet unit dries: sealed, lit for good
    expect(isSealed(r2.board.jars[0], 4)).toBe(true);
    expect(isLit(r2.board.jars[0], 4)).toBe(true);
  });

  it('an empty lighthouse jar keeps counting; a jar without one is always lit', () => {
    const r = shuttle(lightBoard(4, [[], [1], []], 0, 2), 1, 2, 2);
    expect(r.swept).toEqual([0]);
    expect(isLit({ units: [1, 2], hidden: 0 }, 4)).toBe(true);
  });

  it('with a crab, hourglass and tide on the same board, each rule acts on its own jar in the same pour', () => {
    const b = lightBoard(4, [[0, 1], [2, 1, 0], [0, 1, 2], [3], [], [1]], 0, 1, EVERY, false, [{}, { hourglass: { every: 3, left: 1 } }, { tide: { every: 4, left: 1 } }, {}, {}, { crab: { every: 3, left: 1 } }]);
    const r = pour(b, 3, 4);
    expect(r).toMatchObject({ flipped: [1], turned: [2], swept: [0], crabMoved: { from: 5, to: 0 } });
    expect(r.board.jars[0]).toMatchObject({ crab: { every: 3, left: 3 }, lighthouse: { every: 4, left: 4, lit: true } });
  });

  it('undo and restart bring back the beam; the pour event names the sweep', () => {
    const b = lightBoard(4, [[0, 1], [3], [], [2]], 0, 1);
    const s = new GameSession(b, options);
    const events: SessionEvent[] = [];
    s.onChange((e) => events.push(e));
    expect(s.pour(1, 2)).toBe(true);
    expect(events.find((e) => e.type === 'pour')).toMatchObject({ swept: [0] });
    expect(isLit(s.board.jars[0], 4)).toBe(true);
    expect(s.pour(2, 1)).toBe(true);
    expect(events.filter((e) => e.type === 'pour').at(-1)).not.toHaveProperty('swept');
    expect(isLit(s.board.jars[0], 4)).toBe(false);
    s.undo();
    expect(isLit(s.board.jars[0], 4)).toBe(true);
    s.restart();
    expect(s.board).toEqual(b);
  });

  it('the beam is left out of the solver key: no rule depends on it, so the same sand is the same state', () => {
    expect(boardKey(lightBoard(4, [[0, 1], [1]], 0, 2))).toBe(boardKey(lightBoard(4, [[0, 1], [1]], 0, 4, EVERY, true)));
  });

  it('shuffle re-deals a lighthouse jar\'s sand like any free jar and keeps its beam', () => {
    const b = lightBoard(4, [[0, 1, 2, 3], [3, 2, 1, 0], [], [0, 1, 2, 3], [3, 2, 1, 0], []], 0, 2);
    const next = findShuffle(b, options, createRng(7));
    expect(next).not.toBeNull();
    expect(next!.jars[0].lighthouse).toEqual({ every: 4, left: 2, lit: false });
    expect(next!.jars.filter((j) => j.lighthouse)).toHaveLength(1);
  });
});

describe('solver and hint with the lighthouse jar', () => {
  it('the solver finds the same answer with or without the beam (it never depends on seeing)', () => {
    const jars = [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], [], []];
    const lit = solve(lightBoard(4, jars, 0, 4), 100_000);
    const plain = solve(makeBoard(4, jars), 100_000);
    expect(lit.solvable).toBe(true);
    expect(lit.path).toEqual(plain.path);
  });

  it('every hint is a legal move and following the hints wins the debut level', () => {
    const level = generateLevel(UNLOCK, cfg);
    expect(level.board.jars.some((j) => j.lighthouse)).toBe(true);
    const s = new GameSession(level.board, options);
    for (let i = 0; i < 200 && s.status === 'playing'; i++) {
      const m = s.hint();
      expect(m).not.toBeNull();
      expect(s.pour(m!.from, m!.to)).toBe(true);
    }
    expect(s.status).toBe('won');
  }, 60_000);
});

describe('lighthouse jar placement and generation (K3)', () => {
  it('is not classic, so it is in no daily rotation, and has its card id (strings from K5)', () => {
    expect(isClassicMechanic('lighthouse')).toBe(false);
    expect(splitMechanics(['lighthouse'])).toEqual({ mechanics: [], lighthouse: true });
    expect(specMechanics(levelSpec(UNLOCK, cfg))).toEqual(['lighthouse']);
  });

  it('debuts alone on level 321 with two spares (D28): one dark lighthouse jar counting from every, nothing buried in it', () => {
    const spec = levelSpec(UNLOCK, cfg);
    expect(spec).toMatchObject({ lighthouse: true, mechanics: [], spare: 2, challenge: false });
    expect(spec.hourglass || spec.sieve || spec.clam || spec.wet || spec.tide || spec.crab).toBeFalsy();
    const g = generateLevel(UNLOCK, cfg);
    expect(g.spec.lighthouse).toBe(true);
    expect(g.attempts).toBeGreaterThan(0);
    const lights = g.board.jars.filter((j) => j.lighthouse);
    expect(lights).toHaveLength(1);
    expect(lights[0]).toMatchObject({ hidden: 0, lighthouse: { every: EVERY, left: EVERY, lit: false } });
    expect(g.board.jars.some((j) => j.wet || j.hourglass || j.tide || j.crab || j.clam !== undefined || j.sieve !== undefined || j.cap !== undefined || j.funnel || j.frozen || j.lock !== undefined)).toBe(false);
  });

  it('a debut level rolls no other own roll (D28): 321 holds the lighthouse jar alone', () => {
    expect(withOwnRolls(UNLOCK, ['lighthouse'], cfg)).toEqual(['lighthouse']);
  });

  it('never rolls before level 321', () => {
    for (let l = 1; l < UNLOCK; l++) {
      expect(levelSpec(l, cfg).lighthouse, `level ${l}`).toBeFalsy();
      expect(pickMechanics(l, cfg)).not.toContain('lighthouse');
    }
  });

  it('is placed on one filled plain jar: no other mechanic, not the crab\'s, nothing buried, and wet sand never lands on it', () => {
    const dealt = makeBoard(4, [[0, 1, 2, 3], [1, 1, 1, 1], [3, 2, 1, 0], [2, 3, 0, 1], [0, 0, 2, 3], [1, 2, 3, 0], [3, 0, 1, 2], [2, 1, 3, 0], [], []], [2, 0, 2, 2, 2, 2, 2, 2, 0, 0]);
    let placed = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const spec: LevelSpec = { ...levelSpec(UNLOCK + 1, cfg), colors: 4, mechanics: ['frozen', 'locked', 'narrow', 'funnel'], hourglass: true, sieve: true, clam: true, tide: true, crab: true, lighthouse: true, wet: true };
      const b = applyMechanics(dealt, spec, createRng(seed), cfg);
      if (!hasMechanics(b, spec)) continue;
      placed++;
      const lights = b.jars.filter((j) => j.lighthouse);
      expect(lights, `seed ${seed}`).toHaveLength(1);
      const j = lights[0];
      expect(j.units.length).toBeGreaterThan(0);
      expect(j.hidden).toBe(0);
      expect(j.lighthouse).toEqual({ every: EVERY, left: EVERY, lit: false });
      expect(j.frozen || j.lock !== undefined || j.cap !== undefined || j.funnel || j.hourglass || j.sieve !== undefined || j.clam !== undefined || j.tide || j.crab || j.wet || isSealed(j, 4)).toBeFalsy();
    }
    expect(placed).toBeGreaterThan(20);
  });

  it('draws from the placement stream after the crab, so every earlier mechanic is unchanged', () => {
    const dealt = makeBoard(4, [[0, 1, 2, 3], [3, 2, 1, 0], [2, 3, 0, 1], [1, 0, 3, 2], [0, 2, 1, 3], [], []], [2, 2, 2, 2, 2, 0, 0]);
    for (let seed = 1; seed <= 40; seed++) {
      const spec: LevelSpec = { ...levelSpec(UNLOCK + 1, cfg), colors: 4, mechanics: ['frozen'], hourglass: true, sieve: true, clam: true, tide: true, crab: true };
      const without = applyMechanics(dealt, spec, createRng(seed), cfg);
      const withIt = applyMechanics(dealt, { ...spec, lighthouse: true }, createRng(seed), cfg);
      expect(withIt.jars.map(({ lighthouse: _l, hidden: _h, ...rest }) => rest)).toEqual(without.jars.map(({ hidden: _h, ...rest }) => rest));
    }
  });

  it('every is tunable from config', () => {
    const tuned = { ...cfg, mechanics: { ...cfg.mechanics, list: cfg.mechanics.list.map((m) => (m.id === 'lighthouse' ? { ...m, every: 3 } : m)) } } as GameConfig;
    const b = applyMechanics(makeBoard(4, [[0, 1, 2, 3], [3, 2, 1, 0], [], []]), { ...levelSpec(UNLOCK + 1, cfg), colors: 4, mechanics: [], lighthouse: true }, createRng(1), tuned);
    expect(b.jars.find((j) => j.lighthouse)!.lighthouse).toEqual({ every: 3, left: 3, lit: false });
  });

  it('fallback: the lighthouse jar with classic mechanics first keeps the classic ones alone, then none', () => {
    const base = levelSpec(UNLOCK, cfg);
    const row = (spec: LevelSpec) => levelSteps(spec, cfg).map((st) => [st.spec.mechanics.join('+'), st.spec.lighthouse === true]);
    expect(row({ ...base, mechanics: ['frozen'], lighthouse: true })).toEqual([['frozen', true], ['frozen', false], ['', false]]);
    expect(row({ ...base, mechanics: [], lighthouse: true })).toEqual([['', true], ['', false]]);
  });

  it('every lighthouse level of 321-440 is built with it, within its pour cap, and its solution replays to a win', () => {
    let count = 0;
    for (let l = UNLOCK; l <= 440; l++) {
      if (!levelSpec(l, cfg).lighthouse) continue;
      const g = generateLevel(l, cfg);
      expect(g.spec.lighthouse, `level ${l} keeps the lighthouse jar`).toBe(true);
      expect(g.attempts, `level ${l}`).toBeGreaterThan(0);
      expect(g.board.jars.filter((j) => j.lighthouse), `level ${l}`).toHaveLength(1);
      expect(g.solutionLength, `level ${l}`).toBeLessThanOrEqual(maxPoursFor(l, cfg));
      const r = solve(g.board, cfg.generator.solverNodeBudget);
      expect(r.solvable, `level ${l}`).toBe(true);
      let b = g.board;
      for (const m of r.path) {
        expect(canPour(b, m.from, m.to), `level ${l}`).toBe(true);
        b = pour(b, m.from, m.to).board;
      }
      expect(isWon(b), `level ${l}`).toBe(true);
      count++;
    }
    expect(count).toBeGreaterThanOrEqual(10);
  }, 240_000);

  it('its own roll (D210) puts it on about 1 level in 8 from 321: between 12% and 13% of 321-1000', () => {
    let n = 0;
    for (let l = UNLOCK; l <= 1000; l++) if (levelSpec(l, cfg).lighthouse) n++;
    const share = n / (1000 - UNLOCK + 1);
    expect(share).toBeGreaterThanOrEqual(0.12);
    expect(share).toBeLessThanOrEqual(0.13);
  });

  it('comes from its own roll only (shared: false): ownChance 0 leaves only the debut', () => {
    const off = { ...cfg, mechanics: { ...cfg.mechanics, list: cfg.mechanics.list.map((m) => (m.id === 'lighthouse' ? { ...m, ownChance: 0 } : m)) } } as GameConfig;
    const levels: number[] = [];
    for (let l = UNLOCK; l <= 1000; l++) if (levelSpec(l, off).lighthouse) levels.push(l);
    expect(levels).toEqual([UNLOCK]);
  });
});

describe('the lighthouse jar stays out of the daily, the weekly and events (D210)', () => {
  it('the daily never features it (two years of days from 2026-11-01)', () => {
    for (let d = 0; d < 730; d++) {
      const key = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10);
      expect(dailySpec(key, cfg).lighthouse, key).toBeFalsy();
    }
  });

  it('no weekly theme features it, and no weekly board of 52 weeks has it', () => {
    expect((config.weekly.themes as { mechanic?: string }[]).some((t) => t.mechanic === 'lighthouse')).toBe(false);
    for (let w = 1; w <= 52; w++) {
      const week = `2027-W${String(w).padStart(2, '0')}`;
      for (let i = 0; i < 3; i++) expect(weeklySpec(week, i, cfg).lighthouse, `${week} #${i}`).toBeFalsy();
    }
  });

  it('no event board has it', () => {
    for (const e of cfg.events) for (let n = 1; n <= e.boards; n++) expect(eventSpec(e, 2026, n, cfg).lighthouse, `${e.id} #${n}`).toBeFalsy();
  });
});
