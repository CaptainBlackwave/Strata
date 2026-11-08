// Design: design/gdd/player-profile.md (PP-1 to PP-10), acceptance criteria §8 (Logic)
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import {
  type Cosmetic,
  type Progress,
  type ProfileConfig,
  SLOTS,
  UNLOCK_KINDS,
  bumpStats,
  catalog,
  defaultId,
  emptyStats,
  generateName,
  isUnlocked,
  isValidName,
  newlyUnlocked,
  normaliseName,
  progressOf,
  repairProfile,
  sameProfile,
  unlockProgress,
} from '../../../src/core/profile';
import { createRng } from '../../../src/core/rng';
import { contrastRatio } from '../../../src/core/themes';
import { t } from '../../../src/ui/strings';

const cfg = config as unknown as ProfileConfig;
const words = t.nameWords;

/** Progress with every value at `n`, overridden per kind. */
const progress = (n = 0, over: Partial<Progress> = {}): Progress => ({ ...Object.fromEntries(UNLOCK_KINDS.map((k) => [k, n])), ...over }) as Progress;
const fresh = progress(0);

describe('catalog', () => {
  it('ships 8 avatars, 6 frames and 6 plates (PP-10)', () => {
    expect(cfg.profile.avatars).toHaveLength(8);
    expect(cfg.profile.frames).toHaveLength(6);
    expect(cfg.profile.plates).toHaveLength(6);
  });
  it.each(SLOTS)('%s ids are unique, the default is a start item, and at least 3 are open from the start', (slot) => {
    const items = catalog(cfg, slot);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(items[0].unlock).toBeNull();
    expect(defaultId(cfg, slot)).toBe(items[0].id);
    expect(items.filter((i) => i.unlock === null).length).toBeGreaterThanOrEqual(3);
  });
  it('every unlock uses a known kind and a positive count', () => {
    for (const slot of SLOTS)
      for (const item of catalog(cfg, slot))
        if (item.unlock) {
          expect(UNLOCK_KINDS).toContain(item.unlock.kind);
          expect(item.unlock.count).toBeGreaterThan(0);
        }
  });
  it('every plate keeps its ink readable (4.5:1) on both of its backgrounds', () => {
    for (const p of cfg.profile.plates) {
      expect(contrastRatio(p.ink, p.bg), p.id).toBeGreaterThanOrEqual(4.5);
      if (p.bg2) expect(contrastRatio(p.ink, p.bg2), p.id).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('matches the agreed milestones (player-profile.md §3.6)', () => {
    const req = (slot: (typeof SLOTS)[number], id: string) => catalog(cfg, slot).find((i) => i.id === id)!.unlock;
    expect(req('avatar', 'lighthouse')).toEqual({ kind: 'levels', count: 25 });
    expect(req('avatar', 'sandcastle')).toEqual({ kind: 'levels', count: 50 });
    expect(req('avatar', 'anchor')).toEqual({ kind: 'sets', count: 1 });
    expect(req('avatar', 'lantern')).toEqual({ kind: 'levels', count: 100 });
    expect(req('frame', 'driftwood')).toEqual({ kind: 'perfectClears', count: 10 });
    expect(req('frame', 'coral')).toEqual({ kind: 'bestStreak', count: 14 });
    expect(req('frame', 'gold')).toEqual({ kind: 'shells', count: 40 });
    expect(req('plate', 'driftwood')).toEqual({ kind: 'levels', count: 75 });
    expect(req('plate', 'wave')).toEqual({ kind: 'dailiesSolved', count: 30 });
    expect(req('plate', 'gold-leaf')).toEqual({ kind: 'sets', count: 4 });
  });
});

describe('names', () => {
  it('normalises spaces', () => {
    expect(normaliseName('  Sea   Gull ')).toBe('Sea Gull');
  });
  it('accepts letters of any script, numbers and single spaces', () => {
    for (const ok of ['Saffron Gull 42', 'Zoë', '日本', 'Ana-Maria', 'Al', 'ABCDEFGHIJKLMNOP']) expect(isValidName(ok, cfg), ok).toBe(true);
  });
  it('rejects empty, too short, too long, emoji and symbols', () => {
    for (const bad of ['', '   ', 'a', 'ABCDEFGHIJKLMNOPQ', '😀😀', 'a_b', 'hi!', '--', 'a--b']) expect(isValidName(bad, cfg), bad).toBe(false);
  });
  it('stores names NFC-normalised, so a decomposed and a precomposed name are the same (D30)', () => {
    // production/sprints/sprint-7.md B1; design/gdd/player-profile.md
    const decomposed = 'Zoe\u0308'; // e + combining diaeresis
    const precomposed = 'Zo\u00eb'; // ë
    expect(normaliseName(decomposed)).toBe(precomposed);
    expect(normaliseName(precomposed)).toBe(precomposed);
    expect(normaliseName(`  ${decomposed}  `)).toBe(normaliseName(precomposed));
  });
  it('counts NFC characters for the length limit (D30)', () => {
    const max = cfg.profile.name.max;
    expect(isValidName('e\u0301'.repeat(max), cfg)).toBe(true); // max × é, 2 code points each before NFC
    expect(isValidName('\u00e9'.repeat(max), cfg)).toBe(true);
    expect(isValidName('e\u0301'.repeat(max + 1), cfg)).toBe(false);
  });
  it('counts characters, not UTF-16 units', () => {
    expect(isValidName('日'.repeat(16), cfg)).toBe(true);
    expect(isValidName('日'.repeat(17), cfg)).toBe(false);
  });
  it('generates a stable, valid name from a fixed seed', () => {
    const a = generateName(createRng(7), words);
    expect(a).toBe(generateName(createRng(7), words));
    expect(a).toMatch(/^[A-Za-z]+ [A-Za-z]+ [1-9][0-9]$/);
    expect(isValidName(a, cfg)).toBe(true);
  });
  it('every word combination fits the name rules', () => {
    for (const adj of words.adjectives)
      for (const noun of words.nouns)
        for (const nn of [10, 99]) expect(isValidName(`${adj} ${noun} ${nn}`, cfg), `${adj} ${noun}`).toBe(true);
  });
  it('uses the edges of the number range', () => {
    expect(generateName(() => 0, words)).toBe(`${words.adjectives[0]} ${words.nouns[0]} 10`);
    expect(generateName(() => 0.9999999, words)).toBe(`${words.adjectives.at(-1)} ${words.nouns.at(-1)} 99`);
  });
});

describe('unlocks', () => {
  const item = (kind: (typeof UNLOCK_KINDS)[number], count: number): Cosmetic => ({ id: 'x', name: 'X', unlock: { kind, count } });

  it('start items are always open', () => {
    expect(isUnlocked({ id: 's', name: 'S', unlock: null }, fresh)).toBe(true);
  });
  it.each(UNLOCK_KINDS)('%s: locked at count − 1, open at count', (kind) => {
    expect(isUnlocked(item(kind, 5), progress(0, { [kind]: 4 }))).toBe(false);
    expect(isUnlocked(item(kind, 5), progress(0, { [kind]: 5 }))).toBe(true);
  });
  it('reports capped progress for the requirement line', () => {
    expect(unlockProgress(item('levels', 25), progress(0, { levels: 12 }))).toEqual({ have: 12, need: 25 });
    expect(unlockProgress(item('levels', 25), progress(0, { levels: 80 }))).toEqual({ have: 25, need: 25 });
  });
  it('clearing level 25 from a fresh start unlocks only the Lighthouse', () => {
    const r = newlyUnlocked(cfg, progress(0, { levels: 24 }), progress(0, { levels: 25 }));
    expect(r.map((x) => `${x.slot}:${x.item.id}`)).toEqual(['avatar:lighthouse']);
  });
  it('reports nothing when nothing changed, and several items in display order', () => {
    expect(newlyUnlocked(cfg, fresh, fresh)).toEqual([]);
    const r = newlyUnlocked(cfg, progress(0, { levels: 99, sets: 3 }), progress(0, { levels: 100, sets: 4 }));
    expect(r.map((x) => `${x.slot}:${x.item.id}`)).toEqual(['avatar:lantern', 'plate:gold-leaf']);
  });
  it('progressOf counts levels cleared, not the level being played', () => {
    const p = progressOf({ level: 26, bestStreak: 3, shellsOwned: 7, setsCompleted: 1, stats: { ...emptyStats(), perfectClears: 2, dailiesSolved: 4 } });
    expect(p).toEqual({ levels: 25, perfectClears: 2, bestStreak: 3, dailiesSolved: 4, shells: 7, sets: 1 });
    expect(progressOf({ level: 1, bestStreak: 0, shellsOwned: 0, setsCompleted: 0, stats: emptyStats() }).levels).toBe(0);
  });
});

describe('repairProfile', () => {
  const name = () => 'Calm Cove 11';

  it('gives a missing profile the defaults and a new name', () => {
    expect(repairProfile(undefined, cfg, fresh, name)).toEqual({ name: 'Calm Cove 11', avatar: 'sand-jar', frame: 'sand', plate: 'cream' });
  });
  it('replaces unknown and locked picks with the defaults', () => {
    const r = repairProfile({ name: 'Zoë', avatar: 'lighthouse', frame: 'nope', plate: 'wave' }, cfg, fresh, name);
    expect(r).toEqual({ name: 'Zoë', avatar: 'sand-jar', frame: 'sand', plate: 'cream' });
  });
  it('keeps unlocked picks and a valid name (normalised)', () => {
    const r = repairProfile({ name: ' Sea  Gull ', avatar: 'lighthouse', frame: 'rope', plate: 'sea-glass' }, cfg, progress(0, { levels: 30 }), name);
    expect(r).toEqual({ name: 'Sea Gull', avatar: 'lighthouse', frame: 'rope', plate: 'sea-glass' });
  });
  it('regenerates an invalid name', () => {
    expect(repairProfile({ name: '😀' }, cfg, fresh, name).name).toBe('Calm Cove 11');
  });
  it('sameProfile ignores spacing differences in the name', () => {
    const a = repairProfile(undefined, cfg, fresh, name);
    expect(sameProfile(a, { ...a, name: ' Calm  Cove 11' })).toBe(true);
    expect(sameProfile(a, { ...a, frame: 'rope' })).toBe(false);
  });
});

describe('stats', () => {
  it('start at zero and only grow', () => {
    const s = bumpStats(emptyStats(), { pours: 31, coinsEarned: 25, boostersUsed: -3, perfectClears: 1.5 });
    expect(s).toEqual({ perfectClears: 0, dailiesSolved: 0, pours: 31, coinsEarned: 25, boostersUsed: 0 });
    expect(bumpStats(s, { pours: 4 }).pours).toBe(35);
  });
});
