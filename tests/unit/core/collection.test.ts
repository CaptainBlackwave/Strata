// Story: production/epics/sprint-2/story-002-shell-collection.md
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type CollectionConfig, allShells, grantShell, milestoneDue, setProgress } from '../../../src/core/collection';

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
