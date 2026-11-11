// Sprint 16 T1 (D136, D140; design/gdd/daily-puzzle.md §2.4): fixed rewards on streak days,
// counted on the current streak, each claimed once and kept for good.
import { describe, expect, it } from 'vitest';
import { type TrackStep, claimTrack, nextTrackStep } from '../../../src/core/streak-track';

const track: readonly TrackStep[] = [
  { day: 3, reward: { kind: 'boosters', boosters: { hint: 1, shuffle: 1 } } },
  { day: 7, reward: { kind: 'boosters', boosters: { hint: 2, shuffle: 1, extraJar: 1 } } },
  { day: 14, reward: { kind: 'frame', id: 'tideline' } },
  { day: 30, reward: { kind: 'style', piece: 'glass:sealantern' } },
];

describe('claimTrack', () => {
  it('claims a day when the streak reaches it', () => {
    const r = claimTrack([], 3, track);
    expect(r.claimed).toEqual([3]);
    expect(r.rewards.map((s) => s.day)).toEqual([3]);
  });

  it('pays nothing below the first day', () => {
    expect(claimTrack([], 2, track)).toEqual({ claimed: [], rewards: [] });
  });

  it('catches up every unclaimed day up to the streak (a 20-day streak claims 3, 7 and 14)', () => {
    const r = claimTrack([], 20, track);
    expect(r.claimed).toEqual([3, 7, 14]);
    expect(r.rewards.map((s) => s.day)).toEqual([3, 7, 14]);
  });

  it('never pays a claimed day again after the streak restarts', () => {
    const first = claimTrack([], 7, track);
    const again = claimTrack(first.claimed, 7, track); // a new streak back at day 7
    expect(again.rewards).toEqual([]);
    expect(again.claimed).toEqual([3, 7]);
  });

  it('ignores claimed days not on the track and keeps the list sorted', () => {
    expect(claimTrack([99, 7], 14, track).claimed).toEqual([3, 7, 14, 99]);
  });
});

describe('nextTrackStep', () => {
  it('names the next unclaimed day and how many days are left', () => {
    expect(nextTrackStep([3], 5, track)).toEqual({ step: track[1], daysLeft: 2 });
  });

  it('skips claimed days', () => {
    expect(nextTrackStep([3, 7], 1, track)?.step.day).toBe(14);
  });

  it('a claimed day the streak has not reached again is not offered again', () => {
    expect(nextTrackStep([3, 7, 14], 2, track)?.step.day).toBe(30);
  });

  it('is null once the whole track is claimed', () => {
    expect(nextTrackStep([3, 7, 14, 30], 40, track)).toBeNull();
  });
});
