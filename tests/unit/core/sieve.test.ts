// Story: production/sprints/sprint-13.md M2 (sieve jar, D96, D97). Design: design/gdd/jar-mechanics.md §2.5
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import pins from '../../fixtures/boards-101-140.json';
import { type Board, type Jar, boardKey, canPour, isSealed, isStuck, isWon, legalMoves, lostReason, makeBoard, pour, pourRefusal, usefulMoves } from '../../../src/core/board';
import { type DailyConfig, dailySpec } from '../../../src/core/daily';
import { applyMechanics, generateLevel, hasMechanics, levelSteps, proveDeal } from '../../../src/core/generator';
import { type GameConfig, type LevelSpec, isClassicMechanic, levelSpec, pickMechanics, specMechanics } from '../../../src/core/levels';
import { createRng } from '../../../src/core/rng';
import { GameSession, findShuffle } from '../../../src/core/session';
import { solve } from '../../../src/core/solver';

const cfg = config as unknown as GameConfig & DailyConfig;
const sieveTune = cfg.mechanics.list.find((m) => m.id === 'sieve');
const options = { hintNodeBudget: cfg.hint.solverNodeBudget, shuffleNodeBudget: cfg.shuffle.solverNodeBudget, shuffleAttempts: cfg.shuffle.maxAttempts };
const UNLOCK = sieveTune?.unlockAt ?? 141;

/** FNV-1a over JSON.stringify, matching the fixture generators. */
const hash = (b: Board) => {
  const s = JSON.stringify(b);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};

/** A board whose jar `at` is a sieve banded in `color`. */
function withSieve(capacity: number, jars: number[][], at: number, color: number, extra: Partial<Jar>[] = []): Board {
  const b = makeBoard(capacity, jars);
  return { capacity, jars: b.jars.map((j, i): Jar => ({ ...j, ...(extra[i] ?? {}), ...(i === at ? { sieve: color } : {}) })) };
}

const sieveIndex = (b: Board) => b.jars.findIndex((j) => j.sieve !== undefined);

