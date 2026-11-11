/**
 * The streak reward track (sprint 16, D136, D140; design/gdd/daily-puzzle.md §2.4): fixed
 * rewards on streak days, mostly cosmetics that can only be earned this way. The track counts the
 * current streak; each day is claimed once and its reward kept for good. Pure and DOM-free.
 */
import type { BoosterId } from './economy';

/** What one track day gives. */
export type TrackReward =
  | { readonly kind: 'boosters'; readonly boosters: Readonly<Partial<Record<BoosterId, number>>> }
  | { readonly kind: 'frame'; readonly id: string }
  | { readonly kind: 'plate'; readonly id: string }
  | { readonly kind: 'style'; readonly piece: string }
  | { readonly kind: 'scene'; readonly id: string };

/** One day on the track: `daily.track[]` in the config. */
export interface TrackStep {
  readonly day: number;
  readonly reward: TrackReward;
}

/** The track as the config holds it. */
export interface TrackConfig {
  readonly daily: { readonly track?: readonly TrackStep[] };
}

/**
 * Claims every track day up to `streak` that is not claimed yet (D140): a player who arrives with a
 * long streak catches up at once. Returns the new claimed list (sorted, each day once) and the
 * steps paid now, in day order. Example: `claimTrack([], 20, track)` pays days 3, 7 and 14.
 */
export function claimTrack(claimed: readonly number[], streak: number, track: readonly TrackStep[]): { claimed: number[]; rewards: TrackStep[] } {
  const have = new Set(claimed);
  const rewards = track.filter((s) => s.day <= streak && !have.has(s.day)).sort((a, b) => a.day - b.day);
  for (const s of rewards) have.add(s.day);
  return { claimed: [...have].sort((a, b) => a - b), rewards };
}

/**
 * The next reward to aim for: the lowest unclaimed day, and how many more streak days reach it
 * (at least 1). Null once every day is claimed. Example: claimed [3], streak 5: day 7, 2 days left.
 */
export function nextTrackStep(claimed: readonly number[], streak: number, track: readonly TrackStep[]): { step: TrackStep; daysLeft: number } | null {
  const step = [...track].sort((a, b) => a.day - b.day).find((s) => !claimed.includes(s.day));
  return step ? { step, daysLeft: Math.max(1, step.day - streak) } : null;
}

/** The config's track, or none. */
export function trackOf(config: TrackConfig): readonly TrackStep[] {
  return config.daily.track ?? [];
}
