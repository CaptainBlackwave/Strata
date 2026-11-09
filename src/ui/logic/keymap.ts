/** The board's keyboard shortcuts as a pure mapping (sprint 10 F6, TD-12; UX-board-8). DOM-free. */
import type { BoosterId } from '../../core/economy';

/** The parts of a `KeyboardEvent` the mapping reads, so tests can pass a plain object. */
export interface KeyLike {
  readonly key: string;
  readonly code: string;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
}

/** What a board key does. */
export type KeyAction = { readonly kind: 'jar'; readonly index: number } | { readonly kind: 'booster'; readonly id: BoosterId } | { readonly kind: 'restart' } | { readonly kind: 'deselect' };

/** Z, S, J and H: the tools. */
const BOOSTER_KEYS: Readonly<Record<string, BoosterId>> = { z: 'undo', s: 'shuffle', j: 'extraJar', h: 'hint' };

/** True for Cmd, Ctrl or Alt: those combinations belong to the browser and the OS, on every layer. */
export function hasCommandModifier(e: KeyLike): boolean {
  return e.metaKey || e.ctrlKey || e.altKey;
}

/**
 * Maps a key on the board to its action, or `null` for none. No board key works while a layer
 * (a dialog, a sheet, the map, Home) is open: those take their own keys. 1-9 and 0 pick jars
 * 1-10; with Shift they pick jars 11-20. Shift changes `e.key` ("!"), so the top-row digit
 * comes from `e.code`; a numpad digit comes from `e.key`. A jar past `jarCount` does nothing.
 */
export function keyToAction(e: KeyLike, ctx: { readonly layerOpen: boolean; readonly jarCount: number }): KeyAction | null {
  if (hasCommandModifier(e) || ctx.layerOpen) return null;
  const k = e.key.toLowerCase();
  const id = BOOSTER_KEYS[k];
  if (id) return { kind: 'booster', id };
  if (k === 'r') return { kind: 'restart' };
  if (k === 'escape') return { kind: 'deselect' };
  const digit = /^Digit[0-9]$/.test(e.code) ? e.code.slice(5) : /^[0-9]$/.test(k) ? k : null;
  if (digit === null) return null;
  const index = (digit === '0' ? 9 : Number(digit) - 1) + (e.shiftKey ? 10 : 0);
  return index < ctx.jarCount ? { kind: 'jar', index } : null;
}
