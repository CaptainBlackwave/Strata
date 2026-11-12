/**
 * The tide jar's look (sprint 24 T4, D194, D195; design/gdd/jar-mechanics.md §2.8). Pure and
 * DOM-free, so tests/unit/ui/tide-ui.test.ts checks it in Node. Both boards draw from it: the
 * Classic board's wave mark and rise (src/ui/screens/jars.ts) and the Realistic board's rise
 * (src/ui/board-gpu/renderer.ts). When the rise plays is the hourglass flip's rule (`flipDelay`).
 */
import { type Jar, isSealed } from '../../core/board';

/** How long the rise takes (ms): presentation only. */
export const TIDE_MS = 520;

/**
 * The count on a tide jar's wave mark: its pours left while the tide still turns, else nothing (a
 * sealed tide jar is still, D195, so it shows the wave alone). Example: `tideCount({ units: [], hidden: 0, tide: { every: 4, left: 2 } }, 4) // '2'`
 */
export function tideCount(jar: Jar, capacity: number): string {
  return jar.tide && !isSealed(jar, capacity) ? String(jar.tide.left) : '';
}

/**
 * Whether a turn of `jar` (as drawn after it) can be seen: 2+ units, not all one colour. An empty
 * or one-colour tide jar still turns (§2.8 rule 5) but looks the same, so nothing moves.
 * Example: `risesVisibly({ units: [0, 1], hidden: 0 }) // true`
 */
export function risesVisibly(jar: Jar): boolean {
  return jar.units.length >= 2 && jar.units.some((c) => c !== jar.units[0]);
}

/**
 * Where unit `k` of a just-turned stack of `n` units starts its rise, in units above its place
 * (bottom first, as drawn after the turn). The top unit came from the bottom, so it starts `n − 1`
 * below; every other unit was one place higher, so it starts one above.
 * Example: `riseFrom(3, 4) // -3`, `riseFrom(0, 4) // 1`
 */
export function riseFrom(k: number, n: number): number {
  return k === n - 1 ? -(n - 1) : 1;
}

/**
 * Turns a list kept in the order before a tide turn into the order after it (bottom unit to the
 * top, the rest down one), as `riseByOne` in the core; used to follow per-unit data through a turn.
 * Example: `afterTurn([3, 0, 1]) // [0, 1, 3]`
 */
export function afterTurn<T>(xs: readonly T[]): T[] {
  return xs.length > 1 ? [...xs.slice(1), xs[0]] : [...xs];
}
