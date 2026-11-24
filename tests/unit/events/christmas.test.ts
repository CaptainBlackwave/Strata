// Sprint 31 C3 (D237, D240, D242; design/gdd/events.md §3.1-§3.10, §4, §8): Winter Tide to 25 December
// with a bonus board 25, New Tide across the year end, prizeBoards, coins and the start cards.
import { describe, expect, it } from 'vitest';
import raw from '../../../src/config/game-config.json';
import {
  type EventDef,
  type EventsConfig,
  activeEvent,
  emptyEventProgress,
  eventById,
  isFestiveBoard,
  openBoards,
  prizeBoards,
  prizeBoardsCleared,
  recordEventClear,
  repairStartCards,
  startCardDue,
} from '../../../src/core/events';
import { dayNumber } from '../../../src/core/daily';

const cfg = raw as unknown as EventsConfig;
const winter = eventById('wintertide', cfg)!;
const newtide = eventById('newtide', cfg)!;
const run = (date: string) => {
  const r = activeEvent(date, cfg);
  return r ? { id: r.event.id, year: r.year, day: r.day, open: openBoards(r.event, r.day) } : null;
};
/** Clears boards in `order` for 2026; returns coins per clear, the clear that completed and the state. */
const clearAll = (event: EventDef, order: readonly number[]) => {
  let s = emptyEventProgress();
  const coins: number[] = [];
  const completed: number[] = [];
  for (const n of order) {
    const r = recordEventClear(s, event, 2026, n, 20);
    s = r.state;
    coins.push(r.coins);
    if (r.completedNow) completed.push(n);
  }
  return { coins, total: coins.reduce((a, b) => a + b, 0), completed, state: s };
};
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('the windows (§3.1, §4)', () => {
  it('30 November: none', () => expect(run('2026-11-30')).toBeNull());
  it('1 December: Winter Tide day 1, board 1 open', () => expect(run('2026-12-01')).toEqual({ id: 'wintertide', year: 2026, day: 1, open: 1 }));
  it('12 and 24 December: Winter Tide, one board a day', () => {
    expect(run('2026-12-12')).toEqual({ id: 'wintertide', year: 2026, day: 12, open: 12 });
    expect(run('2026-12-24')).toEqual({ id: 'wintertide', year: 2026, day: 24, open: 24 });
  });
  it('25 December: Winter Tide, its last day, with board 25 open', () => expect(run('2026-12-25')).toEqual({ id: 'wintertide', year: 2026, day: 25, open: 25 }));
  it('26 December: New Tide 2026 day 1', () => expect(run('2026-12-26')).toEqual({ id: 'newtide', year: 2026, day: 1, open: 1 }));
  it('31 December: New Tide day 6', () => expect(run('2026-12-31')).toEqual({ id: 'newtide', year: 2026, day: 6, open: 6 }));
  it('1 January 2027: New Tide 2026, day 7', () => expect(run('2027-01-01')).toEqual({ id: 'newtide', year: 2026, day: 7, open: 7 }));
  it('6 January: New Tide 2026, its last day, all 12 open', () => expect(run('2027-01-06')).toEqual({ id: 'newtide', year: 2026, day: 12, open: 12 }));
  it('7 January: none', () => expect(run('2027-01-07')).toBeNull());
  it('the next season starts fresh: 26 December 2027 is New Tide 2027', () => expect(run('2027-12-26')).toMatchObject({ id: 'newtide', year: 2027, day: 1 }));
  it('no two configured events share a day in any year, across the year end', () => {
    for (let y = 2026; y <= 2029; y++) {
      for (let d = dayNumber(`${y}-01-01`); d < dayNumber(`${y + 1}-01-01`); d++) {
        const date = new Date(d * 86_400_000).toISOString().slice(0, 10);
        const running = cfg.events.filter((e) => activeEvent(date, { events: [e] }) !== null);
        expect(running.length, date).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('prizeBoards and the festive board (§3.4, §3.7)', () => {
  it('Winter Tide needs 24 of its 25 boards; New Tide all 12', () => {
    expect(winter.boards).toBe(25);
    expect(prizeBoards(winter)).toBe(24);
    expect(prizeBoards(newtide)).toBe(12);
  });
  it('missing, non-integer, below 1 or above boards means boards', () => {
    for (const p of [undefined, 0, -1, 2.5, 26, Number.NaN]) expect(prizeBoards({ ...winter, prizeBoards: p }), String(p)).toBe(25);
  });
  it('every configured prizeBoards is a whole number from 1 to boards', () => {
    for (const e of cfg.events) if (e.prizeBoards !== undefined) expect(Number.isInteger(e.prizeBoards) && e.prizeBoards >= 1 && e.prizeBoards <= e.boards, e.id).toBe(true);
  });
  it('board 25 is Winter Tide’s festive board; New Tide has none', () => {
    expect(isFestiveBoard(winter, 25)).toBe(true);
    expect(isFestiveBoard(winter, 24)).toBe(false);
    expect(range(1, 12).some((n) => isFestiveBoard(newtide, n))).toBe(false);
  });
  it('the count is of prize boards only', () => {
    expect(prizeBoardsCleared([1, 2, 25], winter)).toBe(2);
    expect(prizeBoardsCleared(range(1, 25), winter)).toBe(24);
  });
});

describe('Winter Tide coins and prize (D237)', () => {
  it('in order: 50 on boards 6, 12, 18 and 24, 200 a year, board 25 pays nothing', () => {
    const r = clearAll(winter, range(1, 25));
    expect(r.total).toBe(200);
    expect(range(1, 25).filter((n) => r.coins[n - 1] > 0)).toEqual([6, 12, 18, 24]);
  });
  it('the prize completes on board 24, once; board 25 after it grants nothing', () => {
    const r = clearAll(winter, range(1, 25));
    expect(r.completed).toEqual([24]);
  });
  it('board 25 first: it pays nothing and never completes; the year still pays 200', () => {
    const r = clearAll(winter, [25, ...range(1, 24)]);
    expect(r.coins[0]).toBe(0);
    expect(r.total).toBe(200);
    expect(r.completed).toEqual([24]);
  });
  it('boards 1-23 and 25 cleared: no prize yet; the clear of 24 completes it', () => {
    const r = clearAll(winter, [...range(1, 23), 25]);
    expect(r.completed).toEqual([]);
    const last = recordEventClear(r.state, winter, 2026, 24, 20);
    expect(last.completedNow).toBe(true);
    expect(last.coins).toBe(50);
  });
  it('a replay pays nothing and never completes again', () => {
    const r = clearAll(winter, range(1, 24));
    const again = recordEventClear(r.state, winter, 2026, 24, 10);
    expect(again).toMatchObject({ firstClear: false, coins: 0, completedNow: false });
  });
  it('an event without prizeBoards needs all its boards (sprint 17 behaviour)', () => {
    const plain = { ...winter, prizeBoards: undefined, boards: 24 };
    const r = clearAll(plain, range(1, 24));
    expect(r.completed).toEqual([24]);
    expect(r.total).toBe(200);
  });
});

describe('New Tide coins and prize (D240)', () => {
  it('50 on boards 4, 8 and 12 (150 a year); the 12th completes, with the Sparkle glass and badge', () => {
    const r = clearAll(newtide, range(1, 12));
    expect(range(1, 12).filter((n) => r.coins[n - 1] > 0)).toEqual([4, 8, 12]);
    expect(r.total).toBe(150);
    expect(r.completed).toEqual([12]);
    expect(newtide.prize).toEqual({ style: 'glass:sparkle', badge: 'event-newtide' });
  });
  it('a board won on 2 January 2027 records for New Tide 2026', () => {
    const y = activeEvent('2027-01-02', cfg)!.year;
    expect(recordEventClear(emptyEventProgress(), newtide, y, 8, 20).state.year).toBe(2026);
  });
  it('has its own salt, distinct from every other salt in the config', () => {
    const c = raw as unknown as { weekly: { seedSalt: number }; events: { seedSalt: number }[] };
    expect(newtide.seedSalt).not.toBe(winter.seedSalt);
    expect(newtide.seedSalt).not.toBe(c.weekly.seedSalt);
  });
});

describe('start cards (D242, §3.10)', () => {
  it('Winter Tide’s from 1 December, once per event year', () => {
    expect(startCardDue('2026-11-30', cfg, {})).toBeNull();
    expect(startCardDue('2026-12-01', cfg, {})).toEqual({ event: winter, year: 2026 });
    expect(startCardDue('2026-12-12', cfg, {})).toEqual({ event: winter, year: 2026 });
    expect(startCardDue('2026-12-02', cfg, { wintertide: 2026 })).toBeNull();
    expect(startCardDue('2027-12-01', cfg, { wintertide: 2026 })).toEqual({ event: winter, year: 2027 });
  });
  it('New Tide’s from 26 December, and its year carries into January', () => {
    expect(startCardDue('2026-12-26', cfg, { wintertide: 2026 })).toEqual({ event: newtide, year: 2026 });
    expect(startCardDue('2027-01-03', cfg, { wintertide: 2026 })).toEqual({ event: newtide, year: 2026 });
    expect(startCardDue('2027-01-03', cfg, { wintertide: 2026, newtide: 2026 })).toBeNull();
  });
  it('none after the event, none without announce, and a bad seen value counts as never', () => {
    expect(startCardDue('2027-01-07', cfg, {})).toBeNull();
    expect(startCardDue('2026-12-01', { events: [{ ...winter, announce: undefined }] }, {})).toBeNull();
    expect(startCardDue('2026-12-01', cfg, { wintertide: Number.NaN })).toEqual({ event: winter, year: 2026 });
  });
  it('repairStartCards keeps known events with whole years from 2000', () => {
    expect(repairStartCards({ wintertide: 2026, newtide: 1999, nope: 2026 }, cfg)).toEqual({ wintertide: 2026 });
    expect(repairStartCards({ newtide: '2026' }, cfg)).toEqual({});
    expect(repairStartCards([1], cfg)).toEqual({});
  });
});
