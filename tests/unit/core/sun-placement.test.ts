// Story: production/sprints/sprint-29.md N3 (generation of the sunrise and sunset jars, D218-D222).
// Design: design/gdd/jar-mechanics.md §2.11 ("Placement", "Band choice", "Schedule") and the §3 tuning knobs.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type Board, type Jar, canPour, isSealed, isWon, makeBoard, pour } from '../../../src/core/board';
import { type DailyConfig, dailySpec } from '../../../src/core/daily';
import { type EventsConfig, eventSpec } from '../../../src/core/events';
import { applyMechanics, generateLevel, hasMechanics, levelSteps, maxPoursFor, proveDeal, sunriseBands } from '../../../src/core/generator';
import { type GameConfig, type LevelSpec, isBreather, isClassicMechanic, levelSpec, pickMechanics, specMechanics, splitMechanics, withOwnRolls, withoutPairConflicts } from '../../../src/core/levels';
import { createRng, mixSeed } from '../../../src/core/rng';
import { solve } from '../../../src/core/solver';
import { type WeeklyConfig, weeklySpec } from '../../../src/core/weekly';

const cfg = config as unknown as GameConfig & DailyConfig & WeeklyConfig & EventsConfig;
const tune = cfg.mechanics.list.find((m) => m.id === 'sun');
const UNLOCK = tune?.unlockAt ?? 361;
const LAST_CHECKED = 1000;

/** Every number under a key named like a salt anywhere in the config. */
function salts(node: unknown, out: number[] = []): number[] {
  if (Array.isArray(node)) for (const x of node) salts(x, out);
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (/salt$/i.test(k) && typeof v === 'number') out.push(v);
      else salts(v, out);
    }
  }
  return out;
}

/** A spec with no mechanic at all, to build placement specs on (a real level's spec may carry other flags). */
const BASE: LevelSpec = { level: UNLOCK + 1, colors: 6, capacity: 4, spare: 2, buriedDepth: 2, challenge: false, mechanics: [] };

/** The jars of a board that carry the pair. */
const pairOf = (b: Board) => ({ rise: b.jars.filter((j) => j.sun?.at === 'rise'), set: b.jars.filter((j) => j.sun?.at === 'set') });

/** True when the jar is a plain jar for the pair: no other mechanic's jar but the crab's (D222). */
const plainForPair = (j: Jar, capacity: number) =>
  j.units.length > 0 && !j.frozen && j.lock === undefined && j.cap === undefined && !j.funnel && !j.hourglass && j.sieve === undefined && j.clam === undefined && !j.tide && !j.lighthouse && !j.wet && !isSealed(j, capacity);

/** A dealt board of `colors` colours (at least 4), capacity 4, two spares: full jar c holds c..c+3, two units buried. */
const dealt = (colors: number) =>
  makeBoard(
    4,
    [...Array.from({ length: colors }, (_, c) => [0, 1, 2, 3].map((k) => (c + k) % colors)), [], []],
    [...new Array<number>(colors).fill(2), 0, 0],
  );
const dealt6 = () => dealt(6);

