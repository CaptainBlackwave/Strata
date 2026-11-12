// Stories: production/epics/strata/story-005-touch-ui.md, story-006-progress-save.md,
// production/epics/competitive/story-002-economy-boosters.md
import { describe, expect, it } from 'vitest';
import { HIT_SNAP_MARGIN, MIN_HIT, computeLayout } from '../../../src/ui/layout';
import config from '../../../src/config/game-config.json';
import { type EconomyConfig, newWallet } from '../../../src/core/economy';
import { type KeyValueStore, exportSave, freshSave, importSave, loadSave, writeSave } from '../../../src/ui/storage';

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
  // D45 / AX-19: the iPhone SE board (288 x 348 at 150% text) with 9 tall jars draws 34 px jars.
  it('widens the gap so a narrow drawn jar plus its gap reaches the 44 px tap target', () => {
    const input = { width: 288, height: 348, jars: 9, capacity: 8 };
    const l = computeLayout(input);
    expect(l.jarWidth).toBeLessThan(MIN_HIT);
    expect(l.jarWidth + l.gapX).toBeGreaterThanOrEqual(MIN_HIT + HIT_SNAP_MARGIN);
    expect(l.cols * l.jarWidth + (l.cols + 1) * l.gapX).toBeLessThanOrEqual(input.width);
  });
  it('never shrinks the drawn jar to make room for the wider gap', () => {
    const before = computeLayout({ width: 288, height: 348, jars: 9, capacity: 8 }).jarWidth;
    // Same height limit, more width: the jar size is set by height, so it must match.
    expect(computeLayout({ width: 340, height: 348, jars: 9, capacity: 8 }).jarWidth).toBe(before);
  });
  it('keeps the normal gap when the jars are already wide enough', () => {
    const l = computeLayout({ width: 390, height: 600, jars: 5, capacity: 4 });
    expect(l.jarWidth).toBeGreaterThanOrEqual(MIN_HIT);
    expect(l.gapX).toBe(Math.max(6, Math.min(18, 390 * 0.025)));
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
    save.settings = { sound: false, music: true, haptics: false, patterns: true, southern: true, soundVolume: 0.35, musicVolume: 0.6, realistic: true };
    save.daily = { last: '2026-11-08', streak: 3, best: 9, passes: 1 };
    save.shells = ['periwinkle', 'limpet'];
    save.seenMechanics = ['narrow'];
    save.themes = { owned: ['midday', 'dawn'], selected: 'dawn', auto: true };
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
    s.setItem('strata.progress.v1', JSON.stringify({ level: 15, best: { '9': 20, '14': 20 } }));
    s.setItem('strata.prefs.v1', JSON.stringify({ patterns: true }));
    const save = loadSave(econ, s);
    expect(save).toMatchObject({ level: 15, best: { '9': 20 }, tutorialDone: true, settings: { patterns: true } });
    expect(save.best['14'], 'best pours of a changed board are dropped (D110)').toBeUndefined();
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
    expect(save.seenMechanics).toEqual([]);
    expect(save.themes).toEqual({ owned: ['midday'], selected: 'midday', auto: false });
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

describe('save code export/import (D16)', () => {
  // design/gdd/save-data.md: "Copy save code" / "Restore from code", no server.
  const sample = () => {
    const save = { ...freshSave(econ), level: 42, tutorialDone: true, shells: ['periwinkle', 'limpet'] };
    save.wallet = { coins: 777, boosters: { undo: 2, shuffle: 1, extraJar: 0, hint: 4 } };
    save.themes = { owned: ['midday', 'sunset'], selected: 'sunset', auto: false };
    save.daily = { last: '2026-11-08', streak: 5, best: 9, passes: 1 };
    return save;
  };
  it('round-trips a save through a text code', () => {
    const code = exportSave(sample());
    expect(code.startsWith('STRATA1:')).toBe(true);
    expect(importSave(code, econ)).toEqual(sample());
  });
  it('tolerates spaces and line breaks around and inside the code', () => {
    const code = exportSave(sample());
    const messy = `  ${code.slice(0, 20)}\n${code.slice(20)}  `;
    expect(importSave(messy, econ)).toEqual(sample());
  });
  it('rejects codes that are not Strata save codes', () => {
    expect(importSave('', econ)).toBeNull();
    expect(importSave('hello', econ)).toBeNull();
    expect(importSave('STRATA1:%%%not-base64%%%', econ)).toBeNull();
    expect(importSave('STRATA1:' + btoa('not json'), econ)).toBeNull();
    expect(importSave('STRATA9:' + exportSave(sample()).slice(8), econ)).toBeNull();
  });
  it('repairs bad values inside a code like a normal load does', () => {
    const code = 'STRATA1:' + btoa(JSON.stringify({ level: -4, wallet: { coins: -50 } }));
    const save = importSave(code, econ)!;
    expect(save.level).toBe(1);
    expect(save.wallet.coins).toBe(econ.economy.startCoins);
  });
});

describe('collection-complete message (D38)', () => {
  it('shows no coin amount once the bonus is 0, and the amount if one is configured', async () => {
    const { t } = await import('../../../src/ui/strings');
    const cfg = (await import('../../../src/config/game-config.json')).default as { collection: { coinsWhenComplete: number } };
    expect(cfg.collection.coinsWhenComplete).toBe(0);
    expect(t.allShellsBonus(0)).toBe('Collection complete ✓');
    expect(t.allShellsBonus(50)).toBe('Collection complete: +50 coins');
  });
});
