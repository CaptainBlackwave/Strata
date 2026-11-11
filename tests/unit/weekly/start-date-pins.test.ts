// Design: design/gdd/daily-puzzle.md §3.3 and design/gdd/weekly-set.md §3.3 (sprint 13 W1, D98).
// The new jars join the daily and the weekly only from a start date, so no board before it may change.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import pins from '../../fixtures/daily-weekly-pins.json';
import type { Board } from '../../../src/core/board';
import { type DailyConfig, dailySpec, generateDaily } from '../../../src/core/daily';
import type { GameConfig } from '../../../src/core/levels';
import { type WeeklyConfig, generateWeekly } from '../../../src/core/weekly';

const cfg = config as unknown as GameConfig & DailyConfig & WeeklyConfig;
/** FNV-1a of the board's JSON, matching the other board fixtures. */
const hash = (b: Board) => {
  const s = JSON.stringify(b);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};

describe('start-date pins (sprint 13 W1, D98)', () => {
  it('covers every daily from 2026-11-11 to 2026-11-27 and the weekly boards of 2026-W46 to 2026-W48', () => {
    expect(Object.keys(pins.days)).toHaveLength(17);
    expect(Object.keys(pins.days)[0]).toBe('2026-11-11');
    expect(Object.keys(pins.days).at(-1)).toBe('2026-11-27');
    expect(Object.keys(pins.weeks)).toHaveLength(15);
  });

  it('every daily before 2026-11-28 is byte-identical to the code before the new jars joined', () => {
    for (const [key, d] of Object.entries(pins.days as Record<string, { mechanics: string[]; hash: string }>)) {
      const spec = dailySpec(key, cfg);
      expect([...spec.mechanics], key).toEqual(d.mechanics);
      expect(spec.hourglass || spec.sieve || spec.clam, key).toBeFalsy();
      expect(hash(generateDaily(key, cfg).board), key).toBe(d.hash);
    }
  });

  it('every weekly board of 2026-W46 to 2026-W48 is byte-identical to the code before the new jars joined', () => {
    for (const [id, h] of Object.entries(pins.weeks as Record<string, string>)) {
      const [week, n] = id.split('#');
      expect(hash(generateWeekly(week, Number(n) - 1, cfg).board), id).toBe(h);
    }
  });
});
