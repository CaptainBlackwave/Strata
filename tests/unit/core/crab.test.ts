// Story: production/sprints/sprint-27.md K2, K3 (the crab jar, D207, D210). Design: design/gdd/jar-mechanics.md §2.9
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type Board, type Jar, boardKey, canPour, crabAt, crabStep, hasCrab, isSealed, isStuck, isWon, jarKey, legalMoves, makeBoard, pour, pourRefusal, usefulMoves } from '../../../src/core/board';
import { type DailyConfig, dailySpec } from '../../../src/core/daily';
import { type EventsConfig, eventSpec } from '../../../src/core/events';
import { applyMechanics, generateLevel, hasMechanics, levelSteps, maxPoursFor } from '../../../src/core/generator';
import { type GameConfig, type LevelSpec, isClassicMechanic, levelSpec, pickMechanics, specMechanics, splitMechanics, withOwnRolls } from '../../../src/core/levels';
import { createRng } from '../../../src/core/rng';
import { GameSession, type SessionEvent, findShuffle } from '../../../src/core/session';
import { solve } from '../../../src/core/solver';
import { type WeeklyConfig, weeklySpec } from '../../../src/core/weekly';

const cfg = config as unknown as GameConfig & DailyConfig & WeeklyConfig & EventsConfig;
const crabTune = cfg.mechanics.list.find((m) => m.id === 'crab');
const options = { hintNodeBudget: cfg.hint.solverNodeBudget, shuffleNodeBudget: cfg.shuffle.solverNodeBudget, shuffleAttempts: cfg.shuffle.maxAttempts };
const UNLOCK = crabTune?.unlockAt ?? 281;
const EVERY = crabTune?.every ?? 3;

/** A board from colour arrays with the crab on jar `at`, `left` of `every` pours to go, plus optional extra jar fields. */
function crabBoard(capacity: number, jars: number[][], at: number, left: number, every = EVERY, extra: Partial<Jar>[] = []): Board {
  const b = makeBoard(capacity, jars);
  return { capacity, jars: b.jars.map((j, i): Jar => ({ ...j, ...(extra[i] ?? {}), ...(i === at ? { crab: { every, left } } : {}) })) };
}

