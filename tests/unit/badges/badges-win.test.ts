// Design: design/gdd/badges.md §3.2 (counting at the win), §3.4 (award points), §5 (no badge pays). Sprint 11 A2, D76.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { newWallet } from '../../../src/core/economy';
import { emptyStats } from '../../../src/core/profile';
import { type WinConfig, type WinResult, type WinState, applyWin } from '../../../src/core/win';

const cfg = config as unknown as WinConfig;
const NO_BADGES = { ...cfg, badges: { list: [] } } as WinConfig;

function state(over: Partial<WinState> = {}): WinState {
  return { level: 1, best: {}, perfect: [], wallet: newWallet(cfg), tutorialDone: true, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], stats: emptyStats(), dailyShare: null, badges: [], scenesPlayed: [], seenMechanics: [], themes: { owned: ['midday'] }, ...over };
}
function level(n: number, over: Partial<WinResult> = {}): WinResult {
  return { mode: 'level', level: n, challenge: false, dailyDate: '', moves: 20, assists: 1, sealed: 4, scene: 'midday', ...over };
}

describe('a win counts jars sealed and the scene (§3.2)', () => {
  it('adds the sealed jars and the scene, each scene once', () => {
    const a = applyWin(state({ level: 3 }), level(3, { sealed: 4 }), cfg).state;
    expect(a.stats.jarsSealed).toBe(4);
    expect(a.scenesPlayed).toEqual(['midday']);
    const b = applyWin(a, level(3, { sealed: 3, scene: 'midday' }), cfg).state; // a replay counts too
    expect(b.stats.jarsSealed).toBe(7);
    expect(b.scenesPlayed).toEqual(['midday']);
    const c = applyWin(b, level(4, { scene: 'dawn' }), cfg).state;
    expect(c.scenesPlayed).toEqual(['midday', 'dawn']);
  });
  it('a daily, even a replay, counts both', () => {
    const d: WinResult = { mode: 'daily', level: 0, challenge: false, dailyDate: '2026-11-09', moves: 30, assists: 0, sealed: 6, scene: 'dawn' };
    const once = applyWin(state(), d, cfg).state;
    const twice = applyWin(once, d, cfg).state;
    expect(once.stats.jarsSealed).toBe(6);
    expect(twice.stats.jarsSealed).toBe(12);
    expect(twice.stats.dailiesSolved).toBe(1);
    expect(twice.scenesPlayed).toEqual(['dawn']);
  });
  it('the tutorial counts nothing and earns nothing', () => {
    const r = applyWin(state({ tutorialDone: false }), { mode: 'tutorial', level: 1, challenge: false, dailyDate: '', moves: 5, assists: 0, sealed: 2, scene: 'midday' }, cfg);
    expect(r.state.stats.jarsSealed).toBe(0);
    expect(r.state.scenesPlayed).toEqual([]);
    expect(r.state.badges).toEqual([]);
    expect(r.card.badges).toEqual([]);
  });
});

describe('the win card lists the badges this win earned (§3.4, §3.6)', () => {
  it('a Perfect first clear of tall-jar level 10 earns five, in catalogue order', () => {
    const r = applyWin(state({ level: 10 }), level(10, { assists: 0, challenge: true, sealed: 5 }), cfg);
    expect(r.card.badges).toEqual(['first-seal', 'levels-10', 'perfect-1', 'tall-perfect-1', 'shells-1']);
    expect(r.state.badges).toEqual(r.card.badges);
  });
  it('badges already saved are not listed again', () => {
    const r = applyWin(state({ level: 10, badges: ['first-seal', 'shells-1'] }), level(10, { assists: 0 }), cfg);
    expect(r.card.badges).toEqual(['levels-10', 'perfect-1', 'tall-perfect-1']);
    expect(r.state.badges).toEqual(['first-seal', 'shells-1', 'levels-10', 'perfect-1', 'tall-perfect-1']);
  });
  it('a special jar met at the start of the level shows on its win card', () => {
    const r = applyWin(state({ level: 5, badges: ['first-seal'], seenMechanics: ['narrow'] }), level(5), cfg);
    expect(r.card.badges).toContain('mechanics-1');
  });
  it('a second scene earns Day Tripper', () => {
    const r = applyWin(state({ level: 4, badges: ['first-seal'], scenesPlayed: ['midday'], themes: { owned: ['midday', 'dawn'] } }), level(4, { scene: 'dawn' }), cfg); // level 4: no shell milestone
    expect(r.card.badges).toEqual(['scenes-played-2']);
  });
});

describe('no badge changes the wallet (D76)', () => {
  it('a badge-earning level win credits exactly what it would with no badges at all', () => {
    const s = state({ level: 10 });
    const w = level(10, { assists: 0, challenge: true, sealed: 5 });
    const withBadges = applyWin(s, w, cfg);
    const without = applyWin(s, w, NO_BADGES);
    expect(withBadges.card.badges.length).toBeGreaterThan(0);
    expect(withBadges.state.wallet).toEqual(without.state.wallet);
    expect(withBadges.state.stats).toEqual(without.state.stats);
    expect(withBadges.state.shells).toEqual(without.state.shells);
    expect(withBadges.card.reward).toBe(without.card.reward);
  });
  it('and so does a badge-earning daily', () => {
    const s = state({ daily: { last: '2026-11-08', streak: 6, best: 6, passes: 0 } });
    const d: WinResult = { mode: 'daily', level: 0, challenge: false, dailyDate: '2026-11-09', moves: 30, assists: 0, sealed: 6, scene: 'midday' };
    const withBadges = applyWin(s, d, cfg);
    expect(withBadges.card.badges).toContain('streak-7');
    expect(withBadges.state.wallet).toEqual(applyWin(s, d, NO_BADGES).state.wallet);
  });
});
