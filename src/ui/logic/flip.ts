/**
 * Hourglass flip timing (sprint 13 M1, D96; design/gdd/jar-mechanics.md 2.4). Pure and DOM-free,
 * so tests/unit/ui/logic/flip.test.ts checks it in Node. The board redraws a flipped jar in its new
 * order at once; these rules say when its turn-over plays, so it never overlaps the pour around it.
 */

/** How long the flip's turn-over takes (ms): presentation only. */
export const FLIP_MS = 460;

/** The pour's phases that follow the board change (ms): `ANIM` in src/ui/state.ts. */
export interface PourTail {
  readonly flow: number;
  readonly streamOut: number;
  readonly back: number;
}

/**
 * How long hourglass `jar` keeps its old look before it turns over, after the pour from jar
 * `from` changed the board. The jar poured out of waits until it has flown home; any other
 * waits until the sand has landed. Reduced motion: 0 (no motion; the new order is drawn).
 * Example: `flipDelay(2, 2, false, ANIM) // 540`.
 */
export function flipDelay(jar: number, from: number, reduced: boolean, anim: PourTail): number {
  if (reduced) return 0;
  return jar === from ? anim.flow + anim.streamOut + anim.back : anim.flow;
}

/**
 * The first unit of target jar `to` that grows in after a pour of `moved` units, given its
 * new length. A target that flipped holds the poured units at its bottom now, so none grows.
 * Example: `grownFrom(1, 4, 2, []) // 2`.
 */
export function grownFrom(to: number, length: number, moved: number, flipped: readonly number[]): number {
  return flipped.includes(to) ? Infinity : length - moved;
}
