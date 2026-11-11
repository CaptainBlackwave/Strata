// Sprint 17 E1/E4 (D141-D147; design/gdd/events.md): a yearly event with advent-style boards.
import { describe, expect, it } from 'vitest';
import raw from '../../../src/config/game-config.json';
import type { GameConfig } from '../../../src/core/levels';
import { type EventsConfig, activeEvent, emptyEventProgress, eventById, generateEventBoard, openBoards, recordEventClear, repairEvents } from '../../../src/core/events';
import { boardKey } from '../../../src/core/board';

const cfg = raw as unknown as GameConfig & EventsConfig;
const winter = eventById('wintertide', cfg)!;

describe('activeEvent', () => {
  it('runs Winter Tide from 1 to 31 December, every year', () => {
    expect(activeEvent('2026-12-01', cfg)).toEqual({ event: winter, year: 2026, day: 1 });
    expect(activeEvent('2026-12-31', cfg)?.day).toBe(31);
    expect(activeEvent('2027-12-12', cfg)).toEqual({ event: winter, year: 2027, day: 12 });
  });
  it('is null outside the dates', () => {
    expect(activeEvent('2026-11-30', cfg)).toBeNull();
    expect(activeEvent('2027-01-01', cfg)).toBeNull();
  });
});

describe('openBoards', () => {
  it('opens board n on day n, up to 24, and keeps them open to the end', () => {
    expect(openBoards(winter, 1)).toBe(1);
    expect(openBoards(winter, 12)).toBe(12);
    expect(openBoards(winter, 24)).toBe(24);
    expect(openBoards(winter, 31)).toBe(24);
  });
});

describe('event boards', () => {
  it('are the same every run and differ between boards and years', () => {
    const a = generateEventBoard(winter, 2026, 1, cfg);
    expect(boardKey(generateEventBoard(winter, 2026, 1, cfg).board)).toBe(boardKey(a.board));
    expect(boardKey(generateEventBoard(winter, 2026, 2, cfg).board)).not.toBe(boardKey(a.board));
    expect(boardKey(generateEventBoard(winter, 2027, 1, cfg).board)).not.toBe(boardKey(a.board));
  });
  it('are gentle: at most the weekly set’s middle recipe (D144)', () => {
    for (let n = 1; n <= winter.boards; n++) {
      const g = generateEventBoard(winter, 2026, n, cfg);
      expect(g.spec.colors).toBeLessThanOrEqual(7);
      expect(g.spec.buriedDepth).toBeLessThanOrEqual(1);
    }
  });
});

describe('recordEventClear', () => {
  it('records a first clear and best pours, and pays coins on every 6th board cleared', () => {
    let s = emptyEventProgress();
    let coins = 0;
    for (let n = 1; n <= 6; n++) {
      const r = recordEventClear(s, winter, 2026, n, 30);
      s = r.state;
      coins += r.coins;
    }
    expect(s.cleared).toEqual([1, 2, 3, 4, 5, 6]);
    expect(coins).toBe(winter.coins);
  });
  it('a replay pays nothing and only lowers best pours', () => {
    const first = recordEventClear(emptyEventProgress(), winter, 2026, 3, 30).state;
    const again = recordEventClear(first, winter, 2026, 3, 25);
    expect(again.firstClear).toBe(false);
    expect(again.coins).toBe(0);
    expect(again.state.pours['3']).toBe(25);
  });
  it('completes on the last board and says so once', () => {
    let s = emptyEventProgress();
    let done = 0;
    for (let n = 1; n <= winter.boards; n++) {
      const r = recordEventClear(s, winter, 2026, n, 20);
      s = r.state;
      if (r.completedNow) done++;
    }
    expect(done).toBe(1);
    expect(recordEventClear(s, winter, 2026, 1, 10).completedNow).toBe(false);
  });
  it('a new year starts fresh', () => {
    const last = recordEventClear(emptyEventProgress(), winter, 2026, 1, 20).state;
    const r = recordEventClear(last, winter, 2027, 1, 20);
    expect(r.state).toMatchObject({ year: 2027, cleared: [1] });
    expect(r.firstClear).toBe(true);
  });
});

describe('repairEvents', () => {
  it('keeps known events with valid fields and drops the rest', () => {
    const r = repairEvents({ wintertide: { year: 2026, cleared: [1, 1, 99, 0, 3, 'x'], pours: { '1': 20, '3': -1, '7': 5 } }, nope: { year: 2026 } }, cfg);
    expect(r).toEqual({ wintertide: { year: 2026, cleared: [1, 3], pours: { '1': 20 } } });
    expect(repairEvents('bad', cfg)).toEqual({});
  });
});

describe('save (E4)', () => {
  it('a save from before 0.16 loads with no events, and a stored one is kept', async () => {
    const { freshSave, loadSave } = await import('../../../src/ui/storage');
    const econ = raw as unknown as Parameters<typeof freshSave>[0];
    const mk = (extra: Record<string, unknown>) => {
      const data: Record<string, string> = { 'strata.save.v2': JSON.stringify({ ...freshSave(econ), ...extra }) };
      return loadSave(econ, { getItem: (k) => data[k] ?? null, setItem: () => undefined });
    };
    const old = { ...freshSave(econ) } as Record<string, unknown>;
    delete old.events;
    const data: Record<string, string> = { 'strata.save.v2': JSON.stringify(old) };
    expect(loadSave(econ, { getItem: (k) => data[k] ?? null, setItem: () => undefined }).events).toEqual({});
    expect(mk({ events: { wintertide: { year: 2026, cleared: [2], pours: { '2': 30 } } } }).events).toEqual({ wintertide: { year: 2026, cleared: [2], pours: { '2': 30 } } });
  });
});
