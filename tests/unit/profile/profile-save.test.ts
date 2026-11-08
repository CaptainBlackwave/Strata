// Design: design/gdd/player-profile.md §3.8 (save fields and repair), §8 (Logic)
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type CollectionConfig, allShells, knownShells, setProgress } from '../../../src/core/collection';
import type { EconomyConfig } from '../../../src/core/economy';
import { type ProfileConfig, emptyStats, isUnlocked, isValidName, progressOf, repairProfile } from '../../../src/core/profile';
import { type KeyValueStore, exportSave, freshSave, importSave, loadSave, writeSave } from '../../../src/ui/storage';

const econ = config as unknown as EconomyConfig;
const cfg = config as unknown as ProfileConfig;
const KEY = 'strata.save.v2';

function memoryStore(init: Record<string, string> = {}): KeyValueStore {
  const data = { ...init };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

/** A save from before the profile update: no `profile`, no `stats`. */
const OLD_SAVE = { level: 30, best: {}, wallet: { coins: 120, boosters: {} }, tutorialDone: true, daily: { last: null, streak: 0, best: 9, passes: 0 }, shells: ['a'] };

describe('profile in the save', () => {
  it('an old save loads with an empty profile and every counter at 0', () => {
    const save = loadSave(econ, memoryStore({ [KEY]: JSON.stringify(OLD_SAVE) }));
    expect(save.profile).toEqual({ name: '', avatar: '', frame: '', plate: '' });
    expect(save.stats).toEqual(emptyStats());
  });
  it('repairing an old save gives a valid name and the defaults, keeping earned unlocks open', () => {
    const save = loadSave(econ, memoryStore({ [KEY]: JSON.stringify(OLD_SAVE) }));
    const progress = progressOf({ level: save.level, bestStreak: save.daily.best, shellsOwned: save.shells.length, setsCompleted: 0, stats: save.stats });
    const profile = repairProfile(save.profile, cfg, progress, () => 'Sunny Bay 21');
    expect(isValidName(profile.name, cfg)).toBe(true);
    expect(profile).toEqual({ name: 'Sunny Bay 21', avatar: 'sand-jar', frame: 'sand', plate: 'cream' });
    // Level 30 means 29 cleared: the Lighthouse (25) is open to an existing player at once.
    expect(repairProfile({ ...profile, avatar: 'lighthouse' }, cfg, progress, () => 'x').avatar).toBe('lighthouse');
  });
  it('repairs bad counters to 0 and keeps good ones', () => {
    const raw = { ...OLD_SAVE, stats: { perfectClears: 4, dailiesSolved: -1, pours: 'many', coinsEarned: 2.5, boostersUsed: 7 } };
    const save = loadSave(econ, memoryStore({ [KEY]: JSON.stringify(raw) }));
    expect(save.stats).toEqual({ perfectClears: 4, dailiesSolved: 0, pours: 0, coinsEarned: 0, boostersUsed: 7 });
  });
  it('ignores non-string profile fields', () => {
    const raw = { ...OLD_SAVE, profile: { name: 42, avatar: 'beach-hut', frame: null, plate: ['x'] } };
    expect(loadSave(econ, memoryStore({ [KEY]: JSON.stringify(raw) })).profile).toEqual({ name: '', avatar: 'beach-hut', frame: '', plate: '' });
  });
  it('round-trips through writeSave/loadSave and a save code', () => {
    const save = { ...freshSave(econ), level: 12, profile: { name: 'Zoë', avatar: 'sailboat', frame: 'rope', plate: 'sea-glass' }, stats: { ...emptyStats(), pours: 310, perfectClears: 3 } };
    const s = memoryStore();
    writeSave(save, s);
    expect(loadSave(econ, s)).toEqual(save);
    expect(importSave(exportSave(save), econ)).toEqual(save);
  });
});

describe('daily share record (GA-DP-6)', () => {
  it('defaults to null, keeps a valid record and drops a broken one', () => {
    expect(loadSave(econ, memoryStore({ [KEY]: JSON.stringify(OLD_SAVE) })).dailyShare).toBeNull();
    const ok = { ...OLD_SAVE, dailyShare: { date: '2026-11-08', pours: 31 } };
    expect(loadSave(econ, memoryStore({ [KEY]: JSON.stringify(ok) })).dailyShare).toEqual({ date: '2026-11-08', pours: 31 });
    for (const bad of [{ date: 'yesterday', pours: 31 }, { date: '2026-11-08', pours: -2 }, 'x']) {
      const raw = { ...OLD_SAVE, dailyShare: bad };
      expect(loadSave(econ, memoryStore({ [KEY]: JSON.stringify(raw) })).dailyShare, JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('unknown shell ids in a save (D26, GX-15 / GB-SC-2)', () => {
  // production/sprints/sprint-7.md B1. main.ts runs knownShells right after loadSave and importSave.
  const col = config as unknown as CollectionConfig;
  const real = allShells(col).map((s) => s.id);
  const UNKNOWN = ['retired-1', 'retired-2', 'retired-3'];
  // 40 ids: 37 real ones (not in catalog order) with 3 unknown ones mixed in.
  const earned = [...real.slice(0, 37)].reverse();
  const held = [...earned.slice(0, 10), UNKNOWN[0], ...earned.slice(10, 20), UNKNOWN[1], ...earned.slice(20), UNKNOWN[2]];
  const gold = cfg.profile.frames.find((f) => f.id === 'gold')!;
  const progressFor = (shells: string[]) =>
    progressOf({ level: 30, bestStreak: 0, shellsOwned: shells.length, setsCompleted: setProgress(shells, col).filter((p) => p.complete).length, stats: emptyStats() });

  it('the fixture really is 40 ids with 3 unknown, and Gold needs 40 shells', () => {
    expect(held).toHaveLength(40);
    expect(held.filter((id) => !real.includes(id))).toEqual(UNKNOWN);
    expect(gold.unlock).toEqual({ kind: 'shells', count: 40 });
  });
  for (const [path, load] of [
    ['loadSave', () => loadSave(econ, memoryStore({ [KEY]: JSON.stringify({ ...OLD_SAVE, shells: held }) }))],
    ['importSave', () => importSave(exportSave({ ...freshSave(econ), shells: held }), econ)!],
  ] as const) {
    it(`after ${path}, keeps the 37 real shells in earned order and the Gold frame stays locked`, () => {
      const shells = knownShells(load().shells, col);
      expect(shells).toEqual(earned);
      const progress = progressFor(shells);
      expect(progress.shells).toBe(37);
      expect(isUnlocked(gold, progress)).toBe(false);
    });
  }
});