describe('sieve rules (D96)', () => {
  it('config: the sieve unlocks at level 141', () => {
    expect(sieveTune).toMatchObject({ id: 'sieve', unlockAt: 141 });
  });

  it('only the sieve colour may be poured in; anything else is refused with the reason "sieve"', () => {
    // Jar 0 is a sieve banded in colour 1, holding [2, 1] (top 1).
    const b = withSieve(4, [[2, 1], [0, 1], [1, 0], []], 0, 1);
    expect(canPour(b, 1, 0)).toBe(true); // a 1 onto its 1
    expect(pourRefusal(b, 1, 0)).toBeNull();
    expect(canPour(b, 2, 0)).toBe(false); // a 0: not the sieve's colour
    expect(pourRefusal(b, 2, 0)).toBe('sieve');
    expect(() => pour(b, 2, 0)).toThrow();
  });

  it('an empty sieve takes only its colour', () => {
    const b = withSieve(4, [[], [0, 1], [1, 0]], 0, 1);
    expect(canPour(b, 1, 0)).toBe(true);
    expect(pourRefusal(b, 2, 0)).toBe('sieve');
  });

  it('the sieve colour still has to match the sieve top (the usual rule, reason "colour")', () => {
    const b = withSieve(4, [[1, 2], [0, 1]], 0, 1);
    expect(pourRefusal(b, 1, 0)).toBe('colour');
  });

  it('anything can be poured out of a sieve', () => {
    const b = withSieve(4, [[1, 2], [], [2]], 0, 1);
    expect(canPour(b, 0, 1)).toBe(true);
    expect(canPour(b, 0, 2)).toBe(true);
    expect(pour(b, 0, 2).board.jars[2].units).toEqual([2, 2]);
    expect(pour(b, 0, 2).board.jars[0].sieve).toBe(1);
  });

  it('pourRefusal names every other refusal, and canPour is exactly "no refusal"', () => {
    const frozen = withSieve(4, [[0, 1], [1], [0, 0, 0, 0], [], [2]], 0, 1, [{}, {}, {}, {}, { frozen: true }]);
    expect(pourRefusal(frozen, 1, 1)).toBe('same');
    expect(pourRefusal(frozen, 3, 1)).toBe('empty');
    expect(pourRefusal(frozen, 2, 3)).toBe('sealed');
    expect(pourRefusal(frozen, 4, 3)).toBe('closed');
    expect(pourRefusal(frozen, 1, 4)).toBe('closed');
    expect(pourRefusal(frozen, 0, 9)).toBe('missing');
    const funnel: Board = { capacity: 2, jars: [{ units: [0, 1], hidden: 0 }, { units: [1, 1], hidden: 0 }, { units: [0], hidden: 0, funnel: true }] };
    expect(pourRefusal(funnel, 2, 0)).toBe('funnel');
    expect(pourRefusal(makeBoard(2, [[0, 1], [0, 1]]), 0, 1)).toBe('full');
    expect(pourRefusal(makeBoard(4, [[0, 1], [0]]), 0, 1)).toBe('colour');
    const boards = [frozen, withSieve(4, [[2, 1], [0, 1], [1, 0], [], [1, 1, 1]], 3, 1), withSieve(4, [[1, 1, 1], [1], [0, 2], []], 0, 1)];
    for (const b of boards) for (let f = 0; f < b.jars.length; f++) for (let t = 0; t < b.jars.length; t++) expect(canPour(b, f, t), `${f}->${t}`).toBe(pourRefusal(b, f, t) === null);
  });

  it('a full sieve of its colour seals, and a board with it sealed is won', () => {
    const b = withSieve(4, [[1, 1, 1], [1], []], 0, 1);
    const after = pour(b, 1, 0).board;
    expect(isSealed(after.jars[0], 4)).toBe(true);
    expect(isWon(after)).toBe(true);
  });

  it('sealing the sieve thaws and unlocks like any seal, and keeps the band', () => {
    const b = withSieve(4, [[1, 1, 1], [1], [0, 2], [2, 0]], 0, 1, [{}, {}, { frozen: true }, { lock: 1 }]);
    const after = pour(b, 1, 0).board;
    expect(after.jars[2].frozen).toBeUndefined();
    expect(after.jars[3].lock).toBeUndefined();
    expect(after.jars[0].sieve).toBe(1);
  });

  it('a refused pour changes nothing in a session; undo and restart keep the band', () => {
    const b = withSieve(4, [[2, 1], [0, 1], [1, 0], []], 0, 1);
    const s = new GameSession(b, options);
    expect(s.pour(2, 0)).toBe(false);
    expect(s.moves).toBe(0);
    expect(s.pour(1, 0)).toBe(true);
    expect(s.board.jars[0]).toEqual({ units: [2, 1, 1], hidden: 0, sieve: 1 });
    s.undo();
    expect(s.board.jars[0]).toEqual(b.jars[0]);
    s.pour(0, 3);
    s.restart();
    expect(s.board.jars[0]).toEqual(b.jars[0]);
  });

  it('the band is board state: the same sand with another band, or none, is another state', () => {
    const a = withSieve(4, [[2, 1], [0, 1], []], 0, 1);
    const c = withSieve(4, [[2, 1], [0, 1], []], 0, 2);
    const plain = makeBoard(4, [[2, 1], [0, 1], []]);
    expect(new Set([boardKey(a), boardKey(c), boardKey(plain)]).size).toBe(3);
  });

  it('moving a one-colour jar whole into an empty sieve of that colour is useful (it frees an ordinary jar)', () => {
    const b = withSieve(4, [[], [1, 1], [0, 2], [2, 0], []], 0, 1);
    expect(usefulMoves(b).some((m) => m.from === 1 && m.to === 0)).toBe(true);
    expect(usefulMoves(b).some((m) => m.from === 1 && m.to === 4)).toBe(false); // plain to plain: a swap
  });

  it('a board whose only pours are into a sieve of another colour is stuck', () => {
    const jars = [[0, 1], [1, 0], [], [2, 2]];
    expect(isStuck(withSieve(2, jars, 2, 2))).toBe(true);
    expect(legalMoves(withSieve(2, jars, 2, 2))).toEqual([]);
    expect(isStuck(makeBoard(2, jars))).toBe(false);
  });

  it('adds no dead end of its own (D21): a mixed sieve can always still be poured out', () => {
    expect(lostReason(withSieve(4, [[0, 1, 0, 1], [1, 0, 1, 0], [], []], 0, 1))).toBeNull();
  });

  it('shuffle re-deals a free sieve like any free jar and keeps its colour', () => {
    const b = withSieve(4, [[0, 1, 2, 3], [3, 2, 1, 0], [], [0, 1, 2, 3], [3, 2, 1, 0], []], 0, 2);
    const next = findShuffle(b, options, createRng(7));
    expect(next).not.toBeNull();
    expect(next!.jars[0].sieve).toBe(2);
    expect(next!.jars[0].units.length).toBe(4);
    expect(solve(next!, cfg.shuffle.solverNodeBudget).solvable).toBe(true);
  });
});

