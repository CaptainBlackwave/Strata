/**
 * Home's streak reward card and its track of reward days (sprint 20 H3, D171; design/ux/home.md
 * §5.6), as words and positions. DOM-free so it is unit-tested; the rules are core/streak-track.ts.
 */
import { type TrackReward, type TrackStep, nextTrackStep } from '../../core/streak-track';
import { type TrackNames, trackRewardName } from './streak-track';
import { t } from '../strings';

/** One stop on the track: collected (ticked), the next one (highlighted) or a later one. */
export interface TrackStop {
  readonly day: number;
  readonly state: 'got' | 'next' | 'later';
  /** Where the stop sits along the line, 0..100 (evenly spaced). */
  readonly at: number;
}

/** Everything the card shows. */
export interface StreakCardView {
  /** The next reward, or null once every day is collected. */
  readonly reward: TrackReward | null;
  /** The next reward's track day, or null. */
  readonly day: number | null;
  /** "Booster pair", "Booster bundle", the cosmetic's name, or the all-collected line. */
  readonly title: string;
  /** The line's lead: "Day 4", or "Start a streak today" with no streak. */
  readonly lead: string;
  /** What the reward is: "Hint ×2, Shuffle, Jar", or the kind of cosmetic ("Avatar frame"). Empty once all are collected. */
  readonly what: string;
  /** "in 3 days" (kept on one line), the catch-up line, or empty. */
  readonly when: string;
  /** The whole card as one spoken sentence, ending with where it goes. */
  readonly label: string;
  readonly stops: TrackStop[];
  /** Where the current streak sits along the line (0..100), or null with no streak. */
  readonly marker: number | null;
  /** The track as one spoken sentence (the line itself is a picture). */
  readonly trackLabel: string;
}

/** The streak's place along evenly spaced stops: between the two stops it falls between, 0 before the first, 100 past the last. */
export function markerAt(streak: number, days: readonly number[]): number | null {
  if (streak <= 0 || days.length === 0) return null;
  if (days.length === 1) return streak >= days[0] ? 100 : 0;
  const span = days.length - 1;
  const i = days.findIndex((d) => d >= streak);
  if (i < 0) return 100;
  if (i === 0) return 0;
  const a = days[i - 1];
  const b = days[i];
  return ((i - 1 + (streak - a) / (b - a)) / span) * 100;
}

/** The card's title for a reward: the booster rewards have their own names (D171); a cosmetic is its name. */
export function rewardTitle(step: TrackStep, names: TrackNames): string {
  if (step.reward.kind !== 'boosters') return trackRewardName(step.reward, names);
  const count = Object.values(step.reward.boosters).reduce((a, n) => a + (n ?? 0), 0);
  return count <= 2 ? t.homeScreen.streak.pair : t.homeScreen.streak.bundle;
}

/**
 * The card for the live streak. `claimed` is `save.track`; `streak` is `streakStatus(...).current`.
 * Example: claimed [3], streak 4: "Booster bundle", "Day 4 · Hint ×2, Shuffle, Jar · in 3 days".
 */
export function streakCard(claimed: readonly number[], streak: number, track: readonly TrackStep[], names: TrackNames): StreakCardView {
  const steps = [...track].sort((a, b) => a.day - b.day);
  const next = nextTrackStep(claimed, streak, steps);
  const span = Math.max(1, steps.length - 1);
  const stops: TrackStop[] = steps.map((s, i) => ({
    day: s.day,
    state: claimed.includes(s.day) ? 'got' : next && next.step.day === s.day ? 'next' : 'later',
    at: steps.length === 1 ? 0 : (i / span) * 100,
  }));
  const marker = markerAt(streak, steps.map((s) => s.day));
  const s = t.homeScreen.streak;
  const lead = streak > 0 ? s.day(streak) : t.noStreak;
  const trackLabel = s.trackLabel(streak, stops.filter((x) => x.state === 'got').map((x) => x.day), next?.step.day ?? null);
  if (!next) {
    return { reward: null, day: null, title: t.track.allCollected, lead, what: '', when: '', label: s.label(t.track.allCollected, lead), stops, marker, trackLabel };
  }
  const title = rewardTitle(next.step, names);
  const what = next.step.reward.kind === 'boosters' ? trackRewardName(next.step.reward, names) : s.kinds[next.step.reward.kind] ?? '';
  // A streak already past an unclaimed day (updated mid-streak, D140): the next counted solve pays it.
  const when = next.step.day <= streak ? t.track.catchUp : s.inDays(next.daysLeft);
  return { reward: next.step.reward, day: next.step.day, title, lead, what, when, label: s.label(`${title}, ${what}, ${when}`, lead), stops, marker, trackLabel };
}
