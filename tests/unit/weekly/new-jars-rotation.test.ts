// Design: design/gdd/daily-puzzle.md §3.3 and design/gdd/weekly-set.md §3.3 (sprint 13 W1, D98).
// From a start date the hourglass, the sieve and the clam join the daily's Saturday rotation and the
// weekly themes, placed through the same LevelSpec flags and fallback chain as the numbered levels.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type Board, isSealed, isWon, pour } from '../../../src/core/board';
import { type DailyConfig, dailySpec, dailySteps, generateDaily, weekday } from '../../../src/core/daily';
import { type GameConfig, type MechanicId, specMechanics } from '../../../src/core/levels';
import { solve } from '../../../src/core/solver';
import { type WeeklyConfig, generateWeekly, weekIndex, weekMonday, weeklySpec, weeklyTheme } from '../../../src/core/weekly';

const cfg = config as unknown as GameConfig & DailyConfig & WeeklyConfig;
const UNLOCK_ORDER: readonly MechanicId[] = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam'];
const NEW_JARS: readonly MechanicId[] = ['hourglass', 'sieve', 'clam'];
const DAILY_FROM = '2026-11-28';
const WEEKLY_FROM = '2026-W49';
const BOARDS = cfg.weekly.boards.length;

/** The date key `days` days after `key`. */
const addDays = (key: string, days: number) => new Date(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
/** The week key `n` weeks after `start` (ISO weeks from the Monday). */
function weekAfter(start: string, n: number): string {
  const monday = new Date(Date.parse(`${weekMonday(start)}T00:00:00Z`) + n * 7 * 86_400_000);
  const thursday = new Date(monday.getTime() + 3 * 86_400_000);
  const year = thursday.getUTCFullYear();
  const week = 1 + Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * 86_400_000));
  return `${year}-W${String(week).padStart(2, '0')}`;
}
/** True when `board` carries the jar of `id` (classic or new). */
function hasJar(board: Board, id: MechanicId): boolean {
  if (id === 'hourglass') return board.jars.some((j) => j.hourglass !== undefined);
  if (id === 'sieve') return board.jars.some((j) => j.sieve !== undefined);
  if (id === 'clam') return board.jars.some((j) => j.clam !== undefined);
  return true;
}
/** Solves `board` with the generator's budget and replays the path to a win. */
function provenAndReplayed(board: Board): boolean {
  const r = solve(board, cfg.generator.solverNodeBudget);
  if (!r.solvable) return false;
  let b = board;
  for (const m of r.path) b = pour(b, m.from, m.to).board;
  return isWon(b);
}

describe('config: the start dates (D98)', () => {
  it('the daily rotation era starts on Saturday 2026-11-28 with all seven mechanics in cyclic unlock order', () => {
    const eras = cfg.daily.saturdayFrom ?? [];
    expect(eras).toHaveLength(1);
    expect(eras[0].from).toBe(DAILY_FROM);
    expect(weekday(eras[0].from)).toBe(6);
    const list = eras[0].mechanics;
    expect([...list].sort()).toEqual([...UNLOCK_ORDER].sort());
    const start = UNLOCK_ORDER.indexOf(list[0]);
    expect(list).toEqual(list.map((_, i) => UNLOCK_ORDER[(start + i) % 7]));
  });
  it('the weekly theme era starts at 2026-W49 and adds the three new jar themes to the old five', () => {
    const eras = cfg.weekly.themesFrom ?? [];
    expect(eras).toHaveLength(1);
    expect(eras[0].from).toBe(WEEKLY_FROM);
    expect(weekMonday(eras[0].from)).toBe('2026-11-30');
    const ids = eras[0].themes.map((t) => t.id);
    expect([...ids].sort()).toEqual([...cfg.weekly.themes.map((t) => t.id), ...NEW_JARS].sort());
    for (const id of NEW_JARS) expect(eras[0].themes.find((t) => t.id === id)?.mechanic).toBe(id);
  });
});

