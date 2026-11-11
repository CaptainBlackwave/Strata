// Design: design/gdd/weekly-set.md (sprint 11 W1, W2; D77). The pure weekly-set rules in src/core/weekly.ts.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import fixture from '../../fixtures/weekly-boards.json';
import { type Board, isSealed, isWon, pour } from '../../../src/core/board';
import { type DailyConfig, dailySeed, dayNumber } from '../../../src/core/daily';
import { maxPoursFor } from '../../../src/core/generator';
import type { GameConfig } from '../../../src/core/levels';
import { solve } from '../../../src/core/solver';
import {
  type WeeklyConfig,
  type WeeklyState,
  daysLeft,
  emptyWeekly,
  generateWeekly,
  parseWeek,
  recordWeeklyClear,
  repairWeekly,
  weekIndex,
  weekKey,
  weekMonday,
  weeklyBadge,
  weeklyFor,
  weeklyPours,
  weeklySeeds,
  weeklySpec,
  weeklyTheme,
} from '../../../src/core/weekly';

const cfg = config as unknown as GameConfig & DailyConfig & WeeklyConfig;
const BOARDS = cfg.weekly.boards.length;
/** FNV-1a of the board's JSON, matching tests/unit/core/placement.test.ts and the fixture. */
const hash = (b: Board) => {
  const s = JSON.stringify(b);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};
const utc = (iso: string) => new Date(iso);
/** The week key `n` weeks after `start`'s week. */
const weekAfter = (start: string, n: number) => weekKey(new Date(Date.UTC(1970, 0, 1 + dayNumber(weekMonday(start)) + 7 * n)));

describe('weekKey: ISO weeks on the UTC calendar (§3.1)', () => {
  it('Sunday 23:59:59.999 UTC and Monday 00:00 UTC are different weeks', () => {
    expect(weekKey(utc('2026-11-15T23:59:59.999Z'))).toBe('2026-W46');
    expect(weekKey(utc('2026-11-16T00:00:00.000Z'))).toBe('2026-W47');
  });
  it('Monday 9 November 2026 opens week 46', () => {
    expect(weekKey(utc('2026-11-09T00:00:00Z'))).toBe('2026-W46');
    expect(weekKey(utc('2026-11-08T23:59:00Z'))).toBe('2026-W45');
  });
  it('the ISO year can differ from the calendar year at its edges', () => {
    expect(weekKey(utc('2025-12-28T12:00:00Z'))).toBe('2025-W52');
    expect(weekKey(utc('2025-12-29T00:00:00Z'))).toBe('2026-W01');
    expect(weekKey(utc('2026-01-01T00:00:00Z'))).toBe('2026-W01');
  });
  it('2026 has an ISO week 53, which runs into 2027', () => {
    expect(weekKey(utc('2026-12-28T00:00:00Z'))).toBe('2026-W53');
    expect(weekKey(utc('2027-01-01T00:00:00Z'))).toBe('2026-W53');
    expect(weekKey(utc('2027-01-03T23:59:59Z'))).toBe('2026-W53');
    expect(weekKey(utc('2027-01-04T00:00:00Z'))).toBe('2027-W01');
  });
  it('the same instant in four time zones gives the same key', () => {
    const keys = ['2026-11-15T18:59:00-05:00', '2026-11-16T00:59:00+01:00', '2026-11-16T09:59:00+10:00', '2026-11-16T13:59:00+14:00'].map((s) => weekKey(utc(s)));
    expect(new Set(keys)).toEqual(new Set(['2026-W46']));
    expect(weekKey(utc('2026-11-15T19:00:00-05:00'))).toBe('2026-W47'); // Sunday evening in New York is Monday UTC
  });
  it('parseWeek reads a key and refuses a malformed one', () => {
    expect(parseWeek('2026-W53')).toEqual({ year: 2026, week: 53 });
    expect(parseWeek('2026-W00')).toBeNull();
    expect(parseWeek('2026-W54')).toBeNull();
    expect(parseWeek('2026-46')).toBeNull();
    expect(parseWeek('2027-W53')).toBeNull(); // 2027 has 52 ISO weeks
  });
  it('weekMonday, weekIndex and daysLeft', () => {
    expect(weekMonday('2026-W46')).toBe('2026-11-09');
    expect(weekMonday('2026-W01')).toBe('2025-12-29');
    expect(weekMonday('2026-W53')).toBe('2026-12-28');
    expect(weekIndex('2026-W46')).toBe(2967);
    expect(weekIndex('2026-W47') - weekIndex('2026-W46')).toBe(1);
    expect(weekIndex('2027-W01') - weekIndex('2026-W53')).toBe(1);
    expect(daysLeft('2026-W46', utc('2026-11-09T00:00:00Z'))).toBe(7);
    expect(daysLeft('2026-W46', utc('2026-11-12T10:00:00Z'))).toBe(4);
    expect(daysLeft('2026-W46', utc('2026-11-15T23:59:00Z'))).toBe(1);
  });
});

