// Design: design/gdd/weekly-set.md §3.9 (Share), §3.8 (card text). Sprint 11 W2, D77.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { WeeklyConfig } from '../../../src/core/weekly';
import { t } from '../../../src/ui/strings';

const cfg = config as unknown as WeeklyConfig;
const URL = 'https://example.test/strata/';

describe('weekly Share text (§3.9)', () => {
  it('mid-week: the cleared count, then each board in order with a dash for one not cleared', () => {
    expect(t.weekly.shareText('2026-W46', 'Lock and Key', [23, 31, null, 40, null], URL)).toBe(`Strata Weekly 2026-W46 (Lock and Key)\n3 of 5 boards: 23 · 31 · – · 40 · –\n${URL}`);
  });
  it('all five: the pours and their total', () => {
    expect(t.weekly.shareText('2026-W46', 'Lock and Key', [23, 31, 35, 40, 44], URL)).toBe(`Strata Weekly 2026-W46 (Lock and Key)\nAll 5 boards: 23 · 31 · 35 · 40 · 44 (173 pours)\n${URL}`);
  });
});

describe('weekly card text (§3.8)', () => {
  it('every theme in the config has a name', () => {
    for (const theme of cfg.weekly.themes) expect(t.weekly.themes[theme.id], theme.id).toBeTruthy();
  });
  it('every theme of a later era has a name; the new jar themes are named (sprint 13 W1)', () => {
    for (const era of cfg.weekly.themesFrom ?? []) for (const theme of era.themes) expect(t.weekly.themes[theme.id], theme.id).toBeTruthy();
    expect(t.weekly.themes.hourglass).toBe('Turning Tides');
    expect(t.weekly.themes.sieve).toBe('Fine Sieve');
    expect(t.weekly.themes.clam).toBe('Clam Bay');
  });
  it('progress, days left and the board lines', () => {
    expect(t.weekly.progress(2, 5)).toBe('2 of 5 cleared');
    expect(t.weekly.progress(5, 5)).toBe('Set complete ✓');
    expect(t.weekly.daysLeft(6)).toBe('6 days left');
    expect(t.weekly.daysLeft(1)).toBe('Last day');
    expect(t.weekly.boardCleared(1)).toBe('Cleared · best 1 pour');
    expect(t.weekly.winText(31, 3, 5)).toBe('31 pours · 3 of 5 cleared');
  });
});
