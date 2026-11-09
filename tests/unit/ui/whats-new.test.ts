// The "What's new" changelog and its save field (production/sprints/sprint-8.md P5, D46, D52).
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { EconomyConfig } from '../../../src/core/economy';
import { type KeyValueStore, exportSave, freshSave, importSave, loadSave, whatsNewDue, writeSave } from '../../../src/ui/storage';
import { WHATS_NEW_VERSION, t } from '../../../src/ui/strings';
import { whatsNewReleases } from '../../../src/ui/logic/whats-new';

const econ = config as unknown as EconomyConfig;
const KEY = 'strata.save.v2';

function memoryStore(entries: Record<string, unknown> = {}): KeyValueStore {
  const data = new Map(Object.entries(entries).map(([k, v]) => [k, JSON.stringify(v)]));
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

/** A save written before this update: every current field except `seenWhatsNew`. */
function oldSave(): Record<string, unknown> {
  const { seenWhatsNew: _drop, ...rest } = { ...freshSave(econ), level: 40, tutorialDone: true };
  return rest;
}

describe("What's new content", () => {
  const releases = t.whatsNew.releases;
  /** "0.10.1" -> [0, 10, 1], for comparing versions by number rather than as text. */
  const parts = (v: string) => v.split('.').map(Number);
  const newer = (a: string, b: string) => {
    const [x, y] = [parts(a), parts(b)];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
    return false;
  };

  it('opens with a posting for the current version', () => {
    expect(t.whatsNew.version).toBe(WHATS_NEW_VERSION);
    expect(releases[0].version).toBe(WHATS_NEW_VERSION);
  });
  it('gives every posting 3 to 5 lines and a name', () => {
    for (const r of releases) {
      expect(r.lines.length, r.version).toBeGreaterThanOrEqual(3);
      expect(r.lines.length, r.version).toBeLessThanOrEqual(5);
      expect(r.name.length, r.version).toBeGreaterThan(0);
    }
  });
  it('lists each version once, newest first', () => {
    for (const r of releases) expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(new Set(releases.map((r) => r.version)).size).toBe(releases.length);
    for (let i = 1; i < releases.length; i++) expect(newer(releases[i - 1].version, releases[i].version), releases[i].version).toBe(true);
  });
  it('keeps every posting back to the first card in 0.8.0', () => {
    expect(releases.map((r) => r.version)).toEqual(expect.arrayContaining(['0.8.0', '0.9.0', '0.9.1', '0.10.0', '0.10.1', '0.11.0']));
  });
});

describe('whatsNewReleases', () => {
  it('shows the whole changelog from Settings', () => {
    expect(whatsNewReleases(t.whatsNew.releases, true)).toEqual(t.whatsNew.releases);
  });
  it('shows only the newest posting on the card after an update', () => {
    expect(whatsNewReleases(t.whatsNew.releases, false)).toEqual([t.whatsNew.releases[0]]);
  });
  it('shows nothing when there are no postings', () => {
    expect(whatsNewReleases([], true)).toEqual([]);
    expect(whatsNewReleases([], false)).toEqual([]);
  });
});

describe('seenWhatsNew', () => {
  it('a first install stores the current version, so the card never shows', () => {
    const save = loadSave(econ, memoryStore());
    expect(save.seenWhatsNew).toBe(WHATS_NEW_VERSION);
    expect(whatsNewDue(save)).toBe(false);
  });

  it('a save from before the update has no value, so the card is due once', () => {
    const store = memoryStore({ [KEY]: oldSave() });
    const save = loadSave(econ, store);
    expect(save.seenWhatsNew).toBe('');
    expect(whatsNewDue(save)).toBe(true);
    save.seenWhatsNew = WHATS_NEW_VERSION; // what main.ts does when the card shows
    writeSave(save, store);
    expect(whatsNewDue(loadSave(econ, store))).toBe(false);
  });

  it('a save that saw an older version is due again', () => {
    const save = loadSave(econ, memoryStore({ [KEY]: { ...oldSave(), seenWhatsNew: '0.7.0' } }));
    expect(save.seenWhatsNew).toBe('0.7.0');
    expect(whatsNewDue(save)).toBe(true);
  });

  it('repairs a non-string value to empty', () => {
    expect(loadSave(econ, memoryStore({ [KEY]: { ...oldSave(), seenWhatsNew: 8 } })).seenWhatsNew).toBe('');
  });

  it('a migrated v1 player is updating, so the card is due', () => {
    const save = loadSave(econ, memoryStore({ 'strata.progress.v1': { level: 9, best: {} } }));
    expect(whatsNewDue(save)).toBe(true);
  });

  it('survives a save code, and an old code without it is due', () => {
    const seen = { ...freshSave(econ), seenWhatsNew: WHATS_NEW_VERSION };
    expect(importSave(exportSave(seen), econ)!.seenWhatsNew).toBe(WHATS_NEW_VERSION);
    const old = oldSave() as unknown as Parameters<typeof exportSave>[0];
    expect(importSave(exportSave(old), econ)!.seenWhatsNew).toBe('');
  });
});
