// Story: production/epics/sprint-2/story-001-daily-puzzle.md
import { describe, expect, it, vi } from 'vitest';
import config from '../../../src/config/game-config.json';
import { isSealed, isWon, pour } from '../../../src/core/board';
import {
  type DailyConfig,
  type StreakState,
  dailySpec,
  dayNumber,
  generateDaily,
  utcDateKey,
  localDateKey,
  recordDailySolve,
  streakReward,
  streakStatus,
} from '../../../src/core/daily';
import type { GameConfig } from '../../../src/core/levels';
import { solve } from '../../../src/core/solver';

const cfg = config as unknown as GameConfig & DailyConfig;
const fresh: StreakState = { last: null, streak: 0, best: 0, passes: 0 };

describe('dates', () => {
  it('formats the local calendar date as YYYY-MM-DD', () => {
    expect(localDateKey(new Date(2026, 10, 8, 23, 59))).toBe('2026-11-08');
    expect(localDateKey(new Date(2026, 0, 3, 0, 1))).toBe('2026-01-03');
  });
  it('day numbers are consecutive across month and year ends', () => {
    expect(dayNumber('2026-12-01') - dayNumber('2026-11-30')).toBe(1);
    expect(dayNumber('2027-01-01') - dayNumber('2026-12-31')).toBe(1);
  });
});

describe('weekly rhythm', () => {
  // 2026-11-02 is a Monday.
  const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
  it('Monday is easiest and Sunday is the tall-jar finale', () => {
    const specs = week.map((d) => dailySpec(d, cfg));
    expect(specs[0].name).toBe('easy');
    expect(specs[6].capacity).toBe(8);
    expect(specs[6].challenge).toBe(true);
  });
  it('colours never decrease from Monday to Saturday', () => {
    const colors = week.slice(0, 6).map((d) => dailySpec(d, cfg).colors);
    for (let i = 1; i < colors.length; i++) expect(colors[i]).toBeGreaterThanOrEqual(colors[i - 1]);
  });
});

describe('generateDaily', () => {
  it('the same date gives everyone the same board', () => {
    expect(generateDaily('2026-11-08', cfg).board).toEqual(generateDaily('2026-11-08', cfg).board);
  });
  it('different dates give different boards', () => {
    expect(generateDaily('2026-11-09', cfg).board).not.toEqual(generateDaily('2026-11-16', cfg).board);
  });
  it('every day for 8 weeks is solvable and starts with nothing sealed', () => {
    const start = dayNumber('2026-11-02');
    for (let i = 0; i < 56; i++) {
      const d = new Date(Date.UTC(1970, 0, 1 + start + i)).toISOString().slice(0, 10);
      const g = generateDaily(d, cfg);
      expect(g.board.jars.some((j) => isSealed(j, g.board.capacity)), d).toBe(false);
      const r = solve(g.board, cfg.generator.solverNodeBudget);
      expect(r.solvable, d).toBe(true);
      let b = g.board;
      for (const m of r.path) b = pour(b, m.from, m.to).board;
      expect(isWon(b), d).toBe(true);
    }
  });
});