describe('the daily Saturday rotation from 2026-11-28 (D98)', () => {
  it('before the start the Saturdays keep the old four-way cycle', () => {
    expect(dailySpec('2026-11-21', cfg).mechanics).toEqual(['narrow']);
    expect(dailySpec('2026-11-14', cfg).mechanics).toEqual(['funnel']);
    expect(dailySpec('2026-11-07', cfg).mechanics).toEqual(['locked']);
  });
  it('from the start every seven Saturdays feature all seven mechanics, one each, the hourglass first', () => {
    const picks = Array.from({ length: 21 }, (_, w) => specMechanics(dailySpec(addDays(DAILY_FROM, 7 * w), cfg)));
    for (const p of picks) expect(p).toHaveLength(1);
    expect(picks[0]).toEqual(['hourglass']);
    for (let w = 0; w + 7 <= picks.length; w++) expect(new Set(picks.slice(w, w + 7).flat()).size, `from week ${w}`).toBe(7);
    // The cycle runs in unlock order: each Saturday plays the mechanic after last Saturday's.
    for (let w = 1; w < picks.length; w++) expect(UNLOCK_ORDER.indexOf(picks[w][0])).toBe((UNLOCK_ORDER.indexOf(picks[w - 1][0]) + 1) % 7);
  });
  it('a new jar rides in its LevelSpec flag, not in spec.mechanics, like the numbered levels', () => {
    const s = dailySpec(DAILY_FROM, cfg);
    expect(s.mechanics).toEqual([]);
    expect(s.hourglass).toBe(true);
    expect(dailySpec(addDays(DAILY_FROM, 7), cfg).sieve).toBe(true);
    expect(dailySpec(addDays(DAILY_FROM, 14), cfg).clam).toBe(true);
    expect(dailySpec(addDays(DAILY_FROM, 21), cfg).mechanics).toEqual(['narrow']);
  });
  it('the other weekdays after the start still have no mechanic', () => {
    for (let d = 1; d < 7; d++) expect(specMechanics(dailySpec(addDays(DAILY_FROM, d), cfg)), addDays(DAILY_FROM, d)).toEqual([]);
  });
  it('the fallback chain drops a new jar flag in its second step', () => {
    const steps = dailySteps(dailySpec(DAILY_FROM, cfg), cfg);
    expect(steps).toHaveLength(2);
    expect(specMechanics(steps[1].spec)).toEqual([]);
  });
  it('the hourglass, sieve and clam Saturdays are built with their jar, solver-proven and replay to a win', () => {
    for (let w = 0; w < 3; w++) {
      const key = addDays(DAILY_FROM, 7 * w);
      const g = generateDaily(key, cfg);
      const id = NEW_JARS[w];
      expect(specMechanics(g.spec), key).toEqual([id]); // no fallback needed
      expect(hasJar(g.board, id), key).toBe(true);
      expect(g.board.jars.some((j) => isSealed(j, g.board.capacity)), key).toBe(false);
      expect(isWon(g.board), key).toBe(false);
      expect(provenAndReplayed(g.board), key).toBe(true);
      expect(generateDaily(key, cfg).board, key).toEqual(g.board); // the same for everyone
    }
  }, 60_000);
});

describe('the weekly themes from 2026-W49 (D98)', () => {
  it('before the start the weeks keep the old five-theme rotation', () => {
    const old = cfg.weekly.themes;
    for (const w of ['2026-W46', '2026-W47', '2026-W48']) expect(weeklyTheme(w, cfg)).toEqual(old[weekIndex(w) % old.length]);
    expect(weeklyTheme('2026-W48', cfg).id).toBe('deep');
  });
  it('from the start the rotation has eight themes, the hourglass first, then the sieve and the clam', () => {
    const ids = Array.from({ length: 16 }, (_, n) => weeklyTheme(weekAfter(WEEKLY_FROM, n), cfg).id);
    expect(ids.slice(0, 3)).toEqual(['hourglass', 'sieve', 'clam']);
    expect(new Set(ids.slice(0, 8)).size).toBe(8);
    expect(ids.slice(8)).toEqual(ids.slice(0, 8));
    expect(weekAfter(WEEKLY_FROM, 4)).toBe('2026-W53'); // the rotation runs through week 53
  });
  it('a new-jar theme puts its jar flag on all five boards', () => {
    NEW_JARS.forEach((id, n) => {
      const week = weekAfter(WEEKLY_FROM, n);
      for (let i = 0; i < BOARDS; i++) {
        const s = weeklySpec(week, i, cfg);
        expect(s.theme).toBe(id);
        expect(specMechanics(s), `${week}#${i + 1}`).toEqual([id]);
        expect(s.mechanics).toEqual([]);
      }
    });
  });
  it('sampled hourglass, sieve and clam boards are built with their jar, solver-proven and replay to a win', () => {
    NEW_JARS.forEach((id, n) => {
      const week = weekAfter(WEEKLY_FROM, n);
      for (const i of [0, 2, BOARDS - 1]) {
        const g = generateWeekly(week, i, cfg);
        const key = `${week}#${i + 1}`;
        expect(specMechanics(g.spec), key).toEqual([id]); // no fallback needed
        expect(hasJar(g.board, id), key).toBe(true);
        expect(g.board.jars.some((j) => isSealed(j, g.board.capacity)), key).toBe(false);
        expect(provenAndReplayed(g.board), key).toBe(true);
      }
    });
  }, 60_000);
});
