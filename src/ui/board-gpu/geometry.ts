/**
 * Where the canvas draws each jar, taken from today's DOM layout (sprint 19 S2). Pure: the caller
 * reads the jar buttons' rects. Jar-local space has its origin at the interior's bottom centre, y up negative.
 */
import { type SandDims, bandRows } from '../sand';

/** A rectangle in CSS pixels, viewport coordinates. */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** One jar's drawing geometry, in CSS pixels. */
export interface JarGeometry {
  /** The glass's outer box at rest (no lift). */
  readonly glass: Rect;
  /** The jar button's box at rest: the DOM places the rim marks (padlock, funnel, sieve, clam) from it. */
  readonly button: Rect;
  /** Interior bottom centre, viewport coordinates: the jar container's origin. */
  readonly x: number;
  readonly y: number;
  /** Wall and base thickness. */
  readonly wall: number;
  readonly base: number;
  /** Interior size: the sand's room, from the base up to the glass top. */
  readonly innerWidth: number;
  readonly innerHeight: number;
  /** One sand cell. A unit's band is exactly `unitHeight` tall. */
  readonly cellW: number;
  readonly cellH: number;
  /** The sand grid's height (`rows × cellH`), bottom-aligned in the interior. A narrow jar's grid
   * is taller than its glass; the rows above its mouth (`mouthRow`) stay empty. */
  readonly gridHeight: number;
  /** Selection lift, as the DOM's `--lift`. */
  readonly lift: number;
}

/** The DOM's sand inset: a 2.5 px border plus 3 px padding (style.css `.glass`, `.sand`). */
const DOM_INSET = 5.5;

/** The rect without the current vertical translate (the DOM's selection lift). */
export function restRect(r: Rect, translateY: number): Rect {
  return { left: r.left, top: r.top - translateY, width: r.width, height: r.height };
}

/**
 * The geometry of a jar whose `.glass` sits at `glass`, for a board of `capacity` with units
 * `unitHeight` tall, so the canvas sand lines up with where the DOM draws it.
 * Example: `jarGeometry({ left: 0, top: 0, width: 68, height: 189 }, 42, 4, { cols: 32, rows: 72 }).cellH // 42 / 18`
 */
export function jarGeometry(glass: Rect, unitHeight: number, capacity: number, dims: SandDims, button: Rect = glass): JarGeometry {
  const wall = DOM_INSET;
  const base = DOM_INSET;
  const innerWidth = Math.max(1, glass.width - 2 * wall);
  const innerHeight = Math.max(1, glass.height - base);
  const cellW = innerWidth / dims.cols;
  const cellH = unitHeight / bandRows(capacity, dims);
  return {
    glass,
    button,
    x: glass.left + glass.width / 2,
    y: glass.top + glass.height - base,
    wall,
    base,
    innerWidth,
    innerHeight,
    cellW,
    cellH,
    gridHeight: dims.rows * cellH,
    lift: button.width * 0.32,
  };
}

/** The jar-local point of the lip on `side` (the interior's top corner). */
export function lipLocal(g: JarGeometry, side: 1 | -1): { x: number; y: number } {
  return { x: (side * g.innerWidth) / 2, y: -g.innerHeight };
}

/**
 * The jar's mouth row in its grid: 0 when the glass holds the whole grid, else the first row inside
 * a narrow jar's shorter glass. Example: `mouthRow(narrowGeom, 72) // 30`
 */
export function mouthRow(g: JarGeometry, rows: number): number {
  return Math.max(0, rows - Math.floor(g.innerHeight / g.cellH + 1e-6));
}

/**
 * Where the source's lip waits during the pour: over the target's near edge, `airRows` cells above
 * the top of its sand grid, which is where the simulation starts a spilled grain.
 */
export function pourLip(target: JarGeometry, side: 1 | -1, airRows: number, mouth = 0): { x: number; y: number } {
  return { x: target.x - (side * target.innerWidth) / 2, y: target.y - target.gridHeight + (mouth - airRows) * target.cellH };
}

/**
 * The lip's side for a pour: toward the target, unless the tipped jar would leave the canvas
 * (`viewWidth`), then the other side. Example: `pourSide(src, dst, 412) // 1`
 */
export function pourSide(source: JarGeometry, target: JarGeometry, viewWidth: number): 1 | -1 {
  const toward: 1 | -1 = target.x >= source.x ? 1 : -1;
  const reach = source.innerHeight + source.base;
  const fits = (s: 1 | -1) => {
    const lip = pourLip(target, s, 0);
    return s > 0 ? lip.x - reach >= 0 : lip.x + reach <= viewWidth;
  };
  if (fits(toward) || !fits(toward === 1 ? -1 : 1)) return toward;
  return toward === 1 ? -1 : 1;
}

/**
 * A CSS `cubic-bezier(x1, y1, x2, y2)` easing, so canvas motion uses the DOM's curves.
 * Example: `cubicBezier(0.3, 0.7, 0.4, 1)(0.5)`
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const bez = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      if (bez(x1, x2, mid) < t) lo = mid;
      else hi = mid;
    }
    return bez(y1, y2, (lo + hi) / 2);
  };
}