describe('themes (§3.3)', () => {
  // Before 2026-W49 (sprint 13 W1, D98); from then see tests/unit/weekly/new-jars-rotation.test.ts.
  it('rotate one per week through the list before 2026-W49; 2026-W46 is Lock and Key', () => {
    expect(weeklyTheme('2026-W46', cfg).id).toBe('locked');
    const ids = Array.from({ length: cfg.weekly.themes.length }, (_, i) => weeklyTheme(weekAfter('2026-W41', i), cfg).id);
    expect(new Set(ids).size).toBe(cfg.weekly.themes.length);
    expect(weeklyTheme('2026-W41', cfg).id).toBe('locked');
  });
  it('a mechanic theme puts its jar on all five boards; Deep Sand buries one more, capped', () => {
    for (let w = 0; w < cfg.weekly.themes.length; w++) {
      const week = weekAfter('2026-W44', w); // 2026-W44 to W48, the classic themes
      const theme = weeklyTheme(week, cfg);
      for (let i = 0; i < BOARDS; i++) {
        const spec = weeklySpec(week, i, cfg);
        const board = cfg.weekly.boards[i];
        expect(spec.mechanics).toEqual(theme.mechanic ? [theme.mechanic] : []);
        expect(spec.buriedDepth).toBe(Math.min(cfg.weekly.maxBuried, board.buriedDepth + (theme.buriedBonus ?? 0)));
        expect(spec.week).toBe(week);
        expect(spec.index).toBe(i);
      }
    }
  });
});

describe('weeklySeeds (§3.2)', () => {
  it('deterministic, five distinct seeds, never a daily seed of the same week (104 weeks)', () => {
    for (let w = 0; w < 104; w++) {
      const week = weekAfter('2026-W46', w);
      const seeds = weeklySeeds(week, cfg);
      expect(seeds).toHaveLength(BOARDS);
      expect(weeklySeeds(week, cfg)).toEqual(seeds);
      expect(new Set(seeds).size, week).toBe(BOARDS);
      const monday = dayNumber(weekMonday(week));
      const daily = Array.from({ length: 7 }, (_, d) => dailySeed(new Date(Date.UTC(1970, 0, 1 + monday + d)).toISOString().slice(0, 10), cfg));
      for (const s of seeds) expect(daily, week).not.toContain(s);
    }
  });
  it('different weeks give different seeds', () => {
    expect(weeklySeeds('2026-W46', cfg)).not.toEqual(weeklySeeds('2026-W47', cfg));
  });
});

