// Story: production/sprints/sprint-16.md T3 (D136, D140): the daily card's next streak reward and the win card's track rows.
import { describe, expect, it } from 'vitest';
import config from '../../../../src/config/game-config.json';
import { type TrackConfig, trackOf } from '../../../../src/core/streak-track';
import { type TrackNames, nextRewardLine, trackRewardName, trackWinRows } from '../../../../src/ui/logic/streak-track';

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
    expect(nextRewardLine([3, 7], 10, track, names)).toBe('Next streak reward: Tide Line frame · 4 days');
    expect(nextRewardLine([3, 7], 13, track, names)).toBe('Next streak reward: Tide Line frame · 1 day');
    expect(nextRewardLine([], 0, track, names)).toBe('Next streak reward: Hint, Shuffle · 3 days');
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
