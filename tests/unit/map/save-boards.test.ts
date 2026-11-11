// Story: owner decision D110 (design/gdd/systems-index.md), design/gdd/save-data.md.
// When a release changes the boards behind level numbers, best pours for those levels are
// cleared once; progress, Perfect marks and everything else are kept.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { EconomyConfig } from '../../../src/core/economy';
import { type KeyValueStore, exportSave, freshSave, importSave, loadSave } from '../../../src/ui/storage';

const econ = config as unknown as EconomyConfig;
const KEY = 'strata.save.v2';
const changes = (config as unknown as { boardChanges: { version: number; fromLevel: number }[] }).boardChanges;
const LATEST = Math.max(...changes.map((c) => c.version));
const FROM = Math.min(...changes.map((c) => c.fromLevel));

const loadRaw = (raw: object) => {
  const data: Record<string, string> = { [KEY]: JSON.stringify(raw) };
  const store: KeyValueStore = { getItem: (k) => data[k] ?? null, setItem: () => undefined };
  return loadSave(econ, store);
};
/** A save from before the gentler curve: no `boards` field. */
const OLD = { level: 40, best: { '3': 12, [String(FROM - 1)]: 20, [String(FROM)]: 30, '39': 51 }, perfect: [3, FROM, 39], wallet: { coins: 500, boosters: {} }, tutorialDone: true, stats: { perfectClears: 3 }, shells: ['periwinkle'] };

describe('save.boards (D110)', () => {
  it('the config records the gentler curve as a board change from level 12', () => {
    expect(changes).toContainEqual({ version: 2, fromLevel: 12 });
  });
  it('0.14.1 records the gentle climb as a board change from level 30 (D133)', () => {
    expect(changes).toContainEqual({ version: 3, fromLevel: 30 });
    expect(LATEST).toBe(3);
  });
  it('a 0.13.1 save (boards 2) keeps best pours below level 30 and loses them from 30, once', () => {
    const save = loadRaw({ ...OLD, boards: 2, best: { '12': 30, '29': 33, '30': 40, '120': 55 } });
    expect(save.best).toEqual({ '12': 30, '29': 33 });
    expect(save.boards).toBe(3);
    expect(save).toMatchObject({ level: 40, perfect: [3, FROM, 39] });
  });
  it('a fresh save is on the latest boards', () => {
    expect(freshSave(econ).boards).toBe(LATEST);
  });
  it('an older save loses best pours for changed levels only, once', () => {
    const save = loadRaw(OLD);
    expect(save.best).toEqual({ '3': 12, [String(FROM - 1)]: 20 });
    expect(save.boards).toBe(LATEST);
  });
  it('keeps the level, Perfect marks, the Perfect stat, coins and shells', () => {
    const save = loadRaw(OLD);
    expect(save).toMatchObject({ level: 40, perfect: [3, FROM, 39], shells: ['periwinkle'] });
    expect(save.stats.perfectClears).toBe(3);
    expect(save.wallet.coins).toBe(500);
  });
  it('a save already on the latest boards keeps every best', () => {
    expect(loadRaw({ ...OLD, boards: LATEST }).best).toEqual(OLD.best);
  });
  it('an invalid boards value counts as an older save', () => {
    for (const boards of ['2', -1, 1.5, null]) expect(loadRaw({ ...OLD, boards }).best, String(boards)).toEqual({ '3': 12, [String(FROM - 1)]: 20 });
  });
  it('a save code from before the change is migrated on import, and round-trips after', () => {
    const code = exportSave({ ...freshSave(econ), ...OLD, boards: undefined } as never);
    const imported = importSave(code, econ)!;
    expect(imported.best).toEqual({ '3': 12, [String(FROM - 1)]: 20 });
    expect(importSave(exportSave({ ...imported, best: { ...imported.best, '39': 44 } }), econ)!.best['39']).toBe(44);
  });
  it('the v1 migration clears them too', () => {
    const data: Record<string, string> = { 'strata.progress.v1': JSON.stringify({ level: 30, best: { '2': 3, '25': 40 } }) };
    const save = loadSave(econ, { getItem: (k) => data[k] ?? null, setItem: () => undefined });
    expect(save.best).toEqual({ '2': 3 });
    expect(save.boards).toBe(LATEST);
  });
});
