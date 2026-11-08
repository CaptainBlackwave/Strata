// Story: production/epics/sprint-2/story-002-shell-collection.md
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type CollectionConfig, allShells, grantShell, knownShells, milestoneDue, setProgress } from '../../../src/core/collection';

const cfg = config as unknown as CollectionConfig;
const total = cfg.collection.sets.reduce((n, s) => n + s.shells.length, 0);

describe('catalog', () => {
  it('has unique shell ids and at least one set', () => {
    const ids = allShells(cfg).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(total);
  });
});

describe('grantShell', () => {
  it('grants shells in catalog order with no duplicates', () => {
    let owned: string[] = [];
    const got: string[] = [];
    for (let i = 0; i < total; i++) {
      const r = grantShell(owned, cfg);
      expect(r.shell).not.toBeNull();
      owned = r.owned;
      got.push(r.shell!.id);
    }
    expect(got).toEqual(allShells(cfg).map((s) => s.id));
    expect(new Set(got).size).toBe(total);
  });
  it('reports a completed set exactly when its last shell arrives', () => {
    const first = cfg.collection.sets[0];
    let owned: string[] = [];
    const completions: (string | null)[] = [];
    for (let i = 0; i < first.shells.length; i++) {
      const r = grantShell(owned, cfg);
      owned = r.owned;
      completions.push(r.completedSet?.id ?? null);
    }
    expect(completions.slice(0, -1).every((c) => c === null)).toBe(true);
    expect(completions.at(-1)).toBe(first.id);
  });
  it('returns null once everything is collected, and does not change owned', () => {
    const owned = allShells(cfg).map((s) => s.id);
    const r = grantShell(owned, cfg);
    expect(r.shell).toBeNull();
    expect(r.owned).toBe(owned);
  });
  it('ignores unknown ids in a save', () => {
    const r = grantShell(['not-a-shell'], cfg);
    expect(r.shell!.id).toBe(allShells(cfg)[0].id);
  });
});

describe('progress and milestones', () => {
  it('counts owned shells per set', () => {
    const firstTwo = allShells(cfg).slice(0, 2).map((s) => s.id);
    const p = setProgress(firstTwo, cfg);
    expect(p[0]).toMatchObject({ owned: 2, total: cfg.collection.sets[0].shells.length, complete: false });
    expect(p[1].owned).toBe(0);
  });
  it(`a shell is due on every ${cfg.collection.everyLevels}th level cleared`, () => {
    const n = cfg.collection.everyLevels;
    expect(milestoneDue(n, cfg)).toBe(true);
    expect(milestoneDue(n * 3, cfg)).toBe(true);
    expect(milestoneDue(n + 1, cfg)).toBe(false);
  });
});

describe('expedition sets (shell sets 5-8, owner interview 2026-11-08)', () => {
  // design/gdd/shell-collection.md, decisions SC-1 to SC-8.
  it('there are 8 sets of 5: the original four, then Night Shore, Cold North, Volcanic Sands, Ancient Cliffs', () => {
    const sets = cfg.collection.sets;
    expect(sets.map((s) => s.name)).toEqual(['Tide Pool', 'Dune Coast', 'Coral Reef', 'Deep Blue', 'Night Shore', 'Cold North', 'Volcanic Sands', 'Ancient Cliffs']);
    for (const s of sets) expect(s.shells, s.name).toHaveLength(5);
    expect(allShells(cfg)).toHaveLength(40);
  });
  it('a player who already owns all 20 original shells gets the first Night Shore shell next', () => {
    const original = allShells(cfg).slice(0, 20).map((s) => s.id);
    const r = grantShell(original, cfg);
    expect(r.shell?.setId).toBe('night');
    expect(r.completedSet).toBeNull();
  });
  it('the new sets pay the same set reward as the originals', () => {
    let owned = allShells(cfg).slice(0, 20).map((s) => s.id);
    const completed: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r = grantShell(owned, cfg);
      owned = r.owned;
      if (r.completedSet) completed.push(r.completedSet.id);
    }
    expect(completed).toEqual(['night', 'north', 'volcanic', 'ancient']);
    expect(cfg.collection.setReward.coins).toBe(150);
  });
  it('Night Shore glows and Ancient Cliffs are stone; the other new sets are plain', () => {
    const effect = Object.fromEntries(cfg.collection.sets.map((s) => [s.id, s.effect ?? null]));
    expect(effect).toMatchObject({ night: 'glow', ancient: 'stone', north: null, volcanic: null, tidepool: null });
    expect(allShells(cfg).find((s) => s.setId === 'night')?.effect).toBe('glow');
  });
});

describe('knownShells: unknown ids are dropped on load (D26, GX-15 / GB-SC-2)', () => {
  // production/sprints/sprint-7.md B1; design/gdd/save-data.md, design/gdd/shell-collection.md
  it('keeps only catalog ids, in earned order', () => {
    const [a, b, c] = allShells(cfg).map((s) => s.id);
    expect(knownShells([c, 'retired-shell', a, 'x', b], cfg)).toEqual([c, a, b]);
  });
  it('drops duplicates, keeping the first time a shell was earned', () => {
    const [a, b] = allShells(cfg).map((s) => s.id);
    expect(knownShells([b, a, b, a], cfg)).toEqual([b, a]);
  });
  it('an empty or fully known list is unchanged', () => {
    const ids = allShells(cfg).map((s) => s.id);
    expect(knownShells([], cfg)).toEqual([]);
    expect(knownShells(ids, cfg)).toEqual(ids);
  });
});
