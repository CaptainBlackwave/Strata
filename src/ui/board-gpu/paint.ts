/**
 * Turns a sand grid into texture pixels (sprint 19 S2). Pure: typed arrays in, typed arrays out.
 * Each cell is `sub × sub` texels, so one grain shows a little texture of its own; the grain's
 * shade (which moves with it) picks its tone, a few grains sparkle, and exposed tops catch the light.
 */
import { EMPTY, NEUTRAL, type ParticleView, type SandGrid } from '../sand';
import type { Overlay } from './patterns';

/** A colour as 0..255 channels. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** `#rrggbb` to channels. Example: `hexToRgb('#c8553d') // { r: 200, g: 85, b: 61 }` */
export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Bad colour ${hex}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Shade at or above this sparkles. */
const SPARKLE = 251;

/** One texel as little-endian RGBA in a Uint32 (ImageData byte order). */
function pack(r: number, g: number, b: number, a = 255): number {
  return ((a << 24) | (clamp(b) << 16) | (clamp(g) << 8) | clamp(r)) >>> 0;
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

/**
 * A mask of `w × h` texels that is 0 outside the interior's rounded bottom corners (radius `rx` by
 * `ry` texels) and 1 inside, so the square grid fits the rounded glass.
 */
export function cornerMask(w: number, h: number, rx: number, ry: number): Uint8Array {
  const mask = new Uint8Array(w * h).fill(1);
  if (rx <= 0 || ry <= 0) return mask;
  for (let y = 0; y < h; y++) {
    const dy = y + 0.5 - (h - ry);
    if (dy <= 0) continue;
    for (let x = 0; x < w; x++) {
      const dxl = rx - (x + 0.5);
      const dxr = x + 0.5 - (w - rx);
      const dx = dxl > 0 ? dxl : dxr > 0 ? dxr : 0;
      if (dx > 0 && (dx / rx) ** 2 + (dy / ry) ** 2 > 1) mask[y * w + x] = 0;
    }
  }
  return mask;
}

/** The colour of a cell value: palette for colours, `neutral` for hidden sand. */
function cellRgb(cell: number, palette: readonly Rgb[], neutral: Rgb): Rgb {
  return cell === NEUTRAL ? neutral : palette[(cell - 1) % palette.length];
}

/** How `paintGrid` dresses the sand. */
export interface PaintLook {
  /** 0 outside the interior's rounded corners (`cornerMask`). */
  readonly mask?: Uint8Array;
  /** The worn sand texture (jar styles), over every grain, hidden sand too. */
  readonly texture?: Overlay | null;
  /** Colour-blind patterns, by colour id (`null` entries or none: patterns off). Never on hidden sand. */
  readonly patterns?: readonly (Overlay | null)[] | null;
  /** Colour saturation, 1 as is (a locked jar's glass dulls its sand to 0.85, as the DOM's filter). */
  readonly saturation?: number;
  /**
   * Smooth the top surface over this many columns each side (`surfaceLine`), drawing only: a pile
   * settling after a pour shows a soft slope instead of one-cell stair-steps (strata-2en). 0 or
   * absent draws the cells as they are. Only for an upright grid (the target, or the source at rest).
   */
  readonly smooth?: number;
  /**
   * Wet sand (D189, §2.7): `rows` marks the grid rows of wet units (1 wet, one entry per row, top
   * first, `wetRows`) and `palette` is the damp tone of each colour (`wetRgb`). Hidden sand is never
   * wet. Absent or null: nothing is wet.
   */
  readonly wet?: { readonly rows: Uint8Array; readonly palette: readonly Rgb[] } | null;
}

/**
 * The resting surface of each column, in cells from the top: the first filled cell that is not a
 * falling grain, or `rows` for an empty column. Example: a flat band 4 rows deep in 8 rows gives 4s.
 */
export function surfaceTops(grid: SandGrid): Float32Array {
  const { cols, rows, cells } = grid;
  const tops = new Float32Array(cols).fill(rows);
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const i = y * cols + x;
      if (cells[i] === EMPTY) continue;
      // A falling grain (empty above and below) is not the surface.
      if (y > 0 && y < rows - 1 && cells[i - cols] === EMPTY && cells[i + cols] === EMPTY) continue;
      tops[x] = y;
      break;
    }
  }
  return tops;
}

/**
 * The drawn surface line (strata-2en): each column's resting top (`surfaceTops`) averaged with a
 * triangular weight over `radius` columns each side, among the columns that hold sand. A flat
 * surface stays exactly flat, and a 45 degree staircase becomes a straight slope through the
 * steps' middles. Drawing only: the grid's grains are untouched. Empty columns stay `rows`.
 * Example: `surfaceLine(grid, 3)[x] // 41.5`
 */
