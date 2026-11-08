// Stories: production/epics/strata/story-005-touch-ui.md, story-006-progress-save.md
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../../src/ui/layout';
import { type KeyValueStore, loadProgress, saveProgress } from '../../../src/ui/storage';

describe('computeLayout', () => {
  it('fits a small board in one row', () => {
    const l = computeLayout({ width: 390, height: 600, jars: 5, capacity: 4 });
    expect(l.rows).toBe(1);
    expect(l.cols * l.jarWidth + (l.cols + 1) * l.gapX).toBeLessThanOrEqual(390);
  });
  it('wraps 14 jars on a phone into multiple rows without overflowing', () => {
    const l = computeLayout({ width: 358, height: 560, jars: 14, capacity: 4 });
    expect(l.rows).toBeGreaterThan(1);
    expect(l.cols * l.jarWidth + (l.cols + 1) * l.gapX).toBeLessThanOrEqual(358);
    expect(l.rows * l.jarHeight + (l.rows + 1) * l.gapY).toBeLessThanOrEqual(560);
  });
  it('tall challenge jars still fit vertically', () => {
    const l = computeLayout({ width: 358, height: 560, jars: 7, capacity: 8 });
    expect(l.rows * l.jarHeight).toBeLessThanOrEqual(560);
  });
});

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('progress storage', () => {
  it('round-trips progress', () => {
    const s = memoryStore();
    saveProgress({ level: 7, best: { '6': 21 } }, s);
    expect(loadProgress(s)).toEqual({ level: 7, best: { '6': 21 } });
  });
  it('falls back to level 1 on corrupt data', () => {
    const s = memoryStore();
    s.setItem('strata.progress.v1', '{not json');
    expect(loadProgress(s).level).toBe(1);
  });
  it('falls back on an invalid level', () => {
    const s = memoryStore();
    s.setItem('strata.progress.v1', JSON.stringify({ level: -3 }));
    expect(loadProgress(s).level).toBe(1);
  });
  it('tolerates missing storage', () => {
    expect(loadProgress(null).level).toBe(1);
    expect(() => saveProgress({ level: 2, best: {} }, null)).not.toThrow();
  });
  it('tolerates a store that throws', () => {
    const bad: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadProgress(bad).level).toBe(1);
    expect(() => saveProgress({ level: 2, best: {} }, bad)).not.toThrow();
  });
});
