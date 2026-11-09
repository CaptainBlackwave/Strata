/**
 * The weekly set: every Monday (UTC) five themed, seeded boards, the same for everyone, playable
 * all week; clearing all five earns that week's badge. Pure functions only, no DOM.
 * Implements design/gdd/weekly-set.md (sprint 11 W1, W2; owner decision D77).
 */
import { weeklyBadgeId } from './badges';
import { dailySteps, dayNumber } from './daily';
import { type FallbackStep, type GeneratedLevel, runFallbackSteps } from './generator';
import type { GameConfig, LevelSpec, MechanicId } from './levels';

/** One board of the set (weekly-set.md §3.4): a recipe and the level whose pour band caps it. */
export interface WeeklyBoard {
  readonly colors: number;
  readonly capacity: number;
  readonly spare: number;
  readonly buriedDepth: number;
  /** `maxPoursFor(bandLevel)` is the board's length cap (D36). */
  readonly bandLevel: number;
}

/** A theme of the week (§3.3): one featured jar mechanic, or more buried sand. `id` keys the UI name. */
export interface WeeklyTheme {
  readonly id: string;
  readonly mechanic?: MechanicId;
  readonly buriedBonus?: number;
}

/** The weekly part of game-config.json. */
export interface WeeklyConfig {
  readonly weekly: {
    readonly seedSalt: number;
    readonly maxBuried: number;
    readonly boards: readonly WeeklyBoard[];
    readonly themes: readonly WeeklyTheme[];
  };
}

/** A weekly board's spec: a LevelSpec plus where it sits in the set. `level` is the band level. */
export interface WeeklySpec extends LevelSpec {
  readonly week: string;
  readonly index: number;
  readonly theme: string;
}

/**
 * Saved progress (§3.10): the set's week (`''` before any clear), the 0-based boards cleared,
 * ascending, and the best pours of each cleared board, keyed by index.
 */
export interface WeeklyState {
  readonly week: string;
  readonly cleared: readonly number[];
  readonly pours: Readonly<Record<string, number>>;
}

const WEEK = /^(\d{4})-W(\d{2})$/;
const DAY_MS = 86_400_000;

/** The number of ISO weeks in an ISO year: 53 when 28 December falls in week 53. */
function weeksIn(year: number): number {
  const d = new Date(Date.UTC(year, 11, 28));
  return isoWeekOf(d).week;
}

function isoWeekOf(d: Date): { year: number; week: number } {
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const thursday = new Date(day + (3 - ((d.getUTCDay() + 6) % 7)) * DAY_MS);
  const year = thursday.getUTCFullYear();
  return { year, week: 1 + Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * DAY_MS)) };
}

/**
 * The ISO 8601 week of a moment on the UTC calendar, as `YYYY-Www` (§3.1). Weeks start Monday 00:00 UTC.
 * Example: `weekKey(new Date('2027-01-01T00:00:00Z')) // '2026-W53'`.
 */
