/**
 * The streak reward track's words (sprint 16, D136; design/gdd/daily-puzzle.md §2.4), DOM-free so
 * they are unit-tested: a reward's name, the Home daily card's "Next streak reward" line and the
 * win card's rows. The rules are the pure core/streak-track.ts.
 */
import { type TrackReward, type TrackStep, nextTrackStep } from '../../core/streak-track';
import { t } from '../strings';

/** Display names the words need, looked up from the config by the caller. */
export interface TrackNames {
  /** An avatar frame's name by id, e.g. "Tide Line". */
  readonly frame: (id: string) => string;
  /** A name plate's name by id, e.g. "Lighthouse". */
  readonly plate: (id: string) => string;
  /** A scene's name by id, e.g. "Lighthouse Night". */
  readonly scene: (id: string) => string;
}

/** Booster order in a list. */
const BOOSTER_ORDER = ['hint', 'shuffle', 'extraJar', 'undo'] as const;

/**
 * A reward as words: "Hint ×2, Shuffle, Jar", "Tide Line frame", "Sea Lantern glass",
 * "Lighthouse name plate" or "Lighthouse Night scene".
 */
export function trackRewardName(reward: TrackReward, names: TrackNames): string {
  switch (reward.kind) {
    case 'boosters':
      return BOOSTER_ORDER.filter((id) => (reward.boosters[id] ?? 0) > 0)
        .map((id) => t.track.booster(t.track.boosterNames[id] ?? id, reward.boosters[id]!))
        .join(', ');
    case 'frame':
      return t.track.frame(names.frame(reward.id));
    case 'plate':
      return t.track.plate(names.plate(reward.id));
    case 'style': {
      const [slot, id] = reward.piece.split(':');
      return t.track.style(t.styles.names[slot]?.[id] ?? id, t.styles.slots[slot] ?? slot);
    }
    case 'scene':
      return t.track.scene(names.scene(reward.id));
  }
}

/**
 * The daily card's line: "Next streak reward: Tide Line frame · 4 days", the catch-up line when the
 * streak already passed an unclaimed day, or '' once every track
 * day is claimed. `streak` is the live streak (`streakStatus(...).current`).
 */
export function nextRewardLine(claimed: readonly number[], streak: number, track: readonly TrackStep[], names: TrackNames): string {
  const next = nextTrackStep(claimed, streak, track);
  if (!next) return '';
  // The streak already passed an unclaimed day (updated mid-streak): the next counted solve pays it (D140).
  if (next.step.day <= streak) return t.track.catchUp;
  return t.track.next(trackRewardName(next.step.reward, names), next.daysLeft);
}

/** One row of the streak track sheet. */
export interface TrackSheetRow {
  readonly step: TrackStep;
  /** The reward in words, from {@link trackRewardName}. */
  readonly name: string;
  readonly state: 'collected' | 'next' | 'later';
  /** "Day 3 · Collected", "Day 14 · Next · 4 days" or "Day 60". */
  readonly status: string;
}

/**
 * The track sheet's rows, in day order: each day collected (in `claimed`), the next one to aim for
 * (with the days left, from the live streak) or a later day.
 * Example: `trackSheetRows(save.track, streakStatus(save.daily, today).current, track, names)`.
 */
export function trackSheetRows(claimed: readonly number[], streak: number, track: readonly TrackStep[], names: TrackNames): TrackSheetRow[] {
  const next = nextTrackStep(claimed, streak, track);
  return [...track]
    .sort((a, b) => a.day - b.day)
    .map((step) => {
      const name = trackRewardName(step.reward, names);
      if (claimed.includes(step.day)) return { step, name, state: 'collected', status: t.track.collected(step.day) };
      if (next && next.step.day === step.day) return { step, name, state: 'next', status: t.track.nextIn(step.day, next.daysLeft) };
      return { step, name, state: 'later', status: t.track.later(step.day) };
    });
}

/**
 * The win card's rows for the track days a solve claimed: "Day 30 streak reward: Sea Lantern glass".
 * Frames and plates are left out: they already show as unlock rows (`card.unlocks`).
 */
export function trackWinRows(steps: readonly TrackStep[], names: TrackNames): string[] {
  return steps.filter((s) => s.reward.kind !== 'frame' && s.reward.kind !== 'plate').map((s) => t.track.row(s.day, trackRewardName(s.reward, names)));
}
