/**
 * The daily puzzle and its streak. Everyone gets the same board for a calendar date,
 * with a weekly difficulty rhythm (Monday easy, Sunday tall jars). Missing one day can
 * be saved by a banked "tide pass". Pure functions only.
 * Implements design/competitive-roadmap.md item C6 (sprint 2 decisions S2-1, S2-2).
 */
import { type FallbackStep, type GeneratedLevel, hasAnyMechanic, runFallbackSteps, stepBudgets, withoutMechanics } from './generator';
import { type GameConfig, type LevelSpec, type MechanicId, isClassicMechanic, splitMechanics } from './levels';

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

/**
 * A rotation era (sprint 13 W1, D98): from date key `from` (a Saturday, UTC) the rotate day plays
 * `mechanics[(whole weeks since from) mod length]`, so the first Saturday plays `mechanics[0]`.
 */
export interface DailyRotationEra {
  readonly from: string;
  readonly mechanics: readonly MechanicId[];
}

/** The daily part of game-config.json. */
export interface DailyConfig {
  readonly daily: {
    readonly seedSalt: number;
    /** Index 0 = Sunday ... 6 = Saturday. */
    readonly week: readonly DailyDay[];
    /**
     * Later rotations, ascending by `from`; the last one started applies (D98). Before the first,
     * or when absent, the rotation is the four classic mechanics by `dayNumber / 7` (S3-4).
     */
    readonly saturdayFrom?: readonly DailyRotationEra[];
    readonly streak: {
      readonly baseCoins: number;
      readonly coinsPerDay: number;
      readonly maxCoins: number;
      /** Long-streak steps (D99): from `fromDay` of a streak, `coins` more on top of the capped reward. The highest step reached applies. */
      readonly longSteps?: readonly { readonly fromDay: number; readonly coins: number }[];
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

/**
 * The mechanic a rotate day features on date `key` (daily-puzzle.md §3.3). Before the first
 * `saturdayFrom` era: the four classic mechanics, `floor(dayNumber / 7) mod 4`, exactly as before
 * sprint 13 W1 (tests/fixtures/daily-weekly-pins.json). From an era's `from`: its list, counted
 * from that date, so no daily before the start date changes (D98).
 * Example: `rotationMechanic('2026-11-28', config) // 'hourglass'`.
 */
export function rotationMechanic(key: string, config: GameConfig & DailyConfig): MechanicId {
  const era = [...(config.daily.saturdayFrom ?? [])].reverse().find((e) => e.mechanics.length > 0 && key >= e.from);
  if (era) {
    const n = Math.floor((dayNumber(key) - dayNumber(era.from)) / 7);
    return era.mechanics[n % era.mechanics.length];
  }
  const classic = config.mechanics.list.map((m) => m.id).filter(isClassicMechanic);
  return classic[Math.floor(dayNumber(key) / 7) % classic.length];
}

/** The board recipe for a date. A new jar (hourglass, sieve, clam) rides in its `LevelSpec` flag, as on the levels. */
export function dailySpec(key: string, config: GameConfig & DailyConfig): DailySpec {
  const day = config.daily.week[weekday(key)];
  const featured = day.mechanic === 'rotate' ? splitMechanics([rotationMechanic(key, config)]) : { mechanics: [] };
  return {
    level: 0,
    date: key,
    name: day.name,
    colors: Math.min(day.colors, config.palette.length),
    capacity: day.capacity,
    spare: day.spare,
    buriedDepth: day.buriedDepth,
    challenge: day.capacity > 4,
    ...featured,
  };
}

/** The generation seed for a date's daily (the same for every player). Example: `dailySeed('2026-11-08', config)`. */
export function dailySeed(key: string, config: DailyConfig): number {
  return hashKey(key, config.daily.seedSalt);
}

/**
 * The daily board for a date: identical for every player. Never throws (F7, GA-DP-1):
 * the full recipe, then without its mechanic (capped by `generator.stepNodeBudget`), then
 * the shared last resort (one more spare, then a board winnable by construction).
 * `spec` says what was actually built, so a dropped mechanic shows no intro card.
 */
export function generateDaily(key: string, config: GameConfig & DailyConfig): GeneratedLevel & { spec: DailySpec } {
  const spec = dailySpec(key, config);
  return runFallbackSteps(dailySteps(spec, config), dailySeed(key, config), config, spec);
}

/**
 * The daily's fallback chain (TD-5): the full recipe with the plain generator caps (it is
 * not capped by step work, unlike a level's first step), then, when the day has a mechanic
 * (a new jar's flag included, sprint 13 W1), the same recipe without it, capped by `generator.stepNodeBudget`.
 * The weekly set uses the same chain for its boards (design/gdd/weekly-set.md §3.4).
 * Example: `dailySteps(dailySpec('2026-11-08', config), config).length // 1 or 2`
 */
export function dailySteps<S extends LevelSpec = DailySpec>(spec: S, config: GameConfig): FallbackStep<S>[] {
  const g = config.generator;
  const steps: FallbackStep<S>[] = [{ spec, maxAttempts: g.maxAttempts, totalNodeBudget: Infinity, attemptNodeBudget: g.solverNodeBudget }];
  if (hasAnyMechanic(spec)) {
    const { cap, perAttempt } = stepBudgets(config);
    steps.push({ spec: withoutMechanics(spec), maxAttempts: g.maxAttempts, totalNodeBudget: cap, attemptNodeBudget: perAttempt });
  }
  return steps;
}

/**
 * Coins for solving on day `streak` of a streak: base plus growth, capped, plus the highest
 * long-streak step reached (D99). Example: `streakReward(30, config) // 100 + 25`.
 */
export function streakReward(streak: number, config: DailyConfig): number {
  const s = config.daily.streak;
  return Math.min(s.maxCoins, s.baseCoins + s.coinsPerDay * Math.max(0, streak - 1)) + streakStep(streak, config);
}

/** The long-streak step for day `streak` (D99): 0 before the first step. Example: `streakStep(60, config) // 50`. */
export function streakStep(streak: number, config: DailyConfig): number {
  return (config.daily.streak.longSteps ?? []).filter((x) => streak >= x.fromDay).reduce((best, x) => Math.max(best, x.coins), 0);
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
  // A device date before the last solve (D10) shows today as not solved (owner default, GA-DP-5).
  if (gap < 0) return { current: state.streak, solvedToday: false, passAtRisk: false };
  if (gap === 0) return { current: state.streak, solvedToday: true, passAtRisk: false };
  if (gap === 1) return { current: state.streak, solvedToday: false, passAtRisk: false };
  if (gap === 2 && state.passes > 0) return { current: state.streak, solvedToday: false, passAtRisk: true };
  return { current: 0, solvedToday: false, passAtRisk: false };
}

/** The pour count of a date's first counted solve, kept so Share can't show a replay's count. */
export interface DailyShareRecord {
  readonly date: string;
  readonly pours: number;
}

/**
 * The pour count Share reports for `date`: the first counted solve's when one is recorded for
 * that date, otherwise the current solve's (owner default, GA-DP-6).
 * Example: `sharePours({ date: '2026-11-08', pours: 31 }, '2026-11-08', 24) // 31`
 */
export function sharePours(record: DailyShareRecord | null, date: string, moves: number): number {
  return record && record.date === date ? record.pours : moves;
}
