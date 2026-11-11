// Issue: strata-gbw.6 (design/gdd/weekly-set.md §3.8, §3.9). A chooser opened on Sunday 23:59
// shows week 46; if Share is tapped after midnight it must still share week 46's pours.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { WeeklyConfig, WeeklyState } from '../../../src/core/weekly';
import { weeklyToShare } from '../../../src/ui/logic/weekly-share';

const cfg = config as unknown as WeeklyConfig;
const w46: WeeklyState = { week: '2026-W46', cleared: [0], pours: { '0': 31 } };
const w47Reset: WeeklyState = { week: '2026-W47', cleared: [], pours: {} };

describe('weeklyToShare (strata-gbw.6)', () => {
  it('the open chooser shares the week it shows, even after the save moved on', () => {
    const s = weeklyToShare({ saved: w47Reset, shown: w46, playing: null, now: '2026-W47' }, cfg);
    expect(s.week).toBe('2026-W46');
    expect(s.pours[0]).toBe(31);
  });

  it('a weekly board in play shares its own week', () => {
    const s = weeklyToShare({ saved: w46, shown: null, playing: '2026-W46', now: '2026-W47' }, cfg);
    expect(s.week).toBe('2026-W46');
    expect(s.pours).toEqual([31, null, null, null, null]);
  });

  it('with nothing open it shares this week from the save', () => {
    const s = weeklyToShare({ saved: w46, shown: null, playing: null, now: '2026-W46' }, cfg);
    expect(s).toEqual({ week: '2026-W46', pours: [31, null, null, null, null] });
  });
});
