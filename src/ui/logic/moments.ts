/**
 * Share moments (sprint 14 H4, design/gdd/sharing.md §3.4): the few high points where the win
 * card offers a quiet Share. DOM-free. Never a pop-up, never a reward (D120).
 */

/** One shareable high point. `id` is a badge id; its name comes from the badge catalogue. */
export type Moment =
  | { readonly kind: 'set'; readonly name: string }
  | { readonly kind: 'streak'; readonly days: number }
  | { readonly kind: 'badge'; readonly id: string };

/** Whether a daily streak of `days` is one of the milestones (`sharing.streakMilestones`). Example: `isStreakMilestone(30, [7, 30]) // true`. */
export function isStreakMilestone(days: number, milestones: readonly number[]): boolean {
  return milestones.includes(days);
}

/** What this win earned that can be shared. `streak` is null when the win was not a daily. */
export interface MomentInput {
  readonly setName: string | null;
  readonly streak: number | null;
  readonly badges: readonly string[];
}

/**
 * The moments a win offers, in card order: a completed set, a streak milestone, then the first
 * new badge (one Share per row). Example: `shareMoments({ setName: null, streak: 30, badges: [] }, [7, 30]) // [streak 30]`.
 */
export function shareMoments(input: MomentInput, milestones: readonly number[]): Moment[] {
  const out: Moment[] = [];
  if (input.setName) out.push({ kind: 'set', name: input.setName });
  if (input.streak !== null && isStreakMilestone(input.streak, milestones)) out.push({ kind: 'streak', days: input.streak });
  if (input.badges.length) out.push({ kind: 'badge', id: input.badges[0] });
  return out;
}
