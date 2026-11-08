// Story: production/sprints/sprint-8.md (P6), TD-2 (docs/tech-debt.md): the reward and stat changes of a win.
// Expected values are written out from the pre-refactor showWin rules, not from applyWin's own output.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { allShells } from '../../../src/core/collection';
import { isFreeBooster, newWallet } from '../../../src/core/economy';
import { emptyStats } from '../../../src/core/profile';
import { type WinConfig, type WinResult, type WinState, applyWin } from '../../../src/core/win';

const cfg = config as unknown as WinConfig;
const E = cfg.economy;
const TIDEPOOL = cfg.collection.sets[0].shells.map((s) => s.id);

function state(over: Partial<WinState> = {}): WinState {
  return { level: 1, best: {}, wallet: newWallet(cfg), tutorialDone: false, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], stats: emptyStats(), dailyShare: null, ...over };
}
function level(n: number, over: Partial<WinResult> = {}): WinResult {
  return { mode: 'level', level: n, challenge: false, dailyDate: '', moves: 12, assists: 1, ...over };
}
function daily(date: string, moves = 20): WinResult {
  return { mode: 'daily', level: 0, challenge: false, dailyDate: date, moves, assists: 0 };
}

describe('level win', () => {
  it('first clear pays coins, advances the level, records best and counts pours and coins', () => {
    const s = state({ level: 3 });
    const { state: n, card } = applyWin(s, level(3), cfg);
    expect(card.reward).toBe(E.coinsPerLevel);
    expect(card.rewardShown).toBe(true);
    expect(card.perfect).toBe(false);
    expect(card.note).toBe('none');
    expect(card.prevBest).toBeUndefined();
    expect(n.level).toBe(4);
    expect(n.best).toEqual({ '3': 12 });
    expect(n.wallet.coins).toBe(s.wallet.coins + E.coinsPerLevel);
    expect(n.stats).toMatchObject({ pours: 12, coinsEarned: E.coinsPerLevel, perfectClears: 0, dailiesSolved: 0 });
    expect(s.level).toBe(3); // input untouched
  });

  it('a replay pays no coins (M1), keeps the level, and lowers best only when beaten', () => {
    const s = state({ level: 8, best: { '3': 10 } });
    const worse = applyWin(s, level(3, { moves: 14 }), cfg);
    expect(worse.card.reward).toBe(0);
    expect(worse.card.rewardShown).toBe(false);
    expect(worse.card.note).toBe('replay');
    expect(worse.card.prevBest).toBe(10);
    expect(worse.state.level).toBe(8);
    expect(worse.state.best['3']).toBe(10);
    expect(worse.state.wallet.coins).toBe(s.wallet.coins);
    expect(worse.state.stats.pours).toBe(14); // pours still count
    expect(worse.state.stats.coinsEarned).toBe(0);
    const better = applyWin(s, level(3, { moves: 9 }), cfg);
    expect(better.state.best['3']).toBe(9);
    expect(better.card.prevBest).toBe(10);
  });

  it('a perfect first clear adds the bonus and counts a perfect clear; a perfect replay does not', () => {
    const first = applyWin(state({ level: 2 }), level(2, { assists: 0 }), cfg);
    expect(first.card.perfect).toBe(true);
    expect(first.card.note).toBe('perfect');
    expect(first.card.reward).toBe(E.coinsPerLevel + E.perfectBonus);
    expect(first.state.stats.perfectClears).toBe(1);
    const replay = applyWin(state({ level: 5 }), level(2, { assists: 0 }), cfg);
    expect(replay.card.perfect).toBe(true);
    expect(replay.card.note).toBe('replay');
    expect(replay.card.reward).toBe(0);
    expect(replay.state.stats.perfectClears).toBe(0);
  });

  it('a challenge level adds the challenge bonus', () => {
    const { card } = applyWin(state({ level: 4 }), level(4, { challenge: true }), cfg);
    expect(card.reward).toBe(E.coinsPerLevel + E.challengeBonus);
  });

  it('a milestone first clear grants the next shell; a milestone replay grants none', () => {
    const m = cfg.collection.everyLevels;
    const first = applyWin(state({ level: m }), level(m), cfg);
    expect(first.state.shells).toEqual([TIDEPOOL[0]]);
    expect(first.card.shell).toMatchObject({ kind: 'shell', completedSet: null, setCoins: 0 });
    const off = applyWin(state({ level: m - 1 }), level(m - 1), cfg);
    expect(off.card.shell).toBeNull();
    const replay = applyWin(state({ level: m + 3 }), level(m), cfg);
    expect(replay.card.shell).toBeNull();
    expect(replay.state.shells).toEqual([]);
  });

  it('completing a set pays the set reward and unlocks the sets cosmetic', () => {
    const m = cfg.collection.everyLevels;
    const s = state({ level: m * 5, shells: TIDEPOOL.slice(0, 4) });
    const { state: n, card } = applyWin(s, level(m * 5), cfg);
    const bonus = cfg.collection.setReward;
    expect(n.shells).toEqual(TIDEPOOL);
    expect(card.shell).toMatchObject({ kind: 'shell', setCoins: bonus.coins });
    expect(n.wallet.coins).toBe(s.wallet.coins + E.coinsPerLevel + bonus.coins);
    expect(n.stats.coinsEarned).toBe(E.coinsPerLevel + bonus.coins);
    for (const [id, count] of Object.entries(bonus.boosters)) expect(n.wallet.boosters[id as 'hint']).toBe(s.wallet.boosters[id as 'hint'] + (count as number));
    expect(card.unlocks.map((u) => u.item.id)).toContain('anchor'); // unlock: 1 set
  });

  it('with every shell owned a milestone pays the completion bonus and no shell', () => {
    const m = cfg.collection.everyLevels;
    const all = allShells(cfg).map((x) => x.id);
    const { state: n, card } = applyWin(state({ level: m, shells: all }), level(m), cfg);
    expect(card.shell).toEqual({ kind: 'complete', coins: cfg.collection.coinsWhenComplete });
    expect(n.shells).toEqual(all);
  });

  it('crossing 25 cleared levels unlocks the lighthouse avatar once', () => {
    const { card } = applyWin(state({ level: 25 }), level(25), cfg);
    expect(card.unlocks.map((u) => u.item.id)).toContain('lighthouse');
    const again = applyWin(state({ level: 40 }), level(25), cfg);
    expect(again.card.unlocks).toEqual([]);
  });
});

