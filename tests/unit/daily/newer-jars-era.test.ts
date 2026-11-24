// Sprint 30 E2 (D228, D229): the 2026-12-19 Saturday era brings wet sand, the tide jar, the crab,
// the lighthouse jar and the sunrise and sunset jars to the daily (design/gdd/daily-puzzle.md §3.3,
// design/gdd/jar-mechanics.md §2.7-§2.11, production/sprints/sprint-30.md task E2).
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import pins from '../../fixtures/daily-era-pins.json';
import { type Board, type Jar, isSealed, isWon, pour } from '../../../src/core/board';
import { type DailyConfig, dailySpec, dayNumber, generateDaily, rotationMechanic, weekday } from '../../../src/core/daily';
import { maxPoursFor } from '../../../src/core/generator';
import type { GameConfig, MechanicId } from '../../../src/core/levels';
import { solve } from '../../../src/core/solver';

const cfg = config as unknown as GameConfig & DailyConfig;
const ERA = '2026-12-19';
const era = cfg.daily.saturdayFrom!.find((e) => e.from === ERA)!;
const previous = cfg.daily.saturdayFrom!.filter((e) => e.from < ERA);
/** The config as it was before the era was added: the same code, the 2026-12-19 era removed. */
const before = { ...cfg, daily: { ...cfg.daily, saturdayFrom: previous } } as typeof cfg;
const NEWER: readonly MechanicId[] = ['wet', 'tide', 'crab', 'lighthouse', 'sun'];
/** Two years of Saturdays from the era's first (2026-12-19 to 2028-12-16). */
const SATURDAYS = 105;

/** FNV-1a of the board's JSON, matching the other board fixtures. */
const hash = (b: Board) => {
  const s = JSON.stringify(b);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};
const keyOf = (day: number) => new Date(day * 86_400_000).toISOString().slice(0, 10);
const saturday = (n: number) => keyOf(dayNumber(ERA) + 7 * n);

/** True when the board carries `id` as placed by `applyMechanics` (an independent check of `hasMechanics`). */
const onBoard: Record<MechanicId, (j: readonly Jar[]) => boolean> = {
  wet: (j) => j.some((x) => x.wet?.some((n) => n > 0)),
  tide: (j) => j.some((x) => x.tide !== undefined),
  crab: (j) => j.some((x) => x.crab !== undefined),
  lighthouse: (j) => j.some((x) => x.lighthouse !== undefined),
  sun: (j) => j.some((x) => x.sun?.at === 'rise') && j.some((x) => x.sun?.at === 'set'),
  hourglass: (j) => j.some((x) => x.hourglass !== undefined),
  sieve: (j) => j.some((x) => x.sieve !== undefined),
  clam: (j) => j.some((x) => x.clam !== undefined),
  narrow: (j) => j.some((x) => x.cap !== undefined),
  frozen: (j) => j.some((x) => x.frozen),
  locked: (j) => j.some((x) => x.lock !== undefined),
  funnel: (j) => j.some((x) => x.funnel),
};

describe('the 2026-12-19 Saturday era (D228, D229)', () => {
  it('is a Saturday and cycles the five newer mechanics first, then the 2026-11-28 rotation', () => {
    expect(weekday(ERA)).toBe(6);
    expect(era.mechanics).toEqual([...NEWER, ...previous.at(-1)!.mechanics]);
    expect(era.mechanics).toHaveLength(12);
  });

  it('Saturday n from 2026-12-19 features mechanics[n % 12], and 2026-12-19 is wet sand', () => {
    expect(rotationMechanic(ERA, cfg)).toBe('wet');
    expect(dailySpec(ERA, cfg)).toMatchObject({ wet: true, mechanics: [] });
    for (let n = 0; n < SATURDAYS; n++) expect(rotationMechanic(saturday(n), cfg), saturday(n)).toBe(era.mechanics[n % 12]);
  });

  it('every Saturday spec carries its mechanic as its LevelSpec flag, on the Saturday recipe', () => {
    const recipe = cfg.daily.week[6];
    for (let n = 0; n < 12; n++) {
      const spec = dailySpec(saturday(n), cfg);
      const id = era.mechanics[n];
      expect(spec, id).toMatchObject({ colors: recipe.colors, capacity: recipe.capacity, spare: recipe.spare, buriedDepth: recipe.buriedDepth });
      const flags = (['hourglass', 'sieve', 'clam', 'wet', 'tide', 'crab', 'lighthouse', 'sun'] as const).filter((f) => spec[f]);
      expect([...spec.mechanics, ...flags], id).toEqual([id]); // one mechanic on its own
    }
  });

  it('nothing changes before 2026-12-19: the last Saturdays of the 2026-11-28 era keep their mechanics', () => {
    expect(['2026-11-28', '2026-12-05', '2026-12-12'].map((k) => rotationMechanic(k, cfg))).toEqual(['hourglass', 'sieve', 'clam']);
    for (let d = dayNumber('2026-11-01'); d < dayNumber(ERA); d++) expect(dailySpec(keyOf(d), cfg), keyOf(d)).toEqual(dailySpec(keyOf(d), before));
  });

  it('two years of dailies match the boards built before the era, except a Saturday whose mechanic changed', () => {
    const days = Object.entries(pins.days as Record<string, string>);
    expect(days).toHaveLength(731);
    let changed = 0;
    for (const [key, h] of days) {
      const same = key < ERA || weekday(key) !== 6 || rotationMechanic(key, cfg) === rotationMechanic(key, before);
      if (same) expect(hash(generateDaily(key, cfg).board), key).toBe(h);
      else changed++;
    }
    expect(changed).toBeGreaterThan(0);
  });

  it('two years of new-era Saturdays match their pins (the same board for everyone, on every run)', () => {
    const sats = Object.entries(pins.saturdays as Record<string, { mechanic: string; hash: string }>);
    expect(sats).toHaveLength(SATURDAYS);
    for (const [key, d] of sats) {
      expect(rotationMechanic(key, cfg), key).toBe(d.mechanic);
      expect(hash(generateDaily(key, cfg).board), key).toBe(d.hash);
    }
  });
});

