import { describe, expect, it } from 'vitest';
import { DirtyTracker, jarKey } from '../../../../src/ui/board-gpu/dirty';

describe('jarKey', () => {
  it('changes with the units and the hidden count only', () => {
    expect(jarKey({ units: [0, 2, 2], hidden: 1 })).toBe('0,2,2|1');
    expect(jarKey({ units: [0, 2, 2], hidden: 0 })).not.toBe(jarKey({ units: [0, 2, 2], hidden: 1 }));
    expect(jarKey({ units: [], hidden: 0 })).toBe('|0');
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
