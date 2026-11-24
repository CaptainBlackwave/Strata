// Design: design/gdd/weekly-set.md §3.3 and design/gdd/jar-mechanics.md §2.7 to §2.11 (sprint 30 E3, D228-D230).
// From ISO week 2026-W52 (Monday 2026-12-21) the weekly rotation is thirteen themes: wet sand, the tide jar, the
// crab, the lighthouse jar and the sunrise and sunset pair, then the 2026-W49 era's eight. Each new theme's mechanic
// rides in its LevelSpec flag on all five boards, with the same placement, proof and fallback chain as the levels.
// No week before 2026-W52 changes.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import eraPins from '../../fixtures/weekly-era-pins.json';
import { type Board, type Jar, isSealed, isWon, pour } from '../../../src/core/board';
import { type DailyConfig, dayNumber } from '../../../src/core/daily';
import { maxPoursFor } from '../../../src/core/generator';
import { type GameConfig, type MechanicId, specMechanics } from '../../../src/core/levels';
import { solve } from '../../../src/core/solver';
import { type WeeklyConfig, generateWeekly, weekKey, weekMonday, weeklySpec, weeklyTheme } from '../../../src/core/weekly';
import { t } from '../../../src/ui/strings';

const cfg = config as unknown as GameConfig & DailyConfig & WeeklyConfig;
const ERA_FROM = '2026-W52';
const ERA_MONDAY = '2026-12-21';
const NEWER: readonly MechanicId[] = ['wet', 'tide', 'crab', 'lighthouse', 'sun'];
const BOARDS = cfg.weekly.boards.length;
/** Two years of weeks from the era: every week whose Monday is before 2028-12-21. */
const TWO_YEARS_END = '2028-12-21';

const eras = cfg.weekly.themesFrom ?? [];
const era = eras.find((e) => e.from === ERA_FROM);
/** The config as it was before the 2026-W52 era: the same, with every era from it on removed. */
const before: GameConfig & WeeklyConfig = { ...cfg, weekly: { ...cfg.weekly, themesFrom: eras.filter((e) => e.from < ERA_FROM) } };

/** The week key `n` weeks after `start`'s week. */
const weekAfter = (start: string, n: number) => weekKey(new Date(Date.UTC(1970, 0, 1 + dayNumber(weekMonday(start)) + 7 * n)));
/** FNV-1a of the board's JSON, matching the other board fixtures. */
const hash = (b: Board) => {
  const s = JSON.stringify(b);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};
/** True when a jar carries mechanic `id`'s state (the board side of `hasMechanics`). */
const JAR_HAS: Readonly<Record<MechanicId, (j: Jar) => boolean>> = {
  narrow: (j) => j.cap !== undefined,
  frozen: (j) => j.frozen === true,
  locked: (j) => j.lock !== undefined,
  funnel: (j) => j.funnel === true,
  hourglass: (j) => j.hourglass !== undefined,
  sieve: (j) => j.sieve !== undefined,
  clam: (j) => j.clam !== undefined,
  wet: (j) => j.wet !== undefined && j.wet.some((n) => n > 0),
  tide: (j) => j.tide !== undefined,
  crab: (j) => j.crab !== undefined,
  lighthouse: (j) => j.lighthouse !== undefined,
  sun: (j) => j.sun !== undefined,
};
/** True when `board` carries mechanic `id`; the pair needs both its sunrise and its sunset jar. */
function boardHas(board: Board, id: MechanicId): boolean {
  if (id === 'sun') return board.jars.some((j) => j.sun?.at === 'rise') && board.jars.some((j) => j.sun?.at === 'set');
  return board.jars.some(JAR_HAS[id]);
}
/** Solves `board` with the generator's budget and replays the path through `pour`; true on a win. */
function replaysToWin(board: Board): boolean {
  const r = solve(board, cfg.generator.solverNodeBudget);
  if (!r.solvable) return false;
  let b = board;
  for (const m of r.path) b = pour(b, m.from, m.to).board;
  return isWon(b);
}

describe('config: the 2026-W52 era (D228-D230)', () => {
  it('starts on Monday 2026-12-21 and is the last era', () => {
    expect(era).toBeDefined();
    expect(weekMonday(ERA_FROM)).toBe(ERA_MONDAY);
    expect(eras.at(-1)?.from).toBe(ERA_FROM);
  });
  it('has thirteen themes: the five newer mechanics in debut order, then the 2026-W49 era in its order', () => {
    const themes = era?.themes ?? [];
    expect(themes).toHaveLength(13);
    expect(themes.slice(0, 5).map((th) => th.id)).toEqual(NEWER);
    for (const th of themes.slice(0, 5)) expect(th.mechanic, th.id).toBe(th.id);
    const previous = eras.filter((e) => e.from < ERA_FROM).at(-1);
    expect(themes.slice(5)).toEqual(previous?.themes);
  });
  it('every new theme, and every theme of every era, has a name in t.weekly.themes', () => {
    for (const id of NEWER) expect(t.weekly.themes[id], id).toBeTruthy();
    expect(t.weekly.themes).toMatchObject({ wet: 'Rain on the Dunes', tide: 'High Water', crab: 'Crab Walk', lighthouse: 'Night Watch', sun: 'Dawn to Dusk' });
    for (const th of [...cfg.weekly.themes, ...eras.flatMap((e) => e.themes)]) expect(t.weekly.themes[th.id], th.id).toBeTruthy();
  });
});

