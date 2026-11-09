/**
 * The UI's clock reads (TD-16), as pure functions of an injected clock so date-dependent UI
 * rules (the daily's UTC rollover, the scene of the hour, the "in season" badge) can be
 * unit-tested with a fixed time. DOM-free. The real clock is `systemClock`; `state.clock`
 * holds the one the app uses. Animation timing (`performance.now`, rAF) is not routed here.
 */
import { utcDateKey } from '../core/daily';
import { type SeasonOptions, type Theme, inSeason, localDateKey } from '../core/themes';

/** A source of the current time. Example: `const clock: Clock = () => new Date('2026-11-09T00:00:00Z');` */
export type Clock = () => Date;
/** A source of uniform random numbers in [0, 1), like `Math.random`. */
export type Random = () => number;

/** The device's real clock. */
export const systemClock: Clock = () => new Date();

/** Today's daily-puzzle key, the UTC date (design/gdd/daily-puzzle.md, M4). Example: `dailyKey(state.clock)`. */
export function dailyKey(clock: Clock): string {
  return utcDateKey(clock());
}

/** The local date key and hour the scenes follow (B5). Example: `sceneDay(state.clock).hour`. */
export function sceneDay(clock: Clock): { readonly dateKey: string; readonly hour: number } {
  const now = clock();
  return { dateKey: localDateKey(now), hour: now.getHours() };
}

/** Whether a scene card shows the "in season" badge today. Example: `seasonBadge(theme, state.clock, { southern })`. */
export function seasonBadge(theme: Theme, clock: Clock, opts: SeasonOptions = {}): boolean {
  return inSeason(theme, sceneDay(clock).dateKey, opts);
}
