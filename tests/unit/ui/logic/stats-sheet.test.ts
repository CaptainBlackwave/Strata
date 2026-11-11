// Sprint 18 S1 (D150): the "Your stats" sheet players copy and send. Nothing is sent automatically.
import { describe, expect, it } from 'vitest';
import { emptyStats } from '../../../../src/core/profile';
import { type StatsInput, type StatsLabels, browserName, statsSections, statsText } from '../../../../src/ui/logic/stats-sheet';

const labels: StatsLabels = {
  title: 'Strata stats', progress: 'Progress', today: 'Today', boosters: 'Boosters and coins', device: 'Device', yes: 'yes', no: 'no',
  rows: { level: 'Level', streak: 'Streak', bestStreak: 'Best streak', perfectClears: 'Perfect clears', dailiesSolved: 'Dailies solved', shells: 'Shells', badges: 'Badges', jarsSealed: 'Jars sealed', date: 'Date (UTC)', goals: 'Goals done', dailyToday: 'Daily solved', event: 'Event', boostersUsed: 'Boosters used', coinsEarned: 'Coins earned', coins: 'Coins now', pours: 'Pours', version: 'Version', browser: 'Browser', screen: 'Screen' },
};
const input = (over: Partial<StatsInput> = {}): StatsInput => ({
  version: '0.17.0', level: 1234, streak: 5, bestStreak: 21, stats: { ...emptyStats(), perfectClears: 40, boostersUsed: 12, coinsEarned: 5600, pours: 30000, jarsSealed: 9000, dailiesSolved: 33 },
  shells: 18, badges: 7, goalsDone: 2, goalsTotal: 3, dailySolvedToday: true, event: null, coins: 410, browser: 'Safari 18 (iOS)', screen: { width: 390, height: 844, ratio: 3 }, today: '2026-12-12', ...over,
});

describe('statsSections', () => {
  it('has the four sections in order', () => {
    expect(statsSections(input(), labels).map((s) => s.heading)).toEqual(['Progress', 'Today', 'Boosters and coins', 'Device']);
  });
  it('adds the event row only while an event runs', () => {
    expect(statsSections(input(), labels)[1].rows.map((r) => r.key)).not.toContain('event');
    const today = statsSections(input({ event: { name: 'Winter Tide', cleared: 9, total: 24 } }), labels)[1].rows;
    expect(today.at(-1)).toEqual({ key: 'event', label: 'Winter Tide', value: '9/24' });
  });
});

describe('statsText', () => {
  it('is plain text with label: value lines and grouped thousands', () => {
    const text = statsText(input(), labels);
    expect(text.split('\n')[0]).toBe('Strata stats');
    expect(text).toContain('Level: 1,234');
    expect(text).toContain('Goals done: 2/3');
    expect(text).toContain('Daily solved: yes');
    expect(text).toContain('Screen: 390×844 @3x');
    expect(text).toContain('Version: 0.17.0');
  });
});

describe('browserName', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', 'Safari 18 (iOS)'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', 'Chrome 131 (Android)'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0', 'Firefox 133 (Windows)'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0', 'Edge 131 (macOS)'],
    ['something odd', 'Other'],
  ])('%s → %s', (ua, name) => {
    expect(browserName(ua)).toBe(name);
  });
});