describe('generateWeekly (§3.4)', () => {
  // 2026-W47 to 2027-W01: eight weeks across the year boundary, with week 53.
  const weeks = Array.from({ length: 8 }, (_, i) => weekAfter('2026-W47', i));
  it('the fixture covers 2026-W47 to 2027-W01', () => {
    expect(weeks[0]).toBe('2026-W47');
    expect(weeks[6]).toBe('2026-W53');
    expect(weeks[7]).toBe('2027-W01');
  });
  it('matches the fixture of board hashes before 2026-W49 (the same boards for everyone, on every run)', () => {
    // From 2026-W49 the rotation has the new jar themes (sprint 13 W1, D98), so later weeks' boards changed on purpose;
    // tests/fixtures/daily-weekly-pins.json pins W46 to W48 from the code before that change.
    const hashes = fixture.hashes as Record<string, string>;
    for (const week of weeks.filter((w) => w < '2026-W49')) for (let i = 0; i < BOARDS; i++) expect(hash(generateWeekly(week, i, cfg).board), `${week}#${i + 1}`).toBe(hashes[`${week}#${i + 1}`]);
    expect(Object.keys(hashes)).toHaveLength(weeks.length * BOARDS);
  });
  it('every board of 8 weeks is solvable, starts unsealed, keeps its theme and is within its pour cap', () => {
    for (const week of weeks) {
      const colours: number[] = [];
      for (let i = 0; i < BOARDS; i++) {
        const g = generateWeekly(week, i, cfg);
        const id = `${week}#${i + 1}`;
        expect(g.spec.mechanics, id).toEqual(weeklySpec(week, i, cfg).mechanics); // no fallback needed
        expect(g.board.jars.some((j) => isSealed(j, g.board.capacity)), id).toBe(false);
        expect(isWon(g.board), id).toBe(false);
        expect(g.solutionLength, id).toBeLessThanOrEqual(maxPoursFor(cfg.weekly.boards[i].bandLevel, cfg));
        const r = solve(g.board, cfg.generator.solverNodeBudget);
        expect(r.solvable, id).toBe(true);
        let b = g.board;
        for (const m of r.path) b = pour(b, m.from, m.to).board;
        expect(isWon(b), id).toBe(true);
        colours.push(g.spec.colors);
      }
      for (let i = 1; i < colours.length; i++) expect(colours[i]).toBeGreaterThan(colours[i - 1]);
    }
  });
  it('a year of weeks generates without throwing, deterministic per week and board', () => {
    for (let w = 0; w < 52; w++) {
      const week = weekAfter('2027-W02', w);
      for (let i = 0; i < BOARDS; i++) expect(generateWeekly(week, i, cfg).board, `${week}#${i + 1}`).toEqual(generateWeekly(week, i, cfg).board);
    }
  });
});

