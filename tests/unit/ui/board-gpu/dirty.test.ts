import { describe, expect, it } from 'vitest';
import { DirtyTracker, jarKey } from '../../../../src/ui/board-gpu/dirty';

describe('jarKey', () => {
  it('changes with the units and the hidden count only', () => {
    expect(jarKey({ units: [0, 2, 2], hidden: 1 })).toBe('0,2,2|1');
    expect(jarKey({ units: [0, 2, 2], hidden: 0 })).not.toBe(jarKey({ units: [0, 2, 2], hidden: 1 }));
    expect(jarKey({ units: [], hidden: 0 })).toBe('|0');
  });
  it('changes with each mechanic, so a thaw, an unlock or a clam opening redraws the jar', () => {
    const plain = jarKey({ units: [0], hidden: 0 });
    const keys = [
      { cap: 2 }, { funnel: true }, { frozen: true }, { lock: 1 }, { lock: 2 }, { sieve: 0 }, { clam: 3 }, { hourglass: { every: 3, left: 2 } },
    ].map((m) => jarKey({ units: [0], hidden: 0, ...m }));
    expect(new Set([plain, ...keys]).size).toBe(keys.length + 1);
    // The clam's and the hourglass's counts are DOM text: counting down needs no redraw.
    expect(jarKey({ units: [0], hidden: 0, clam: 3 })).toBe(jarKey({ units: [0], hidden: 0, clam: 2 }));
  });
});

describe('DirtyTracker', () => {
  it('reports every jar the first time, then only the changed ones', () => {
    const t = new DirtyTracker();
    expect(t.diff(['a', 'b', 'c'])).toEqual([0, 1, 2]);
    expect(t.diff(['a', 'b', 'c'])).toEqual([]);
    expect(t.diff(['a', 'x', 'c'])).toEqual([1]);
  });
  it('reports all jars when the count changes (an extra jar)', () => {
    const t = new DirtyTracker();
    t.diff(['a', 'b']);
    expect(t.diff(['a', 'b', 'c'])).toEqual([0, 1, 2]);
  });
  it('mark records a jar as drawn without reporting it', () => {
    const t = new DirtyTracker();
    t.diff(['a', 'b']);
    t.mark(1, 'z');
    expect(t.diff(['a', 'z'])).toEqual([]);
    t.mark(0, '');
    expect(t.diff(['a', 'z'])).toEqual([0]);
  });
  it('reset makes the next diff redraw everything', () => {
    const t = new DirtyTracker();
    t.diff(['a']);
    t.reset();
    expect(t.diff(['a'])).toEqual([0]);
  });
});