describe('daily win', () => {
  const D1 = '2026-11-08';

  it('the first solve counts: streak, reward, stats, a shell and the share record (GA-DP-6)', () => {
    const s = state();
    const { state: n, card } = applyWin(s, daily(D1, 31), cfg);
    const reward = cfg.daily.streak.baseCoins;
    expect(card.rewardShown).toBe(true);
    expect(card.reward).toBe(reward);
    expect(card.streak).toBe(1);
    expect(n.daily).toMatchObject({ last: D1, streak: 1, best: 1 });
    expect(n.wallet.coins).toBe(s.wallet.coins + reward);
    expect(n.stats).toMatchObject({ dailiesSolved: 1, pours: 31, coinsEarned: reward });
    expect(n.shells).toEqual([TIDEPOOL[0]]);
    expect(card.shell).toMatchObject({ kind: 'shell' });
    expect(n.dailyShare).toEqual({ date: D1, pours: 31 });
    expect(n.level).toBe(1); // a daily never advances the level
  });

  it('a replay the same day pays nothing, keeps the share record, but still counts pours', () => {
    const first = applyWin(state(), daily(D1, 31), cfg).state;
    const { state: n, card } = applyWin(first, daily(D1, 24), cfg);
    expect(card.note).toBe('dailyReplay');
    expect(card.rewardShown).toBe(false);
    expect(card.shell).toBeNull();
    expect(n.wallet.coins).toBe(first.wallet.coins);
    expect(n.shells).toEqual(first.shells);
    expect(n.dailyShare).toEqual({ date: D1, pours: 31 });
    expect(n.stats.dailiesSolved).toBe(1);
    expect(n.stats.pours).toBe(31 + 24);
  });

  it('an earlier date than the last solve is out of order (D10): no reward, no streak change', () => {
    const s = state({ daily: { last: '2026-11-10', streak: 3, best: 3, passes: 0 } });
    const { state: n, card } = applyWin(s, daily('2026-11-09', 18), cfg);
    expect(card.note).toBe('outOfOrder');
    expect(card.rewardShown).toBe(false);
    expect(n.daily).toEqual(s.daily);
    expect(n.wallet.coins).toBe(s.wallet.coins);
    expect(n.stats.dailiesSolved).toBe(0);
    expect(n.stats.pours).toBe(18);
    expect(n.dailyShare).toBeNull();
    expect(n.shells).toEqual([]);
  });

  it('a next-day solve extends the streak and pays more; the 7th day earns a pass', () => {
    const s = state({ daily: { last: '2026-11-07', streak: 6, best: 6, passes: 0 } });
    const { state: n, card } = applyWin(s, daily(D1), cfg);
    expect(card.streak).toBe(7);
    expect(card.note).toBe('earnedPass');
    expect(card.reward).toBe(Math.min(cfg.daily.streak.maxCoins, cfg.daily.streak.baseCoins + cfg.daily.streak.coinsPerDay * 6));
    expect(n.daily.passes).toBe(1);
  });

  it('a missed day bridged by a pass keeps the streak and says so', () => {
    const s = state({ daily: { last: '2026-11-06', streak: 2, best: 2, passes: 1 } });
    const { state: n, card } = applyWin(s, daily(D1), cfg);
    expect(card.note).toBe('usedPass');
    expect(n.daily).toMatchObject({ streak: 3, passes: 0 });
  });
});

describe('tutorial win', () => {
  it('marks the tutorial done and changes nothing else', () => {
    const s = state();
    const { state: n, card } = applyWin(s, { mode: 'tutorial', level: 0, challenge: false, dailyDate: '', moves: 6, assists: 0 }, cfg);
    expect(n).toEqual({ ...s, tutorialDone: true });
    expect(card).toMatchObject({ rewardShown: false, reward: 0, shell: null, unlocks: [], note: 'none' });
  });
});

describe('stats (D25)', () => {
  it('a win never touches boostersUsed, and Undo is a free booster so it is not counted there', () => {
    expect(isFreeBooster('undo', cfg)).toBe(true);
    const s = state({ stats: { ...emptyStats(), boostersUsed: 4 } });
    expect(applyWin(s, level(1), cfg).state.stats.boostersUsed).toBe(4);
    expect(applyWin(s, daily('2026-11-08'), cfg).state.stats.boostersUsed).toBe(4);
  });

  it('assists (not Undo) decide Perfect: zero assists is perfect', () => {
    expect(applyWin(state(), level(1, { assists: 0 }), cfg).card.perfect).toBe(true);
    expect(applyWin(state(), level(1, { assists: 1 }), cfg).card.perfect).toBe(false);
  });

  it('pours and coins accumulate across wins', () => {
    const a = applyWin(state(), level(1, { moves: 10 }), cfg).state;
    const b = applyWin(a, level(2, { moves: 7 }), cfg).state;
    expect(b.stats.pours).toBe(17);
    expect(b.stats.coinsEarned).toBe(2 * E.coinsPerLevel);
  });
});