describe('solver and hint with the sieve', () => {
  it('the solver never pours a wrong colour into a sieve: unwinnable with it, winnable without', () => {
    const jars = [[0, 1], [1, 0], [], [2, 2]];
    expect(solve(withSieve(2, jars, 2, 2), 50_000).solvable).toBe(false);
    expect(solve(makeBoard(2, jars), 50_000).solvable).toBe(true);
  });

  it('the solver can seal the sieve as its colour, and its path replays legally to a win', () => {
    const b = withSieve(2, [[0, 1], [1, 0], []], 0, 0);
    const r = solve(b, 50_000);
    expect(r.solvable).toBe(true);
    let s = b;
    for (const m of r.path) {
      expect(canPour(s, m.from, m.to)).toBe(true);
      s = pour(s, m.from, m.to).board;
    }
    expect(isWon(s)).toBe(true);
  });

  it('every hint is a legal move and following the hints wins a sieve level', () => {
    const level = generateLevel(UNLOCK, cfg);
    expect(sieveIndex(level.board)).toBeGreaterThanOrEqual(0);
    const s = new GameSession(level.board, options);
    for (let i = 0; i < 200 && s.status === 'playing'; i++) {
      const m = s.hint();
      expect(m).not.toBeNull();
      expect(s.pour(m!.from, m!.to)).toBe(true);
    }
    expect(s.status).toBe('won');
  }, 60_000);
});

describe('sieve colour choice (proveDeal)', () => {
  // Jar 0 holds [0, 1]. Banded 1 it can only end with the sieve empty (not a win, D214); banded 0 it ends sealed.
  const dealt = (color: number) => withSieve(2, [[0, 1], [1, 0], []], 0, color);

  it('prefers a colour whose proof ends with the sieve sealed as that colour', () => {
    const p = proveDeal(dealt(1), 50_000, Infinity, 2, 2);
    expect(p.result.solvable).toBe(true);
    expect(p.board.jars[0].sieve).toBe(0);
    let s = p.board;
    for (const m of p.result.path) s = pour(s, m.from, m.to).board;
    expect(isSealed(s.jars[0], 2)).toBe(true);
  });

  it('with one try the dealt colour is kept, and a band that can only end with the sieve empty is not a proof (D214)', () => {
    const p = proveDeal(dealt(1), 50_000, Infinity, 2, 1);
    expect(p.board.jars[0].sieve).toBe(1);
    expect(p.result.solvable).toBe(false);
  });

  it('a board without a sieve is proved exactly as before (one solve)', () => {
    const b = makeBoard(2, [[0, 1], [1, 0], []]);
    const p = proveDeal(b, 50_000, Infinity, 2, 3);
    const r = solve(b, 50_000);
    expect(p.board).toBe(b);
    expect(p.result).toEqual(r);
    expect(p.nodes).toBe(r.nodes);
  });
});

