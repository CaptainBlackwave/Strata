// Story: production/sprints/sprint-20.md H3, D171: Home's streak reward card and its track of reward days.
import { describe, expect, it } from 'vitest';
import config from '../../../../src/config/game-config.json';
import { type TrackConfig, trackOf } from '../../../../src/core/streak-track';
import { markerAt, streakCard } from '../../../../src/ui/logic/streak-card';
import type { TrackNames } from '../../../../src/ui/logic/streak-track';

const track = trackOf(config as unknown as TrackConfig);
const names: TrackNames = { frame: (id) => (id === 'tideline' ? 'Tide Line' : id), plate: (id) => id, scene: (id) => id };
const DAYS = [3, 7, 14, 30, 60, 100];

describe('streakCard (D171)', () => {
  it('reads the six reward days from config daily.track', () => {
    expect(streakCard([], 0, track, names).stops.map((s) => s.day)).toEqual(DAYS);
  });
  it('day 3 is the "Booster pair", day 7 the "Booster bundle"', () => {
    expect(streakCard([], 1, track, names).title).toBe('Booster pair');
    expect(streakCard([3], 4, track, names).title).toBe('Booster bundle');
  });
  it('day 4 with day 3 collected: "Day 4 · Hint ×2, Shuffle, Jar" and "in 3 days" on one line', () => {
    const v = streakCard([3], 4, track, names);
    expect(v.lead).toBe('Day 4');
    expect(v.what).toBe('Hint ×2, Shuffle, Jar');
    expect(v.when).toBe('in 3 days');
    expect(v.when).not.toContain(' ');
    expect(v.label).toContain('Booster bundle');
    expect(v.label).toContain('See all streak rewards');
  });
  it('a cosmetic is titled by its name and says what kind it is', () => {
    const v = streakCard([3, 7], 9, track, names);
    expect(v.title).toBe('Tide Line frame');
    expect(v.what).toBe('Avatar frame');
    expect(v.when).toBe('in 5 days');
  });
  it('ticks collected days, highlights the next, and the rest are later', () => {
    expect(streakCard([3], 4, track, names).stops.map((s) => s.state)).toEqual(['got', 'next', 'later', 'later', 'later', 'later']);
  });
  it('stops are evenly spaced from 0 to 100', () => {
    expect(streakCard([], 0, track, names).stops.map((s) => s.at)).toEqual([0, 20, 40, 60, 80, 100]);
  });
  it('no streak: no marker and "Start a streak today"', () => {
    const v = streakCard([], 0, track, names);
    expect(v.marker).toBeNull();
    expect(v.lead).toBe('Start a streak today');
    expect(v.when).toBe('in 3 days');
  });
  it('a streak past an unclaimed day says the next solve collects it (D140)', () => {
    expect(streakCard([], 5, track, names).when).toBe('Your next daily solve collects your streak rewards');
  });
  it('once all are collected: the all-collected title and no next reward', () => {
    const v = streakCard(DAYS, 120, track, names);
    expect(v.reward).toBeNull();
    expect(v.title).toBe('All streak rewards collected');
    expect(v.stops.every((s) => s.state === 'got')).toBe(true);
    expect(v.marker).toBe(100);
  });
  it('the track has a spoken sentence', () => {
    expect(streakCard([3], 4, track, names).trackLabel).toBe('Streak 4 days; collected: day 3; next: day 7');
  });
});

describe('markerAt', () => {
  it('sits between the two stops the streak falls between', () => {
    expect(markerAt(3, DAYS)).toBe(0);
    expect(markerAt(5, DAYS)).toBeCloseTo(10);
    expect(markerAt(7, DAYS)).toBe(20);
    expect(markerAt(45, DAYS)).toBeCloseTo(70);
  });
  it('before the first stop at 0, past the last at 100, none without a streak', () => {
    expect(markerAt(1, DAYS)).toBe(0);
    expect(markerAt(150, DAYS)).toBe(100);
    expect(markerAt(0, DAYS)).toBeNull();
  });
});
