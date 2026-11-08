// Story: production/sprints/sprint-8.md (P6), TD-6 (docs/tech-debt.md): loadSave and importSave on hostile input.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { EconomyConfig } from '../../../src/core/economy';
import { type KeyValueStore, exportSave, freshSave, importSave, loadSave } from '../../../src/ui/storage';

const econ = config as unknown as EconomyConfig;
const KEY = 'strata.save.v2';

function load(patch: Record<string, unknown>) {
  const data: Record<string, string> = { [KEY]: JSON.stringify({ ...freshSave(econ), ...patch }) };
  const store: KeyValueStore = { getItem: (k) => data[k] ?? null, setItem: () => undefined };
  return loadSave(econ, store);
}

describe('best (TD-6)', () => {
  it('keeps only positive-integer level keys with non-negative integer values', () => {
    const save = load({ best: { '1': 5, '12': 0, '0': 3, '-4': 2, abc: 1, '2.5': 2, '3': 'x', '4': -1, '5': 1.5, '6': null, '7': NaN } });
    expect(save.best).toEqual({ '1': 5, '12': 0 });
  });

  it('an array or non-object best becomes empty', () => {
    expect(load({ best: [1, 2, 3] }).best).toEqual({});
    expect(load({ best: 'oops' }).best).toEqual({});
  });

  it('the v1 migration sanitises best too', () => {
    const data: Record<string, string> = { 'strata.progress.v1': JSON.stringify({ level: 4, best: { '1': '9', '2': 3, x: 1 } }) };
    const save = loadSave(econ, { getItem: (k) => data[k] ?? null, setItem: () => undefined });
    expect(save.best).toEqual({ '2': 3 });
  });
});

describe('level (TD-6)', () => {
  it.each([[1e308], [Number.MAX_SAFE_INTEGER], [0], [-3], [2.5], ['7'], [null]])('rejects %s and falls back to level 1', (bad) => {
    expect(load({ level: bad }).level).toBe(1);
  });

  it('keeps an ordinary level', () => {
    expect(load({ level: 480 }).level).toBe(480);
  });
});

describe('importSave size cap (TD-6)', () => {
  it('rejects a code over 256 KB', () => {
    const padded = btoa(JSON.stringify({ ...freshSave(econ), junk: 'x'.repeat(256 * 1024) }));
    expect(padded.length).toBeGreaterThan(256 * 1024);
    expect(importSave(`STRATA1:${padded}`, econ)).toBeNull();
  });

  it('still accepts a normal code, and repairs field by field', () => {
    const code = exportSave({ ...freshSave(econ), level: 12, best: { '3': 4 } });
    expect(importSave(code, econ)?.best).toEqual({ '3': 4 });
  });

  it('a hostile best in an imported code is repaired', () => {
    const json = JSON.stringify({ ...freshSave(econ), level: 1e308, best: { '1': 'x', '2': 2 } });
    const imported = importSave(`STRATA1:${btoa(json)}`, econ)!;
    expect(imported.level).toBe(1);
    expect(imported.best).toEqual({ '2': 2 });
  });
});
