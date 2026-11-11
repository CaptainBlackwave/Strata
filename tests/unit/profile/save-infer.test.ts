// Issue: strata-6og (design/gdd/save-data.md §3 repair). A hand-edited or damaged v2 save infers
// what it can from the rest of the save instead of giving a returning player a fresh start.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { EconomyConfig } from '../../../src/core/economy';
import { type KeyValueStore, freshSave, loadSave } from '../../../src/ui/storage';

const econ = config as unknown as EconomyConfig;
const KEY = 'strata.save.v2';

function load(patch: Record<string, unknown>, drop: string[] = []) {
  const save: Record<string, unknown> = { ...freshSave(econ), ...patch };
  for (const k of drop) delete save[k];
  const data: Record<string, string> = { [KEY]: JSON.stringify(save) };
  const store: KeyValueStore = { getItem: (k) => data[k] ?? null, setItem: () => undefined };
  return loadSave(econ, store);
}

const cleared = (to: number) => Object.fromEntries(Array.from({ length: to }, (_, i) => [String(i + 1), 10]));

describe('tutorialDone when missing (strata-6og)', () => {
  it('a save past level 1 without the flag skips the tutorial, as v1 migration does', () => {
    expect(load({ level: 45 }, ['tutorialDone']).tutorialDone).toBe(true);
  });

  it('a level-1 save without the flag gets the tutorial', () => {
    expect(load({ level: 1 }, ['tutorialDone']).tutorialDone).toBe(false);
  });

  it('an explicit false is kept', () => {
    expect(load({ level: 45, tutorialDone: false }).tutorialDone).toBe(false);
  });
});

describe('a bad level is inferred from cleared levels (strata-6og)', () => {
  it('level -5 with best up to 44 resumes at 45', () => {
    expect(load({ level: -5, best: cleared(44) }).level).toBe(45);
  });

  it('Perfect marks count as cleared levels too', () => {
    expect(load({ level: 'x', best: {}, perfect: [3, 9] }).level).toBe(10);
  });

  it('nothing cleared falls back to level 1', () => {
    expect(load({ level: null, best: {}, perfect: [] }).level).toBe(1);
  });

  it('a valid level is kept even if best goes further', () => {
    expect(load({ level: 20, best: cleared(44) }).level).toBe(20);
  });
});

describe('coins are capped (strata-6og)', () => {
  it('a huge coin count is clamped so it never shows as 1e+300', () => {
    const coins = load({ wallet: { coins: 1e300, boosters: {} } }).wallet.coins;
    expect(Number.isSafeInteger(coins)).toBe(true);
    expect(String(coins)).not.toContain('e');
  });

  it('an ordinary coin count is kept', () => {
    expect(load({ wallet: { coins: 1234, boosters: {} } }).wallet.coins).toBe(1234);
  });
});