describe('streak', () => {
  const s = cfg.daily.streak;
  it('the first solve starts a streak of 1 and pays the base reward', () => {
    const r = recordDailySolve(fresh, '2026-11-08', cfg);
    expect(r.state).toMatchObject({ last: '2026-11-08', streak: 1, best: 1 });
    expect(r.reward).toBe(s.baseCoins);
  });
  it('consecutive days grow the streak and the reward, up to the cap', () => {
    let st = fresh;
    const rewards: number[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10);
      const r = recordDailySolve(st, d, cfg);
      st = r.state;
      rewards.push(r.reward);
    }
    expect(st.streak).toBe(12);
    expect(rewards[1]).toBe(s.baseCoins + s.coinsPerDay);
    expect(Math.max(...rewards)).toBe(s.maxCoins);
  });
  it('solving twice on the same day pays nothing the second time', () => {
    const a = recordDailySolve(fresh, '2026-11-08', cfg);
    const b = recordDailySolve(a.state, '2026-11-08', cfg);
    expect(b.alreadySolved).toBe(true);
    expect(b.reward).toBe(0);
    expect(b.state).toEqual(a.state);
  });
  it(`earns a tide pass every ${s.passEvery} days, capped`, () => {
    let st = fresh;
    for (let i = 0; i < s.passEvery * (s.maxPasses + 2); i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      st = recordDailySolve(st, d, cfg).state;
      if (i + 1 === s.passEvery) expect(st.passes).toBe(1);
    }
    expect(st.passes).toBe(s.maxPasses);
  });
  it('one missed day is saved by a tide pass', () => {
    const st: StreakState = { last: '2026-11-06', streak: 9, best: 9, passes: 1 };
    const r = recordDailySolve(st, '2026-11-08', cfg);
    expect(r.usedPass).toBe(true);
    expect(r.state).toMatchObject({ streak: 10, passes: 0 });
  });
  it('a missed day without a pass, or two missed days, resets to 1', () => {
    expect(recordDailySolve({ last: '2026-11-06', streak: 9, best: 9, passes: 0 }, '2026-11-08', cfg).state.streak).toBe(1);
    const r = recordDailySolve({ last: '2026-11-05', streak: 9, best: 9, passes: 2 }, '2026-11-08', cfg);
    expect(r.state.streak).toBe(1);
    expect(r.state.best).toBe(9);
    expect(r.state.passes).toBe(2);
  });
  it('streakStatus shows what the player would see today', () => {
    expect(streakStatus({ last: '2026-11-07', streak: 4, best: 4, passes: 0 }, '2026-11-08')).toEqual({ current: 4, solvedToday: false, passAtRisk: false });
    expect(streakStatus({ last: '2026-11-08', streak: 5, best: 5, passes: 0 }, '2026-11-08')).toEqual({ current: 5, solvedToday: true, passAtRisk: false });
    expect(streakStatus({ last: '2026-11-06', streak: 4, best: 4, passes: 1 }, '2026-11-08')).toEqual({ current: 4, solvedToday: false, passAtRisk: true });
    expect(streakStatus({ last: '2026-11-06', streak: 4, best: 4, passes: 0 }, '2026-11-08').current).toBe(0);
  });
  it('streakReward is base + per-day growth, capped', () => {
    expect(streakReward(1, cfg)).toBe(s.baseCoins);
    expect(streakReward(1000, cfg)).toBe(s.maxCoins);
  });
});

describe('utcDateKey (M4: the daily follows UTC)', () => {
  // design/gdd/daily-puzzle.md: one board for everyone at the same moment.
  it('formats the UTC calendar date, switching at UTC midnight', () => {
    expect(utcDateKey(new Date(Date.UTC(2026, 10, 8, 23, 59)))).toBe('2026-11-08');
    expect(utcDateKey(new Date(Date.UTC(2026, 10, 9, 0, 1)))).toBe('2026-11-09');
    expect(utcDateKey(new Date(Date.UTC(2026, 11, 31, 23, 59)))).toBe('2026-12-31');
  });
  it('gives the same key in any time zone at the same instant', () => {
    const instant = new Date(Date.UTC(2026, 10, 8, 12, 0)).getTime();
    try {
      const keys = ['Pacific/Kiritimati', 'America/Los_Angeles', 'Asia/Tokyo', 'UTC'].map((tz) => {
        vi.stubEnv('TZ', tz);
        return utcDateKey(new Date(instant));
      });
      expect(new Set(keys)).toEqual(new Set(['2026-11-08']));
      vi.stubEnv('TZ', 'Pacific/Kiritimati'); // UTC+14: the local date is already the 9th
      expect(localDateKey(new Date(instant))).toBe('2026-11-09');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
