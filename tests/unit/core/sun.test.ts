// Story: production/sprints/sprint-29.md N2 (sunrise and sunset jars, core rules, D218–D223). Design: design/gdd/jar-mechanics.md §2.11
import { describe, expect, it } from 'vitest';
import {
  type Board,
  type Jar,
  type PourRefusal,
  boardKey,
  isComplete,
  isStuck,
  isSunDone,
  isWon,
  jarKey,
  legalMoves,
  lostReason,
  makeBoard,
  pour,
  pourRefusal,
  sunAt,
  sunriseLostColor,
  sunsetLostColor,
  usefulMoves,
} from '../../../src/core/board';
import { type Rng, createRng, shuffle } from '../../../src/core/rng';
import { GameSession, type SessionEvent, findShuffle } from '../../../src/core/session';
import { solve } from '../../../src/core/solver';

/** Session tuning for these tiny boards (budgets far above what they need). */
const options = { hintNodeBudget: 50_000, shuffleNodeBudget: 50_000, shuffleAttempts: 40 };
/** A budget big enough to settle these small boards exactly. */
const PROOF = 200_000;
const SUN_REASONS: readonly PourRefusal[] = ['sun', 'sunrise', 'sunset'];

/**
 * A board from colour arrays with the sunrise jar at `rise[0]` banded `rise[1]` and the sunset jar at
 * `set[0]` banded `set[1]`, plus optional extra jar fields by index.
 */
function pairBoard(capacity: number, jars: number[][], rise: [number, number], set: [number, number], extra: Record<number, Partial<Jar>> = {}): Board {
  const b = makeBoard(capacity, jars);
  return {
    capacity,
    jars: b.jars.map((j, i): Jar => ({
      ...j,
      ...(extra[i] ?? {}),
      ...(i === rise[0] ? { sun: { band: rise[1], at: 'rise' as const } } : {}),
      ...(i === set[0] ? { sun: { band: set[1], at: 'set' as const } } : {}),
    })),
  };
}

/** Replays `path` from `board`, checking every step is legal; returns the boards after each pour. */
function replay(board: Board, path: readonly { from: number; to: number }[]): Board[] {
  const out: Board[] = [];
  let b = board;
  for (const m of path) {
    expect(pourRefusal(b, m.from, m.to)).toBeNull();
    b = pour(b, m.from, m.to).board;
    out.push(b);
  }
  return out;
}

/** Asserts that a winning line fills the sunrise jar before any other jar and the sunset jar on its last pour. */
function expectInOrder(start: Board, after: readonly Board[]): void {
  const rise = sunAt(start, 'rise');
  const set = sunAt(start, 'set');
  const cap = start.capacity;
  let prev = start;
  let riseDone = isComplete(start.jars[rise], cap);
  after.forEach((b, k) => {
    for (let i = 0; i < b.jars.length; i++) {
      if (isComplete(b.jars[i], cap) && !isComplete(prev.jars[i], cap)) {
        if (i === rise) riseDone = true;
        else expect(riseDone).toBe(true);
        if (i === set) expect(k).toBe(after.length - 1);
      }
    }
    prev = b;
  });
  expect(isWon(after[after.length - 1])).toBe(true);
}

