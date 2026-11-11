// Story: production/sprints/sprint-17.md E3 (D142, D145, D146): Winter Tide's Home card and chooser, DOM-free.
import { describe, expect, it } from 'vitest';
import config from '../../../../src/config/game-config.json';
import { type EventsConfig } from '../../../../src/core/events';
import { eventView } from '../../../../src/ui/logic/event-card';

const cfg = config as unknown as EventsConfig;
const nine = { wintertide: { year: 2026, cleared: [1, 2, 3, 4, 5, 6, 7, 8, 9], pours: { '1': 31, '9': 12 } } };

describe('eventView', () => {
  it('shows no card on Nov 30 or Jan 1', () => {
    expect(eventView({}, [], '2026-11-30', cfg)).toBeNull();
    expect(eventView({}, [], '2027-01-01', cfg)).toBeNull();
  });
  it('Dec 1: board 1 open, the rest locked with their dates, 30 days left', () => {
    const v = eventView({}, [], '2026-12-01', cfg)!;
    expect(v.name).toBe('Winter Tide');
    expect(v.sub).toBe('Board 1 open · 0 of 24 cleared');
    expect(v.days).toBe('Ends in 30 days');
    expect(v.boards[0]).toMatchObject({ state: 'open', status: 'Open', label: 'Board 1, not cleared yet' });
    expect(v.boards[13]).toMatchObject({ state: 'locked', status: 'Dec 14', label: 'Board 14, opens Dec 14' });
    expect(v.focus).toBe(1);
    expect(v.prize).toBe('Clear all 24 for the Frost jar glass and the Winter Tide badge');
  });
  it('Dec 12 with boards 1-9 cleared: three open, cleared tiles show best pours, focus on board 10', () => {
    const v = eventView(nine, [], '2026-12-12', cfg)!;
    expect(v.sub).toBe('Board 12 open · 9 of 24 cleared');
    expect(v.days).toBe('Ends in 19 days');
    expect(v.boards.map((b) => b.state).join(',')).toBe([...Array(9).fill('cleared'), 'open', 'open', 'open', ...Array(12).fill('locked')].join(','));
    expect(v.boards[0]).toMatchObject({ status: '✓ 31', label: 'Board 1, cleared, best 31 pours' });
    expect(v.focus).toBe(10);
  });
  it('Dec 31: every board open, last day', () => {
    const v = eventView(nine, [], '2026-12-31', cfg)!;
    expect(v.sub).toBe('All 24 boards open · 9 of 24 cleared');
    expect(v.days).toBe('Last day');
    expect(v.boards.some((b) => b.state === 'locked')).toBe(false);
  });
  it('progress from last year does not count; the prize reads collected once its badge is owned', () => {
    const old = { wintertide: { ...nine.wintertide, year: 2025 } };
    const v = eventView(old, ['event-wintertide'], '2026-12-12', cfg)!;
    expect(v.cleared).toBe(0);
    expect(v.prizeCollected).toBe(true);
    expect(v.prize).toBe('Prize collected');
  });
});
