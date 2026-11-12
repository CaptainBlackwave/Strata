// Story: production/sprints/sprint-10.md F3 (volume sliders, D66): the save fields and their repair.
import { describe, expect, it } from 'vitest';
import html from '../../../index.html?raw';
import config from '../../../src/config/game-config.json';
import type { EconomyConfig } from '../../../src/core/economy';
import { DEFAULT_VOLUME, type KeyValueStore, exportSave, freshSave, importSave, loadSave, volumeOf, writeSave } from '../../../src/ui/storage';

const econ = config as unknown as EconomyConfig;
const KEY = 'strata.save.v2';

function memoryStore(init: Record<string, string> = {}): KeyValueStore {
  const data = { ...init };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

/** A save from before sprint 10: settings without the two volume fields. */
const OLD_SETTINGS = { sound: false, music: true, haptics: true, patterns: true, southern: false };

const loadWith = (settings: Record<string, unknown>) => loadSave(econ, memoryStore({ [KEY]: JSON.stringify({ level: 4, settings }) })).settings;

describe('Sound and music volume settings (D66)', () => {
  it('the default is 0.8 (D66)', () => {
    expect(DEFAULT_VOLUME).toBe(0.8);
  });
  it('a fresh save has both volumes at the default', () => {
    const s = freshSave(econ).settings;
    expect(s.soundVolume).toBe(DEFAULT_VOLUME);
    expect(s.musicVolume).toBe(DEFAULT_VOLUME);
  });
  it('an older save without the fields gets the defaults and keeps every other setting', () => {
    expect(loadWith(OLD_SETTINGS)).toEqual({ ...OLD_SETTINGS, soundVolume: DEFAULT_VOLUME, musicVolume: DEFAULT_VOLUME, realistic: true }); // and Realistic sand on (D165)
  });
  it('a v1 save (migrated) gets the defaults', () => {
    const save = loadSave(econ, memoryStore({ 'strata.progress.v1': JSON.stringify({ level: 3, best: {} }) }));
    expect(save.settings.soundVolume).toBe(DEFAULT_VOLUME);
    expect(save.settings.musicVolume).toBe(DEFAULT_VOLUME);
  });
  it('keeps a valid value, including the ends', () => {
    expect(loadWith({ ...OLD_SETTINGS, soundVolume: 0.35, musicVolume: 0 })).toMatchObject({ soundVolume: 0.35, musicVolume: 0 });
    expect(loadWith({ ...OLD_SETTINGS, soundVolume: 1, musicVolume: 1 })).toMatchObject({ soundVolume: 1, musicVolume: 1 });
  });
  it('clamps an out-of-range number to 0..1', () => {
    expect(loadWith({ ...OLD_SETTINGS, soundVolume: 1.7, musicVolume: -0.2 })).toMatchObject({ soundVolume: 1, musicVolume: 0 });
  });
  it('repairs a missing or invalid value to the default, field by field', () => {
    for (const bad of ['0.5', null, true, [], {}, Number.NaN]) {
      const s = loadSave(econ, memoryStore({ [KEY]: `{"level":4,"settings":{"soundVolume":${JSON.stringify(bad) ?? 'null'},"musicVolume":0.4}}` })).settings;
      expect(s.soundVolume, JSON.stringify(bad)).toBe(DEFAULT_VOLUME);
      expect(s.musicVolume).toBe(0.4);
    }
  });
  it('volumeOf treats Infinity and NaN as invalid', () => {
    expect(volumeOf(Number.POSITIVE_INFINITY)).toBe(DEFAULT_VOLUME);
    expect(volumeOf(Number.NaN)).toBe(DEFAULT_VOLUME);
    expect(volumeOf(undefined)).toBe(DEFAULT_VOLUME);
    expect(volumeOf(0.25)).toBe(0.25);
  });
  it('survives a write and reload, and a save code', () => {
    const store = memoryStore();
    const save = freshSave(econ);
    save.settings.soundVolume = 0.45;
    save.settings.musicVolume = 0.1;
    writeSave(save, store);
    expect(loadSave(econ, store).settings).toMatchObject({ soundVolume: 0.45, musicVolume: 0.1 });
    expect(importSave(exportSave(save), econ)?.settings).toMatchObject({ soundVolume: 0.45, musicVolume: 0.1 });
  });
});

describe('Settings sliders in index.html (D66)', () => {
  for (const [id, key] of [
    ['set-sound-volume', 'soundVolume'],
    ['set-music-volume', 'musicVolume'],
  ] as const) {
    it(`${id} is a 0-100 range in steps of 5, labelled by its own visible text`, () => {
      const label = html.match(new RegExp(`<label class="volume"[^>]*>(?:(?!</label>).)*id="${id}"(?:(?!</label>).)*</label>`, 's'))?.[0] ?? '';
      expect(label, `a <label class="volume"> wraps #${id}`).not.toBe('');
      expect(label).toContain(`data-s="${key}"`);
      const input = label.match(/<input[^>]*>/)?.[0] ?? '';
      for (const attr of ['type="range"', 'min="0"', 'max="100"', 'step="5"']) expect(input, attr).toContain(attr);
    });
  }
});
