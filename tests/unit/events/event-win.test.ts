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
});