describe('sunrise and sunset schedule (D220)', () => {
  it('config: unlocks at 361, 3 band pairs per deal, its own roll only, with a salt no other roll uses', () => {
    expect(tune).toMatchObject({ id: 'sun', unlockAt: 361, colorTries: 3, ownSalt: 9173, shared: false });
    expect(tune!.ownChance).toBeGreaterThan(0);
    expect(tune!.ownChance).toBeLessThanOrEqual(0.25);
    const all = salts(config);
    expect(all.filter((s) => s === 9173)).toHaveLength(1);
    const ids = cfg.mechanics.list.map((m) => m.id);
    expect(ids.indexOf('sun')).toBe(ids.indexOf('lighthouse') + 1);
  });

  it('is not classic, so no daily rotation picks it, and splits into its own spec flag', () => {
    expect(isClassicMechanic('sun')).toBe(false);
    expect(splitMechanics(['sun'])).toEqual({ mechanics: [], sun: true });
    expect(specMechanics({ mechanics: ['frozen'], crab: true, sun: true })).toEqual(['frozen', 'crab', 'sun']);
  });

  it('no level up to 360 rolls the pair', () => {
    for (let l = 1; l < UNLOCK; l++) {
      expect(levelSpec(l, cfg).sun, `level ${l}`).toBeFalsy();
      expect(pickMechanics(l, cfg)).not.toContain('sun');
    }
  });

  it('debuts on 361 alone with two spares and no spare swap (D28), and the debut rolls nothing else', () => {
    const spec = levelSpec(UNLOCK, cfg);
    expect(spec).toMatchObject({ sun: true, mechanics: [], spare: 2, challenge: false });
    expect(specMechanics(spec)).toEqual(['sun']);
    expect(withOwnRolls(UNLOCK, ['sun'], cfg)).toEqual(['sun']);
    const g = generateLevel(UNLOCK, cfg);
    expect(g.spec.sun).toBe(true);
    expect(g.spec.spare).toBe(2);
    expect(g.attempts).toBeGreaterThan(0);
    const { rise, set } = pairOf(g.board);
    expect(rise).toHaveLength(1);
    expect(set).toHaveLength(1);
    expect(rise[0].sun!.band).not.toBe(set[0].sun!.band);
    expect(g.board.jars.some((j) => j.wet || j.hourglass || j.tide || j.crab || j.lighthouse || j.clam !== undefined || j.sieve !== undefined || j.cap !== undefined || j.funnel || j.frozen || j.lock !== undefined)).toBe(false);
  });

  it('tall-jar levels never get own rolls, so they never have the pair', () => {
    const every = cfg.challenge.every;
    let tall = 0;
    for (let l = UNLOCK; l <= LAST_CHECKED; l++) {
      if (l % every !== 0) continue;
      tall++;
      expect(levelSpec(l, cfg).sun, `tall level ${l}`).toBeFalsy();
    }
    expect(tall).toBeGreaterThan(50);
  });

  it('comes from its own roll only (shared: false): ownChance 0 leaves only the debut', () => {
    const off = { ...cfg, mechanics: { ...cfg.mechanics, list: cfg.mechanics.list.map((m) => (m.id === 'sun' ? { ...m, ownChance: 0 } : m)) } } as GameConfig;
    const levels: number[] = [];
    for (let l = UNLOCK; l <= LAST_CHECKED; l++) if (levelSpec(l, off).sun) levels.push(l);
    expect(levels).toEqual([UNLOCK]);
  });

  it('adding the pair changes nothing on a level that does not roll it (every other mechanic and spare is as without it)', () => {
    const without = { ...cfg, mechanics: { ...cfg.mechanics, list: cfg.mechanics.list.filter((m) => m.id !== 'sun') } } as GameConfig;
    const cut: number[] = [];
    for (let l = UNLOCK + 1; l <= LAST_CHECKED; l++) {
      const spec = levelSpec(l, cfg);
      // A level "rolls the pair" when its own roll draws it; a breather's maxMechanics cut may then
      // drop the pair again, and such a level is unchanged too (the cut comes before the D222 drop).
      const rolled = !spec.challenge && withOwnRolls(l, pickMechanics(l, cfg), cfg).includes('sun');
      if (spec.sun) continue;
      if (rolled) {
        cut.push(l);
        expect(isBreather(l, cfg), `level ${l} lost the pair only to a breather cut`).toBe(true);
      }
      expect(spec, `level ${l}`).toEqual(levelSpec(l, without));
    }
    expect(cut.length).toBeGreaterThan(0);
  });
});