export function surfaceLine(grid: SandGrid, radius: number): Float32Array {
  const tops = surfaceTops(grid);
  const { cols, rows } = grid;
  if (!(radius > 0)) return tops;
  const r = Math.floor(radius);
  const line = new Float32Array(cols);
  for (let x = 0; x < cols; x++) {
    if (tops[x] >= rows) {
      line[x] = rows;
      continue;
    }
    let sum = 0;
    let weight = 0;
    for (let d = -r; d <= r; d++) {
      const nx = x + d;
      if (nx < 0 || nx >= cols || tops[nx] >= rows) continue;
      const w = r + 1 - Math.abs(d);
      sum += tops[nx] * w;
      weight += w;
    }
    line[x] = sum / weight;
  }
  return line;
}

/**
 * Paints `grid` into `out`, which is `(cols × sub) × (rows × sub)` texels. Empty cells and masked
 * texels are transparent. Example: `paintGrid(grid, palette, neutral, out, 2, { mask })`
 */
export function paintGrid(grid: SandGrid, palette: readonly Rgb[], neutral: Rgb, out: Uint32Array, sub: number, look: PaintLook = {}): void {
  const mask = look.mask;
  const { cols, rows, cells, shade } = grid;
  const w = cols * sub;
  // A grain with nothing above or below it is falling. Grains that entered together fall level
  // with each other, so they are drawn after the rest, nudged by their shade (drawing only), into
  // empty texels: the rows break up into a stream.
  const floating = (i: number, y: number) => y > 0 && y < rows - 1 && cells[i - cols] === EMPTY && cells[i + cols] === EMPTY;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const cell = cells[i];
      const t0 = y * sub * w + x * sub;
      if (cell === EMPTY || floating(i, y)) {
        for (let sy = 0; sy < sub; sy++) out.fill(0, t0 + sy * w, t0 + sy * w + sub);
        continue;
      }
      const pal = look.wet && look.wet.rows[y] === 1 && cell !== NEUTRAL ? look.wet.palette : palette;
      paintCell(grid, i, x, y, cellRgb(cell, pal, neutral), out, w, sub, t0, mask, false, look);
    }
  }
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (cells[i] === EMPTY || !floating(i, y)) continue;
      const s = shade[i];
      const ty = Math.min(rows - 1, Math.max(0, y + (((s >> 2) & 7) - 3.5) * 0.6));
      const tx = Math.min(cols - 1, Math.max(0, x + ((s & 3) - 1.5) * 0.4));
      const t0 = Math.floor(ty * sub) * w + Math.floor(tx * sub);
      paintCell(grid, i, x, y, cellRgb(cells[i], palette, neutral), out, w, sub, t0, mask, true, null);
    }
  }
  if (look.smooth) smoothSurface(grid, out, sub, surfaceLine(grid, look.smooth), mask);
}

/**
 * Redraws the texels at the top of each column to follow `line` (in cells), interpolated between
 * column centres at texel resolution, with one half-covered texel at the edge: texels above a
 * column's real top are filled with that column's top texel, texels below the line are cleared.
 * The sand below the surface is unchanged.
 */
function smoothSurface(grid: SandGrid, out: Uint32Array, sub: number, line: Float32Array, mask: Uint8Array | undefined): void {
  const { cols, rows } = grid;
  const tops = surfaceTops(grid);
  const w = cols * sub;
  const h = rows * sub;
  for (let tx = 0; tx < w; tx++) {
    const x = Math.floor(tx / sub);
    if (tops[x] >= rows) continue; // no sand in this column: nothing to shape
    // The line between column centres, in texels.
    const u = (tx + 0.5) / sub - 0.5;
    const a = Math.max(0, Math.min(cols - 1, Math.floor(u)));
    const b = Math.min(cols - 1, a + 1);
    const la = line[a] >= rows ? line[x] : line[a];
    const lb = line[b] >= rows ? line[x] : line[b];
    const f = Math.max(0, Math.min(1, u - a));
    const want = Math.max(0, Math.min(h, (la + (lb - la) * f) * sub));
    const top = tops[x] * sub; // the first texel of the real top cell
    const edge = Math.floor(want);
    const cover = 1 - (want - edge); // how much of the edge texel is sand
    if (want < top) {
      const src = out[top * w + tx];
      if ((src >>> 24) === 0) continue;
      for (let ty = edge + 1; ty < top; ty++) put(out, ty * w + tx, src, 1, mask);
      put(out, edge * w + tx, src, cover, mask);
    } else if (want > top) {
      for (let ty = top; ty < edge && ty < h; ty++) out[ty * w + tx] = 0;
      if (edge < h) put(out, edge * w + tx, out[edge * w + tx], cover, mask);
    }
  }
}