describe('two years of new-era Saturdays build and win (D228, TD-5)', () => {
  const cap = maxPoursFor(0, cfg);
  const built = Array.from({ length: SATURDAYS }, (_, n) => {
    const key = saturday(n);
    return { key, id: era.mechanics[n % 12], g: generateDaily(key, cfg) };
  });

  it('each builds within the pour cap, starts unsealed and unwon, and its proof replays to a win through pour', () => {
    for (const { key, g } of built) {
      expect(g.solutionLength, key).toBeLessThanOrEqual(cap);
      expect(isWon(g.board), key).toBe(false);
      expect(g.board.jars.some((j) => isSealed(j, g.board.capacity)), key).toBe(false);
      const r = solve(g.board, cfg.generator.solverNodeBudget);
      expect(r.solvable, key).toBe(true);
      let b = g.board;
      for (const m of r.path) b = pour(b, m.from, m.to).board;
      expect(isWon(b), key).toBe(true);
    }
  });

  it('each has its featured mechanic on the board, or says it fell back; no mechanic falls back on more than 1 in 4', () => {
    const tally = new Map<MechanicId, { saturdays: number; fallbacks: number }>();
    for (const { key, id, g } of built) {
      const t = tally.get(id) ?? { saturdays: 0, fallbacks: 0 };
      t.saturdays++;
      const kept = g.spec.mechanics.includes(id as never) || (g.spec as unknown as Record<string, unknown>)[id] === true;
      if (kept) expect(onBoard[id](g.board.jars), key).toBe(true);
      else {
        t.fallbacks++;
        expect(Object.values(onBoard).some((f) => f(g.board.jars)), `${key} fell back to a plain board`).toBe(false);
      }
      tally.set(id, t);
    }
    expect([...tally.keys()].sort()).toEqual([...era.mechanics].sort());
    for (const [id, t] of tally) expect(t.fallbacks * 4, `${id}: ${t.fallbacks} of ${t.saturdays} fell back`).toBeLessThanOrEqual(t.saturdays);
  });

  it('each newer mechanic is placed as on the levels (§2.7-§2.10)', () => {
    for (const { key, id, g } of built) {
      const jars = g.board.jars;
      if (id === 'wet') for (const j of jars) j.wet?.forEach((n, k) => n > 0 && expect(k, key).toBeGreaterThanOrEqual(j.hidden)); // never buried
      if (id === 'tide') expect(jars.find((j) => j.tide)?.hidden, key).toBe(0);
      if (id === 'crab') expect(jars.find((j) => j.crab)?.units.length, key).toBeGreaterThan(0);
      if (id === 'lighthouse') {
        const light = jars.find((j) => j.lighthouse)!;
        expect(light.hidden, key).toBe(0);
        expect(light.wet, key).toBeUndefined();
      }
    }
  });

  it('a sunrise and sunset Saturday has 14 jars, both pair jars empty at the start', () => {
    const pair = built.filter((s) => s.id === 'sun' && s.g.spec.sun);
    expect(pair.length).toBeGreaterThan(0);
    const recipe = cfg.daily.week[6];
    expect(recipe.colors + recipe.spare + 2).toBe(14);
    for (const { key, g } of pair) {
      expect(g.board.jars, key).toHaveLength(14);
      const sun = g.board.jars.filter((j) => j.sun);
      expect(sun.map((j) => j.sun!.at), key).toEqual(['rise', 'set']);
      for (const j of sun) expect(j.units, key).toEqual([]);
      expect(sun[0].sun!.band, key).not.toBe(sun[1].sun!.band);
    }
  });
});