describe('crab jar rules (D207)', () => {
  it('config: the crab unlocks at 281 (D206), moving every 3 pours (D207), from its own roll only with its own salt (D210)', () => {
    expect(crabTune).toMatchObject({ id: 'crab', unlockAt: 281, every: 3, shared: false });
    expect(crabTune!.ownChance).toBeGreaterThan(0);
    const salts = cfg.mechanics.list.map((m) => m.ownSalt).filter((s) => s !== undefined);
    expect(new Set(salts).size).toBe(salts.length);
  });

  it('pouring out of the crab\'s jar is refused with \'crab\'; pouring into it is allowed', () => {
    const b = crabBoard(4, [[0, 1], [1], []], 0, 3);
    expect(pourRefusal(b, 0, 2)).toBe('crab');
    expect(pourRefusal(b, 0, 1)).toBe('crab');
    expect(canPour(b, 1, 0)).toBe(true);
    expect(pour(b, 1, 0).board.jars[0].units).toEqual([0, 1, 1]);
  });

  it('refusal order: a frozen, clam or sealed source says so first; the crab comes before empty, room and colour', () => {
    expect(pourRefusal(crabBoard(4, [[0, 1], []], 0, 3, EVERY, [{ frozen: true }]), 0, 1)).toBe('closed');
    expect(pourRefusal(crabBoard(4, [[0, 1], []], 0, 3, EVERY, [{ clam: 2 }]), 0, 1)).toBe('clam');
    expect(pourRefusal(crabBoard(2, [[0, 0], []], 0, 3), 0, 1)).toBe('sealed');
    expect(pourRefusal(crabBoard(2, [[0, 1], [1, 1]], 0, 3), 0, 1)).toBe('crab');
  });

  it('every successful pour counts down; the third moves the crab to the next jar in the row and restarts its count', () => {
    const b = crabBoard(4, [[0, 1], [2], [3, 2], [1], []], 0, 3);
    const r1 = pour(b, 1, 4);
    expect(r1.board.jars[0].crab).toEqual({ every: 3, left: 2 });
    expect(r1.crabMoved).toBeNull();
    const r2 = pour(r1.board, 4, 1);
    expect(r2.board.jars[0].crab).toEqual({ every: 3, left: 1 });
    const r3 = pour(r2.board, 3, 0); // a pour into the crab's jar counts too
    expect(r3.crabMoved).toEqual({ from: 0, to: 1 });
    expect(r3.board.jars[0].crab).toBeUndefined();
    expect(r3.board.jars[1].crab).toEqual({ every: 3, left: 3 });
    expect(r3.board.jars.filter((j) => j.crab)).toHaveLength(1);
    expect(crabAt(r3.board)).toBe(1);
  });

  it('a refused pour does not count', () => {
    const s = new GameSession(crabBoard(4, [[0, 1], [2], [3], []], 0, 2), options);
    expect(s.pour(0, 3)).toBe(false);
    expect(s.pour(1, 2)).toBe(false);
    expect(s.board.jars[0].crab).toEqual({ every: 3, left: 2 });
  });

  it('it skips empty and sealed jars and wraps round the row', () => {
    // Jar 3 holds the crab; after the pour 2 -> 3 jars 4, 5 and 2 are empty and 0 is sealed, so it wraps to 1.
    const b = crabBoard(4, [[2, 2, 2, 2], [0, 1], [0], [1, 0], [], []], 3, 1);
    const r = pour(b, 2, 3);
    expect(r.crabMoved).toEqual({ from: 3, to: 1 });
  });

  it('when no other jar can take it, it stays and its count restarts', () => {
    // Jar 1 empties into the crab's jar; jar 2 is sealed and jar 3 empty, so no other jar can take it.
    const lone = crabBoard(4, [[0, 1, 1], [1], [2, 2, 2, 2], []], 0, 1);
    expect(crabStep(lone, 0)).toBe(1);
    const r = pour(lone, 1, 0);
    expect(r.crabMoved).toBeNull();
    expect(r.board.jars[0].crab).toEqual({ every: 3, left: 3 });
    expect(crabStep(r.board, 0)).toBe(-1);
  });

  it('a jar the pour just filled can take it: emptiness is judged after the pour', () => {
    const b = crabBoard(4, [[0, 1], [1], [], []], 0, 1);
    const r = pour(b, 1, 2); // jar 1 empties and jar 2 now holds the 1
    expect(r.crabMoved).toEqual({ from: 0, to: 2 });
  });

  it('a pour that seals the crab\'s jar makes it step off at once, whatever its count', () => {
    const b = crabBoard(4, [[0, 0, 0], [0], [1, 2], [2]], 0, 3);
    const r = pour(b, 1, 0);
    expect(isSealed(r.board.jars[0], 4)).toBe(true);
    expect(r.crabMoved).toEqual({ from: 0, to: 2 });
    expect(r.board.jars[2].crab).toEqual({ every: 3, left: 3 });
  });

  it('a winning pour into the crab\'s jar leaves it where it is (no jar can take it)', () => {
    const b = crabBoard(2, [[0], [0], [1, 1]], 0, 2);
    const r = pour(b, 1, 0);
    expect(isWon(r.board)).toBe(true);
    expect(r.crabMoved).toBeNull();
  });

  it('it may step onto a closed clam (like any jar that is neither empty nor sealed): only empty and sealed jars are skipped', () => {
    const b = crabBoard(4, [[0, 1], [2], [3], [1], []], 0, 1, EVERY, [{}, { clam: 4 }]);
    const r = pour(b, 3, 4);
    expect(r.crabMoved).toEqual({ from: 0, to: 1 });
    expect(r.board.jars[1]).toMatchObject({ clam: 3, crab: { every: 3, left: 3 } });
  });

  it('order: drying runs first, so a jar sealed by its last wet sand drying on this pour is skipped', () => {
    const b = crabBoard(4, [[0, 1], [2, 2, 2, 2], [3], [1], []], 0, 1, EVERY, [{}, { wet: [0, 0, 0, 1] }]);
    const r = pour(b, 3, 4);
    expect(r.dried).toEqual([1]);
    expect(r.crabMoved).toEqual({ from: 0, to: 2 });
    // Still wet: not sealed, so the crab steps onto it.
    const wet = crabBoard(4, [[0, 1], [2, 2, 2, 2], [3], [1], []], 0, 1, EVERY, [{}, { wet: [0, 0, 0, 3] }]);
    expect(pour(wet, 3, 4).crabMoved).toEqual({ from: 0, to: 1 });
  });

  it('with an hourglass and a tide jar under it, the crab rides along: they flip and turn, the crab stays on its jar', () => {
    const b = crabBoard(4, [[0, 1, 2], [2, 1, 0], [3], [1], []], 0, 2, EVERY, [{ hourglass: { every: 3, left: 1 } }, { tide: { every: 4, left: 1 } }]);
    const r = pour(b, 3, 4);
    expect(r).toMatchObject({ flipped: [0], turned: [1], crabMoved: null });
    expect(r.board.jars[0]).toMatchObject({ units: [2, 1, 0], crab: { every: 3, left: 1 } });
  });

  it('undo and restart bring back where the crab was and its count; the pour event names the step', () => {
    const b = crabBoard(4, [[0, 1], [2], [3], [1], []], 0, 1);
    const s = new GameSession(b, options);
    const events: SessionEvent[] = [];
    s.onChange((e) => events.push(e));
    expect(s.pour(3, 4)).toBe(true);
    expect(events.find((e) => e.type === 'pour')).toMatchObject({ crabMoved: { from: 0, to: 1 } });
    expect(crabAt(s.board)).toBe(1);
    expect(s.pour(4, 3)).toBe(true);
    expect(events.filter((e) => e.type === 'pour').at(-1)).not.toHaveProperty('crabMoved');
    s.undo();
    s.undo();
    expect(s.board).toEqual(b);
    s.pour(3, 4);
    s.restart();
    expect(s.board).toEqual(b);
  });

  it('the crab and its count are board state, and with a crab jar order is too', () => {
    const keys = [crabBoard(4, [[0, 1], [1]], 0, 2), crabBoard(4, [[0, 1], [1]], 0, 3), crabBoard(4, [[0, 1], [1]], 1, 2), makeBoard(4, [[0, 1], [1]])].map(boardKey);
    expect(new Set(keys).size).toBe(4);
    expect(jarKey(crabBoard(4, [[0, 1]], 0, 2).jars[0])).toBe('K2/3:0,1');
    // Same jars in another order: different with a crab (it steps in index order), the same without.
    expect(boardKey(crabBoard(4, [[0, 1], [1], [2]], 0, 2))).not.toBe(boardKey(crabBoard(4, [[0, 1], [2], [1]], 0, 2)));
    expect(boardKey(makeBoard(4, [[0, 1], [1], [2]]))).toBe(boardKey(makeBoard(4, [[0, 1], [2], [1]])));
  });

  it('with a crab every legal pour is useful (a wait), swaps included, so the board is stuck only when no pour is left', () => {
    const b = crabBoard(4, [[0, 1], [1, 0], [2, 2], []], 0, 3);
    expect(hasCrab(b)).toBe(true);
    expect(usefulMoves(b)).toEqual(legalMoves(b));
    expect(usefulMoves(b).some((m) => m.from === 2 && m.to === 3)).toBe(true);
    expect(isStuck(b)).toBe(false);
    // The only pour that would help is out of the crab's jar, and no other pour is legal: stuck.
    const stuck = crabBoard(2, [[0, 1], [1, 0], [0, 1]], 0, 1);
    expect(legalMoves(stuck)).toEqual([]);
    expect(isStuck(stuck)).toBe(true);
  });

  it('shuffle keeps the crab\'s jar as it is, sand, crab and count, and re-deals the others', () => {
    const b = crabBoard(4, [[0, 1, 2, 3], [3, 2, 1, 0], [], [0, 1, 2, 3], [3, 2, 1, 0], []], 0, 2);
    const next = findShuffle(b, options, createRng(7));
    expect(next).not.toBeNull();
    expect(next!.jars[0]).toEqual(b.jars[0]);
    expect(next!.jars.filter((j) => j.crab)).toHaveLength(1);
    expect(boardKey(next!)).not.toBe(boardKey(b));
  });
});

