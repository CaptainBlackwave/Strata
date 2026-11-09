// Sprint 10 F6 (TD-12, docs/tech-debt.md): the board's keyboard shortcuts (src/ui/logic/keymap.ts), UX-board-8.
import { describe, expect, it } from 'vitest';
import { type KeyLike, hasCommandModifier, keyToAction } from '../../../../src/ui/logic/keymap';

const SHIFTED = ')!@#$%^&*('; // what a US layout puts in e.key for Shift+0..9
const k = (key: string, code: string, over: Partial<KeyLike> = {}): KeyLike => ({ key, code, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, ...over });
const digit = (d: string, shift = false) => k(shift ? SHIFTED[Number(d)] : d, `Digit${d}`, { shiftKey: shift });
const board = (jarCount = 20) => ({ layerOpen: false, jarCount });

describe('keyToAction: jars', () => {
  it('1-9 and 0 pick jars 1-10 (indexes 0-9)', () => {
    for (const [d, i] of [['1', 0], ['5', 4], ['9', 8], ['0', 9]] as const) expect(keyToAction(digit(d), board())).toEqual({ kind: 'jar', index: i });
  });
  it('Shift with the top-row digit picks jars 11-20, reading e.code because Shift changes e.key', () => {
    for (const [d, i] of [['1', 10], ['9', 18], ['0', 19]] as const) expect(keyToAction(digit(d, true), board())).toEqual({ kind: 'jar', index: i });
  });
  it('a numpad digit (no Digit code) works through e.key', () => {
    expect(keyToAction(k('3', 'Numpad3'), board())).toEqual({ kind: 'jar', index: 2 });
  });
  it('a jar past the last one on the board does nothing', () => {
    expect(keyToAction(digit('0'), board(9))).toBeNull();
    expect(keyToAction(digit('9'), board(9))).toEqual({ kind: 'jar', index: 8 });
    expect(keyToAction(digit('2', true), board(11))).toBeNull();
    expect(keyToAction(digit('1', true), board(11))).toEqual({ kind: 'jar', index: 10 });
  });
});

describe('keyToAction: tools, Restart and Escape', () => {
  it('Z, S, J and H are Undo, Shuffle, Jar and Hint, in either case', () => {
    for (const [key, id] of [['z', 'undo'], ['s', 'shuffle'], ['j', 'extraJar'], ['h', 'hint'], ['Z', 'undo'], ['H', 'hint']] as const) {
      expect(keyToAction(k(key, `Key${key.toUpperCase()}`, { shiftKey: key === key.toUpperCase() }), board())).toEqual({ kind: 'booster', id });
    }
  });
  it('R restarts and Escape lifts the selection off', () => {
    expect(keyToAction(k('r', 'KeyR'), board())).toEqual({ kind: 'restart' });
    expect(keyToAction(k('Escape', 'Escape'), board())).toEqual({ kind: 'deselect' });
  });
  it('other keys do nothing', () => {
    for (const e of [k('a', 'KeyA'), k('Enter', 'Enter'), k(' ', 'Space'), k('ArrowLeft', 'ArrowLeft'), k('-', 'Minus'), k('Shift', 'ShiftLeft', { shiftKey: true })]) {
      expect(keyToAction(e, board())).toBeNull();
    }
  });
});

describe('keyToAction: modifiers and layers', () => {
  it('Cmd, Ctrl and Alt combinations are left to the browser', () => {
    for (const mod of ['metaKey', 'ctrlKey', 'altKey'] as const) {
      expect(hasCommandModifier(k('z', 'KeyZ', { [mod]: true }))).toBe(true);
      expect(keyToAction(k('z', 'KeyZ', { [mod]: true }), board())).toBeNull();
      expect(keyToAction({ ...digit('1'), [mod]: true }, board())).toBeNull();
    }
    expect(hasCommandModifier(k('Z', 'KeyZ', { shiftKey: true }))).toBe(false);
  });
  it('no board shortcut works while a layer (dialog, sheet, map, Home) is open', () => {
    for (const e of [digit('1'), digit('1', true), k('z', 'KeyZ'), k('r', 'KeyR'), k('Escape', 'Escape')]) {
      expect(keyToAction(e, { layerOpen: true, jarCount: 20 })).toBeNull();
    }
  });
});