describe('pour refusals (§2.11 rules 3, 5, 6, 7)', () => {
  it("'sun': only the band goes into a sunrise or sunset jar, even an empty one; anything comes out", () => {
    const b = pairBoard(3, [[], [1], [0, 1], [1, 0], []], [0, 0], [1, 1]);
    expect(pourRefusal(b, 2, 0)).toBe('sun');
    expect(pourRefusal(b, 3, 1)).toBe('sun');
    expect(pourRefusal(b, 3, 0)).toBeNull();
    expect(pourRefusal(b, 2, 1)).toBeNull();
    expect(pourRefusal(b, 1, 4)).toBeNull(); // out of the sunset jar into an empty plain jar
  });

  it("'sun' comes after the source checks and before room and top colour", () => {
    const b = pairBoard(3, [[], [1], [0, 1], [1, 0], []], [0, 0], [1, 1], { 2: { frozen: true } });
    expect(pourRefusal(b, 2, 0)).toBe('closed');
    expect(pourRefusal(b, 4, 0)).toBe('empty');
    const full = pairBoard(2, [[1, 0], [], [1], [0]], [0, 0], [1, 1]);
    expect(pourRefusal(full, 2, 0)).toBe('sun'); // wrong colour into a full sunrise jar: the band first
    expect(pourRefusal(full, 3, 0)).toBe('full');
    const dealt = pairBoard(3, [[1], [], [0]], [0, 0], [1, 1]);
    expect(pourRefusal(dealt, 2, 0)).toBe('colour'); // the band onto dealt sand of another colour
  });

  it("'sunrise': while the sunrise jar is not filled, a pour that would fill another jar is refused", () => {
    const b = pairBoard(2, [[0], [], [1], [0, 1], []], [0, 0], [1, 1]);
    expect(pourRefusal(b, 3, 2)).toBe('sunrise');
    expect(pourRefusal(b, 3, 4)).toBeNull(); // into an empty jar fills nothing
    // Filling the sunset jar first breaks both rules: the sunrise note wins (D219).
    const half = pour(b, 3, 1).board;
    expect(pourRefusal(half, 2, 1)).toBe('sunrise');
    // Filling the sunrise jar itself is the way on.
    expect(pourRefusal(half, 3, 0)).toBeNull();
  });

  it("'sunrise' and 'sunset' are judged only on otherwise legal pours ('full' and 'colour' come first)", () => {
    const b = pairBoard(2, [[0], [], [1, 1], [2, 1], [2], [0, 2], [1]], [0, 0], [1, 1]);
    expect(pourRefusal(b, 3, 2)).toBe('full');
    expect(pourRefusal(b, 5, 6)).toBe('colour');
    expect(pourRefusal(b, 5, 4)).toBe('sunrise');
  });

  it("'sunset': the pour that would fill the sunset jar is refused unless it wins", () => {
    // The sunset jar holds 3 of 4 and a jar is still mixed (§3 example).
    const b = pairBoard(4, [[0, 0, 0, 0], [1, 1, 1], [2, 2, 1], [2, 2], []], [0, 0], [1, 1]);
    expect(pourRefusal(b, 2, 1)).toBe('sunset');
    const sorted = pour(pour(b, 2, 4).board, 3, 2).board;
    expect(pourRefusal(sorted, 4, 1)).toBeNull();
    expect(isWon(pour(sorted, 4, 1).board)).toBe(true);
  });

  it("'sunset': filling the sunset jar while its source still holds band sand is refused", () => {
    const b = pairBoard(4, [[0, 0, 0, 0], [1, 1, 1], [1, 2, 1], [2, 2, 2]], [0, 0], [1, 1]);
    expect(pourRefusal(b, 2, 1)).toBe('sunset');
  });

  it('the sunset jar may hold its band up to one unit short of full', () => {
    const b = pairBoard(4, [[0, 0, 0, 0], [1], [2, 1, 1], [2, 2, 2], [1]], [0, 0], [1, 1]);
    expect(pourRefusal(b, 2, 1)).toBeNull();
    expect(pour(b, 2, 1).board.jars[1].units).toEqual([1, 1, 1]);
  });

  it('a narrow jar is never filled, so the sunrise refusal never applies to it', () => {
    const b = pairBoard(2, [[0], [], [], [1, 0], [1]], [0, 0], [1, 1], { 2: { cap: 1 } });
    expect(pourRefusal(b, 3, 2)).toBeNull();
  });

  it('boards without the pair never give a sun reason, and their refusals are unchanged', () => {
    const rng = createRng(29);
    for (let t = 0; t < 40; t++) {
      let b = randomBoard(rng, false);
      for (let step = 0; step < 6; step++) {
        for (let from = 0; from < b.jars.length; from++) {
          for (let to = 0; to < b.jars.length; to++) expect(SUN_REASONS).not.toContain(pourRefusal(b, from, to));
        }
        const moves = legalMoves(b);
        if (!moves.length) break;
        const m = moves[Math.floor(rng() * moves.length)];
        b = pour(b, m.from, m.to).board;
      }
    }
  });
});

