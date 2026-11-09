// Design: design/gdd/weekly-set.md §3.10 (the save field and its repair), §3.6 (a new week resets). Sprint 11 W2, D77.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { EconomyConfig } from '../../../src/core/economy';
import { type KeyValueStore, exportSave, freshSave, importSave, loadSave } from '../../../src/ui/storage';

const econ = config as unknown as EconomyConfig;
const KEY = 'strata.save.v2';

function memoryStore(init: Record<string, string> = {}): KeyValueStore {
  const data = { ...init };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}
const load = (raw: object) => loadSave(econ, memoryStore({ [KEY]: JSON.stringify(raw) }));
/** A save from before the weekly set: no `weekly`. */
const OLD_SAVE = { level: 12, best: {}, wallet: { coins: 300, boosters: {} }, tutorialDone: true, badges: ['first-seal'] };

describe('the weekly field in the save', () => {
  it('a fresh save, and an older save without the field, start with an empty set', () => {
    expect(freshSave(econ).weekly).toEqual({ week: '', cleared: [], pours: {} });
    expect(load(OLD_SAVE).weekly).toEqual({ week: '', cleared: [], pours: {} });
  });
  it('a valid field loads as saved', () => {
    const weekly = { week: '2026-W46', cleared: [0, 3], pours: { '0': 21, '3': 40 } };
    expect(load({ ...OLD_SAVE, weekly }).weekly).toEqual(weekly);
  });
  it('is repaired field by field', () => {
    const s = load({ ...OLD_SAVE, weekly: { week: '2026-W46', cleared: [4, 4, 7, 'x', 1], pours: { '1': 18, '4': -2, '2': 9 } } });
    expect(s.weekly).toEqual({ week: '2026-W46', cleared: [1, 4], pours: { '1': 18 } });
    expect(load({ ...OLD_SAVE, weekly: { week: 'soon', cleared: [0], pours: { '0': 5 } } }).weekly).toEqual({ week: '', cleared: [], pours: {} });
    expect(load({ ...OLD_SAVE, weekly: 'W46' }).weekly).toEqual({ week: '', cleared: [], pours: {} });
    expect(load({ ...OLD_SAVE, weekly: { week: '2026-W46', cleared: [0], pours: { '0': 5 } } }).badges).toEqual(['first-seal']); // other fields untouched
  });
  it('a save code carries it, and importSave repairs it like a load', () => {
    const s = freshSave(econ);
    s.weekly = { week: '2026-W53', cleared: [0, 1, 2, 3, 4], pours: { '0': 20, '1': 22, '2': 30, '3': 33, '4': 41 } };
    expect(importSave(exportSave(s), econ)?.weekly).toEqual(s.weekly);
    const bad = { ...s, weekly: { ...s.weekly, cleared: [9] } };
    expect(importSave(exportSave(bad), econ)?.weekly).toEqual({ week: '2026-W53', cleared: [], pours: {} });
  });
});
