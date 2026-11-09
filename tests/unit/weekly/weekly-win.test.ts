// Design: design/gdd/weekly-set.md §3.5 (cleared), §3.7 (single boards pay nothing; the set pays a bonus once, D83), badges.md §3.9 (the week badge). Sprint 11 W2, D77.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { newWallet } from '../../../src/core/economy';
import { emptyStats } from '../../../src/core/profile';
import { emptyWeekly } from '../../../src/core/weekly';
import { type WinConfig, type WinResult, type WinState, applyWin } from '../../../src/core/win';

const cfg = config as unknown as WinConfig;
const W = '2026-W46';

function state(over: Partial<WinState> = {}): WinState {
  return { level: 9, best: {}, perfect: [], wallet: newWallet(cfg), tutorialDone: true, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], stats: emptyStats(), dailyShare: null, badges: [], scenesPlayed: [], seenMechanics: [], themes: { owned: ['midday'] }, weekly: emptyWeekly(), ...over };
}
function weekly(index: number, over: Partial<WinResult> = {}): WinResult {
  return { mode: 'weekly', level: 0, challenge: false, dailyDate: '', moves: 30, assists: 2, sealed: 5, scene: 'midday', weekly: { week: W, index }, ...over };
}

describe('a weekly win (§3.5, §3.7)', () => {
  it('records the board, pays no coins and no shell for a single board, and counts pours and sealed jars', () => {
    const before = state();
    const r = applyWin(before, weekly(2), cfg);
    expect(r.state.weekly).toEqual({ week: W, cleared: [2], pours: { '2': 30 } });
    expect(r.state.wallet).toEqual(before.wallet);
    expect(r.state.shells).toEqual([]);
    expect(r.state.stats.coinsEarned).toBe(0);
    expect(r.state.stats.pours).toBe(30);
    expect(r.state.stats.jarsSealed).toBe(5);
    expect(r.state.stats.dailiesSolved).toBe(0);
    expect(r.state.level).toBe(9);
    expect(r.card).toMatchObject({ mode: 'weekly', rewardShown: false, reward: 0, shell: null });
    expect(r.card.weekly).toMatchObject({ index: 2, cleared: 1, total: 5, firstClear: true, completedNow: false, outOfDate: false });
  });
  it('the fifth board adds the week badge to the save and the card, once', () => {
    let s = state();
    for (const i of [0, 1, 2, 3]) s = applyWin(s, weekly(i), cfg).state;
    expect(s.badges).not.toContain('weekly-2026-W46');
    const r = applyWin(s, weekly(4), cfg);
    expect(r.state.badges).toContain('weekly-2026-W46');
    expect(r.card.badges[0]).toBe('weekly-2026-W46');
    expect(r.card.weekly).toMatchObject({ cleared: 5, completedNow: true });
    const again = applyWin(r.state, weekly(4, { moves: 20 }), cfg);
    expect(again.state.badges.filter((b) => b === 'weekly-2026-W46')).toHaveLength(1);
    expect(again.card.badges).not.toContain('weekly-2026-W46');
    expect(again.card.weekly).toMatchObject({ newBest: true, prevBest: 30, firstClear: false });
  });
  it('the fifth board pays the set bonus once a week, shown on the card (D83)', () => {
    const bonus = cfg.weekly.completeBonus;
    expect(bonus).toBeGreaterThan(0);
    let s = state();
    for (const i of [0, 1, 2, 3]) s = applyWin(s, weekly(i), cfg).state;
    expect(s.wallet).toEqual(state().wallet);
    const r = applyWin(s, weekly(4), cfg);
    expect(r.state.wallet.coins).toBe(s.wallet.coins + bonus);
    expect(r.state.stats.coinsEarned).toBe(bonus);
    expect(r.card).toMatchObject({ rewardShown: true, reward: bonus });
    const again = applyWin(r.state, weekly(4, { moves: 20 }), cfg);
    expect(again.state.wallet).toEqual(r.state.wallet);
    expect(again.card).toMatchObject({ rewardShown: false, reward: 0 });
  });
  it('a set completed out of order pays the bonus on whichever board is last', () => {
    let s = state();
    for (const i of [4, 0, 3, 1]) s = applyWin(s, weekly(i), cfg).state;
    const r = applyWin(s, weekly(2), cfg);
    expect(r.state.wallet.coins).toBe(s.wallet.coins + cfg.weekly.completeBonus);
  });
  it('a new week pays the bonus again when its set is complete', () => {
    let s = state();
    for (const i of [0, 1, 2, 3, 4]) s = applyWin(s, weekly(i), cfg).state;
    const after1 = s.wallet.coins;
    for (const i of [0, 1, 2, 3, 4]) s = applyWin(s, weekly(i, { weekly: { week: '2026-W47', index: i } }), cfg).state;
    expect(s.wallet.coins).toBe(after1 + cfg.weekly.completeBonus);
  });
  it('a badge the save already holds is not added twice', () => {
    let s = state({ badges: ['weekly-2026-W46'] });
    for (const i of [0, 1, 2, 3, 4]) s = applyWin(s, weekly(i), cfg).state;
    expect(s.badges.filter((b) => b === 'weekly-2026-W46')).toHaveLength(1);
  });
  it('a win for a week older than the saved one records nothing for the set', () => {
    const s = state({ weekly: { week: '2026-W47', cleared: [0], pours: { '0': 12 } } });
    const r = applyWin(s, weekly(1), cfg);
    expect(r.state.weekly).toEqual(s.weekly);
    expect(r.card.weekly).toMatchObject({ outOfDate: true });
  });
  it('a save without a weekly field starts one', () => {
    const { weekly: _w, ...rest } = state();
    void _w;
    const r = applyWin(rest as WinState, weekly(0), cfg);
    expect(r.state.weekly).toEqual({ week: W, cleared: [0], pours: { '0': 30 } });
  });
});
