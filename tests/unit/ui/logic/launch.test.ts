// Story: production/sprints/sprint-11.md O3 (D78): the share link and the launch address, DOM-free.
import { describe, expect, it } from 'vitest';
import { dailyLaunch, isDateKey, isWeekKey, parseLaunch, shareLink } from '../../../../src/ui/logic/launch';

describe('shareLink (O3)', () => {
  it('is the page origin and path with only the daily key, built from the page address', () => {
    expect(shareLink('https://owner.github.io/Strata/', { daily: '2026-11-09' })).toBe('https://owner.github.io/Strata/?daily=2026-11-09');
    expect(shareLink('http://localhost:5520/index.html', { daily: '2026-11-09' })).toBe('http://localhost:5520/index.html?daily=2026-11-09');
  });
  it('drops whatever the page address carried, so no save data or old key travels', () => {
    const link = new URL(shareLink('https://x.test/game/?level=40&daily=2026-01-01&code=STRATA1:abc#win', { daily: '2026-11-09' }));
    expect([...link.searchParams.keys()]).toEqual(['daily']);
    expect(link.hash).toBe('');
  });
  it('builds a weekly link the same way', () => {
    expect(shareLink('https://x.test/game/', { weekly: '2026-W46' })).toBe('https://x.test/game/?weekly=2026-W46');
  });
});

describe('isDateKey and isWeekKey (O3)', () => {
  it('accepts only real calendar dates', () => {
    expect(isDateKey('2026-11-09')).toBe(true);
    expect(isDateKey('2028-02-29')).toBe(true);
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('2026-1-9')).toBe(false);
  });
  it('accepts ISO weeks, with week 53 only in a year that has one', () => {
    expect(isWeekKey('2026-W46')).toBe(true);
    expect(isWeekKey('2026-W53')).toBe(true); // 2026 starts on a Thursday
    expect(isWeekKey('2027-W53')).toBe(false);
    expect(isWeekKey('2026-W00')).toBe(false);
    expect(isWeekKey('2026-W7')).toBe(false);
    expect(isWeekKey('2026-w46')).toBe(false);
  });
});

describe('parseLaunch (O3)', () => {
  it('reads a daily, a weekly and a level', () => {
    expect(parseLaunch('?daily=2026-11-09')).toEqual({ kind: 'daily', date: '2026-11-09' });
    expect(parseLaunch('?weekly=2026-W46')).toEqual({ kind: 'weekly', week: '2026-W46' });
    expect(parseLaunch('?level=12')).toEqual({ kind: 'level', level: 12 });
  });
  it('keeps ?level=N first, so the QA route works as before', () => {
    expect(parseLaunch('?daily=2026-11-09&level=3')).toEqual({ kind: 'level', level: 3 });
  });
  it('ignores anything malformed', () => {
    for (const q of ['', '?', '?level=0', '?level=2.5', '?level=abc', '?daily=yesterday', '?daily=2026-02-30', '?weekly=2026-46', '?other=1']) expect(parseLaunch(q)).toEqual({ kind: 'none' });
  });
  it('falls through a malformed daily to a valid weekly', () => {
    expect(parseLaunch('?daily=bad&weekly=2026-W46')).toEqual({ kind: 'weekly', week: '2026-W46' });
  });
});

describe('dailyLaunch (O3)', () => {
  it('opens today when the link is today', () => {
    expect(dailyLaunch('2026-11-09', '2026-11-09')).toEqual({ date: '2026-11-09', over: false });
  });
  it('marks a past day as over and offers today instead', () => {
    expect(dailyLaunch('2026-11-02', '2026-11-09')).toEqual({ date: '2026-11-09', over: true });
  });
  it('opens today for a day that has not come yet (a link from a clock that runs ahead)', () => {
    expect(dailyLaunch('2026-11-10', '2026-11-09')).toEqual({ date: '2026-11-09', over: false });
  });
});
