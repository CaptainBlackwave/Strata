// Sprint 16 T1/G2 (D136, D137, D140): a daily solve pays the streak track, and every counted
// win moves today's goals. Rules: design/gdd/daily-puzzle.md §2.4, design/gdd/daily-goals.md.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { newWallet } from '../../../src/core/economy';
import { type GoalsConfig, goalsFor } from '../../../src/core/goals';
import { emptyStats } from '../../../src/core/profile';
import { type WinConfig, type WinResult, type WinState, applyWin } from '../../../src/core/win';

const cfg = config as unknown as WinConfig & GoalsConfig;

function state(over: Partial<WinState> = {}): WinState {
  return { level: 10, best: {}, perfect: [], wallet: newWallet(cfg), tutorialDone: true, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], stats: emptyStats(), dailyShare: null, badges: [], scenesPlayed: [], seenMechanics: [], themes: { owned: ['midday'] }, track: [], styles: { owned: [], worn: { glass: 'clear', cork: 'cork', sand: 'plain' } }, ...over };
}
const daily = (date: string): WinResult => ({ mode: 'daily', level: 0, challenge: false, dailyDate: date, today: date, moves: 20, assists: 0, sealed: 3, scene: 'midday' });
const level = (n: number, today: string, over: Partial<WinResult> = {}): WinResult => ({ mode: 'level', level: n, challenge: false, dailyDate: '', today, moves: 12, assists: 1, sealed: 3, scene: 'midday', ...over });

describe('streak track on a daily solve', () => {
  it('day 3 pays its boosters once', () => {
    const s = state({ daily: { last: '2026-11-11', streak: 2, best: 2, passes: 0 } });
    const { state: n, card } = applyWin(s, daily('2026-11-12'), cfg);
    expect(card.track.map((t) => t.day)).toEqual([3]);
    expect(n.track).toEqual([3]);
    expect(n.wallet.boosters.hint).toBe(s.wallet.boosters.hint + 1);
    expect(n.wallet.boosters.shuffle).toBe(s.wallet.boosters.shuffle + 1);
  });

  it('a replay of today pays nothing from the track', () => {
    const s = state({ daily: { last: '2026-11-12', streak: 3, best: 3, passes: 0 }, track: [] });
    expect(applyWin(s, daily('2026-11-12'), cfg).card.track).toEqual([]);
  });

  it('day 30 gives the streak-only jar glass, day 100 the scene', () => {
    const s30 = applyWin(state({ daily: { last: '2026-11-11', streak: 29, best: 29, passes: 0 }, track: [3, 7, 14] }), daily('2026-11-12'), cfg).state;
    expect(s30.styles?.owned).toContain('glass:sealantern');
    const s100 = applyWin(state({ daily: { last: '2026-11-11', streak: 99, best: 99, passes: 0 }, track: [3, 7, 14, 30, 60] }), daily('2026-11-12'), cfg).state;
    expect(s100.themes.owned).toContain('lighthousenight');
  });

  it('day 14 unlocks the Tide Line frame on the win card', () => {
    const { card } = applyWin(state({ daily: { last: '2026-11-11', streak: 13, best: 13, passes: 0 }, track: [3, 7] }), daily('2026-11-12'), cfg);
    expect(card.unlocks.map((u) => u.item.id)).toContain('tideline');
  });
});

describe('daily goals on a win', () => {
  it('sealed jars move a seal goal and pay when reached', () => {
    // Find a date with a seal goal.
    let date = '';
    for (let d = 0; d < 60 && !date; d++) {
      const k = new Date(Date.UTC(2026, 10, 12) + d * 86_400_000).toISOString().slice(0, 10);
      if (goalsFor(k, cfg).some((g) => g.kind === 'seal')) date = k;
    }
    const goals = goalsFor(date, cfg);
    const i = goals.findIndex((g) => g.kind === 'seal');
    const s = state({ goals: { date, progress: goals.map((g, k) => (k === i ? g.target - 3 : 0)), done: [], bonus: false } });
    const { state: n, card } = applyWin(s, level(5, date, { sealed: 3 }), cfg);
    expect(card.goals.paid.map((p) => p.index)).toContain(i);
    expect(n.wallet.coins).toBeGreaterThanOrEqual(s.wallet.coins + goals[i].coins);
  });

  it('nothing is recorded without today', () => {
    const s = state();
    const { card } = applyWin(s, level(5, '', {}), cfg);
    expect(card.goals.paid).toEqual([]);
  });
});
