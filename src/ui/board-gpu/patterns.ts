/**
 * Colour-blind patterns and jar-style sand textures for the GPU board (sprint 19 S3). Pure.
 * The 14 patterns mirror style.css `.pat-0` … `.pat-13` (one per palette colour, `color % 14`), and
 * the sand textures come from the same table the DOM uses (`SAND_TEXTURES` in style-art.ts). Both are
 * evaluated in each unit's own CSS px, as the DOM lays them over a `.unit`, and baked once per jar
 * size into an overlay anchored to the jar's grain grid: settled sand never shimmers, and the
 * pattern turns with a tipped jar instead of staying fixed to the screen.
 */
import { type SandId, type SandLayer, SAND_TEXTURES, layerAlphaAt } from '../style-art';

/** One overlay layer's colour and opacity at a point. */
export interface Ink {
  readonly rgb: readonly [number, number, number];
  readonly a: number;
}

const WHITE = [255, 255, 255] as const;
const BLACK = [0, 0, 0] as const;
const NONE: Ink = { rgb: BLACK, a: 0 };

/** A repeating stripe, as `repeating-linear-gradient(angle, c 0 on, transparent on period)`. */
function stripe(angleDeg: number, on: number, period: number, rgb: readonly [number, number, number], a: number) {
  const t = (angleDeg * Math.PI) / 180;
  const sx = Math.sin(t);
  const cy = Math.cos(t);
  // CSS: 0deg runs bottom to top, 90deg left to right; y grows downward on screen.
  return (x: number, y: number, h: number): Ink => {
    const d = x * sx + (h - y) * cy;
    const m = ((d % period) + period) % period;
    return m < on ? { rgb, a } : NONE;
  };
}

/** A round dot in the middle of each `tile` px, solid to `r0`, clear at `r1`. */
function dot(tile: number, r0: number, r1: number, rgb: readonly [number, number, number], a: number) {
  return (x: number, y: number): Ink => {
    const u = (((x % tile) + tile) % tile) - tile / 2;
    const v = (((y % tile) + tile) % tile) - tile / 2;
    const d = Math.hypot(u, v);
    const k = d <= r0 ? 1 : d >= r1 ? 0 : (r1 - d) / (r1 - r0);
    return k > 0 ? { rgb, a: a * k } : NONE;
  };
}

/** Two inks over each other (the first on top). */
function both(top: (x: number, y: number, h: number) => Ink, under: (x: number, y: number, h: number) => Ink) {
  return (x: number, y: number, h: number): Ink => {
    const p = top(x, y, h);
    return p.a > 0 ? p : under(x, y, h);
  };
}

/** Pattern 5: the light checker of diagonal corners (two 45deg gradients on 10 px tiles, the second offset 5 px). */
function checker(x: number, y: number): Ink {
  const on = (u: number, v: number) => {
    const s = (((u % 10) + 10) % 10) + (10 - (((v % 10) + 10) % 10));
    const f = s / 20;
    return f < 0.25 || f > 0.75;
  };
  return on(x, y) || on(x - 5, y - 5) ? { rgb: WHITE, a: 0.3 } : NONE;
}

/** Pattern 7: a ring in each 10 px tile. */
function ring(x: number, y: number): Ink {
  const u = (((x % 10) + 10) % 10) - 5;
  const v = (((y % 10) + 10) % 10) - 5;
  const d = Math.hypot(u, v);
  return d >= 2.25 && d <= 3.75 ? { rgb: BLACK, a: 0.3 } : NONE;
}

/** The patterns, in style.css order. `x`, `y` are px in the unit from its top-left; `h` is its height. */
export const PATTERNS: readonly ((x: number, y: number, h: number) => Ink)[] = [
  stripe(0, 2, 7, WHITE, 0.45),
  dot(8, 1.6, 2, BLACK, 0.35),
  stripe(45, 2, 7, WHITE, 0.5),
  stripe(-45, 2, 7, BLACK, 0.3),
  stripe(90, 2, 7, WHITE, 0.5),
  checker,
  both(stripe(0, 1.5, 6, BLACK, 0.3), stripe(90, 1.5, 6, BLACK, 0.3)),
  ring,
  both(stripe(45, 1.5, 6, WHITE, 0.4), stripe(-45, 1.5, 6, WHITE, 0.4)),
  stripe(0, 5, 10, BLACK, 0.28),
  dot(11, 2.4, 3, WHITE, 0.6),
  stripe(90, 5, 10, WHITE, 0.4),
  stripe(30, 2, 8, BLACK, 0.3),
  dot(12, 2.6, 3.2, BLACK, 0.42),
];