describe('a pair level drops wet sand and the sieve (D222)', () => {
  it('withoutPairConflicts drops only the sieve and wet sand, and only with the pair; the rest close up in order', () => {
    expect(withoutPairConflicts(['sieve', 'frozen', 'wet', 'crab', 'sun'])).toEqual(['frozen', 'crab', 'sun']);
    expect(withoutPairConflicts(['sieve', 'frozen', 'wet'])).toEqual(['sieve', 'frozen', 'wet']);
    expect(withoutPairConflicts(['sun'])).toEqual(['sun']);
  });

  it('no level of 361-1000 has the pair with wet sand or a sieve, and a breather keeps at most maxMechanics', () => {
    for (let l = UNLOCK; l <= LAST_CHECKED; l++) {
      const spec = levelSpec(l, cfg);
      if (!spec.sun) continue;
      expect(spec.wet, `level ${l}`).toBeFalsy();
      expect(spec.sieve, `level ${l}`).toBeFalsy();
      if (isBreather(l, cfg) && cfg.breather?.maxMechanics !== undefined) expect(specMechanics(spec).length, `breather ${l}`).toBeLessThanOrEqual(cfg.breather.maxMechanics);
    }
  });

  it('the breather cut comes first: a breather that cuts the pair keeps its sieve or wet sand', () => {
    // levelSpec keeps withoutPairConflicts(rolled.slice(0, maxMechanics)).
    expect(withoutPairConflicts((['sieve', 'sun'] as const).slice(0, 1))).toEqual(['sieve']);
    expect(withoutPairConflicts((['sun', 'wet'] as const).slice(0, 1))).toEqual(['sun']);
  });
});

