// Story: production/sprints/sprint-16.md T3 (D136, D140): the daily card's next streak reward and the win card's track rows.
import { describe, expect, it } from 'vitest';
import config from '../../../../src/config/game-config.json';
import { type TrackConfig, trackOf } from '../../../../src/core/streak-track';
import { type TrackNames, nextRewardLine, trackRewardName, trackSheetRows, trackWinRows } from '../../../../src/ui/logic/streak-track';

const track = trackOf(config as unknown as TrackConfig);
const names: TrackNames = { frame: () => 'Tide Line', plate: () => 'Lighthouse', scene: () => 'Lighthouse Night' };
const step = (day: number) => track.find((s) => s.day === day)!;

describe('trackRewardName', () => {
  it('lists boosters in a fixed order with counts above one', () => {
    expect(trackRewardName(step(3).reward, names)).toBe('Hint, Shuffle');
    expect(trackRewardName(step(7).reward, names)).toBe('Hint ×2, Shuffle, Jar');
  });
  it('names each cosmetic with its kind', () => {
    expect(trackRewardName(step(14).reward, names)).toBe('Tide Line frame');
    expect(trackRewardName(step(30).reward, names)).toBe('Sea Lantern glass');
    expect(trackRewardName(step(60).reward, names)).toBe('Lighthouse name plate');
    expect(trackRewardName(step(100).reward, names)).toBe('Lighthouse Night scene');
  });
});

describe('nextRewardLine', () => {
  it('names the lowest unclaimed day and the days left', () => {
    expect(nextRewardLine([3, 7], 10, track, names)).toBe('Next streak reward: Tide Line frame · 4\u00a0days');
    expect(nextRewardLine([3, 7], 13, track, names)).toBe('Next streak reward: Tide Line frame · 1\u00a0day');
    expect(nextRewardLine([], 0, track, names)).toBe('Next streak reward: Hint, Shuffle · 3\u00a0days');
  });
  it('says the next solve collects when the streak already passed an unclaimed day (D140 catch-up)', () => {
    expect(nextRewardLine([], 20, track, names)).toBe('Your next daily solve collects your streak rewards');
  });
  it('is empty once the whole track is claimed', () => {
    expect(nextRewardLine(track.map((s) => s.day), 120, track, names)).toBe('');
  });
});

describe('trackWinRows', () => {
  it('writes a row for boosters, styles and scenes, and none for frames and plates (they show as unlocks)', () => {
    expect(trackWinRows([step(7), step(14), step(30), step(60), step(100)], names)).toEqual([
      'Day 7 streak reward: Hint ×2, Shuffle, Jar',
      'Day 30 streak reward: Sea Lantern glass',
      'Day 100 streak reward: Lighthouse Night scene',
    ]);
  });
});

describe('trackSheetRows (0.15.1, strata-dll)', () => {
  it('lists all six days in order: collected, then the next with days left, then later days', () => {
    const rows = trackSheetRows([3, 7], 13, track, names);
    expect(rows.map((r) => r.step.day)).toEqual([3, 7, 14, 30, 60, 100]);
    expect(rows.map((r) => r.state)).toEqual(['collected', 'collected', 'next', 'later', 'later', 'later']);
    expect(rows.map((r) => r.status)).toEqual(['Day 3 · Collected', 'Day 7 · Collected', 'Day 14 · Next · 1 day', 'Day 30', 'Day 60', 'Day 100']);
    expect(rows[3].name).toBe('Sea Lantern glass');
  });
  it('a streak of 40 with four days collected aims for day 60 in 20 days', () => {
    const rows = trackSheetRows([3, 7, 14, 30], 40, track, names);
    expect(rows[4]).toMatchObject({ state: 'next', status: 'Day 60 · Next · 20 days', name: 'Lighthouse name plate' });
    expect(rows[5].state).toBe('later');
  });
  it('a collected day stays collected after the streak ends; nothing is next once all are collected', () => {
    expect(trackSheetRows([3, 7, 14], 0, track, names)[2].state).toBe('collected');
    expect(trackSheetRows(track.map((s) => s.day), 0, track, names).every((r) => r.state === 'collected')).toBe(true);
  });
});