/**
 * A per-texel overlay: a texel of colour `c` becomes `c × keep + add`. Index `t` is the texel,
 * `add` holds three channels per texel.
 */
export interface Overlay {
  readonly keep: Float32Array;
  readonly add: Float32Array;
}

/** Where a grid's texels sit in CSS px, so overlays line up with the DOM's units. */
export interface TexelSpace {
  /** Texels across and down. */
  readonly width: number;
  readonly height: number;
  /** One texel in CSS px. */
  readonly texelW: number;
  readonly texelH: number;
  /** Texel rows per unit band (the bands stack up from the bottom). */
  readonly unitRows: number;
}

/** Calls `ink(x, y, h)` at every texel's centre in its unit's own px and bakes the inks into an overlay. */
function bake(space: TexelSpace, inks: readonly ((x: number, y: number, h: number) => Ink)[]): Overlay {
  const { width, height, texelW, texelH, unitRows } = space;
  const keep = new Float32Array(width * height).fill(1);
  const add = new Float32Array(width * height * 3);
  const unitH = unitRows * texelH;
  for (let ty = 0; ty < height; ty++) {
    const fromBottom = height - 1 - ty;
    const inUnit = unitRows - 1 - (fromBottom % unitRows);
    const y = (inUnit + 0.5) * texelH;
    for (let tx = 0; tx < width; tx++) {
      const x = (tx + 0.5) * texelW;
      const t = ty * width + tx;
      // The first ink draws on top, so composite from the last.
      for (let k = inks.length - 1; k >= 0; k--) {
        const { rgb, a } = inks[k](x, y, unitH);
        if (a <= 0) continue;
        keep[t] *= 1 - a;
        for (let ch = 0; ch < 3; ch++) add[t * 3 + ch] = add[t * 3 + ch] * (1 - a) + rgb[ch] * a;
      }
    }
  }
  return { keep, add };
}

/** The ink of a style-art layer at a point: tiles repeat from their `x`, `y` offset; bands use % of the unit. */
function layerInk(l: SandLayer): (x: number, y: number, h: number) => Ink {
  return (x, y, h) => {
    if (l.kind === 'band') return { rgb: l.rgb, a: layerAlphaAt(l, 0, (y / h) * 100) };
    const u = (((x - l.x) % l.w) + l.w) % l.w;
    const v = (((y - l.y) % l.h) + l.h) % l.h;
    return { rgb: l.rgb, a: layerAlphaAt(l, u, v) };
  };
}

/**
 * How much stronger a sand piece's layers are drawn on the canvas than in the DOM table. The canvas's
 * own grain is busier than the DOM's flat colour, so at the table's strength a piece barely shows;
 * light and dark layers scale together, so the mean shade stays put (jar-styles.md §4).
 */
export const CANVAS_TEXTURE_GAIN = 1.8;

/** The worn sand texture's overlay, or `null` for plain sand (the board's own grain is the plain look). */
export function sandOverlay(space: TexelSpace, sand: string, gain = CANVAS_TEXTURE_GAIN): Overlay | null {
  const layers = SAND_TEXTURES[sand as SandId];
  if (!layers) return null;
  return bake(space, layers.map((l) => {
    const ink = layerInk(l);
    return (x: number, y: number, h: number) => {
      const p = ink(x, y, h);
      return { rgb: p.rgb, a: Math.min(0.6, p.a * gain) };
    };
  }));
}

/** Colour pattern `index`'s overlay (`index` is `color % PATTERNS.length`). */
export function patternOverlay(space: TexelSpace, index: number): Overlay {
  return bake(space, [PATTERNS[((index % PATTERNS.length) + PATTERNS.length) % PATTERNS.length]]);
}
