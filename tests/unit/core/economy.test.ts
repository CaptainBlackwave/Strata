// Story: production/epics/competitive/story-002-economy-boosters.md
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type BoosterId, type EconomyConfig, addBoosters, buyBooster, levelReward, newWallet, spendBooster } from '../../../src/core/economy';

const econ = config as unknown as EconomyConfig;

describe('wallet', () => {
  it('starts with the configured coins and booster charges', () => {
    const w = newWallet(econ);
    expect(w.coins).toBe(econ.economy.startCoins);
    for (const id of Object.keys(econ.boosters) as BoosterId[]) expect(w.boosters[id]).toBe(econ.boosters[id].start);
  });

  it('spending a booster with charges uses a charge and no coins', () => {
    const w = newWallet(econ);
    const r = spendBooster(w, 'undo', econ);
    expect(r.ok).toBe(true);
    expect(r.wallet.boosters.undo).toBe(w.boosters.undo - 1);
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
    spendBooster(w, 'undo', econ);
    buyBooster({ ...w, coins: 9999 }, 'undo', econ);
    expect(JSON.stringify(w)).toBe(snapshot);
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
    for (const id of Object.keys(econ.boosters) as BoosterId[]) {
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