describe('winning (§2.11 rule 8)', () => {
  it('isSunDone: complete in its band only', () => {
    expect(isSunDone({ units: [1, 1], hidden: 0, sun: { band: 1, at: 'set' } }, 2)).toBe(true);
    expect(isSunDone({ units: [], hidden: 0, sun: { band: 1, at: 'set' } }, 2)).toBe(false);
    expect(isSunDone({ units: [1], hidden: 0, sun: { band: 1, at: 'rise' } }, 2)).toBe(false);
    expect(isSunDone({ units: [2, 2], hidden: 0, sun: { band: 1, at: 'rise' } }, 2)).toBe(false);
    expect(isSunDone({ units: [1, 1], hidden: 0 }, 2)).toBe(false);
  });

  it('both jars complete in their bands win; an empty sunset jar with everything else sorted does not', () => {
    expect(isWon(pairBoard(2, [[0, 0], [1, 1], [2, 2], []], [0, 0], [1, 1]))).toBe(true);
    const emptySet = pairBoard(2, [[0, 0], [], [1, 1], []], [0, 0], [1, 1]);
    expect(isWon(emptySet)).toBe(false);
    expect(isStuck(emptySet)).toBe(true);
    const emptyRise = pairBoard(2, [[], [1, 1], [0, 0]], [0, 0], [1, 1]);
    expect(isWon(emptyRise)).toBe(false);
  });

  it('a sun jar complete in another colour is not done', () => {
    expect(isWon(pairBoard(2, [[2, 2], [1, 1], [0, 0]], [0, 0], [1, 1]))).toBe(false);
  });
});

describe('the sunrise moment and the seal it brings (§2.11 rule 9, D223)', () => {
  /** Frozen jar 3 and jar 4 locked by the sunrise band: both stay shut until the sunrise jar is filled. */
  const wake = () => pairBoard(2, [[0], [], [1, 0], [2, 1], [2], []], [0, 0], [1, 1], { 3: { frozen: true }, 4: { lock: 0 } });

  it('pour() reports sunrise: true on the pour that fills the sunrise jar, and only then', () => {
    const b = wake();
    const r = pour(b, 2, 0);
    expect(r.sunrise).toBe(true);
    const next = pour(r.board, 2, 5);
    expect('sunrise' in next).toBe(false);
    const plain = pour(makeBoard(2, [[0], [1, 0], []]), 1, 0);
    expect('sunrise' in plain).toBe(false);
  });

  it('frozen jars and locks stay shut until the sunrise jar is filled; filling it thaws and unlocks', () => {
    const b = wake();
    expect(pourRefusal(b, 3, 5)).toBe('closed');
    expect(pourRefusal(b, 4, 5)).toBe('closed');
    const after = pour(b, 2, 0).board;
    expect(after.jars[3].frozen).toBeUndefined();
    expect(after.jars[4].lock).toBeUndefined();
    const r = solve(b, PROOF);
    expect(r.solvable).toBe(true);
    expectInOrder(b, replay(b, r.path));
  });

  it("the session's pour event carries sunrise: true", () => {
    const s = new GameSession(wake(), options);
    const events: SessionEvent[] = [];
    s.onChange((e) => events.push(e));
    s.pour(2, 5);
    s.undo();
    s.pour(2, 0);
    const pours = events.filter((e) => e.type === 'pour');
    expect(pours).toHaveLength(2);
    expect('sunrise' in pours[0]).toBe(false);
    expect(pours[1]).toMatchObject({ type: 'pour', sunrise: true });
  });
});

