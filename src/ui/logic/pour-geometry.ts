/**
 * Where sand leaves a tilted jar (strata bug report 2026-11-11, "the sand doesn't fall out of the
 * jar right"): the lower corner of the glass mouth after the jar is moved and rotated, so the
 * stream starts at the lip instead of at a fixed point near it. Pure, so it is unit-tested.
 */

/** A point in page pixels. */
export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** A rectangle in page pixels. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The lower lip of a jar rotated by `deg` degrees (clockwise is positive, as CSS) about its centre
 * and then moved by (`dx`, `dy`). `jar` is the jar's box at rest; `glass` is its glass's box at rest
 * (the mouth is the glass's top edge). Of the mouth's two corners, the one lower on screen is where
 * the sand spills. Example: a jar tilted 100° to the right spills from its top-left corner, now low right.
 */
export function lowerLip(jar: Box, glass: Box, deg: number, dx: number, dy: number): Pt {
  const cx = jar.left + jar.width / 2;
  const cy = jar.top + jar.height / 2;
  const a = (deg * Math.PI) / 180;
  const turn = (p: Pt): Pt => {
    const x = p.x - cx;
    const y = p.y - cy;
    return { x: cx + x * Math.cos(a) - y * Math.sin(a) + dx, y: cy + x * Math.sin(a) + y * Math.cos(a) + dy };
  };
  const left = turn({ x: glass.left, y: glass.top });
  const right = turn({ x: glass.left + glass.width, y: glass.top });
  return left.y >= right.y ? left : right;
}
