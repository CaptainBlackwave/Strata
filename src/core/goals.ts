/**
 * Daily goals (sprint 16, D137; design/gdd/daily-goals.md): three small goals each UTC day, the
 * same for every player, picked from the date. Each pays coins once when reached; all three pay a
 * bonus. Pure and DOM-free: the UI reports wins as {@link GoalEvent}s.
 */
import { dayNumber } from './daily';
import { createRng, mixSeed, shuffle } from './rng';

/** What a goal counts. */
export type GoalKind = 'seal' | 'clear' | 'perfect' | 'daily' | 'weekly' | 'beatBest';

/** One goal: reach `target` of `kind` today for `coins`. */
export interface Goal {
  readonly kind: GoalKind;
  readonly target: number;
  readonly coins: number;
}

/** `goals` in the config. */
export interface GoalsConfig {
  readonly goals: {
    /** Seed salt for picking a date's goals. NEVER change once released: today's goals would change. */
    readonly seedSalt: number;
    readonly perDay: number;
    /** Coins for finishing all of a day's goals. */
    readonly bonus: number;
    /** Every goal that can be picked; a kind may appear with several sizes. */
    readonly pool: readonly Goal[];
  };
}

/** Saved progress for one day. `progress[i]` is for goal `i` of {@link goalsFor}(date). */
export interface GoalsState {
  readonly date: string;
  readonly progress: readonly number[];
  readonly done: readonly number[];
  readonly bonus: boolean;
}

/** One won board, as the goals see it. */
export interface GoalEvent {
  /** `event` boards (sprint 17) count for jars sealed only. */
  readonly mode: 'level' | 'daily' | 'weekly' | 'event';
  readonly jarsSealed: number;
  /** Won with no hint, shuffle or extra jar (Undo is free). */
  readonly perfect: boolean;
  /** A replay cleared in fewer pours than the level's best. */
  readonly beatBest: boolean;
  /** False for a daily already solved today or out of order: it pays nothing and counts for nothing. */
  readonly counted: boolean;
}

/** No progress yet. */
export function emptyGoals(): GoalsState {
  return { date: '', progress: [], done: [], bonus: false };
}

/**
 * The goals for `date` (`YYYY-MM-DD`): `perDay` goals of different kinds, each a size of its kind
 * picked from the pool, in a fixed order for the day. Example: `goalsFor('2026-11-12', config)`.
 */
export function goalsFor(date: string, config: GoalsConfig): Goal[] {
  const g = config.goals;
  const rng = createRng(mixSeed(dayNumber(date), g.seedSalt));
  const kinds = shuffle([...new Set(g.pool.map((p) => p.kind))], rng).slice(0, g.perDay);
  return kinds.map((kind) => {
    const sizes = g.pool.filter((p) => p.kind === kind);
    return sizes[Math.floor(rng() * sizes.length)];
  });
}

/** How much one event moves a goal of `kind`. */
function stepFor(kind: GoalKind, e: GoalEvent): number {
  if (!e.counted) return 0;
  switch (kind) {
    case 'seal':
      return e.jarsSealed;
    case 'clear':
      return e.mode === 'level' ? 1 : 0;
    case 'perfect':
      return e.mode === 'level' && e.perfect ? 1 : 0;
    case 'daily':
      return e.mode === 'daily' ? 1 : 0;
    case 'weekly':
      return e.mode === 'weekly' ? 1 : 0;
    case 'beatBest':
      return e.mode === 'level' && e.beatBest ? 1 : 0;
  }
}

/**
 * Records one won board on `date`. A later date than the saved one starts the day fresh; an earlier
 * one (the clock moved back) records nothing. Progress stops at each target. Returns the new state,
 * the goals paid now (index and coins) and the bonus paid now (0 or the config's bonus).
 */
export function recordGoals(state: GoalsState, date: string, event: GoalEvent, config: GoalsConfig): { state: GoalsState; paid: { index: number; coins: number }[]; bonus: number } {
  if (state.date !== '' && date < state.date) return { state, paid: [], bonus: 0 };
  const goals = goalsFor(date, config);
  const base = state.date === date ? state : { date, progress: [], done: [], bonus: false };
  const progress = goals.map((g, i) => Math.min(g.target, (base.progress[i] ?? 0) + stepFor(g.kind, event)));
  const paid = goals.flatMap((g, i) => (progress[i] >= g.target && !base.done.includes(i) ? [{ index: i, coins: g.coins }] : []));
  const done = [...base.done, ...paid.map((p) => p.index)].sort((a, b) => a - b);
  const allDone = done.length >= goals.length;
  const bonus = allDone && !base.bonus ? config.goals.bonus : 0;
  return { state: { date, progress, done, bonus: base.bonus || allDone }, paid, bonus };
}

/**
 * A saved `goals` field made safe, field by field: a bad date gives no progress; progress values are
 * whole numbers ≥ 0; `done` keeps valid indices once, ascending.
 */
export function repairGoals(raw: unknown): GoalsState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyGoals();
  const r = raw as Record<string, unknown>;
  if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return emptyGoals();
  const progress = Array.isArray(r.progress) ? r.progress.map((n) => (Number.isInteger(n) && (n as number) >= 0 ? (n as number) : 0)) : [];
  const done = Array.isArray(r.done) ? [...new Set(r.done.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 16))].sort((a, b) => a - b) : [];
  return { date: r.date, progress, done, bonus: r.bonus === true };
}
