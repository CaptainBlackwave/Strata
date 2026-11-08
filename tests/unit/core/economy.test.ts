// Story: production/epics/competitive/story-002-economy-boosters.md
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type BoosterId, type EconomyConfig, addBoosters, buyBooster, clearReward, isFreeBooster, levelReward, newWallet, spendBooster } from '../../../src/core/economy';

const econ = config as unknown as EconomyConfig;

describe('wallet', () => {
  it('starts with the configured coins and booster charges', () => {
    const w = newWallet(econ);
    expect(w.coins).toBe(econ.economy.startCoins);
    for (const id of Object.keys(econ.boosters) as BoosterId[]) expect(w.boosters[id]).toBe(econ.boosters[id].start);
  });

  it('spending a booster with charges uses a charge and no coins', () => {
    const w = newWallet(econ);
    const r = spendBooster(w, 'hint', econ);
    expect(r.ok).toBe(true);
    expect(r.wallet.boosters.hint).toBe(w.boosters.hint - 1);
    expect(r.wallet.coins).toBe(w.coins);
    expect(r.paidCoins).toBe(0);
  });

  it('with no charges left it buys one with coins when affordable', () => {
    const w = { ...newWallet(econ), boosters: { ...newWallet(econ).boosters, shuffle: 0 }, coins: 500 };
    const r = spendBooster(w, 'shuffle', econ);
    expect(r.ok).toBe(true);
    expect(r.wallet.boosters.shuffle).toBe(0);
    expect(r.wallet.coins).toBe(500 - econ.boosters.shuffle.price);
    expect(r.paidCoins).toBe(econ.boosters.shuffle.price);
  });

  it('refuses when there are no charges and not enough coins, and changes nothing', () => {
    const w = { ...newWallet(econ), boosters: { ...newWallet(econ).boosters, hint: 0 }, coins: 1 };
    const r = spendBooster(w, 'hint', econ);
    expect(r.ok).toBe(false);
    expect(r.wallet).toBe(w);
  });

  it('buyBooster adds a charge for its price', () => {
    const w = { ...newWallet(econ), coins: 1000 };
    const r = buyBooster(w, 'extraJar', econ);
    expect(r.ok).toBe(true);
    expect(r.wallet.boosters.extraJar).toBe(w.boosters.extraJar + 1);
    expect(r.wallet.coins).toBe(1000 - econ.boosters.extraJar.price);
  });

  it('never mutates the input wallet', () => {
    const w = newWallet(econ);
    const snapshot = JSON.stringify(w);
    spendBooster(w, 'hint', econ);
    buyBooster({ ...w, coins: 9999 }, 'hint', econ);
    expect(JSON.stringify(w)).toBe(snapshot);
  });
});

describe('Undo is free and unlimited (D-a, production/qa/sprint-6-findings.md)', () => {
  it('the shipped config marks undo free, with no price and no starting charges', () => {
    expect(econ.boosters.undo).toEqual({ start: 0, price: 0, free: true });
    expect(isFreeBooster('undo', econ)).toBe(true);
    expect(isFreeBooster('hint', econ)).toBe(false);
  });
  it('spending undo with no charges and no coins succeeds and changes nothing', () => {
    const w = { coins: 0, boosters: { undo: 0, shuffle: 0, extraJar: 0, hint: 0 } };
    const r = spendBooster(w, 'undo', econ);
    expect(r).toEqual({ ok: true, wallet: w, paidCoins: 0 });
    expect(r.wallet).toBe(w);
  });
  it('an old save with stored undo charges keeps them: spending undo never uses one', () => {
    const w = { coins: 500, boosters: { undo: 5, shuffle: 1, extraJar: 1, hint: 1 } };
    const r = spendBooster(w, 'undo', econ);
    expect(r.ok).toBe(true);
    expect(r.wallet).toBe(w);
    expect(r.paidCoins).toBe(0);
  });
  it('undo can be spent any number of times in a row', () => {
    let w = newWallet(econ);
    for (let i = 0; i < 50; i++) {
      const r = spendBooster(w, 'undo', econ);
      expect(r.ok).toBe(true);
      w = r.wallet;
    }
    expect(w).toEqual(newWallet(econ));
  });
  it('buying a free booster is a no-op success', () => {
    const w = { ...newWallet(econ), coins: 300 };
    const r = buyBooster(w, 'undo', econ);
    expect(r).toEqual({ ok: true, wallet: w, paidCoins: 0 });
    expect(r.wallet).toBe(w);
  });
  it('nothing in the config grants undo charges any more', () => {
    const c = config as unknown as { collection: { setReward: { boosters: Record<string, number> } } };
    expect(c.collection.setReward.boosters).not.toHaveProperty('undo');
    expect(newWallet(econ).boosters.undo).toBe(0);
  });
});

describe('levelReward', () => {
  it('pays the base reward, plus the perfect bonus when no boosters were used', () => {
    expect(levelReward({ perfect: false, challenge: false }, econ)).toBe(econ.economy.coinsPerLevel);
    expect(levelReward({ perfect: true, challenge: false }, econ)).toBe(econ.economy.coinsPerLevel + econ.economy.perfectBonus);
  });
  it('tall-jar challenges pay a bonus', () => {
    expect(levelReward({ perfect: false, challenge: true }, econ)).toBe(econ.economy.coinsPerLevel + econ.economy.challengeBonus);
  });
  it('a booster costs a few levels of play, so coins stay meaningful', () => {
    const perLevel = econ.economy.coinsPerLevel;
    for (const id of (Object.keys(econ.boosters) as BoosterId[]).filter((x) => !isFreeBooster(x, econ))) {
      expect(econ.boosters[id].price / perLevel).toBeGreaterThanOrEqual(2);
      expect(econ.boosters[id].price / perLevel).toBeLessThanOrEqual(8);
    }
  });
});

describe('addBoosters', () => {
  it('adds a bundle of charges without touching coins', () => {
    const w = newWallet(econ);
    const r = addBoosters(w, { undo: 1, hint: 2 });
    expect(r.boosters.undo).toBe(w.boosters.undo + 1);
    expect(r.boosters.hint).toBe(w.boosters.hint + 2);
    expect(r.boosters.shuffle).toBe(w.boosters.shuffle);
    expect(r.coins).toBe(w.coins);
  });
});

describe('clearReward (M1: first clear only)', () => {
  // design/gdd/economy.md: "A level pays coins on its first clear only; replays pay nothing".
  it('a first clear pays the full level reward', () => {
    expect(clearReward({ level: 7, nextLevel: 7, perfect: true, challenge: false }, econ)).toBe(levelReward({ perfect: true, challenge: false }, econ));
  });
  it('clearing a level beyond your progress also counts as a first clear', () => {
    expect(clearReward({ level: 9, nextLevel: 7, perfect: false, challenge: false }, econ)).toBe(econ.economy.coinsPerLevel);
  });
  it('replaying an already-cleared level pays nothing, Perfect or not', () => {
    expect(clearReward({ level: 3, nextLevel: 7, perfect: true, challenge: false }, econ)).toBe(0);
    expect(clearReward({ level: 10, nextLevel: 11, perfect: true, challenge: true }, econ)).toBe(0);
  });
  it('winning level 1 twice raises coins only once', () => {
    let coins = 0;
    let next = 1;
    for (let i = 0; i < 2; i++) {
      coins += clearReward({ level: 1, nextLevel: next, perfect: false, challenge: false }, econ);
      next = Math.max(next, 2);
    }
    expect(coins).toBe(econ.economy.coinsPerLevel);
  });
});
