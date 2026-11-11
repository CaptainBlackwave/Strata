/**
 * Clam jar opening timing and shell count (sprint 13 M3, D96; design/gdd/jar-mechanics.md 2.6).
 * Pure and DOM-free, so tests/unit/ui/logic/clam.test.ts checks it in Node. The board redraws an
 * opened clam as an ordinary jar at once; these rules say when its shell swings open over it.
 */
import type { Jar } from '../../core/board';
import type { PourTail } from './flip';

/** How long the shell takes to swing open and fade (ms): presentation only. */
export const CLAM_OPEN_MS = 520;

/**
 * How long a just-opened clam keeps its shell before it swings open, after the pour that opened
 * it changed the board: until that pour's sand has landed. A closed clam is never poured from or
 * into, so it is never the pour's own jar. Reduced motion: 0 (no motion; the open jar is drawn).
 * Example: `clamOpenDelay(false, ANIM) // 230`.
 */
export function clamOpenDelay(reduced: boolean, anim: Pick<PourTail, 'flow'>): number {
  return reduced ? 0 : anim.flow;
}

/** The count drawn on a jar's shell: a closed clam's pours left, else nothing. Example: `shellCount({ units: [], hidden: 0, clam: 3 }) // '3'`. */
export function shellCount(jar: Jar): string {
  return jar.clam !== undefined ? String(jar.clam) : '';
}
