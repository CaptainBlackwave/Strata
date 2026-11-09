// Design: production/qa/sprint-8/backlog-triage.md UX-cab-4 (sprint 9 M5 follow-up): the "New" shell mark survives a reload.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { EconomyConfig } from '../../../src/core/economy';
import { type KeyValueStore, exportSave, freshSave, importSave, loadSave } from '../../../src/ui/storage';

const econ = config as unknown as EconomyConfig;
const KEY = 'strata.save.v2';
const store = (raw: unknown): KeyValueStore => {
  const data: Record<string, string> = { [KEY]: JSON.stringify(raw) };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};
const BASE = { level: 30, best: {}, wallet: { coins: 0, boosters: {} }, tutorialDone: true, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: ['a', 'b', 'c'] };

describe('seenShells in the save', () => {
  it('a fresh save has seen no shells', () => {
    expect(freshSave(econ).seenShells).toBe(0);
  });
  it('an older save without the field counts every owned shell as seen, so nothing old shows "New"', () => {
    expect(loadSave(econ, store(BASE)).seenShells).toBe(3);
  });
  it('keeps a valid count and clamps one above the shells owned', () => {
    expect(loadSave(econ, store({ ...BASE, seenShells: 2 })).seenShells).toBe(2);
    expect(loadSave(econ, store({ ...BASE, seenShells: 9 })).seenShells).toBe(3);
  });
  it('repairs a broken count to "all seen"', () => {
    for (const bad of [-1, 1.5, '2', null]) expect(loadSave(econ, store({ ...BASE, seenShells: bad })).seenShells, String(bad)).toBe(3);
  });
  it('survives a save code', () => {
    const save = { ...freshSave(econ), shells: ['a', 'b'], seenShells: 1 };
    expect(importSave(exportSave(save), econ)?.seenShells).toBe(1);
  });
});

describe('the default scene comes from config (TD-3)', () => {
  const def = (config as unknown as { themes: { default: string } }).themes.default;
  it('a fresh save owns and selects themes.default', () => {
    expect(freshSave(econ).themes).toEqual({ owned: [def], selected: def, auto: false });
  });
  it('a loaded save always owns it, and falls back to it when nothing is selected', () => {
    const t = loadSave(econ, store({ ...BASE, themes: { owned: ['dawn'] } })).themes;
    expect(t.owned).toEqual([def, 'dawn']);
    expect(t.selected).toBe(def);
  });
});
