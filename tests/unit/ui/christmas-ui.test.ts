// Story: production/sprints/sprint-31.md C5 (D237-D242): the Christmas view logic, DOM-free — the Home card
// order, the chooser's Christmas Day tile, the board and win labels, the locked style labels and the
// December scene order.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type EventsConfig, eventById } from '../../../src/core/events';
import { type StylesConfig, defaultStyles } from '../../../src/core/styles';
import { eventBoardHeader, eventBoardLabel, eventView, eventWinCount, homeNotice, sceneOrder } from '../../../src/ui/logic/event-card';
import { lockText, styleAction } from '../../../src/ui/logic/styles-sheet';
import { t } from '../../../src/ui/strings';

const cfg = config as unknown as EventsConfig;
const styles = config as unknown as StylesConfig;
const winter = eventById('wintertide', cfg)!;
const newtide = eventById('newtide', cfg)!;

describe('homeNotice: one card at a time (events.md §3.9-§3.10)', () => {
  const start = { id: 'wintertide', year: 2026 };
  it('shows nothing before the tutorial', () => {
    expect(homeNotice(false, 'christmas', start)).toEqual({ show: null, markSeen: null });
  });
  it('the gift first; a start card due the same day is marked seen without showing', () => {
    expect(homeNotice(true, 'christmas', start)).toEqual({ show: { kind: 'gift', id: 'christmas' }, markSeen: start });
    expect(homeNotice(true, 'christmas', null)).toEqual({ show: { kind: 'gift', id: 'christmas' }, markSeen: null });
  });
  it('else the start card, else nothing', () => {
    expect(homeNotice(true, null, start)).toEqual({ show: { kind: 'start', id: 'wintertide', year: 2026 }, markSeen: null });
    expect(homeNotice(true, null, null)).toEqual({ show: null, markSeen: null });
  });
});

describe("the chooser's Christmas Day tile (D237)", () => {
  it('is locked until Dec 25 and labelled Christmas Day, with the bonus note', () => {
    const v = eventView({}, [], '2026-12-24', cfg)!;
    expect(v.boards[24]).toMatchObject({ n: 25, state: 'locked', status: 'Christmas Day', festive: true, label: 'Board 25, opens Dec 25, Christmas Day bonus, not needed for the prize' });
    expect(v.boards.filter((b) => b.festive)).toHaveLength(1);
    expect(v.note).toBe('A Christmas Day bonus board, not needed for the prize');
  });
  it('opens on Dec 25 and shows its best pours once cleared', () => {
    expect(eventView({}, [], '2026-12-25', cfg)!.boards[24]).toMatchObject({ state: 'open', status: 'Christmas Day' });
    expect(eventView({ wintertide: { year: 2026, cleared: [25], pours: { '25': 18 } } }, [], '2026-12-25', cfg)!.boards[24]).toMatchObject({ state: 'cleared', status: '✓ 18' });
  });
});

describe('board and win labels', () => {
  it('board 25 reads "Winter Tide · Christmas Day"; others and New Tide read "· Board n"', () => {
    expect(eventBoardLabel(winter, 'wintertide', 25)).toBe('Winter Tide · Christmas Day');
    expect(eventBoardLabel(winter, 'wintertide', 6)).toBe('Winter Tide · Board 6');
    expect(eventBoardLabel(newtide, 'newtide', 12)).toBe('New Tide · Board 12');
    // The board screen splits it like the weekly: the board in the label, the event in the tag (sprint 31 C2).
    expect(eventBoardHeader(winter, 'wintertide', 6)).toEqual({ label: 'Board 6', tag: 'Winter Tide' });
    expect(eventBoardHeader(winter, 'wintertide', 25)).toEqual({ label: 'Christmas Day', tag: 'Winter Tide' });
    expect(eventBoardHeader(newtide, 'newtide', 3)).toEqual({ label: 'Board 3', tag: 'New Tide' });
  });
  it('the win count is of prize boards, so a bonus board never reads "25 of 24"', () => {
    const all = Array.from({ length: 25 }, (_, i) => i + 1);
    expect(eventWinCount({ wintertide: { year: 2026, cleared: all, pours: {} } }, winter, 2026)).toEqual({ cleared: 24, total: 24 });
    expect(eventWinCount({ wintertide: { year: 2025, cleared: all, pours: {} } }, winter, 2026)).toEqual({ cleared: 0, total: 24 });
    expect(eventWinCount({ newtide: { year: 2026, cleared: [1, 2, 3, 4], pours: {} } }, newtide, 2026)).toEqual({ cleared: 4, total: 12 });
  });
});

describe('locked style labels (D239, D240)', () => {
  it('the Holly cap reads as the Christmas Day gift and the Sparkle glass as the New Tide prize, New Year', () => {
    expect(lockText('cork', 'holly', styles, cfg.events)).toBe('Christmas Day gift · 25 December');
    expect(lockText('glass', 'sparkle', styles, cfg.events)).toBe('New Tide prize · New Year');
    expect(lockText('glass', 'frost', styles, cfg.events)).toBe('Winter Tide prize · December');
  });
  it('neither is buyable, however many coins', () => {
    const level = styles.styles.unlockLevel;
    expect(styleAction(defaultStyles(styles), 99_999, level, 'cork', 'holly', styles)).toBe('earned');
    expect(styleAction(defaultStyles(styles), 99_999, level, 'glass', 'sparkle', styles)).toBe('earned');
  });
  it('once owned, the Holly cap can be worn', () => {
    const s = { owned: ['cork:holly'], worn: { ...defaultStyles(styles).worn } };
    expect(styleAction(s, 0, 1, 'cork', 'holly', styles)).toBe('wear');
  });
});

describe('the December scene order (D241)', () => {
  const list = [
    { id: 'a', price: 300 },
    { id: 'wintersnow', price: 900 },
    { id: 'streak', price: 0, earned: 30 },
    { id: 'b', price: 0 },
    { id: 'winterlights', price: 1200 },
  ];
  it('lists the festive scenes first, in the config order, then the usual order', () => {
    expect(sceneOrder(list, ['wintersnow', 'winterlights']).map((s) => s.id)).toEqual(['wintersnow', 'winterlights', 'b', 'a', 'streak']);
  });
  it('keeps the usual order outside December (no festive scenes)', () => {
    expect(sceneOrder(list, []).map((s) => s.id)).toEqual(['b', 'a', 'wintersnow', 'winterlights', 'streak']);
  });
  it('the configured festive scenes exist in the scene list', () => {
    const ids = (config as unknown as { themes: { list: { id: string }[] } }).themes.list.map((th) => th.id);
    for (const id of (config as unknown as { festive: { scenesFirst: string[] } }).festive.scenesFirst) expect(ids).toContain(id);
  });
});

// Sprint 31 C2 rehearsal finding 5: a later year read "Prize collected" at 0 of 24.
describe('the prize line in a later year', () => {
  it('says the prize is already yours until this year\'s set is done, then "Prize collected"', () => {
    const v0 = eventView({ wintertide: { year: 2027, cleared: [], pours: {} } }, ['event-wintertide'], '2027-12-01', cfg)!;
    expect(v0.prize).toBe(t.event.prizeKept);
    const all = Array.from({ length: 24 }, (_, i) => i + 1);
    const v24 = eventView({ wintertide: { year: 2027, cleared: all, pours: {} } }, ['event-wintertide'], '2027-12-24', cfg)!;
    expect(v24.prize).toBe(t.event.prizeCollected);
  });
});
