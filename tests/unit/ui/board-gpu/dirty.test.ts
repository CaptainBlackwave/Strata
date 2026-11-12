import { describe, expect, it } from 'vitest';
import { DirtyTracker, domDrawKeys, domRedraw, jarKey } from '../../../../src/ui/board-gpu/dirty';

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

describe('the Classic board redraws only the jars that changed (sprint 21 P2, strata-8j3)', () => {
  const plain = { sealed: false, patterns: false, unitHeight: 30 };
  const keys = (jar: Parameters<typeof domDrawKeys>[0], d = plain) => domDrawKeys(jar, d);
  it('an untouched jar needs nothing redrawn', () => {
    const k = keys({ units: [0, 2], hidden: 0 });
    expect(domRedraw(k, keys({ units: [0, 2], hidden: 0 }), false, false, false)).toEqual({ sand: false, rest: false, selection: false });
  });
  it('a jar never drawn (a new button) is drawn in full', () => {
    expect(domRedraw(null, keys({ units: [], hidden: 0 }), false, false, false)).toEqual({ sand: true, rest: true, selection: true });
  });
  it('a pour changes the sand and the label; growing units always rebuild the sand', () => {
    const a = keys({ units: [0], hidden: 0 });
    const b = keys({ units: [0, 0], hidden: 0 });
    expect(domRedraw(a, b, false, false, false)).toMatchObject({ sand: true, rest: true });
    expect(domRedraw(a, a, false, false, true).sand).toBe(true);
  });
  it('selecting a jar only refreshes its selection', () => {
    const k = keys({ units: [1], hidden: 0 });
    expect(domRedraw(k, k, false, true, false)).toEqual({ sand: false, rest: false, selection: true });
  });
  it('the counts the DOM draws as text redraw the jar: an hourglass or a clam counting down', () => {
    const h = (left: number) => keys({ units: [0], hidden: 0, hourglass: { every: 3, left } });
    expect(domRedraw(h(2), h(1), false, false, false).rest).toBe(true);
    const c = (n: number) => keys({ units: [0], hidden: 0, clam: n });
    expect(domRedraw(c(3), c(2), false, false, false).rest).toBe(true);
  });
  it('a thaw, an unlock, a seal, the patterns setting or a new unit height redraw it', () => {
    const base = keys({ units: [0], hidden: 0 });
    for (const next of [
      keys({ units: [0], hidden: 0, frozen: true }),
      keys({ units: [0], hidden: 0, lock: 1 }),
      keys({ units: [0], hidden: 0 }, { ...plain, sealed: true }),
      keys({ units: [0], hidden: 0 }, { ...plain, unitHeight: 24 }),
    ])
      expect(domRedraw(next, base, false, false, false).rest).toBe(true);
    expect(domRedraw(base, keys({ units: [0], hidden: 0 }, { ...plain, patterns: true }), false, false, false)).toMatchObject({ sand: true, rest: true });
  });
  it('a reveal (hidden count down) rebuilds the sand', () => {
    expect(domRedraw(keys({ units: [0, 1], hidden: 1 }), keys({ units: [0, 1], hidden: 0 }), false, false, false).sand).toBe(true);
  });
});
