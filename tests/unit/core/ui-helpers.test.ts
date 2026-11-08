// Stories: production/epics/strata/story-005-touch-ui.md, story-006-progress-save.md,
// production/epics/competitive/story-002-economy-boosters.md
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../../src/ui/layout';
import config from '../../../src/config/game-config.json';
import { type EconomyConfig, newWallet } from '../../../src/core/economy';
import { type KeyValueStore, freshSave, loadSave, writeSave } from '../../../src/ui/storage';

describe('computeLayout', () => {
  it('fits a small board in one row', () => {
    const l = computeLayout({ width: 390, height: 600, jars: 5, capacity: 4 });
    expect(l.rows).toBe(1);
    expect(l.cols * l.jarWidth + (l.cols + 1) * l.gapX).toBeLessThanOrEqual(390);
  });
  it('wraps 14 jars on a phone into multiple rows without overflowing', () => {
    const l = computeLayout({ width: 358, height: 560, jars: 14, capacity: 4 });
    expect(l.rows).toBeGreaterThan(1);
    expect(l.cols * l.jarWidth + (l.cols + 1) * l.gapX).toBeLessThanOrEqual(358);
    expect(l.rows * l.jarHeight + (l.rows + 1) * l.gapY).toBeLessThanOrEqual(560);
  });
  it('tall challenge jars still fit vertically', () => {
    const l = computeLayout({ width: 358, height: 560, jars: 7, capacity: 8 });
    expect(l.rows * l.jarHeight).toBeLessThanOrEqual(560);
  });
});

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const econ = config as unknown as EconomyConfig;

describe('save storage', () => {
  it('round-trips a save', () => {
    const s = memoryStore();
    const save = { ...freshSave(econ), level: 7, best: { '6': 21 }, tutorialDone: true };
    save.wallet = { coins: 345, boosters: { undo: 1, shuffle: 0, extraJar: 2, hint: 4 } };
    save.settings = { sound: false, music: true, haptics: false, patterns: true };
    save.daily = { last: '2026-11-08', streak: 3, best: 9, passes: 1 };
    save.shells = ['periwinkle', 'limpet'];
    writeSave(save, s);
    expect(loadSave(econ, s)).toEqual(save);
  });
  it('a new player gets the starting wallet and the tutorial', () => {
    const save = loadSave(econ, memoryStore());
    expect(save.level).toBe(1);
    expect(save.tutorialDone).toBe(false);
    expect(save.wallet).toEqual(newWallet(econ));
  });
  it('migrates v1 progress and prefs, skipping the tutorial for returning players', () => {
    const s = memoryStore();
    s.setItem('strata.progress.v1', JSON.stringify({ level: 15, best: { '14': 20 } }));
    s.setItem('strata.prefs.v1', JSON.stringify({ patterns: true }));
    const save = loadSave(econ, s);
    expect(save).toMatchObject({ level: 15, best: { '14': 20 }, tutorialDone: true, settings: { patterns: true } });
  });
  it('repairs invalid fields individually', () => {
    const s = memoryStore();
    s.setItem('strata.save.v2', JSON.stringify({ level: -3, wallet: { coins: 'lots', boosters: { undo: 2, hint: -1 } }, settings: { sound: 'yes' } }));
    const save = loadSave(econ, s);
    expect(save.level).toBe(1);
    expect(save.wallet.coins).toBe(econ.economy.startCoins);
    expect(save.wallet.boosters.undo).toBe(2);
    expect(save.wallet.boosters.hint).toBe(econ.boosters.hint.start);
    expect(save.settings.sound).toBe(true);
  });
  it('repairs a bad streak date and de-duplicates shells', () => {
    const s = memoryStore();
    s.setItem('strata.save.v2', JSON.stringify({ level: 2, daily: { last: 'yesterday', streak: 4 }, shells: ['a', 'a', 3, 'b'] }));
    const save = loadSave(econ, s);
    expect(save.daily).toEqual({ last: null, streak: 4, best: 0, passes: 0 });
    expect(save.shells).toEqual(['a', 'b']);
  });
  it('a sprint-1 save without daily or shells loads with empty ones', () => {
    const s = memoryStore();
    s.setItem('strata.save.v2', JSON.stringify({ level: 9, tutorialDone: true }));
    const save = loadSave(econ, s);
    expect(save.daily.streak).toBe(0);
    expect(save.shells).toEqual([]);
    expect(save.level).toBe(9);
  });
  it('falls back on corrupt JSON', () => {
    const s = memoryStore();
    s.setItem('strata.save.v2', '{not json');
    expect(loadSave(econ, s).level).toBe(1);
  });
  it('tolerates missing or throwing storage', () => {
    const bad: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSave(econ, null).level).toBe(1);
    expect(loadSave(econ, bad).level).toBe(1);
    expect(() => writeSave(freshSave(econ), bad)).not.toThrow();
  });
});