describe('sunrise and sunset placement (applyMechanics)', () => {
  const full = (): LevelSpec => ({ ...BASE, colors: 8, capacity: 4, spare: 2, buriedDepth: 2, mechanics: ['frozen', 'locked', 'narrow', 'funnel'], hourglass: true, clam: true, tide: true, crab: true, lighthouse: true, sun: true });

  it('places exactly one sunrise and one sunset jar on two different filled plain jars, in different bands of the board, burial kept', () => {
    const board = dealt(8);
    let placed = 0;
    let crabOnPair = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const spec = full();
      const b = applyMechanics(board, spec, createRng(seed), cfg);
      if (!hasMechanics(b, spec)) continue;
      placed++;
      const { rise, set } = pairOf(b);
      expect(rise, `seed ${seed}`).toHaveLength(1);
      expect(set, `seed ${seed}`).toHaveLength(1);
      expect(rise[0]).not.toBe(set[0]);
      const [r, s] = [rise[0].sun!.band, set[0].sun!.band];
      expect(r, `seed ${seed}`).not.toBe(s);
      for (const band of [r, s]) {
        expect(Number.isInteger(band)).toBe(true);
        expect(band).toBeGreaterThanOrEqual(0);
        expect(band).toBeLessThan(spec.colors);
      }
      for (const j of [rise[0], set[0]]) {
        expect(plainForPair(j, b.capacity), `seed ${seed}`).toBe(true);
        expect(j.hidden, `seed ${seed}: burial kept`).toBe(2);
        if (j.crab) crabOnPair++;
      }
    }
    expect(placed).toBeGreaterThan(20);
    expect(crabOnPair, 'the crab may sit on either jar').toBeGreaterThan(0);
  });

  it('never keys a lock to the sunset band; with no colour left for it the deal is re-dealt', () => {
    // Two colours and a lock: whenever the sunrise band is not the lock's key, the only colour left
    // for the sunset band is the key, so the pair is not placed and hasMechanics rejects the deal.
    // Jars 2 and 3 each miss a colour, so a lock can go on either (keyed to the colour it misses).
    const two = makeBoard(4, [[0, 1, 0, 1], [1, 0, 1, 0], [0, 0], [1, 1], []]);
    let placed = 0;
    let rejected = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const spec: LevelSpec = { ...BASE, colors: 2, capacity: 4, spare: 1, buriedDepth: 0, mechanics: ['locked'], sun: true };
      const b = applyMechanics(two, spec, createRng(mixSeed(seed, 361)), cfg); // mixed: small raw seeds start alike
      const keys = b.jars.filter((j) => j.lock !== undefined).map((j) => j.lock);
      const { rise, set } = pairOf(b);
      if (!hasMechanics(b, spec)) {
        rejected++;
        expect(rise.length + set.length).toBe(0);
        continue;
      }
      placed++;
      expect(keys, `seed ${seed}`).not.toContain(set[0].sun!.band);
    }
    expect(placed).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
  });

  it('on a richer board with locks, no lock is keyed to the sunset band (a lock keyed to the sunrise band is allowed)', () => {
    // Four colours, jars of three: each misses one colour, so every lock has a key.
    const board = makeBoard(4, [[0, 1, 2], [1, 2, 3], [2, 3, 0], [3, 0, 1], [0, 1, 2], [3, 3], []]);
    let placed = 0;
    let riseKeyed = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const spec: LevelSpec = { ...full6(), colors: 4, mechanics: ['locked'], sun: true };
      const b = applyMechanics(board, spec, createRng(seed), cfg);
      if (!hasMechanics(b, spec)) continue;
      placed++;
      const { rise, set } = pairOf(b);
      for (const j of b.jars) {
        if (j.lock === undefined) continue;
        expect(j.lock, `seed ${seed}`).not.toBe(set[0].sun!.band);
        if (j.lock === rise[0].sun!.band) riseKeyed++;
      }
    }
    expect(placed).toBeGreaterThan(100);
    expect(riseKeyed).toBeGreaterThan(0);
  });

  it('draws after the lighthouse, so every earlier mechanic is placed exactly as without the pair', () => {
    const board = dealt(8);
    for (let seed = 1; seed <= 60; seed++) {
      const spec = full();
      const withIt = applyMechanics(board, spec, createRng(seed), cfg);
      const without = applyMechanics(board, { ...spec, sun: false }, createRng(seed), cfg);
      expect(withIt.jars.map(({ sun: _s, ...rest }) => rest), `seed ${seed}`).toEqual(without.jars);
    }
  });

  it('is seeded: the same seed gives the same pair, and pair levels build the same board twice', () => {
    const board = dealt(8);
    for (let seed = 1; seed <= 20; seed++) expect(applyMechanics(board, full(), createRng(seed), cfg)).toEqual(applyMechanics(board, full(), createRng(seed), cfg));
    for (const l of [UNLOCK, ...Array.from({ length: 60 }, (_, k) => UNLOCK + 1 + k).filter((l) => levelSpec(l, cfg).sun)].slice(0, 4)) {
      expect(generateLevel(l, cfg), `level ${l}`).toEqual(generateLevel(l, cfg));
    }
  }, 120_000);
});

describe('sunrise band choice (proveDeal, D222)', () => {
  it('sunriseBands: the dealt band, then the next colours wrapping and skipping the sunset band, min(tries, colors - 1) in all', () => {
    expect(sunriseBands(4, 5, 6, 3)).toEqual([4, 0, 1]);
    expect(sunriseBands(2, 3, 6, 3)).toEqual([2, 4, 5]);
    expect(sunriseBands(1, 0, 2, 3)).toEqual([1]);
    expect(sunriseBands(0, 2, 3, 3)).toEqual([0, 1]);
    expect(sunriseBands(3, 1, 6, 1)).toEqual([3]);
    for (const bands of [sunriseBands(5, 0, 12, 5), sunriseBands(11, 0, 12, 3)]) {
      expect(new Set(bands).size).toBe(bands.length);
      expect(bands).not.toContain(0);
    }
  });

  it('keeps the first band in sunriseBands order whose proof fits the cap, and never moves the sunset band', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const b = applyMechanics(dealt6(), { ...full6(), sun: true }, createRng(mixSeed(seed, 29)), cfg);
      const rise = b.jars.findIndex((j) => j.sun?.at === 'rise');
      const setBand = pairOf(b).set[0].sun!.band;
      const tries = sunriseBands(b.jars[rise].sun!.band, setBand, 6, 3);
      const p = proveDeal(b, 600_000, Infinity, 6, 3, 3);
      expect(pairOf(p.board).set[0].sun!.band, `seed ${seed}`).toBe(setBand);
      // Arrange the expectation by proving each band on its own, in order.
      const solvable = tries.map((band) => solve({ ...b, jars: b.jars.map((j, i) => (i === rise ? { ...j, sun: { band, at: 'rise' as const } } : j)) }, 600_000).solvable === true);
      const want = solvable.indexOf(true);
      if (want < 0) expect(p.result.solvable, `seed ${seed}`).not.toBe(true);
      else {
        expect(p.result.solvable, `seed ${seed}`).toBe(true);
        expect(pairOf(p.board).rise[0].sun!.band, `seed ${seed}`).toBe(tries[want]);
        if (want === 0) expect(p.board, `seed ${seed}`).toBe(b);
      }
    }
  });

  it('a board without the pair is proven exactly as before (one solve)', () => {
    const b = dealt6();
    const p = proveDeal(b, 50_000, Infinity, 6, 3, 3);
    expect(p.board).toBe(b);
    expect(p.nodes).toBe(solve(b, 50_000).nodes);
  });
});