describe('the 13-week cycle from 2026-W52', () => {
  it('week n from 2026-W52 plays themes[n mod 13], and 2026-W52 is wet sand', () => {
    const themes = era?.themes ?? [];
    expect(weeklyTheme(ERA_FROM, cfg).id).toBe('wet');
    expect(weeklyTheme(ERA_FROM, cfg).mechanic).toBe('wet');
    for (let n = 0; n < 3 * 13 + 1; n++) expect(weeklyTheme(weekAfter(ERA_FROM, n), cfg), weekAfter(ERA_FROM, n)).toEqual(themes[n % 13]);
    expect(weekAfter(ERA_FROM, 1)).toBe('2026-W53'); // the cycle runs through week 53 and the year boundary
    expect(weeklyTheme('2027-W01', cfg).id).toBe('crab');
  });
  it('a newer-mechanic theme puts its flag on all five boards and no classic mechanic', () => {
    NEWER.forEach((id, n) => {
      const week = weekAfter(ERA_FROM, n);
      for (let i = 0; i < BOARDS; i++) {
        const s = weeklySpec(week, i, cfg);
        expect(s.theme, `${week}#${i + 1}`).toBe(id);
        expect(specMechanics(s), `${week}#${i + 1}`).toEqual([id]);
        expect(s.mechanics).toEqual([]);
      }
    });
  });
});

describe('nothing changes before 2026-W52 (D229)', () => {
  it('every week from 2026-W01 to 2026-W51 plays the theme it played before the era', () => {
    for (let n = 0; n < 51; n++) {
      const week = weekAfter('2026-W01', n);
      expect(weeklyTheme(week, cfg), week).toEqual(weeklyTheme(week, before));
    }
    expect(weekAfter('2026-W01', 50)).toBe('2026-W51');
  });
  it('the boards of 2026-W40 to 2026-W51 are byte-identical to the boards before the era', () => {
    for (let n = 0; n < 12; n++) {
      const week = weekAfter('2026-W40', n);
      for (let i = 0; i < BOARDS; i++) expect(generateWeekly(week, i, cfg).board, `${week}#${i + 1}`).toEqual(generateWeekly(week, i, before).board);
    }
  });
  it('the boards of 2026-W49 to 2026-W51 match their pinned hashes', () => {
    const pins = eraPins.weeks as Record<string, string>;
    expect(Object.keys(pins)).toHaveLength(3 * BOARDS);
    for (const [id, h] of Object.entries(pins)) {
      const [week, n] = id.split('#');
      expect(week < ERA_FROM, id).toBe(true);
      expect(hash(generateWeekly(week, Number(n) - 1, cfg).board), id).toBe(h);
    }
  });
});

describe('two years of weeks from 2026-W52', () => {
  it('build all five boards within the cap, each carrying its theme or a counted fallback, and the proofs replay to a win', () => {
    const weeks: string[] = [];
    for (let n = 0; weekMonday(weekAfter(ERA_FROM, n)) < TWO_YEARS_END; n++) weeks.push(weekAfter(ERA_FROM, n));
    expect(weeks).toHaveLength(105);
    const count: Record<string, { boards: number; carried: number; fallbacks: string[] }> = {};
    for (const week of weeks) {
      const theme = weeklyTheme(week, cfg);
      const c = (count[theme.id] ??= { boards: 0, carried: 0, fallbacks: [] });
      const colours: number[] = [];
      for (let i = 0; i < BOARDS; i++) {
        const id = `${week}#${i + 1}`;
        const spec = weeklySpec(week, i, cfg);
        const g = generateWeekly(week, i, cfg);
        c.boards++;
        expect(g.solutionLength, id).toBeLessThanOrEqual(maxPoursFor(cfg.weekly.boards[i].bandLevel, cfg));
        expect(g.board.jars.some((j) => isSealed(j, g.board.capacity)), id).toBe(false);
        expect(isWon(g.board), id).toBe(false);
        expect(replaysToWin(g.board), id).toBe(true);
        if (theme.mechanic) {
          if (specMechanics(g.spec).includes(theme.mechanic)) {
            expect(specMechanics(g.spec), id).toEqual([theme.mechanic]);
            expect(boardHas(g.board, theme.mechanic), id).toBe(true);
            c.carried++;
          } else {
            expect(specMechanics(g.spec), `${id} fallback`).toEqual([]); // the fallback chain's plain step
            c.fallbacks.push(id);
          }
        } else {
          expect(g.spec.buriedDepth, id).toBe(spec.buriedDepth); // deep sand: the extra buried layer
          c.carried++;
        }
        colours.push(g.spec.colors);
      }
      for (let i = 1; i < colours.length; i++) expect(colours[i], week).toBeGreaterThan(colours[i - 1]);
    }
    const lines = Object.entries(count).map(([id, c]) => `${id}: ${c.boards} boards, ${c.carried} with the theme, ${c.fallbacks.length} fallbacks${c.fallbacks.length ? ` (${c.fallbacks.join(', ')})` : ''}`);
    console.info(`Weekly 2026-W52 era, ${weeks.length} weeks:\n${lines.join('\n')}`);
    for (const id of NEWER) expect(count[id]?.boards, id).toBeGreaterThanOrEqual(8 * BOARDS);
    // Fail only when a theme falls back on more than 1 board in 4.
    for (const [id, c] of Object.entries(count)) expect(c.fallbacks.length * 4, id).toBeLessThanOrEqual(c.boards);
  }, 120_000);
  it('a newer-theme board is the same on every build', () => {
    NEWER.forEach((id, n) => {
      const week = weekAfter(ERA_FROM, n);
      expect(generateWeekly(week, BOARDS - 1, cfg).board, `${week} ${id}`).toEqual(generateWeekly(week, BOARDS - 1, cfg).board);
    });
  });
});
