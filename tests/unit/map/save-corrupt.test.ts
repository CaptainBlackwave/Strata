// Story: bug sweep, strata-wry; design/gdd/save-data.md (corrupt JSON gives a fresh save).
// The old v1 keys are read only when there is no v2 save at all. A corrupt or null v2 save must not
// bring back the v1 progress a phone may still hold from before the v2 format.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { EconomyConfig } from '../../../src/core/economy';
import { type KeyValueStore, loadSave } from '../../../src/ui/storage';

const econ = config as unknown as EconomyConfig;
const V1 = { 'strata.progress.v1': JSON.stringify({ level: 8, best: { 3: 5 } }) };
const store = (data: Record<string, string>): KeyValueStore => ({ getItem: (k) => data[k] ?? null, setItem: () => undefined });

describe('a corrupt v2 save next to old v1 keys (strata-wry)', () => {
  for (const [name, v2] of [['truncated JSON', '{"level": 45, '], ['null', 'null'], ['a number', '7'], ['an array', '[1,2]']] as const) {
    it(`${name}: a fresh save, not the v1 progress`, () => {
      const save = loadSave(econ, store({ ...V1, 'strata.save.v2': v2 }));
      expect(save.level).toBe(1);
      expect(save.best).toEqual({});
      expect(save.tutorialDone).toBe(false);
    });
  }
  it('with no v2 save at all, the v1 keys are still migrated', () => {
    const save = loadSave(econ, store(V1));
    expect(save.level).toBe(8);
    expect(save.best).toEqual({ '3': 5 });
    expect(save.tutorialDone).toBe(true);
  });
});