describe('sieve placement and generation', () => {
  it('is a card mechanic since its UI (sprint 13 M2), but not classic, so never in the daily rotation', () => {
    expect(isClassicMechanic('sieve')).toBe(false);
    expect(specMechanics(levelSpec(UNLOCK, cfg))).toEqual(['sieve']);
  });

  it('debuts alone on level 141 (no spare-jar swap, D28) and the board has one sieve', () => {
    const spec = levelSpec(UNLOCK, cfg);
    expect(spec.sieve).toBe(true);
    expect(spec.hourglass).toBeFalsy();
    expect(spec.mechanics).toEqual([]);
    expect(spec.spare).toBe(2);
    expect(generateLevel(UNLOCK, cfg).board.jars.filter((j) => j.sieve !== undefined).length).toBe(1);
  });

  it('never rolls before level 141', () => {
    for (let l = 1; l < UNLOCK; l++) {
      expect(levelSpec(l, cfg).sieve, `level ${l}`).toBeFalsy();
      expect(pickMechanics(l, cfg)).not.toContain('sieve');
    }
  });

  it('places one sieve on a filled, unsealed, plain jar (not frozen, locked, narrow, a funnel or the hourglass), in a board colour', () => {
    const dealt = makeBoard(4, [[0, 1, 2, 3], [1, 1, 1, 1], [3, 2, 1, 0], [2, 3, 0, 1], [0, 0, 2, 3], [], []], [3, 0, 3, 3, 3, 0, 0]);
    for (let seed = 1; seed <= 60; seed++) {
      const spec: LevelSpec = { ...levelSpec(UNLOCK, cfg), colors: 4, mechanics: ['frozen', 'locked', 'narrow', 'funnel'], hourglass: true, sieve: true };
      const b = applyMechanics(dealt, spec, createRng(seed), cfg);
      const sieves = b.jars.filter((j) => j.sieve !== undefined);
      expect(sieves.length).toBe(1);
      const s = sieves[0];
      expect(s.units.length).toBeGreaterThan(0);
      expect(isSealed(s, 4)).toBe(false);
      expect(s.frozen || s.lock !== undefined || s.funnel || s.cap !== undefined || s.hourglass !== undefined).toBeFalsy();
      expect(s.sieve).toBeGreaterThanOrEqual(0);
      expect(s.sieve).toBeLessThan(4);
      expect(hasMechanics(b, spec)).toBe(true);
      expect(hasMechanics(dealt, { ...spec, mechanics: [], hourglass: false })).toBe(false);
    }
  });

  it('draws from the placement stream only after every other mechanic, so the rest of the board is unchanged', () => {
    const dealt = makeBoard(4, [[0, 1, 2, 3], [3, 2, 1, 0], [2, 3, 0, 1], [1, 0, 3, 2], [], []], [3, 3, 3, 3, 0, 0]);
    for (let seed = 1; seed <= 20; seed++) {
      const spec: LevelSpec = { ...levelSpec(UNLOCK, cfg), colors: 4, mechanics: ['frozen', 'locked'], hourglass: true, sieve: false };
      const without = applyMechanics(dealt, spec, createRng(seed), cfg);
      const withIt = applyMechanics(dealt, { ...spec, sieve: true }, createRng(seed), cfg);
      expect(withIt.jars.map(({ sieve: _s, ...rest }) => rest)).toEqual(without.jars);
    }
  });

  it('fallback: a sieve with classic mechanics first keeps the classic ones alone, then none', () => {
    const base = levelSpec(170, cfg);
    const row = (spec: LevelSpec) => levelSteps(spec, cfg).map((st) => [st.spec.mechanics.join('+'), st.spec.hourglass === true, st.spec.sieve === true]);
    expect(row({ ...base, mechanics: ['frozen'], sieve: true })).toEqual([['frozen', false, true], ['frozen', false, false], ['', false, false]]);
    expect(row({ ...base, mechanics: [], sieve: true })).toEqual([['', false, true], ['', false, false]]);
    expect(row({ ...base, mechanics: [], hourglass: true, sieve: true })).toEqual([['', true, true], ['', false, false]]);
  });

  it('levels 141-340: every board with a sieve is solver-proven, has one sieve in a board colour, and its solution replays to a win', () => {
    let withSieveCount = 0;
    for (let l = UNLOCK; l <= 340; l++) {
      const g = generateLevel(l, cfg);
      const at = sieveIndex(g.board);
      if (at < 0) continue;
      withSieveCount++;
      expect(g.board.jars.filter((j) => j.sieve !== undefined).length, `level ${l}`).toBe(1);
      const color = g.board.jars[at].sieve!;
      expect(g.board.jars.flatMap((j) => j.units).filter((c) => c === color).length, `level ${l}`).toBe(g.board.capacity);
      const r = solve(g.board, cfg.generator.solverNodeBudget);
      expect(r.solvable, `level ${l}`).toBe(true);
      let b = g.board;
      for (const m of r.path) {
        expect(canPour(b, m.from, m.to), `level ${l}`).toBe(true);
        b = pour(b, m.from, m.to).board;
      }
      expect(isWon(b), `level ${l}`).toBe(true);
    }
    expect(withSieveCount).toBeGreaterThanOrEqual(5);
  }, 60_000);
});

describe('no earlier board changes (sprint 13 M2 hard constraints)', () => {
  it('levels 101-140 are byte-identical to boards-101-140.json', () => {
    const hashes = pins.hashes as Record<string, string>;
    expect(Object.keys(hashes).length).toBe(40);
    for (const [l, h] of Object.entries(hashes)) expect(hash(generateLevel(Number(l), cfg).board), `level ${l}`).toBe(h);
  }, 60_000);

  it('the daily Saturday rotation never picks the sieve before its start date (2026-11-28, sprint 13 W1)', () => {
    // Ten years of Saturdays up to 2026-11-21; from 2026-11-28 see tests/unit/weekly/new-jars-rotation.test.ts.
    for (let w = 0; w < 520; w++) {
      const key = new Date(Date.UTC(2026, 10, 21 - 7 * w)).toISOString().slice(0, 10);
      const spec = dailySpec(key, cfg);
      expect(spec.mechanics).not.toContain('sieve');
      expect(spec.sieve).toBeFalsy();
    }
  });

  it('no weekly theme features the sieve yet', () => {
    expect((config.weekly.themes as { mechanic?: string }[]).some((t) => t.mechanic === 'sieve')).toBe(false);
  });
});
