// Story: production/sprints/sprint-8.md P2 (southern hemisphere seasons, D42): the save field and its repair.
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

/** A save from before sprint 8: settings without the `southern` field. */
const OLD_SETTINGS = { sound: true, music: false, haptics: true, patterns: true };

describe('Southern hemisphere seasons setting', () => {
  it('a fresh save has it off', () => {
    expect(freshSave(econ).settings.southern).toBe(false);
  });
  it('an older save without the field loads with it off and keeps the other settings', () => {
    const save = loadSave(econ, memoryStore({ [KEY]: JSON.stringify({ level: 4, settings: OLD_SETTINGS }) }));
    expect(save.settings).toEqual({ ...OLD_SETTINGS, southern: false, soundVolume: 0.8, musicVolume: 0.8 }); // the sprint 10 volumes (D66) get their defaults too
  });
  it('a value that is not a boolean is repaired to off', () => {
    const save = loadSave(econ, memoryStore({ [KEY]: JSON.stringify({ level: 4, settings: { ...OLD_SETTINGS, southern: 'yes' } }) }));
    expect(save.settings.southern).toBe(false);
  });
  it('turning it on survives a write and reload, and a save code', () => {
    const store = memoryStore();
    const save = freshSave(econ);
    save.settings.southern = true;
    writeSave(save, store);
    expect(loadSave(econ, store).settings.southern).toBe(true);
    expect(importSave(exportSave(save), econ)?.settings.southern).toBe(true);
  });
});