describe('the crab with the pair', () => {
  it('the crab on the last source with every other jar done: pouring out of the sunset jar onto it is legal and counts it down', () => {
    const b = pairBoard(4, [[0, 0, 0, 0], [1, 1], [1], []], [0, 0], [1, 1], { 2: { crab: { every: 3, left: 2 } } });
    expect(pourRefusal(b, 2, 1)).toBe('crab');
    expect(pourRefusal(b, 1, 2)).toBeNull();
    const r = pour(b, 1, 2);
    expect(r.board.jars[2].units).toEqual([1, 1, 1]);
    expect(r.board.jars[2].crab).toEqual({ every: 3, left: 1 });
  });

  it('a crab board with the pair plays to a win, in order', () => {
    const b = pairBoard(3, [[2, 0, 0], [0, 1], [1, 2, 1], [2], [], []], [0, 0], [1, 1], { 3: { crab: { every: 3, left: 3 } } });
    const r = solve(b, PROOF);
    expect(r.solvable).toBe(true);
    expectInOrder(b, replay(b, r.path));
  });
});

describe('board state, keys and useful moves (§2.11 rules 11, 12)', () => {
  it('jarKey carries R{band} and D{band}; empty sunrise, sunset and plain jars all differ', () => {
    expect(jarKey({ units: [0], hidden: 0, sun: { band: 2, at: 'rise' } })).toBe('R2:0');
    expect(jarKey({ units: [], hidden: 0, sun: { band: 2, at: 'set' } })).toBe('D2:');
    expect(jarKey({ units: [0, 1], hidden: 0 })).toBe('0,1'); // a plain jar's key is unchanged
    const keys = new Set([jarKey({ units: [], hidden: 0 }), jarKey({ units: [], hidden: 0, sun: { band: 2, at: 'rise' } }), jarKey({ units: [], hidden: 0, sun: { band: 2, at: 'set' } })]);
    expect(keys.size).toBe(3);
    const b = pairBoard(2, [[], [], [0, 1], [1, 0], []], [0, 0], [1, 1]);
    const plain = makeBoard(2, [[], [], [0, 1], [1, 0], []]);
    expect(boardKey(b)).not.toBe(boardKey(plain));
  });

  it('a whole one-colour run into an empty sun jar, or out of one into an empty plain jar, is not a pure swap', () => {
    const b = pairBoard(2, [[0], [], [], [1], [2, 1]], [1, 0], [3, 1]);
    const useful = usefulMoves(b);
    expect(useful).toContainEqual({ from: 0, to: 1 }); // plain one-colour run into the empty sunrise jar
    expect(useful).toContainEqual({ from: 3, to: 2 }); // out of the sunset jar into an empty plain jar
    expect(useful).not.toContainEqual({ from: 0, to: 2 }); // plain into plain is still a swap
  });

  it('the solver uses empty sun jars even when an empty plain jar comes first', () => {
    const b = pairBoard(2, [[], [], [], [1, 0], [0, 1]], [1, 0], [2, 1]);
    const r = solve(b, PROOF);
    expect(r.solvable).toBe(true);
    expectInOrder(b, replay(b, r.path));
  });

  it('undo, restart and a saved board keep band and role', () => {
    const b = pairBoard(2, [[0], [], [1, 0], [2, 1], [2], []], [0, 0], [1, 1]);
    const s = new GameSession(b, options);
    s.pour(2, 0);
    expect(s.board.jars[0].sun).toEqual({ band: 0, at: 'rise' });
    s.undo();
    expect(s.board).toEqual(b);
    s.pour(2, 0);
    s.restart();
    expect(s.board).toEqual(b);
    const saved = JSON.parse(JSON.stringify(b)) as Board;
    expect(saved).toEqual(b);
    expect(boardKey(saved)).toBe(boardKey(b));
    expect(pourRefusal(saved, 3, 1)).toBe(pourRefusal(b, 3, 1));
  });

  it('following hints wins, with the sunrise jar filled first and the sunset jar last', () => {
    const b = pairBoard(3, [[2, 0, 0], [0, 1], [1, 2, 1], [2], [], []], [0, 0], [1, 1]);
    const s = new GameSession(b, options);
    const boards: Board[] = [];
    for (let k = 0; k < 40 && s.status !== 'won'; k++) {
      const h = s.hintResult();
      expect('move' in h).toBe(true);
      if (!('move' in h)) break;
      expect(s.pour(h.move.from, h.move.to)).toBe(true);
      boards.push(s.board);
    }
    expect(s.status).toBe('won');
    expectInOrder(b, boards);
  });
});

