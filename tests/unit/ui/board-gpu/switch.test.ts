import { describe, expect, it } from 'vitest';
import type { Board } from '../../../../src/core/board';
import { chooseBoardMode, detectWebGL, needsDomBoard } from '../../../../src/ui/board-gpu/switch';

const base = { search: '', storedFlag: null, dev: false, webgl: true };

describe('chooseBoardMode', () => {
  it('defaults to the DOM board', () => {
    expect(chooseBoardMode(base)).toBe('dom');
    expect(chooseBoardMode({ ...base, search: '?level=7' })).toBe('dom');
  });
  it('?board=gpu turns the GPU board on', () => {
    expect(chooseBoardMode({ ...base, search: '?board=gpu&level=7' })).toBe('gpu');
  });
  it('?board=dom always wins, even over the dev flag', () => {
    expect(chooseBoardMode({ ...base, search: '?board=dom', storedFlag: 'gpu', dev: true })).toBe('dom');
  });
  it('reads the stored flag only in a dev build', () => {
    expect(chooseBoardMode({ ...base, storedFlag: 'gpu', dev: true })).toBe('gpu');
    expect(chooseBoardMode({ ...base, storedFlag: 'gpu', dev: false })).toBe('dom');
    expect(chooseBoardMode({ ...base, storedFlag: 'dom', dev: true })).toBe('dom');
  });
  it('falls back to DOM without WebGL', () => {
    expect(chooseBoardMode({ ...base, search: '?board=gpu', webgl: false })).toBe('dom');
    expect(chooseBoardMode({ ...base, storedFlag: 'gpu', dev: true, webgl: false })).toBe('dom');
  });
});

describe('detectWebGL', () => {
  it('is true with a WebGL 2 or WebGL 1 context', () => {
    expect(detectWebGL(() => ({ getContext: (id: string) => (id === 'webgl2' ? {} : null) }))).toBe(true);
    expect(detectWebGL(() => ({ getContext: (id: string) => (id === 'webgl' ? {} : null) }))).toBe(true);
  });
  it('is false when no context, no canvas, or it throws', () => {
    expect(detectWebGL(() => ({ getContext: () => null }))).toBe(false);
    expect(detectWebGL(() => null)).toBe(false);
    expect(detectWebGL(() => { throw new Error('no document'); })).toBe(false);
    expect(detectWebGL(() => ({ getContext: () => { throw new Error('blocked'); } }))).toBe(false);
  });
  it('with WebGL stubbed out, the switch gives the DOM board', () => {
    const webgl = detectWebGL(() => ({ getContext: () => null }));
    expect(chooseBoardMode({ ...base, search: '?board=gpu', webgl })).toBe('dom');
  });
});

describe('needsDomBoard', () => {
  const plain: Board = { capacity: 4, jars: [{ units: [0, 1], hidden: 1 }, { units: [], hidden: 0 }] };
  it('keeps a plain board on the canvas', () => {
    expect(needsDomBoard(plain, false)).toBe(false);
  });
  it('falls back for colour-blind patterns (S3)', () => {
    expect(needsDomBoard(plain, true)).toBe(true);
  });
  it.each([
    ['narrow', { cap: 2 }],
    ['frozen', { frozen: true }],
    ['locked', { lock: 1 }],
    ['funnel', { funnel: true }],
    ['hourglass', { hourglass: { every: 3, left: 2 } }],
    ['sieve', { sieve: 0 }],
    ['clam', { clam: 2 }],
  ])('falls back for a %s jar (S3)', (_name, extra) => {
    const board = { ...plain, jars: [...plain.jars, { units: [], hidden: 0, ...extra }] } as Board;
    expect(needsDomBoard(board, false)).toBe(true);
  });
});