describe('solver and hint with the crab', () => {
  it('the solver plans with the crab: its path replays legally to a win and the crab moves on the way', () => {
    const b = crabBoard(4, [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], [], []], 0, 3);
    const r = solve(b, 100_000);
    expect(r.solvable).toBe(true);
    let s = b;
    let steps = 0;
    for (const m of r.path) {
      expect(canPour(s, m.from, m.to), JSON.stringify(m)).toBe(true);
      const p = pour(s, m.from, m.to);
      if (p.crabMoved) steps++;
      s = p.board;
    }
    expect(isWon(s)).toBe(true);
    expect(steps).toBeGreaterThan(0);
  });

  it('a failed search on a crab board never claims "unwinnable" (the crab search is not exhaustive)', () => {
    const stuck = crabBoard(2, [[0, 1], [1, 0], [0, 1]], 0, 1);
    expect(solve(stuck, 10_000).solvable).toBeNull();
    expect(solve(makeBoard(2, [[0, 1], [1, 0], [0, 1]]), 10_000).solvable).toBe(false);
  });

  it('every hint is a legal move and following the hints wins the debut level', () => {
    const level = generateLevel(UNLOCK, cfg);
    expect(hasCrab(level.board)).toBe(true);
    const s = new GameSession(level.board, options);
    for (let i = 0; i < 200 && s.status === 'playing'; i++) {
      const m = s.hint();
      expect(m).not.toBeNull();
      expect(s.pour(m!.from, m!.to)).toBe(true);
    }
    expect(s.status).toBe('won');
  }, 60_000);
});