describe('progress and cleared state (§3.5, §3.6)', () => {
  const W = '2026-W46';
  it('an empty save shows an empty set for the current week', () => {
    expect(weeklyFor(emptyWeekly(), W)).toEqual({ week: W, cleared: [], pours: {} });
  });
  it('boards clear in any order, each once, keeping the best pours', () => {
    let s: WeeklyState = emptyWeekly();
    const a = recordWeeklyClear(s, W, 3, 40, cfg);
    expect(a).toMatchObject({ counted: true, firstClear: true, newBest: false, completedNow: false, badge: null });
    s = a.state;
    s = recordWeeklyClear(s, W, 0, 23, cfg).state;
    expect(s).toEqual({ week: W, cleared: [0, 3], pours: { '0': 23, '3': 40 } });
    const better = recordWeeklyClear(s, W, 3, 35, cfg);
    expect(better).toMatchObject({ counted: true, firstClear: false, newBest: true, prevBest: 40 });
    expect(better.state.pours['3']).toBe(35);
    const worse = recordWeeklyClear(better.state, W, 3, 50, cfg);
    expect(worse).toMatchObject({ firstClear: false, newBest: false, prevBest: 35 });
    expect(worse.state).toEqual(better.state);
  });
  it('the fifth distinct clear completes the set and returns the week badge once', () => {
    let s = emptyWeekly();
    for (const i of [4, 2, 0, 1]) {
      const r = recordWeeklyClear(s, W, i, 30, cfg);
      expect(r.badge).toBeNull();
      s = r.state;
    }
    const last = recordWeeklyClear(s, W, 3, 30, cfg);
    expect(last).toMatchObject({ completedNow: true, complete: true, badge: 'weekly-2026-W46' });
    const again = recordWeeklyClear(last.state, W, 3, 20, cfg);
    expect(again).toMatchObject({ completedNow: false, complete: true, badge: null, newBest: true });
  });
  it('a new week resets the set', () => {
    const s = recordWeeklyClear(emptyWeekly(), W, 0, 20, cfg).state;
    expect(weeklyFor(s, '2026-W47')).toEqual({ week: '2026-W47', cleared: [], pours: {} });
    const r = recordWeeklyClear(s, '2026-W47', 2, 25, cfg);
    expect(r.state).toEqual({ week: '2026-W47', cleared: [2], pours: { '2': 25 } });
  });
  it('a board started last week and won after Monday counts for its week while that is the saved week', () => {
    let s = emptyWeekly();
    for (const i of [0, 1, 2, 3]) s = recordWeeklyClear(s, '2026-W45', i, 30, cfg).state;
    const r = recordWeeklyClear(s, '2026-W45', 4, 30, cfg);
    expect(r).toMatchObject({ counted: true, badge: 'weekly-2026-W45' });
  });
  it('a win for a week older than the saved one is ignored (clock moved back, or another tab moved on)', () => {
    const s = recordWeeklyClear(emptyWeekly(), '2026-W47', 1, 20, cfg).state;
    const r = recordWeeklyClear(s, '2026-W46', 0, 15, cfg);
    expect(r).toMatchObject({ counted: false, outOfDate: true, badge: null });
    expect(r.state).toBe(s);
    expect(weeklyFor(s, '2026-W46')).toEqual({ week: '2026-W46', cleared: [], pours: {} }); // shown as not started; the save keeps W47
  });
  it('an index outside the set is not recorded', () => {
    expect(recordWeeklyClear(emptyWeekly(), W, BOARDS, 10, cfg).counted).toBe(false);
    expect(recordWeeklyClear(emptyWeekly(), W, -1, 10, cfg).counted).toBe(false);
  });
  it('weeklyBadge and weeklyPours', () => {
    expect(weeklyBadge('2026-W53')).toBe('weekly-2026-W53');
    expect(weeklyBadge('2026-W05')).toBe('weekly-2026-W05');
    const s: WeeklyState = { week: W, cleared: [0, 3], pours: { '0': 23, '3': 40 } };
    expect(weeklyPours(s, W, cfg)).toEqual([23, null, null, 40, null]);
    expect(weeklyPours(s, '2026-W47', cfg)).toEqual([null, null, null, null, null]);
  });
});

describe('repairWeekly (§3.10)', () => {
  it('keeps a valid field', () => {
    const ok = { week: '2026-W46', cleared: [0, 2], pours: { '0': 20, '2': 31 } };
    expect(repairWeekly(ok, cfg)).toEqual(ok);
  });
  it('anything that is not an object, or a bad week, resets the whole field', () => {
    for (const bad of [null, 3, 'x', [], { week: '2026-W54', cleared: [0], pours: { '0': 3 } }, { week: 46, cleared: [0] }, { cleared: [1] }]) expect(repairWeekly(bad, cfg)).toEqual(emptyWeekly());
  });
  it('cleared keeps in-range integers, each once, ascending; pours keeps cleared indices with valid counts', () => {
    const r = repairWeekly({ week: '2026-W46', cleared: [3, 1, 1, 9, -1, 2.5, '0', 0], pours: { '0': 12, '1': -4, '3': 22.5, '4': 30, x: 2 } }, cfg);
    expect(r).toEqual({ week: '2026-W46', cleared: [0, 1, 3], pours: { '0': 12 } });
  });
  it('a missing cleared or pours becomes empty', () => {
    expect(repairWeekly({ week: '2026-W46' }, cfg)).toEqual({ week: '2026-W46', cleared: [], pours: {} });
  });
});
