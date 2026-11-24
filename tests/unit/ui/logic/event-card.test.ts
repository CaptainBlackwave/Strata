// Story: production/sprints/sprint-17.md E3 (D142, D145, D146): Winter Tide's Home card and chooser, DOM-free.
// Sprint 31 C5 (D237, D240): Winter Tide runs 1-25 December with a bonus Christmas Day board 25 (the prize
// needs boards 1-24), and New Tide runs 26 December - 6 January with 12 boards.
import { describe, expect, it } from 'vitest';
import config from '../../../../src/config/game-config.json';
import { type EventsConfig } from '../../../../src/core/events';
import { eventView } from '../../../../src/ui/logic/event-card';

const cfg = config as unknown as EventsConfig;
const nine = { wintertide: { year: 2026, cleared: [1, 2, 3, 4, 5, 6, 7, 8, 9], pours: { '1': 31, '9': 12 } } };

describe('eventView: Winter Tide', () => {
  it('shows no card on Nov 30 or Jan 7', () => {
    expect(eventView({}, [], '2026-11-30', cfg)).toBeNull();
    expect(eventView({}, [], '2027-01-07', cfg)).toBeNull();
  });
  it('Dec 1: board 1 open, the rest locked with their dates, 24 days left, the prize of 24', () => {
    const v = eventView({}, [], '2026-12-01', cfg)!;
    expect(v.name).toBe('Winter Tide');
    expect(v.sub).toBe('Board 1 open · 0 of 24 cleared');
    expect(v.days).toBe('Ends in 24 days');
    expect(v.total).toBe(24);
    expect(v.boards).toHaveLength(25);
    expect(v.boards[0]).toMatchObject({ state: 'open', status: 'Open', label: 'Board 1, not cleared yet', festive: false });
    expect(v.boards[13]).toMatchObject({ state: 'locked', status: 'Dec 14', label: 'Board 14, opens Dec 14' });
    expect(v.focus).toBe(1);
    expect(v.prize).toBe('Clear all 24 for the Frost jar glass and the Winter Tide badge');
  });
  it('Dec 12 with boards 1-9 cleared: three open, cleared tiles show best pours, focus on board 10', () => {
    const v = eventView(nine, [], '2026-12-12', cfg)!;
    expect(v.sub).toBe('Board 12 open · 9 of 24 cleared');
    expect(v.days).toBe('Ends in 13 days');
    expect(v.boards.map((b) => b.state).join(',')).toBe([...Array(9).fill('cleared'), 'open', 'open', 'open', ...Array(13).fill('locked')].join(','));
    expect(v.boards[0]).toMatchObject({ status: '✓ 31', label: 'Board 1, cleared, best 31 pours' });
    expect(v.focus).toBe(10);
  });
  it('Dec 24: board 24 open, Christmas Day still locked', () => {
    const v = eventView(nine, [], '2026-12-24', cfg)!;
    expect(v.sub).toBe('Board 24 open · 9 of 24 cleared');
    expect(v.days).toBe('Ends tomorrow');
    expect(v.boards[24].state).toBe('locked');
  });
  it('Dec 25: every board open, last day', () => {
    const v = eventView(nine, [], '2026-12-25', cfg)!;
    expect(v.sub).toBe('All 25 boards open · 9 of 24 cleared');
    expect(v.days).toBe('Last day');
    expect(v.boards.some((b) => b.state === 'locked')).toBe(false);
  });
  it('a cleared bonus board never moves the count; all 24 read as all cleared', () => {
    expect(eventView({ wintertide: { year: 2026, cleared: [25], pours: { '25': 20 } } }, [], '2026-12-25', cfg)!.cleared).toBe(0);
    const all = Array.from({ length: 24 }, (_, i) => i + 1);
    const v = eventView({ wintertide: { year: 2026, cleared: all, pours: {} } }, [], '2026-12-25', cfg)!;
    expect(v.sub).toBe('All 25 boards open · All cleared ✓');
    expect(v.focus).toBe(25);
  });
  it('progress from last year does not count; with the badge owned the prize line says it is already yours', () => {
    const old = { wintertide: { ...nine.wintertide, year: 2025 } };
    const v = eventView(old, ['event-wintertide'], '2026-12-12', cfg)!;
    expect(v.cleared).toBe(0);
    expect(v.prizeCollected).toBe(true);
    // Sprint 31 C2 finding 5: not "Prize collected" at 0 of 24 in a later year.
    expect(v.prize).toBe('You already have the prize from an earlier year');
  });
});

describe('eventView: New Tide (D240)', () => {
  it('Dec 26: day 1 of 12, the Sparkle glass and New Tide badge prize, no bonus note', () => {
    const v = eventView({}, [], '2026-12-26', cfg)!;
    expect(v.name).toBe('New Tide');
    expect(v.year).toBe(2026);
    expect(v.sub).toBe('Board 1 open · 0 of 12 cleared');
    expect(v.days).toBe('Ends in 11 days');
    expect(v.boards).toHaveLength(12);
    expect(v.boards.some((b) => b.festive)).toBe(false);
    expect(v.note).toBe('');
    expect(v.prize).toBe('Clear all 12 for the Sparkle jar glass and the New Tide badge');
  });
  it('across the year end: Jan 3 is day 9 of the 2026 event, board 10 opens Jan 4', () => {
    const v = eventView({ newtide: { year: 2026, cleared: [1, 2], pours: {} } }, [], '2027-01-03', cfg)!;
    expect(v.year).toBe(2026);
    expect(v.sub).toBe('Board 9 open · 2 of 12 cleared');
    expect(v.boards[9]).toMatchObject({ state: 'locked', status: 'Jan 4', label: 'Board 10, opens Jan 4' });
  });
  it('Jan 6: all 12 open, last day', () => {
    const v = eventView({}, [], '2027-01-06', cfg)!;
    expect(v.sub).toBe('All 12 boards open · 0 of 12 cleared');
    expect(v.days).toBe('Last day');
  });
});
