// Sprint 17 E2 (D146): a win on an event board records it, pays coins every 6th board and the
// prize (Frost glass, Winter Tide badge) on the last. Rules: design/gdd/events.md.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { newWallet } from '../../../src/core/economy';
import { emptyStats } from '../../../src/core/profile';
import { type WinConfig, type WinResult, type WinState, applyWin } from '../../../src/core/win';

const cfg = config as unknown as WinConfig;
const state = (over: Partial<WinState> = {}): WinState => ({ level: 10, best: {}, perfect: [], wallet: newWallet(cfg), tutorialDone: true, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], stats: emptyStats(), dailyShare: null, badges: [], scenesPlayed: [], seenMechanics: [], themes: { owned: ['midday'] }, styles: { owned: [], worn: { glass: 'clear', cork: 'cork', sand: 'plain' } }, events: {}, ...over });
const win = (board: number, moves = 20): WinResult => ({ mode: 'event', level: 0, challenge: false, dailyDate: '', today: '2026-12-24', moves, assists: 0, sealed: 5, scene: 'midday', event: { id: 'wintertide', year: 2026, board } });

describe('event win', () => {
  it('records the board and its pours, pays nothing on an ordinary board', () => {
    const s = state();
    const { state: n, card } = applyWin(s, win(1), cfg);
    expect(n.events?.wintertide).toEqual({ year: 2026, cleared: [1], pours: { '1': 20 } });
    expect(card.event).toMatchObject({ board: 1, cleared: 1, total: 24, firstClear: true, coins: 0, completedNow: false });
    expect(n.wallet.coins - s.wallet.coins).toBe(card.goals.paid.reduce((a, p) => a + p.coins, 0) + card.goals.bonus);
  });

  it('pays 50 coins on the 6th board cleared', () => {
    const s = state({ events: { wintertide: { year: 2026, cleared: [1, 2, 3, 4, 5], pours: {} } } });
    const { card } = applyWin(s, win(6), cfg);
    expect(card.event?.coins).toBe(50);
    expect(card.rewardShown).toBe(true);
    expect(card.reward).toBe(50);
  });

  it('the 24th board gives the Frost glass and the Winter Tide badge, once', () => {
    const cleared = Array.from({ length: 23 }, (_, i) => i + 1);
    const { state: n, card } = applyWin(state({ events: { wintertide: { year: 2026, cleared, pours: {} } } }), win(24), cfg);
    expect(card.event?.completedNow).toBe(true);
    expect(n.styles?.owned).toContain('glass:frost');
    expect(n.badges).toContain('event-wintertide');
    expect(card.badges).toContain('event-wintertide');
    // A second year's completion keeps one copy of each.
    const again = applyWin({ ...n, events: { wintertide: { year: 2027, cleared, pours: {} } } }, { ...win(24), event: { id: 'wintertide', year: 2027, board: 24 } }, cfg).state;
    expect(again.styles?.owned.filter((x) => x === 'glass:frost')).toHaveLength(1);
    expect(again.badges.filter((x) => x === 'event-wintertide')).toHaveLength(1);
  });

  // Sprint 31 C2 rehearsal finding 1: completing again in a later year showed "Frost jar glass is yours"
  // although nothing new was granted. The prize row shows only when the piece is new.
  it('a later year that completes again shows no prize row for a piece already owned', () => {
    const cleared = Array.from({ length: 23 }, (_, i) => i + 1);
    const first = applyWin(state({ events: { wintertide: { year: 2026, cleared, pours: {} } } }), win(24), cfg);
    expect(first.card.event?.prizeStyle).toBe('glass:frost');
    const again = applyWin({ ...first.state, events: { wintertide: { year: 2027, cleared, pours: {} } } }, { ...win(24), event: { id: 'wintertide', year: 2027, board: 24 } }, cfg);
    expect(again.card.event?.completedNow).toBe(true);
    expect(again.card.event?.prizeStyle).toBeUndefined();
  });
  it('board 25 (Christmas Day, D237) is a bonus: no coins, no prize, and the count stays "of 24"', () => {
    const all = Array.from({ length: 24 }, (_, i) => i + 1);
    const after = applyWin(state({ events: { wintertide: { year: 2026, cleared: all, pours: {} } } }), win(25), cfg);
    expect(after.card.event).toMatchObject({ board: 25, cleared: 24, total: 24, firstClear: true, coins: 0, completedNow: false });
    expect(after.card.rewardShown).toBe(false);
    expect(after.state.styles?.owned).not.toContain('glass:frost');
    expect(after.state.events?.wintertide.cleared).toContain(25);
    const early = applyWin(state(), win(25), cfg);
    expect(early.card.event).toMatchObject({ cleared: 0, total: 24, coins: 0, completedNow: false });
  });

  it('New Tide: the 12th board gives the Sparkle glass and the New Tide badge (D240)', () => {
    const cleared = Array.from({ length: 11 }, (_, i) => i + 1);
    const r = applyWin(state({ events: { newtide: { year: 2026, cleared, pours: {} } } }), { ...win(12), today: '2027-01-06', event: { id: 'newtide', year: 2026, board: 12 } }, cfg);
    expect(r.card.event).toMatchObject({ id: 'newtide', cleared: 12, total: 12, coins: 50, completedNow: true, prizeStyle: 'glass:sparkle' });
    expect(r.state.styles?.owned).toContain('glass:sparkle');
    expect(r.state.badges).toContain('event-newtide');
  });
});
