/**
 * Turns a sand grid into texture pixels (sprint 19 S2). Pure: typed arrays in, typed arrays out.
 * Each cell is `sub × sub` texels, so one grain shows a little texture of its own; the grain's
 * shade (which moves with it) picks its tone, a few grains sparkle, and exposed tops catch the light.
 */
import { EMPTY, NEUTRAL, type ParticleView, type SandGrid } from '../sand';

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

/**
 * Paints `grid` into `out`, which is `(cols × sub) × (rows × sub)` texels. Empty cells and masked
 * texels are transparent. Example: `paintGrid(grid, palette, neutral, out, 2, mask)`
 */
export function paintGrid(grid: SandGrid, palette: readonly Rgb[], neutral: Rgb, out: Uint32Array, sub: number, mask?: Uint8Array): void {
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
      paintCell(grid, i, x, y, cellRgb(cell, palette, neutral), out, w, sub, t0, mask, false);
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
      paintCell(grid, i, x, y, cellRgb(cells[i], palette, neutral), out, w, sub, t0, mask, true);
    }
  }
}

/** One grain's `sub × sub` texels at `t0`. `onlyEmpty` keeps a nudged falling grain off settled sand. */
function paintCell(grid: SandGrid, i: number, x: number, y: number, c: Rgb, out: Uint32Array, w: number, sub: number, t0: number, mask: Uint8Array | undefined, onlyEmpty: boolean): void {
  const { cols, cells, shade } = grid;
  const cell = cells[i];
  const s = shade[i];
  let k = 0.87 + 0.2 * (s / 255);
  const above = y > 0 ? cells[i - cols] : EMPTY;
  const exposed = above === EMPTY;
  if (exposed) k += 0.14;
  else if (y > 1 && cells[i - 2 * cols] === EMPTY) k += 0.06;
  if (x > 0 && cells[i - 1] === EMPTY) k += 0.05;
  if (x < cols - 1 && cells[i + 1] === EMPTY) k -= 0.06;
  // A thin shadow under a stratum line, where a different colour lies on top.
  const seam = !exposed && above !== cell;
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
      let kk = k + (n - 0.5) * 0.1;
      if (seam && sy === 0) kk -= 0.12;
      let r = c.r * kk;
      let g = c.g * kk;
      let b = c.b * kk;
      if (s >= SPARKLE && sx === 0 && sy === 0) {
        r += (255 - r) * 0.7;
        g += (255 - g) * 0.7;
        b += (255 - b) * 0.7;
      }
      out[t] = pack(r, g, b);
    }
  }
}

/**
 * Paints the grains in the air into `out`, a `(cols × sub) × (airRows × sub)` texture whose bottom
 * row is the target's mouth (particle `y` 0) and whose top is the lip (`y = -airRows`).
 * Clears it first. Each grain is one cell.
 */
export function paintAir(view: ParticleView, cols: number, airRows: number, palette: readonly Rgb[], neutral: Rgb, out: Uint32Array, sub: number): void {
  out.fill(0);
  const w = cols * sub;
  const h = airRows * sub;
  for (let p = 0; p < view.count; p++) {
    // Grains that left the lip in the same step fall level with each other; a small offset from
    // each grain's shade (drawing only) breaks those rows up into a stream.
    const s = view.shade[p];
    const tx = Math.floor((view.x[p] + ((s & 3) - 1.5) * 0.6) * sub);
    const ty = Math.floor((view.y[p] + airRows + (((s >> 2) & 15) - 7.5) * 0.5) * sub);
    if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;
    const c = cellRgb(view.cell[p], palette, neutral);
    const k = 0.9 + 0.25 * (view.shade[p] / 255);
    const px = pack(c.r * k, c.g * k, c.b * k);
    for (let sy = 0; sy < sub && ty + sy < h; sy++) for (let sx = 0; sx < sub && tx + sx < w; sx++) out[(ty + sy) * w + tx + sx] = px;
  }
}