describe('Shuffle (§2.11 rule 13)', () => {
  it('the pair keeps its sand, and while the sunrise jar is open no re-deal fills a jar', () => {
    // Re-dealing {2, 0, 1, 2} into jars 2 and 3 fills a jar with 2 a third of the time; those deals are winnable, so only the rule rejects them.
    const b = pairBoard(2, [[0], [1], [2, 0], [1, 2], [], []], [0, 0], [1, 1]);
    let found = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const next = findShuffle(b, options, createRng(seed));
      if (!next) continue;
      found++;
      expect(next.jars[0]).toEqual(b.jars[0]);
      expect(next.jars[1]).toEqual(b.jars[1]);
      expect(next.jars.some((j) => isComplete(j, 2))).toBe(false);
      expect(solve(next, PROOF).solvable).toBe(true);
    }
    expect(found).toBeGreaterThan(0);
  });

  it('once the sunrise jar is filled, a re-deal may fill a jar', () => {
    const b = pairBoard(2, [[0, 0], [1], [2, 1], [2], []], [0, 0], [1, 1]);
    let filled = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const next = findShuffle(b, options, createRng(seed));
      if (next && isComplete(next.jars[2], 2)) filled++;
    }
    expect(filled).toBeGreaterThan(0);
  });
});

describe('dead ends (§2.11, D221)', () => {
  it("'sunrise': band sand in a frozen jar can't reach the sunrise jar in time", () => {
    const b = pairBoard(2, [[0], [], [1, 0], [1], []], [0, 0], [1, 1], { 2: { frozen: true } });
    expect(lostReason(b)).toBe('sunrise');
    expect(sunriseLostColor(b)).toBe(0);
    expect(solve(b, PROOF).solvable).toBe(false);
  });

  it("'sunrise': band sand in a funnel, or behind a lock keyed to another colour, is out of reach", () => {
    const funnel = pairBoard(2, [[0], [], [0], [1], [1]], [0, 0], [1, 1], { 2: { funnel: true } });
    expect(lostReason(funnel)).toBe('sunrise');
    expect(solve(funnel, PROOF).solvable).toBe(false);
    const locked = pairBoard(2, [[0], [], [1, 0], [1], []], [0, 0], [1, 1], { 2: { lock: 1 } });
    expect(lostReason(locked)).toBe('sunrise');
    expect(sunriseLostColor(locked)).toBe(0);
    expect(solve(locked, PROOF).solvable).toBe(false);
  });

  it('look-alike: a frozen jar without band sand is not a dead end, and the board wins', () => {
    const b = pairBoard(2, [[], [], [1, 2], [0, 1], [2, 0], []], [0, 0], [1, 1], { 2: { frozen: true } });
    expect(lostReason(b)).toBeNull();
    const r = solve(b, PROOF);
    expect(r.solvable).toBe(true);
    expectInOrder(b, replay(b, r.path));
  });

  it("look-alike: a closed clam's band sand counts as reachable", () => {
    const b = pairBoard(2, [[0], [], [0], [1], [1], []], [0, 0], [1, 1], { 2: { clam: 2 } });
    expect(lostReason(b)).toBeNull();
  });

  it("'sunset': filling a plain jar in the sunset band is legal after the sunrise, then reported", () => {
    const b = pairBoard(2, [[0, 0], [], [1], [1]], [0, 0], [1, 1]);
    expect(pourRefusal(b, 2, 3)).toBeNull();
    const after = pour(b, 2, 3).board;
    expect(lostReason(after)).toBe('sunset');
    expect(sunsetLostColor(after)).toBe(1);
    expect(sunriseLostColor(after)).toBeNull();
    expect(solve(after, PROOF).solvable).toBe(false);
  });

  it("'sunset': sunset band sand held in a funnel", () => {
    const b = pairBoard(2, [[0, 0], [], [1], [1]], [0, 0], [1, 1], { 2: { funnel: true } });
    expect(lostReason(b)).toBe('sunset');
    expect(solve(b, PROOF).solvable).toBe(false);
  });

  it("order: 'sunrise' before 'sunset', both before 'funnel'", () => {
    // Jar 2 holds the sunrise band in a funnel; jar 3 is a mixed funnel holding the sunset band.
    const both = pairBoard(2, [[0], [], [0], [2, 1], [2, 1]], [0, 0], [1, 1], { 2: { funnel: true }, 3: { funnel: true } });
    expect(lostReason(both)).toBe('sunrise');
    const setOnly = pairBoard(2, [[0], [], [0], [2, 1], [2, 1]], [0, 0], [1, 1], { 3: { funnel: true } });
    expect(lostReason(setOnly)).toBe('sunset');
  });

  it('no pair, no sun dead end; a filled sunrise jar is never a sunrise dead end', () => {
    expect(sunriseLostColor(makeBoard(2, [[0], [0, 1], [1]]))).toBeNull();
    expect(sunsetLostColor(makeBoard(2, [[0], [0, 1], [1]]))).toBeNull();
    expect(sunriseLostColor(pairBoard(2, [[0, 0], [], [1, 1]], [0, 0], [1, 1]))).toBeNull();
  });
});

