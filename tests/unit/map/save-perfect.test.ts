// Story: production/sprints/sprint-9.md M3; design/gdd/level-map.md §2.2 (save gains `perfect`), save-data.md (repair field by field).
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { EconomyConfig } from '../../../src/core/economy';
import { type KeyValueStore, exportSave, freshSave, importSave, loadSave, writeSave } from '../../../src/ui/storage';

const econ = config as unknown as EconomyConfig;
const KEY = 'strata.save.v2';

function memoryStore(init: Record<string, string> = {}): KeyValueStore {
  const data = { ...init };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}
const loadRaw = (raw: object) => loadSave(econ, memoryStore({ [KEY]: JSON.stringify(raw) }));

/** A save from before M3: no `perfect` field, a Perfect stat already counted. */
const OLD_SAVE = { level: 30, best: { '3': 12 }, wallet: { coins: 120, boosters: {} }, tutorialDone: true, stats: { perfectClears: 6 } };

describe('save.perfect (D52)', () => {
  it('a fresh save starts with no Perfect marks', () => {
    expect(freshSave(econ).perfect).toEqual([]);
  });
  it('an old save loads it as [] and keeps its Perfect stat', () => {
    const save = loadRaw(OLD_SAVE);
    expect(save.perfect).toEqual([]);
    expect(save.stats.perfectClears).toBe(6);
  });
  it('keeps only positive integer levels, each once, sorted', () => {
    expect(loadRaw({ ...OLD_SAVE, perfect: [9, 3, 3, 0, -1, 2.5, '4', null, 7, 1, 1_000_001] }).perfect).toEqual([1, 3, 7, 9]);
  });
  it('a non-array is repaired to [] without touching the other fields', () => {
    for (const bad of ['3,4', { 3: true }, 5, null]) {
      const save = loadRaw({ ...OLD_SAVE, perfect: bad });
      expect(save.perfect).toEqual([]);
      expect(save.level).toBe(30);
      expect(save.best).toEqual({ '3': 12 });
    }
  });
  it('survives write and load', () => {
    const store = memoryStore();
    writeSave({ ...freshSave(econ), level: 12, perfect: [2, 5, 11] }, store);
    expect(loadSave(econ, store).perfect).toEqual([2, 5, 11]);
  });
  it('survives export and import (save code, D16), repaired like a load', () => {
    const code = exportSave({ ...freshSave(econ), level: 40, perfect: [4, 8, 39] });
    expect(importSave(code, econ)?.perfect).toEqual([4, 8, 39]);
    const bad = exportSave({ ...freshSave(econ), perfect: [8, 8, -2] as number[] });
    expect(importSave(bad, econ)?.perfect).toEqual([8]);
  });
});