/** A plain spec for the 6-colour board, no mechanics. */
function full6(): LevelSpec {
  return { ...BASE, colors: 6, capacity: 4, spare: 2, buriedDepth: 2, mechanics: [] };
}

describe('sunrise and sunset fallback and generation', () => {
  it('fallback as for the crab: with classic mechanics first the classic ones alone, then none; alone straight to none', () => {
    const base = levelSpec(UNLOCK, cfg);
    const row = (spec: LevelSpec) => levelSteps(spec, cfg).map((st) => [st.spec.mechanics.join('+'), st.spec.sun === true]);
    expect(row({ ...base, mechanics: ['frozen'], sun: true })).toEqual([['frozen', true], ['frozen', false], ['', false]]);
    expect(row({ ...base, mechanics: [], sun: true })).toEqual([['', true], ['', false]]);
  });

  // NEEDS LANE A (sprint 29 N2): until board.ts enforces the sunrise/sunset order rules, the solver's
  // proofs ignore the order, so this only shows the generator places the pair and proves the deal. It
  // becomes the real gate once the pour/win rules land; the pass counts are not final measurements.
  it('every pair level of 361-480 is built with the pair, within its pour cap, and its proof replays to a win', () => {
    let count = 0;
    for (let l = UNLOCK; l <= 480; l++) {
      if (!levelSpec(l, cfg).sun) continue;
      const g = generateLevel(l, cfg);
      expect(g.spec.sun, `level ${l} keeps the pair`).toBe(true);
      expect(g.attempts, `level ${l}`).toBeGreaterThan(0);
      const { rise, set } = pairOf(g.board);
      expect(rise.length + set.length, `level ${l}`).toBe(2);
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
});

describe('the pair stays out of the daily, the weekly and events (D220)', () => {
  it('the daily never features it (two years of days from 2026-11-01)', () => {
    for (let d = 0; d < 730; d++) {
      const key = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10);
      expect(dailySpec(key, cfg).sun, key).toBeFalsy();
    }
  });

  it('no weekly theme features it, and no weekly board of 52 weeks has it', () => {
    expect((config.weekly.themes as { mechanic?: string }[]).some((t) => t.mechanic === 'sun')).toBe(false);
    for (let w = 1; w <= 52; w++) {
      const week = `2027-W${String(w).padStart(2, '0')}`;
      for (let i = 0; i < 3; i++) expect(weeklySpec(week, i, cfg).sun, `${week} #${i}`).toBeFalsy();
    }
  });

  it('no event board has it', () => {
    for (const e of cfg.events) for (let n = 1; n <= e.boards; n++) expect(eventSpec(e, 2026, n, cfg).sun, `${e.id} #${n}`).toBeFalsy();
  });
});
