/**
 * Which weekly set a Share sends (design/gdd/weekly-set.md §3.9, strata-gbw.6). Pure, so it is
 * tested without the DOM.
 */
import { type WeeklyConfig, type WeeklyState, weeklyPours } from '../../core/weekly';

/** What is on screen when Share is tapped. */
export interface WeeklyShareInput {
  /** The saved weekly state (it may already have moved on to a new week). */
  readonly saved: WeeklyState;
  /** The set the open chooser shows, as it was when it opened; null when Share comes from elsewhere. */
  readonly shown: WeeklyState | null;
  /** The week of the weekly board in play, or null. */
  readonly playing: string | null;
  /** This week by the clock, e.g. "2026-W47". */
  readonly now: string;
}

/**
 * The week and per-board pours to share: the board in play's week, else the week the open chooser
 * shows (a chooser left open past Sunday midnight still shares the week it shows), else this week.
 * Example: chooser opened on W46 with board 1 in 31 pours, tapped after midnight: W46, [31, null…].
 */
export function weeklyToShare(input: WeeklyShareInput, config: WeeklyConfig): { week: string; pours: (number | null)[] } {
  if (input.playing) return { week: input.playing, pours: weeklyPours(input.saved, input.playing, config) };
  if (input.shown) return { week: input.shown.week, pours: weeklyPours(input.shown, input.shown.week, config) };
  return { week: input.now, pours: weeklyPours(input.saved, input.now, config) };
}
