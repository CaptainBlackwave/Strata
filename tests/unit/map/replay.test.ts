// Story: production/sprints/sprint-9.md M3; design/gdd/level-map.md D50, D52 (replays and the Perfect stat).
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { newWallet } from '../../../src/core/economy';
import { emptyStats } from '../../../src/core/profile';
import { type WinConfig, type WinResult, type WinState, applyWin } from '../../../src/core/win';

const cfg = config as unknown as WinConfig;

function state(over: Partial<WinState> = {}): WinState {
  return { level: 10, best: { '3': 20 }, perfect: [], wallet: newWallet(cfg), tutorialDone: true, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], stats: emptyStats(), dailyShare: null, badges: [], scenesPlayed: [], seenMechanics: [], themes: { owned: ['midday'] }, ...over };
}
function win(n: number, over: Partial<WinResult> = {}): WinResult {
  return { mode: 'level', level: n, challenge: false, dailyDate: '', moves: 20, assists: 0, sealed: 3, scene: 'midday', ...over };
}

describe('replay (D50): no coins', () => {
  it('pays nothing, keeps the level, and says so when nothing else changed', () => {
    const s = state({ perfect: [3] });
    const { state: n, card } = applyWin(s, win(3), cfg);
    expect(card.reward).toBe(0);
    expect(card.rewardShown).toBe(false);
    expect(n.wallet.coins).toBe(s.wallet.coins);
    expect(n.level).toBe(10);
    expect(card.note).toBe('replay');
    expect(card.perfectEarned).toBe(false);
    expect(card.newBest).toBe(false);
  });
});

describe('first Perfect counts once per level (D50, D52)', () => {
  it('a replay Perfect on a level not yet Perfect sets the mark and adds 1 to the stat', () => {
    const { state: n, card } = applyWin(state({ perfect: [2, 9] }), win(3), cfg);
    expect(n.perfect).toEqual([2, 3, 9]); // sorted
    expect(n.stats.perfectClears).toBe(1);
    expect(card.perfectEarned).toBe(true);
    expect(card.reward).toBe(0); // still no coins
  });
  it('a second Perfect on the same level changes nothing', () => {
    const once = applyWin(state(), win(3), cfg).state;
    const { state: n, card } = applyWin(once, win(3), cfg);
    expect(n.perfect).toEqual([3]);
    expect(n.stats.perfectClears).toBe(1);
    expect(card.perfectEarned).toBe(false);
  });
  it('a replay with a booster used earns no mark', () => {
    const { state: n, card } = applyWin(state(), win(3, { assists: 1 }), cfg);
    expect(n.perfect).toEqual([]);
    expect(n.stats.perfectClears).toBe(0);
    expect(card.perfectEarned).toBe(false);
  });
  it('a Perfect first clear also records the level, so a later replay cannot count it again', () => {
    const first = applyWin(state({ level: 10 }), win(10), cfg);
    expect(first.state.perfect).toEqual([10]);
    expect(first.state.stats.perfectClears).toBe(1);
    expect(first.card.perfectEarned).toBe(true);
    const again = applyWin(first.state, win(10), cfg);
    expect(again.state.stats.perfectClears).toBe(1);
  });
  it('a first clear with a booster records no Perfect; a later Perfect replay earns it', () => {
    const first = applyWin(state({ level: 10 }), win(10, { assists: 2 }), cfg).state;
    expect(first.perfect).toEqual([]);
    const replay = applyWin(first, win(10), cfg);
    expect(replay.state.perfect).toEqual([10]);
    expect(replay.state.stats.perfectClears).toBe(1);
  });
  it('an old save keeps its counter and only grows (D52)', () => {
    const { state: n } = applyWin(state({ stats: { ...emptyStats(), perfectClears: 7 } }), win(3), cfg);
    expect(n.stats.perfectClears).toBe(8);
  });
  it('the 10th Perfect from a replay unlocks the Perfect-stat cosmetic (player-profile.md)', () => {
    const { card } = applyWin(state({ stats: { ...emptyStats(), perfectClears: 9 } }), win(3), cfg);
    expect(card.unlocks.map((u) => u.item.id)).toContain('driftwood');
  });
  it('a daily solve never touches the per-level Perfect list', () => {
    const { state: n } = applyWin(state(), { mode: 'daily', level: 0, challenge: false, dailyDate: '2026-11-09', moves: 20, assists: 0, sealed: 3, scene: 'midday' }, cfg);
    expect(n.perfect).toEqual([]);
  });
});

describe('best pours on a replay (D50)', () => {
  it('a lower count updates best and is reported', () => {
    const { state: n, card } = applyWin(state({ perfect: [3] }), win(3, { moves: 15 }), cfg);
    expect(n.best['3']).toBe(15);
    expect(card.newBest).toBe(true);
    expect(card.prevBest).toBe(20);
  });
  it('an equal or higher count keeps best and reports nothing new', () => {
    for (const moves of [20, 25]) {
      const { state: n, card } = applyWin(state({ perfect: [3] }), win(3, { moves }), cfg);
      expect(n.best['3']).toBe(20);
      expect(card.newBest).toBe(false);
    }
  });
  it('a first clear is not reported as a new best (there was none before)', () => {
    expect(applyWin(state(), win(10), cfg).card.newBest).toBe(false);
  });
});
