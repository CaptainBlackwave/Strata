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
import { type PourTail } from './flip';

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
 * - `halo`, `disc`, `core`: three half-discs on the horizon, filled one over the other: the ink halo
 *   (a thin contrasting edge), the half-sun in the band colour, and, while the jar is open, its centre
 *   in the card colour, so open is a heavy ring and filled is solid (screenshot review: the disc is
 *   about 8 CSS px at board size). The halo is outside the ring only, so the open centre stays clear;
 * - `rays`: four short rays round it;
 * - `rise` / `set`: the arrow above it, up for sunrise, down for sunset.
 */
export const SUN_PATHS = {
  horizon: 'M1 12.6h14',
  halo: 'M2.85 12.6a5.15 5.15 0 0 1 10.3 0z',
  disc: 'M3.5 12.6a4.5 4.5 0 0 1 9 0z',
  core: 'M5.3 12.6a2.7 2.7 0 0 1 5.4 0z',
  rays: 'M1.4 9.4l1.5.7M14.6 9.4l-1.5.7M3.5 6.1l1.1 1.1M12.5 6.1l-1.1 1.1',
  rise: 'M8 6.4V1.4M6 3.4l2-2 2 2',
  set: 'M8 1.4v5M6 4.4l2 2 2-2',
} as const;

/** The half-sun glyph's box (width, height), as `SUN_PATHS` is drawn in. */
export const SUN_BOX = { width: 16, height: 14 } as const;

/**
 * The half-sun glyph's strokes, in `SUN_BOX` units (screenshot review, sprint 29): the rays and the
 * arrow are `line` wide in the band colour over a `halo`-wide stroke in the scene's ink (dark on a
 * light card, cream on a dark one), so any band colour reads on both cards; the horizon is `horizon`
 * wide in ink. The DOM (style.css `.sun-mark`) and the canvas (mech-art.ts `drawPill`) use the same
 * numbers. The disc's ring and halo are the `SUN_PATHS` half-discs, not strokes.
 */
export const SUN_STROKE = { line: 1.6, halo: 2.6, horizon: 1.6 } as const;

/** The dark the band's edge is mixed towards (a warm ink), and how far: pale bands still read as a coloured band. */
export const SUN_EDGE_INK = { r: 43, g: 29, b: 20 } as const;
/** How much of {@link SUN_EDGE_INK} the band's edge takes (0 = the band colour, 1 = the ink). */
export const SUN_EDGE_MIX = 0.5;

/**
 * The band's edge colour: the band colour darkened towards a warm ink, so a pale band (saffron,
 * lemon, mint) keeps a coloured edge rather than a plain ink trim, on light and dark scenes alike.
 * Both boards draw it from here (jars.ts sets `--band-edge`; mech-art.ts `drawSunBand`).
 * Example: `sunBandEdge('#ffffff') // 'rgb(149,142,138)'`
 */
export function sunBandEdge(hex: string): string {
  const n = Number.parseInt(hex.replace('#', '').slice(0, 6), 16);
  const mix = (c: number, ink: number) => Math.round(c + (ink - c) * SUN_EDGE_MIX);
  return `rgb(${mix((n >> 16) & 255, SUN_EDGE_INK.r)},${mix((n >> 8) & 255, SUN_EDGE_INK.g)},${mix(n & 255, SUN_EDGE_INK.b)})`;
}

/**
 * The sunrise brightening (D223, "the day begins"), in ms: the light comes up over the board and
 * fades back. Presentation only, so a named constant here (D31). Starting value for the owner's
 * screenshot review: about as long as the seal shimmer and the cork's landing together, so it reads
 * as one calm moment after the pour.
 */
export const SUNRISE_MS = 1100;

/** The sunrise light's peak opacity: soft, so the board never washes out. The light's colours and blend per scene (warmer and a touch stronger on light scenes, gentle on dark ones) are style.css `.sun-dawn`'s `--dawn-*` properties. */
export const SUNRISE_PEAK = 0.55;

/**
 * How long after the pour's board change the sunrise light starts, in ms: once the pour has finished
 * (the sand has landed, the stream has run out and the jar is home), so it is one calm moment after
 * the pour, not over it. The board's session event comes as the sand lands (`ANIM.flow`,
 * `streamOut` and `back` are still to play); the hourglass under a pouring jar waits the same
 * (logic/flip.ts). Reduced motion: 0 (no light plays anyway).
 * Example: `sunriseDelay(false, { flow: 230, streamOut: 90, back: 220 }) // 540`
 */
export function sunriseDelay(reduced: boolean, anim: PourTail): number {
  return reduced ? 0 : anim.flow + anim.streamOut + anim.back;
}

/**
 * Whether the board's sunrise jar is filled, so a light still waiting can tell the day has begun (an
 * Undo or Restart while it waits takes it back, and the light then never plays).
 * Example: `sunriseRisen({ capacity: 4, jars: [{ units: [1, 1, 1, 1], hidden: 0, sun: { band: 1, at: 'rise' } }] }) // true`
 */
export function sunriseRisen(board: Board): boolean {
  return board.jars.some((j) => j.sun?.at === 'rise' && sunMark(j, board.capacity)!.filled);
}

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
