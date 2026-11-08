/**
 * The daily puzzle and its streak. Everyone gets the same board for a calendar date,
 * with a weekly difficulty rhythm (Monday easy, Sunday tall jars). Missing one day can
 * be saved by a banked "tide pass". Pure functions only.
 * Implements design/competitive-roadmap.md item C6 (sprint 2 decisions S2-1, S2-2).
 */
import { type GeneratedLevel, generateFromSpec } from './generator';
import type { GameConfig, LevelSpec } from './levels';

/** One weekday's board recipe. */
export interface DailyDay {
  readonly name: string;
  readonly colors: number;
  readonly capacity: number;
  readonly spare: number;
  readonly buriedDepth: number;
  /** `rotate`: feature one mechanic, cycling through all of them week by week (S3-4). */
  readonly mechanic?: 'rotate';
}

/** The daily part of game-config.json. */
export interface DailyConfig {
  readonly daily: {
    readonly seedSalt: number;
    /** Index 0 = Sunday ... 6 = Saturday. */
    readonly week: readonly DailyDay[];
    readonly streak: {
      readonly baseCoins: number;
      readonly coinsPerDay: number;
      readonly maxCoins: number;
      readonly passEvery: number;
      readonly maxPasses: number;
    };
  };
}

/** Persisted streak state. `last` is the date key of the most recent solve. */
export interface StreakState {
  readonly last: string | null;
  readonly streak: number;
  readonly best: number;
  readonly passes: number;
}

/** A daily spec: a LevelSpec plus its difficulty name. */
export interface DailySpec extends LevelSpec {
  readonly name: string;
  readonly date: string;
}

/** The device's local calendar date as `YYYY-MM-DD`. Example: `localDateKey(new Date())`. */
export function localDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Today's daily-puzzle key: the **UTC** calendar date as `YYYY-MM-DD`, so every player
 * gets the same board at the same moment (design/gdd/daily-puzzle.md, M4).
 * Example: `utcDateKey(new Date())`.
 */
export function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Whole days since 1970-01-01 for a date key (timezone-independent). */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** 0 = Sunday ... 6 = Saturday for a date key, the same on every device. */
export function weekday(key: string): number {
  return (dayNumber(key) + 4) % 7; // 1970-01-01 was a Thursday
}

function hashKey(key: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The board recipe for a date. */
export function dailySpec(key: string, config: GameConfig & DailyConfig): DailySpec {
  const day = config.daily.week[weekday(key)];
  return {
    level: 0,
    date: key,
    name: day.name,
    colors: Math.min(day.colors, config.palette.length),
    capacity: day.capacity,
    spare: day.spare,
    buriedDepth: day.buriedDepth,
    challenge: day.capacity > 4,
    mechanics: day.mechanic === 'rotate' ? [config.mechanics.list[Math.floor(dayNumber(key) / 7) % config.mechanics.list.length].id] : [],
  };
}

/** The daily board for a date: identical for every player. */
export function generateDaily(key: string, config: GameConfig & DailyConfig): GeneratedLevel & { spec: DailySpec } {
  const spec = dailySpec(key, config);
  return { ...generateFromSpec(spec, hashKey(key, config.daily.seedSalt), config), spec };
}

/** Coins for solving on day `streak` of a streak. */
export function streakReward(streak: number, config: DailyConfig): number {
  const s = config.daily.streak;
  return Math.min(s.maxCoins, s.baseCoins + s.coinsPerDay * Math.max(0, streak - 1));
}

/** The result of recording a solve. */
export interface DailySolveResult {
  readonly state: StreakState;
  readonly reward: number;
  readonly alreadySolved: boolean;
  readonly usedPass: boolean;
  readonly earnedPass: boolean;
  /** The device date is earlier than the last solve: ignored for the streak (decision D10). */
  readonly outOfOrder?: boolean;
}

/** Records solving the daily puzzle on `today`. Pays only the first solve of a day. */
export function recordDailySolve(state: StreakState, today: string, config: DailyConfig): DailySolveResult {
  if (state.last === today) return { state, reward: 0, alreadySolved: true, usedPass: false, earnedPass: false };
  // A date before the last solve (clock moved back) changes nothing: no reward, no reset.
  if (state.last !== null && dayNumber(today) < dayNumber(state.last)) {
    return { state, reward: 0, alreadySolved: false, usedPass: false, earnedPass: false, outOfOrder: true };
  }
  const s = config.daily.streak;
  const gap = state.last === null ? Infinity : dayNumber(today) - dayNumber(state.last);
  let streak = 1;
  let passes = state.passes;
  let usedPass = false;
  if (gap === 1) streak = state.streak + 1;
  else if (gap === 2 && passes > 0) {
    streak = state.streak + 1;
    passes--;
    usedPass = true;
  }
  let earnedPass = false;
  if (streak % s.passEvery === 0 && passes < s.maxPasses) {
    passes++;
    earnedPass = true;
  }
  const next: StreakState = { last: today, streak, best: Math.max(state.best, streak), passes };
  return { state: next, reward: streakReward(streak, config), alreadySolved: false, usedPass, earnedPass };
}

/** What the home screen shows today: the live streak, and whether a pass is about to be spent. */
export function streakStatus(state: StreakState, today: string): { current: number; solvedToday: boolean; passAtRisk: boolean } {
  if (state.last === null) return { current: 0, solvedToday: false, passAtRisk: false };
  const gap = dayNumber(today) - dayNumber(state.last);
  if (gap <= 0) return { current: state.streak, solvedToday: true, passAtRisk: false };
  if (gap === 1) return { current: state.streak, solvedToday: false, passAtRisk: false };
  if (gap === 2 && state.passes > 0) return { current: state.streak, solvedToday: false, passAtRisk: true };
  return { current: 0, solvedToday: false, passAtRisk: false };
}
