// TD-16 (docs/tech-debt.md): the UI's date-dependent helpers read an injected clock.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { ThemeConfig } from '../../../src/core/themes';
import { dailyKey, sceneDay, seasonBadge, systemClock } from '../../../src/ui/clock';

const cfg = config as unknown as ThemeConfig;
const fixed = (d: Date) => () => d;
const winter = cfg.themes.list.find((th) => th.id === 'wintersnow')!;

describe('dailyKey (the daily follows UTC, M4)', () => {
  it('rolls over at midnight UTC, whatever the device time zone', () => {
    expect(dailyKey(fixed(new Date(Date.UTC(2026, 10, 8, 23, 59, 59))))).toBe('2026-11-08');
    expect(dailyKey(fixed(new Date(Date.UTC(2026, 10, 9, 0, 0, 0))))).toBe('2026-11-09');
  });
});

describe('sceneDay and seasonBadge (scenes follow the local date, B5)', () => {
  it('uses the local calendar date of the clock', () => {
    expect(sceneDay(fixed(new Date(2026, 11, 1, 0, 30)))).toEqual({ dateKey: '2026-12-01', hour: 0 });
    expect(sceneDay(fixed(new Date(2026, 10, 30, 23, 30)))).toEqual({ dateKey: '2026-11-30', hour: 23 });
  });
  it('shows the in-season badge from the first day of a scene window, not the day before', () => {
    expect(seasonBadge(winter, fixed(new Date(2026, 10, 30, 23, 59)))).toBe(false);
    expect(seasonBadge(winter, fixed(new Date(2026, 11, 1, 0, 0)))).toBe(true);
  });
  it('the southern setting moves the window by half a year', () => {
    expect(seasonBadge(winter, fixed(new Date(2026, 6, 1, 12)), { southern: true })).toBe(true);
    expect(seasonBadge(winter, fixed(new Date(2026, 6, 1, 12)))).toBe(false);
  });
});

describe('systemClock', () => {
  it('is the real clock', () => {
    const before = Date.now();
    const now = systemClock().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