/**
 * A small random board: 3 colours of `capacity` (2 or 3) units dealt into 3 full jars, plus 2 empty ones.
 * With `pair`, two of the full jars become the sunrise and sunset jars in two different bands, and a
 * third may be frozen, locked or a funnel, so the dead ends come up.
 */
function randomBoard(rng: Rng, pair: boolean): Board {
  const capacity = 2 + Math.floor(rng() * 2);
  const colors = 3;
  const pool = shuffle(Array.from({ length: colors * capacity }, (_, k) => k % colors), rng);
  const jars: number[][] = [];
  for (let c = 0; c < colors; c++) jars.push(pool.slice(c * capacity, (c + 1) * capacity));
  jars.push([], []);
  const b = makeBoard(capacity, jars);
  const order = shuffle([0, 1, 2], rng);
  const extra: { frozen?: boolean; lock?: number; funnel?: boolean } = {};
  const roll = rng();
  if (roll < 0.25) extra.frozen = true;
  else if (roll < 0.5) extra.lock = Math.floor(rng() * colors);
  else if (roll < 0.65) extra.funnel = true;
  if (!pair) return { capacity, jars: b.jars.map((j, i) => (i === order[2] ? { ...j, ...extra } : j)) };
  const bands = shuffle([0, 1, 2], rng);
  return {
    capacity,
    jars: b.jars.map((j, i): Jar => {
      if (i === order[0]) return { ...j, sun: { band: bands[0], at: 'rise' } };
      if (i === order[1]) return { ...j, sun: { band: bands[1], at: 'set' } };
      return i === order[2] ? { ...j, ...extra } : j;
    }),
  };
}

describe('property: the solver against the rules on small random pair boards', () => {
  it("whenever lostReason says 'sunrise' or 'sunset' the solver finds no win; every found win is legal and in order", () => {
    const rng = createRng(361);
    const hits = { sunrise: 0, sunset: 0 };
    let wins = 0;
    for (let t = 0; t < 400; t++) {
      let b = randomBoard(rng, true);
      for (let step = 0; step < 10; step++) {
        const reason = lostReason(b);
        const r = solve(b, PROOF);
        if (reason === 'sunrise' || reason === 'sunset') {
          hits[reason]++;
          expect(r.solvable).not.toBe(true);
        }
        if (r.solvable === true && r.path.length > 0) {
          wins++;
          expectInOrder(b, replay(b, r.path));
        }
        const moves = legalMoves(b);
        if (!moves.length || isWon(b)) break;
        const m = moves[Math.floor(rng() * moves.length)];
        b = pour(b, m.from, m.to).board;
      }
    }
    expect(hits.sunrise).toBeGreaterThan(0);
    expect(hits.sunset).toBeGreaterThan(0);
    expect(wins).toBeGreaterThan(0);
  });
});
