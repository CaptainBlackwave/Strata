// Design: design/gdd/badges.md §3.5 (back-fill), §3.10 (save fields and repair). Sprint 11 A2, D76.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type BadgeSourceConfig, backfillBadges } from '../../../src/core/badges';
import type { EconomyConfig } from '../../../src/core/economy';
import { type KeyValueStore, exportSave, freshSave, importSave, loadSave } from '../../../src/ui/storage';

const econ = config as unknown as EconomyConfig;
const cfg = config as unknown as BadgeSourceConfig;
const KEY = 'strata.save.v2';

function memoryStore(init: Record<string, string> = {}): KeyValueStore {
  const data = { ...init };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}
const load = (raw: object) => loadSave(econ, memoryStore({ [KEY]: JSON.stringify(raw) }));

/** A save from before badges: no `badges`, no `scenesPlayed`, no `stats.jarsSealed`. */
const OLD_SAVE = { level: 60, best: {}, perfect: [10, 33], wallet: { coins: 500, boosters: {} }, tutorialDone: true, daily: { last: null, streak: 0, best: 8, passes: 0 }, shells: ['periwinkle'], stats: { perfectClears: 30, dailiesSolved: 3, pours: 1200, coinsEarned: 900, boostersUsed: 4 } };

describe('badges in the save', () => {
  it('a fresh save has no badges, no scenes played and no jars sealed', () => {
    const s = freshSave(econ);
    expect(s.badges).toEqual([]);
    expect(s.scenesPlayed).toEqual([]);
    expect(s.stats.jarsSealed).toBe(0);
  });
  it('an old save loads with the new fields empty, keeping its other counters', () => {
    const s = load(OLD_SAVE);
    expect(s.badges).toEqual([]);
    expect(s.scenesPlayed).toEqual([]);
    expect(s.stats).toMatchObject({ jarsSealed: 0, perfectClears: 30, pours: 1200 });
  });
  it('an old save is back-filled with what it already earned, and the wallet is untouched', () => {
    const s = load(OLD_SAVE);
    const coins = s.wallet.coins;
    s.badges = backfillBadges(s, cfg);
    expect(s.badges).toEqual(['levels-10', 'levels-50', 'pours-1000', 'perfect-1', 'perfect-25', 'tall-perfect-1', 'shells-1', 'mechanics-1', 'daily-1', 'streak-7']);
    expect(s.wallet.coins).toBe(coins);
  });
  it('repairs each field: unknown and duplicate badges dropped, unknown scenes dropped, a bad counter zeroed', () => {
    const s = load({ ...OLD_SAVE, badges: ['streak-7', 'shiny-thing', 'streak-7', 42, 'weekly-2026-W46', 'first-seal'], scenesPlayed: ['dawn', 'dawn', 'mars', 3, 'midday'], stats: { ...OLD_SAVE.stats, jarsSealed: -3 } });
    expect(s.badges).toEqual(['streak-7', 'weekly-2026-W46', 'first-seal']);
    expect(s.scenesPlayed).toEqual(['dawn', 'midday']);
    expect(s.stats.jarsSealed).toBe(0);
    expect(load({ ...OLD_SAVE, badges: 'first-seal', scenesPlayed: {} }).badges).toEqual([]);
  });
  it('round-trips through the save code', () => {
    const s = load({ ...OLD_SAVE, badges: ['first-seal', 'streak-7', 'weekly-2026-W46'], scenesPlayed: ['dawn', 'midday'], stats: { ...OLD_SAVE.stats, jarsSealed: 77 } });
    const back = importSave(exportSave(s), econ)!;
    expect(back.badges).toEqual(['first-seal', 'streak-7', 'weekly-2026-W46']);
    expect(back.scenesPlayed).toEqual(['dawn', 'midday']);
    expect(back.stats.jarsSealed).toBe(77);
    expect(back).toEqual(s);
  });
});
