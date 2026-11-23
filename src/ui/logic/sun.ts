/**
 * The sunrise and sunset jars' look and moments (sprint 29 N4, D223; design/gdd/jar-mechanics.md §2.11).
 * Pure and DOM-free, so it is unit-tested (tests/unit/ui/sun-ui.test.ts). The DOM side is
 * screens/jars.ts (the band and the half-sun mark), screens/sun-moments.ts (the sunrise brightening)
 * and screens/win.ts (the dusk win); the Realistic board draws the band and carries the mark in a pour
 * from the same path data (board-gpu/mech-art.ts).
 *
 * Drawn for Strata: a horizon line, a half-sun on it, four short rays and an arrow above it, up for
 * the sunrise jar and down for the sunset jar. Nothing here is taken from another game.
 */
import { type Board, type Jar, isComplete } from '../../core/board';

/** Which of the pair a jar is: `'rise'` (filled first) or `'set'` (filled last). */
export type SunAt = 'rise' | 'set';

/** What a sun jar's mark shows. */
export interface SunMark {
  /** The rising half-sun (`'rise'`) or the setting one (`'set'`). */
  readonly at: SunAt;
  /** The band colour (a palette index). */
  readonly band: number;
  /** Open ring (false) until the jar is filled in its band, then filled in (true). */
  readonly filled: boolean;
}

/**
 * A sun jar's mark, or `null` for any other jar. "Filled" is `isComplete` in the jar's band (§2.11
 * rule 2): only the band may be poured in, so a complete sun jar is always its band, but the band is
 * checked too so a hand-made board can never show a filled mark in the wrong colour.
 * Example: `sunMark({ units: [2, 2, 2, 2], hidden: 0, sun: { band: 2, at: 'rise' } }, 4) // { at: 'rise', band: 2, filled: true }`
 */
export function sunMark(jar: Jar, capacity: number): SunMark | null {
  if (!jar.sun) return null;
  const filled = isComplete(jar, capacity) && jar.units[0] === jar.sun.band;
  return { at: jar.sun.at, band: jar.sun.band, filled };
}

/**
 * The classes a jar button wears for its sun role: `sun` and `sun-rise` or `sun-set`, plus
 * `sun-filled` once filled. Empty for any other jar. The DOM toggles exactly these.
 * Example: `sunClasses({ units: [], hidden: 0, sun: { band: 0, at: 'set' } }, 4) // ['sun', 'sun-set']`
 */
export function sunClasses(jar: Jar, capacity: number): string[] {
  const m = sunMark(jar, capacity);
  if (!m) return [];
  return ['sun', `sun-${m.at}`, ...(m.filled ? ['sun-filled'] : [])];
}

/** Every class `sunClasses` can return, so a redraw can clear the ones a jar no longer has. */
export const SUN_CLASSES = ['sun', 'sun-rise', 'sun-set', 'sun-filled'] as const;

/**
 * Whether the board has a sunset jar: its win plays with the dusk tint (D223). Decided from the
 * won board, since the sunset jar's filling pour is always the winning pour (§2.11 rule 6).
 * Example: `hasSunset({ capacity: 4, jars: [{ units: [], hidden: 0, sun: { band: 1, at: 'set' } }] }) // true`
 */
export function hasSunset(board: Board): boolean {
  return board.jars.some((j) => j.sun?.at === 'set');
}

/**
 * The half-sun glyph's path data, in a 16 × 14 box (`viewBox="0 0 16 14"`). The DOM's SVG mark and
 * the Realistic board's canvas copy (`Path2D`) draw from these same strings.
 * - `horizon`: the line the sun sits on, in ink so it reads on any band colour;
 * - `disc`: the half-sun, closed along the horizon; stroked while open, filled once filled;
 * - `rays`: four short rays round it;
 * - `rise` / `set`: the arrow above it, up for sunrise, down for sunset.
 */
export const SUN_PATHS = {
  horizon: 'M1 12.6h14',
  disc: 'M3.9 12.6a4.1 4.1 0 0 1 8.2 0z',
  rays: 'M1.4 9.4l1.5.7M14.6 9.4l-1.5.7M3.5 6.1l1.1 1.1M12.5 6.1l-1.1 1.1',
  rise: 'M8 6.4V1.4M6 3.4l2-2 2 2',
  set: 'M8 1.4v5M6 4.4l2 2 2-2',
} as const;

/** The half-sun glyph's box (width, height), as `SUN_PATHS` is drawn in. */
export const SUN_BOX = { width: 16, height: 14 } as const;

/**
 * The sunrise brightening (D223, "the day begins"), in ms: the light comes up over the board and
 * fades back. Presentation only, so a named constant here (D31). Starting value for the owner's
 * screenshot review: about as long as the seal shimmer and the cork's landing together, so it reads
 * as one calm moment after the pour.
 */
export const SUNRISE_MS = 1100;

/** The sunrise light's peak opacity: soft, so the board never washes out. */
export const SUNRISE_PEAK = 0.55;

/**
 * The sunrise brightening's keyframes (opacity only, as every effect here): up quickly, held a
 * moment, then a long fade. Example: `sunriseFrames()[0] // { opacity: 0, offset: 0 }`
 */
export function sunriseFrames(): Keyframe[] {
  return [
    { opacity: 0, offset: 0 },
    { opacity: SUNRISE_PEAK, offset: 0.3 },
    { opacity: SUNRISE_PEAK, offset: 0.45 },
    { opacity: 0, offset: 1 },
  ];
}

/**
 * Whether the sunrise brightening plays: never under reduced motion (the moment is then instant,
 * that is the filled mark alone, as for the beam and the tide) and never on a hidden tab.
 * Example: `sunrisePlays({ reduced: true, hidden: false }) // false`
 */
export function sunrisePlays(o: { readonly reduced: boolean; readonly hidden: boolean }): boolean {
  return !o.reduced && !o.hidden;
}

/** How long the dusk tint takes to come over the win, in ms (0 under reduced motion: it is simply there). */
export const DUSK_FADE_MS = 600;

/** The dusk tint's fade-in for this win: {@link DUSK_FADE_MS}, or 0 under reduced motion. */
export function duskFade(reduced: boolean): number {
  return reduced ? 0 : DUSK_FADE_MS;
}

/** How long the board's dusk stays once the win card opens, in ms: the win overlay's own fade-in (220 ms) and a little, so the tint never dips. */
export const DUSK_HANDOVER_MS = 260;