/** Writes texel `src` at `t` with `cover` (0..1) of its alpha, where the mask allows. */
function put(out: Uint32Array, t: number, src: number, cover: number, mask: Uint8Array | undefined): void {
  if (t < 0 || t >= out.length || (mask && !mask[t])) return;
  const a = Math.round((src >>> 24) * cover);
  out[t] = a === 0 ? 0 : ((src & 0xffffff) | (a << 24)) >>> 0;
}

/** One grain's `sub × sub` texels at `t0`. `onlyEmpty` keeps a nudged falling grain off settled sand. */
function paintCell(grid: SandGrid, i: number, x: number, y: number, c: Rgb, out: Uint32Array, w: number, sub: number, t0: number, mask: Uint8Array | undefined, onlyEmpty: boolean, look: PaintLook | null): void {
  const { cols, cells, shade } = grid;
  const cell = cells[i];
  const s = shade[i];
  // A worn sand piece brings its own texture, so the grain's own tone steps back for it.
  const quiet = look?.texture ? 0.5 : 1;
  let k = 0.87 + 0.2 * quiet * (s / 255) + 0.1 * (1 - quiet);
  const above = y > 0 ? cells[i - cols] : EMPTY;
  const exposed = above === EMPTY;
  if (exposed) k += 0.14;
  else if (y > 1 && cells[i - 2 * cols] === EMPTY) k += 0.06;
  if (x > 0 && cells[i - 1] === EMPTY) k += 0.05;
  if (x < cols - 1 && cells[i + 1] === EMPTY) k -= 0.06;
  // A thin shadow under a stratum line, where a different colour lies on top.
  const seam = !exposed && above !== cell;
  // A falling grain (look null) is drawn plain: textures and patterns belong to the resting sand.
  const texture = look?.texture ?? null;
  const pattern = look?.patterns && cell !== NEUTRAL ? look.patterns[cell - 1] ?? null : null;
  const sat = look?.saturation ?? 1;
  for (let sy = 0; sy < sub; sy++) {
    for (let sx = 0; sx < sub; sx++) {
      const t = t0 + sy * w + sx;
      if (t >= out.length) continue;
      if (mask && !mask[t]) {
        out[t] = 0;
        continue;
      }
      if (onlyEmpty && out[t] !== 0) continue;
      // Per-texel tone from the grain's own shade, so the texture travels with the grain.
      const n = (((s * 73 + (sy * sub + sx) * 151) ^ (s >> 3)) & 31) / 31;
      let kk = k + (n - 0.5) * 0.1 * quiet;
      if (seam && sy === 0) kk -= 0.12;
      let r = c.r * kk;
      let g = c.g * kk;
      let b = c.b * kk;
      if (s >= SPARKLE && sx === 0 && sy === 0) {
        r += (255 - r) * 0.7;
        g += (255 - g) * 0.7;
        b += (255 - b) * 0.7;
      }
      for (const o of [texture, pattern]) {
        if (!o) continue;
        const k = o.keep[t];
        r = r * k + o.add[t * 3];
        g = g * k + o.add[t * 3 + 1];
        b = b * k + o.add[t * 3 + 2];
      }
      if (sat !== 1) {
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = l + (r - l) * sat;
        g = l + (g - l) * sat;
        b = l + (b - l) * sat;
      }
      out[t] = pack(r, g, b);
    }
  }
}

/**
 * Paints falling grains into `out`, a `(cols × sub) × (rows × sub)` texture covering particle `y`
 * from `top` to `top + rows` (the air above the mouth is `top = -airRows`; the target's own grid is
 * `top = 0`). `clear` empties it first; otherwise grains only fill transparent texels, so they never
 * hide settled sand; `minY` skips grains above it (a narrow target draws only grains past its mouth). Each grain is one cell, nudged up or down a little by its shade so grains that
 * left the lip together don't fall in a line (drawing only; the stream keeps its width).
 */
export function paintParticles(view: ParticleView, cols: number, top: number, rows: number, palette: readonly Rgb[], neutral: Rgb, out: Uint32Array, sub: number, clear: boolean, minY = -Infinity): void {
  if (clear) out.fill(0);
  const w = cols * sub;
  const h = rows * sub;
  for (let p = 0; p < view.count; p++) {
    if (view.y[p] < minY) continue;
    const s = view.shade[p];
    const tx = Math.floor(view.x[p] * sub);
    const ty = Math.floor((view.y[p] - top + (((s >> 2) & 7) - 3.5) * 0.4) * sub);
    if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;
    const c = cellRgb(view.cell[p], palette, neutral);
    const k = 0.9 + 0.25 * (s / 255);
    const px = pack(c.r * k, c.g * k, c.b * k);
    for (let sy = 0; sy < sub && ty + sy < h; sy++) {
      for (let sx = 0; sx < sub && tx + sx < w; sx++) {
        const t = (ty + sy) * w + tx + sx;
        if (clear || out[t] === 0) out[t] = px;
      }
    }
  }
}