describe('crab jar placement and generation (K3)', () => {
  it('is not classic, so it is in no daily rotation, and has its card id (strings from K5)', () => {
    expect(isClassicMechanic('crab')).toBe(false);
    expect(splitMechanics(['crab'])).toEqual({ mechanics: [], crab: true });
    expect(specMechanics(levelSpec(UNLOCK, cfg))).toEqual(['crab']);
  });

  it('debuts alone on level 281 with two spares (D28): the crab on one filled jar counting from every', () => {
    const spec = levelSpec(UNLOCK, cfg);
    expect(spec).toMatchObject({ crab: true, mechanics: [], spare: 2, challenge: false });
    expect(spec.hourglass || spec.sieve || spec.clam || spec.wet || spec.tide || spec.lighthouse).toBeFalsy();
    const g = generateLevel(UNLOCK, cfg);
    expect(g.spec.crab).toBe(true);
    expect(g.attempts).toBeGreaterThan(0);
    const crabs = g.board.jars.filter((j) => j.crab);
    expect(crabs).toHaveLength(1);
    expect(crabs[0].crab).toEqual({ every: EVERY, left: EVERY });
    expect(crabs[0].units.length).toBeGreaterThan(0);
    expect(g.board.jars.some((j) => j.wet || j.hourglass || j.tide || j.lighthouse || j.clam !== undefined || j.sieve !== undefined || j.cap !== undefined || j.funnel || j.frozen || j.lock !== undefined)).toBe(false);
  });

  it('a debut level rolls no other own roll (D28): 281 holds the crab alone', () => {
    expect(withOwnRolls(UNLOCK, ['crab'], cfg)).toEqual(['crab']);
  });

  it('never rolls before level 281', () => {
    for (let l = 1; l < UNLOCK; l++) {
      expect(levelSpec(l, cfg).crab, `level ${l}`).toBeFalsy();
      expect(pickMechanics(l, cfg)).not.toContain('crab');
    }
  });

  it('starts on one filled jar it could otherwise be poured from: not sealed, frozen, locked, a funnel or a closed clam', () => {
    const dealt = makeBoard(4, [[0, 1, 2, 3], [1, 1, 1, 1], [3, 2, 1, 0], [2, 3, 0, 1], [0, 0, 2, 3], [1, 2, 3, 0], [3, 0, 1, 2], [2, 1, 3, 0], [], []], [2, 0, 2, 2, 2, 2, 2, 2, 0, 0]);
    let placed = 0;
    const where = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const spec: LevelSpec = { ...levelSpec(UNLOCK + 1, cfg), colors: 4, mechanics: ['frozen', 'locked', 'narrow', 'funnel'], hourglass: true, sieve: true, clam: true, tide: true, crab: true };
      const b = applyMechanics(dealt, spec, createRng(seed), cfg);
      if (!hasMechanics(b, spec)) continue;
      placed++;
      const crabs = b.jars.filter((j) => j.crab);
      expect(crabs, `seed ${seed}`).toHaveLength(1);
      const j = crabs[0];
      expect(j.units.length).toBeGreaterThan(0);
      expect(j.crab).toEqual({ every: EVERY, left: EVERY });
      expect(j.frozen || j.lock !== undefined || j.funnel || j.clam !== undefined || isSealed(j, 4)).toBeFalsy();
      where.add(j.hourglass ? 'hourglass' : j.sieve !== undefined ? 'sieve' : j.tide ? 'tide' : 'plain');
    }
    expect(placed).toBeGreaterThan(30);
    expect(where.has('plain')).toBe(true);
  });

  it('draws from the placement stream after the tide jar, so the earlier mechanics are unchanged', () => {
    const dealt = makeBoard(4, [[0, 1, 2, 3], [3, 2, 1, 0], [2, 3, 0, 1], [1, 0, 3, 2], [0, 2, 1, 3], [], []], [2, 2, 2, 2, 2, 0, 0]);
    for (let seed = 1; seed <= 40; seed++) {
      const spec: LevelSpec = { ...levelSpec(UNLOCK + 1, cfg), colors: 4, mechanics: ['frozen'], hourglass: true, sieve: true, clam: true, tide: true };
      const without = applyMechanics(dealt, spec, createRng(seed), cfg);
      const withIt = applyMechanics(dealt, { ...spec, crab: true }, createRng(seed), cfg);
      expect(withIt.jars.map(({ crab: _c, ...rest }) => rest)).toEqual(without.jars);
    }
  });

  it('every is tunable from config', () => {
    const tuned = { ...cfg, mechanics: { ...cfg.mechanics, list: cfg.mechanics.list.map((m) => (m.id === 'crab' ? { ...m, every: 5 } : m)) } } as GameConfig;
    const b = applyMechanics(makeBoard(4, [[0, 1, 2, 3], [3, 2, 1, 0], [], []]), { ...levelSpec(UNLOCK + 1, cfg), colors: 4, mechanics: [], crab: true }, createRng(1), tuned);
    expect(b.jars.find((j) => j.crab)!.crab).toEqual({ every: 5, left: 5 });
  });

  it('fallback: the crab with classic mechanics first keeps the classic ones alone, then none', () => {
    const base = levelSpec(UNLOCK, cfg);
    const row = (spec: LevelSpec) => levelSteps(spec, cfg).map((st) => [st.spec.mechanics.join('+'), st.spec.crab === true]);
    expect(row({ ...base, mechanics: ['frozen'], crab: true })).toEqual([['frozen', true], ['frozen', false], ['', false]]);
    expect(row({ ...base, mechanics: [], crab: true })).toEqual([['', true], ['', false]]);
  });

  it('every crab level of 281-440 is built with the crab, within its pour cap, and its solution replays to a win', () => {
    let crabLevels = 0;
    for (let l = UNLOCK; l <= 440; l++) {
      if (!levelSpec(l, cfg).crab) continue;
      const g = generateLevel(l, cfg);
      expect(g.spec.crab, `level ${l} keeps the crab`).toBe(true);
      expect(g.attempts, `level ${l}`).toBeGreaterThan(0);
      expect(g.board.jars.filter((j) => j.crab), `level ${l}`).toHaveLength(1);
      expect(g.solutionLength, `level ${l}`).toBeLessThanOrEqual(maxPoursFor(l, cfg));
      const r = solve(g.board, cfg.generator.solverNodeBudget);
      expect(r.solvable, `level ${l}`).toBe(true);
      let b = g.board;
      for (const m of r.path) {
        expect(canPour(b, m.from, m.to), `level ${l}`).toBe(true);
        b = pour(b, m.from, m.to).board;
      }
      expect(isWon(b), `level ${l}`).toBe(true);
      crabLevels++;
    }
    expect(crabLevels).toBeGreaterThanOrEqual(10);
  }, 240_000);

  it('its own roll (D210) puts the crab on about 1 level in 8 from 281: between 12% and 13% of 281-1000', () => {
    let crab = 0;
    for (let l = UNLOCK; l <= 1000; l++) if (levelSpec(l, cfg).crab) crab++;
    const share = crab / (1000 - UNLOCK + 1);
    expect(share).toBeGreaterThanOrEqual(0.12);
    expect(share).toBeLessThanOrEqual(0.13);
  });

  it('comes from its own roll only (shared: false): ownChance 0 leaves only the debut', () => {
    const off = { ...cfg, mechanics: { ...cfg.mechanics, list: cfg.mechanics.list.map((m) => (m.id === 'crab' ? { ...m, ownChance: 0 } : m)) } } as GameConfig;
    const levels: number[] = [];
    for (let l = UNLOCK; l <= 1000; l++) if (levelSpec(l, off).crab) levels.push(l);
    expect(levels).toEqual([UNLOCK]);
  });
});

describe('the crab stays out of the daily, the weekly and events (D210)', () => {
  it('the daily never features the crab (two years of days from 2026-11-01)', () => {
    for (let d = 0; d < 730; d++) {
      const key = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10);
      expect(dailySpec(key, cfg).crab, key).toBeFalsy();
    }
  });

  it('no weekly theme features the crab, and no weekly board of 52 weeks has it', () => {
    expect((config.weekly.themes as { mechanic?: string }[]).some((t) => t.mechanic === 'crab')).toBe(false);
    for (let w = 1; w <= 52; w++) {
      const week = `2027-W${String(w).padStart(2, '0')}`;
      for (let i = 0; i < 3; i++) expect(weeklySpec(week, i, cfg).crab, `${week} #${i}`).toBeFalsy();
    }
  });

  it('no event board has the crab', () => {
    for (const e of cfg.events) for (let n = 1; n <= e.boards; n++) expect(eventSpec(e, 2026, n, cfg).crab, `${e.id} #${n}`).toBeFalsy();
  });
});