export function weekKey(date: Date): string {
  const { year, week } = isoWeekOf(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** A week key's ISO year and week, or null when malformed or past the year's last week. Example: `parseWeek('2026-W53')`. */
export function parseWeek(key: string): { year: number; week: number } | null {
  const m = typeof key === 'string' ? WEEK.exec(key) : null;
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  return week >= 1 && week <= weeksIn(year) ? { year, week } : null;
}

/** True for a well-formed week key. */
export function isWeekKey(key: unknown): key is string {
  return typeof key === 'string' && parseWeek(key) !== null;
}

/** The Monday a week opens, as a `YYYY-MM-DD` date key. Example: `weekMonday('2026-W01') // '2025-12-29'`. */
export function weekMonday(key: string): string {
  const p = parseWeek(key);
  if (!p) throw new Error(`Not a week key: ${key}`);
  const jan4 = new Date(Date.UTC(p.year, 0, 4)); // always in week 1
  const monday1 = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY_MS;
  return new Date(monday1 + (p.week - 1) * 7 * DAY_MS).toISOString().slice(0, 10);
}

/** Whole weeks since Monday 1969-12-29 (§4). Example: `weekIndex('2026-W46') // 2967`. */
export function weekIndex(key: string): number {
  return Math.floor((dayNumber(weekMonday(key)) + 3) / 7);
}

/** Days left in the week including today: 7 on Monday, 1 on Sunday ("Last day"). Example: `daysLeft('2026-W46', now)`. */
export function daysLeft(key: string, now: Date): number {
  const elapsed = dayNumber(now.toISOString().slice(0, 10)) - dayNumber(weekMonday(key));
  return Math.min(7, Math.max(1, 7 - elapsed));
}

/** The theme of a week: `themes[weekIndex mod themes.length]` (§3.3). */
export function weeklyTheme(week: string, config: WeeklyConfig): WeeklyTheme {
  const list = config.weekly.themes;
  return list[weekIndex(week) % list.length];
}

function hashKey(key: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The five boards' seeds (§3.2): FNV-1a of `YYYY-Www#n` with the weekly salt, so they never
 * repeat the daily's. Example: `weeklySeeds('2026-W46', config).length // 5`.
 */
export function weeklySeeds(week: string, config: WeeklyConfig): number[] {
  return config.weekly.boards.map((_, i) => hashKey(`${week}#${i + 1}`, config.weekly.seedSalt));
}

/** The recipe of board `index` (0-based) of a week: its row, the theme's mechanic or extra buried layer. */
export function weeklySpec(week: string, index: number, config: GameConfig & WeeklyConfig): WeeklySpec {
  const w = config.weekly;
  const b = w.boards[index];
  const theme = weeklyTheme(week, config);
  return {
    level: b.bandLevel,
    week,
    index,
    theme: theme.id,
    colors: Math.min(b.colors, config.palette.length),
    capacity: b.capacity,
    spare: b.spare,
    buriedDepth: Math.min(w.maxBuried, b.buriedDepth + (theme.buriedBonus ?? 0)),
    challenge: b.capacity > 4,
    mechanics: theme.mechanic ? [theme.mechanic] : [],
  };
}

/** The weekly board's fallback chain: the daily's (§3.4), the full recipe then without its mechanic. */
export function weeklySteps(spec: WeeklySpec, config: GameConfig): FallbackStep<WeeklySpec>[] {
  return dailySteps(spec, config);
}

/**
 * Board `index` (0-based) of a week: identical for every player, never throws (§3.4). `spec`
 * says what was built, so a dropped mechanic shows no intro card.
 * Example: `generateWeekly('2026-W46', 0, config).board`.
 */
export function generateWeekly(week: string, index: number, config: GameConfig & WeeklyConfig): GeneratedLevel & { spec: WeeklySpec } {
  const spec = weeklySpec(week, index, config);
  return runFallbackSteps(weeklySteps(spec, config), weeklySeeds(week, config)[index], config, spec);
}

/** Progress before the first weekly clear. */
export function emptyWeekly(): WeeklyState {
  return { week: '', cleared: [], pours: {} };
}

/**
 * The progress to show for `week` (§3.6): the saved progress when it is that week's, otherwise an
 * empty set for it (a new week resets; an earlier week, after the clock moved back, shows as not started).
 */
export function weeklyFor(state: WeeklyState, week: string): WeeklyState {
  return state.week === week ? state : { week, cleared: [], pours: {} };
}

/** The result of recording a weekly win (§3.5, §3.6). */
export interface WeeklyClearResult {
  readonly state: WeeklyState;
  /** False when nothing was recorded: an older week than the saved one, or an index outside the set. */
  readonly counted: boolean;
  /** The board's week is older than the saved week (§3.6). */
  readonly outOfDate: boolean;
  readonly firstClear: boolean;
  /** A replay that beat the board's best. */
  readonly newBest: boolean;
  /** The board's best before this win, if it was cleared. */
  readonly prevBest: number | undefined;
  /** All boards are cleared after this win. */
  readonly complete: boolean;
  /** This win cleared the last uncleared board. */
  readonly completedNow: boolean;
  /** The week badge id when this win completed the set, else null. */
  readonly badge: string | null;
}

/**
 * Records winning board `index` of `week` in `pours` (§3.5, §3.6). A later week than the saved
 * one starts a fresh set; an earlier one is ignored. Example: `recordWeeklyClear(s, '2026-W46', 2, 31, config)`.
 */
export function recordWeeklyClear(state: WeeklyState, week: string, index: number, pours: number, config: WeeklyConfig): WeeklyClearResult {
  const total = config.weekly.boards.length;
  const ignored = (outOfDate: boolean): WeeklyClearResult => ({ state, counted: false, outOfDate, firstClear: false, newBest: false, prevBest: undefined, complete: false, completedNow: false, badge: null });
  if (state.week !== '' && week < state.week) return ignored(true);
  if (!Number.isInteger(index) || index < 0 || index >= total) return ignored(false);
  const base = weeklyFor(state, week);
  const key = String(index);
  const prevBest = base.pours[key];
  const firstClear = !base.cleared.includes(index);
  const cleared = firstClear ? [...base.cleared, index].sort((a, b) => a - b) : base.cleared;
  const best = prevBest === undefined || pours < prevBest ? pours : prevBest;
  const next: WeeklyState = { week, cleared, pours: { ...base.pours, [key]: best } };
  const complete = cleared.length >= total;
  const completedNow = complete && firstClear;
  return { state: next, counted: true, outOfDate: false, firstClear, newBest: !firstClear && prevBest !== undefined && pours < prevBest, prevBest, complete, completedNow, badge: completedNow ? weeklyBadge(week) : null };
}

/** The week's badge id (badges.md §3.9). Example: `weeklyBadge('2026-W46') // 'weekly-2026-W46'`. */
export function weeklyBadge(week: string): string {
  const p = parseWeek(week);
  if (!p) throw new Error(`Not a week key: ${week}`);
  return weeklyBadgeId(p.year, p.week);
}

/** Each board's best pours for `week`, in board order, `null` for a board not cleared (Share, §3.9). */
export function weeklyPours(state: WeeklyState, week: string, config: WeeklyConfig): (number | null)[] {
  const s = weeklyFor(state, week);
  return config.weekly.boards.map((_, i) => (s.cleared.includes(i) && s.pours[String(i)] !== undefined ? s.pours[String(i)] : null));
}

/**
 * A saved `weekly` field made safe (§3.10), field by field: a bad week resets everything; `cleared`
 * keeps in-range integers once, ascending; `pours` keeps non-negative integers of cleared boards.
 */
export function repairWeekly(raw: unknown, config: WeeklyConfig): WeeklyState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyWeekly();
  const r = raw as Record<string, unknown>;
  if (!isWeekKey(r.week)) return emptyWeekly();
  const total = config.weekly.boards.length;
  const list = Array.isArray(r.cleared) ? r.cleared : [];
  const cleared = [...new Set(list.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < total))].sort((a, b) => a - b);
  const src = r.pours && typeof r.pours === 'object' && !Array.isArray(r.pours) ? (r.pours as Record<string, unknown>) : {};
  const pours: Record<string, number> = {};
  for (const i of cleared) {
    const v = src[String(i)];
    if (Number.isInteger(v) && (v as number) >= 0) pours[String(i)] = v as number;
  }
  return { week: r.week, cleared, pours };
}
