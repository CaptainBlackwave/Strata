// PROTOTYPE - NOT FOR PRODUCTION
// Question: can a falling-sand pour run at 60 fps and stay in sync with the discrete pour rules?
// Date: 2026-11-11
// CPU falling-sand: per-jar grids (typed arrays) + a world-aligned scratch grid for the tilting jar.
import { CELL, GH, GW, HEAD, HIDDEN, IH, IW, PAL_RGB, WALL, BASE, pat, unitRows } from './consts';

/** One cell = colour+1 (0 empty) and a per-grain shade byte that travels with the grain. */
export class Grid {
  col = new Uint8Array(GW * GH);
  sh = new Uint8Array(GW * GH);
  dirty = true;
  clear(): void {
    this.col.fill(0);
    this.sh.fill(0);
    this.dirty = true;
  }
}

/** Fill a grid with the exact discrete state: bands of `unitRows` rows, bottom first. */
export function fillGrid(g: Grid, units: readonly number[], hidden: number, cap: number): void {
  g.clear();
  const ur = unitRows(cap);
  for (let k = 0; k < units.length; k++) {
    const c = (k < hidden ? HIDDEN : units[k]) + 1;
    for (let y = GH - (k + 1) * ur; y < GH - k * ur; y++) {
      for (let x = 0; x < GW; x++) {
        g.col[y * GW + x] = c;
        g.sh[y * GW + x] = (Math.random() * 256) | 0;
      }
    }
  }
}

/** Number of non-empty cells. */
export function count(g: Grid): number {
  let n = 0;
  for (let i = 0; i < g.col.length; i++) if (g.col[i]) n++;
  return n;
}

const LUT = PAL_RGB.map((c) => c);

/** Write a grid (w x h cells) into RGBA pixels. Lit from top-left: a cell with empty air above/left is brighter. */
export function renderCells(col: Uint8Array, sh: Uint8Array, w: number, h: number, out: Uint32Array, patterns: boolean, ox = 0, oy = 0): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = col[i];
      if (!c) { out[i] = 0; continue; }
      const rgb = LUT[c - 1];
      const s = sh[i];
      let k = 0.8 + 0.3 * (s / 255);
      if (y === 0 || !col[i - w]) k += 0.2;
      else if (y > 1 && !col[i - 2 * w]) k += 0.08;
      if (x === 0 || !col[i - 1]) k += 0.07;
      if (x === w - 1 || !col[i + 1]) k -= 0.06;
      if (patterns && pat(c - 1, x + ox, y + oy)) k *= 0.7;
      let r = rgb[0] * k, g = rgb[1] * k, b = rgb[2] * k;
      if (s >= 250) { r += (255 - r) * 0.55; g += (255 - g) * 0.55; b += (255 - b) * 0.55; }
      out[i] = (255 << 24) | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
    }
  }
}

/**
 * Settle one tick of an upright jar grid: fall (2 cells), slide diagonally, and a wide-range
 * "tumble" so heaps level out to a gentle angle of repose instead of a 45-degree cone.
 * Returns true when anything moved.
 */
export function settleStep(g: Grid, tick: number, level: number): boolean {
  const { col, sh } = g;
  let moved = false;
  const ltr = (tick & 1) === 0;
  for (let y = GH - 2; y >= 0; y--) {
    for (let k = 0; k < GW; k++) {
      const x = ltr ? k : GW - 1 - k;
      const i = y * GW + x;
      if (!col[i]) continue;
      const b = i + GW;
      if (!col[b]) {
        let d = b;
        if (y + 2 < GH && !col[b + GW]) d = b + GW;
        col[d] = col[i]; sh[d] = sh[i]; col[i] = 0; sh[i] = 0; moved = true;
        continue;
      }
      const first = Math.random() < 0.5 ? -1 : 1;
      for (let t = 0; t < 2; t++) {
        const dx = t === 0 ? first : -first;
        const nx = x + dx;
        if (nx < 0 || nx >= GW) continue;
        if (!col[i + dx] && !col[b + dx]) {
          col[b + dx] = col[i]; sh[b + dx] = sh[i]; col[i] = 0; sh[i] = 0; moved = true;
          break;
        }
      }
    }
  }
  if (level > 0) {
    // tumble: a surface grain hops to a lower column up to 5 away when the height gap is >= 2 (about 27 deg)
    const top = new Int16Array(GW);
    for (let x = 0; x < GW; x++) {
      let y = 0;
      while (y < GH && !col[y * GW + x]) y++;
      top[x] = y;
    }
    for (let n = 0; n < level; n++) {
      const x = (Math.random() * GW) | 0;
      if (top[x] >= GH) continue;
      const dist = 3 + ((Math.random() * 3) | 0);
      const nx = x + (Math.random() < 0.5 ? -dist : dist);
      if (nx < 0 || nx >= GW) continue;
      if (top[nx] - top[x] >= 3 && top[nx] - 1 >= 0) {
        const si = top[x] * GW + x, di = (top[nx] - 1) * GW + nx;
        col[di] = col[si]; sh[di] = sh[si]; col[si] = 0; sh[si] = 0;
        top[x]++; top[nx]--; moved = true;
      }
    }
  }
  if (moved) g.dirty = true;
  return moved;
}

/** Drop one grain of colour `c` into a jar grid at local design-px x, returns false if there was no room. */
export function landGrain(g: Grid, lx: number, ly: number, c: number, shade: number): boolean {
  let gx = Math.floor((lx + IW / 2) / CELL);
  gx = gx < 0 ? 0 : gx >= GW ? GW - 1 : gx;
  let gy = Math.floor((ly + IH) / CELL);
  if (gy < 0) gy = 0;
  if (gy >= GH) gy = GH - 1;
  // fall to rest
  while (gy + 1 < GH && !g.col[(gy + 1) * GW + gx]) gy++;
  // occupied (hit the pile from above while inside it)? climb
  while (gy >= 0 && g.col[gy * GW + gx]) gy--;
  if (gy < 0) return false;
  g.col[gy * GW + gx] = c + 1;
  g.sh[gy * GW + gx] = shade;
  g.dirty = true;
  return true;
}

/** True when a falling grain at local (lx, ly) has reached the pile or floor. */
export function grainResting(g: Grid, lx: number, ly: number): boolean {
  let gx = Math.floor((lx + IW / 2) / CELL);
  gx = gx < 0 ? 0 : gx >= GW ? GW - 1 : gx;
  const gy = Math.floor((ly + IH) / CELL);
  if (gy < 0) return false;
  if (gy + 1 >= GH) return true;
  return g.col[(gy + 1) * GW + gx] !== 0 || g.col[gy * GW + gx] !== 0;
}

// ---------------------------------------------------------------------------------------------
// Source jar: a world-aligned grid. The jar's rotated walls are rasterised into `mask` every
// frame, gravity is plain "down", and a lean toward the lip (growing with tilt) stands in for
// sand that is avalanching over a tilted floor. Grains that cross the lip become particles.

export interface Emit { (x: number, y: number, c: number, sh: number, vx: number, vy: number): void }

const OFFS: [number, number][] = [];
for (let r = 1; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) OFFS.push([dx, dy]);
OFFS.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));

export class SrcSim {
  w: number;
  h: number;
  col: Uint8Array;
  sh: Uint8Array;
  mask: Uint8Array;
  /** world px of the grid's top-left corner */
  ox: number;
  oy: number;
  emitted = 0;
  lost = 0;
  /** no more than this many grains may leave the jar (the discrete rules decide how much moves) */
  limit = 1e9;
  /** 1 = lip on the right, -1 = lip on the left */
  s: number;
  /** pivot (world), local pivot point, and current rotation (signed, radians) */
  pvx = 0; pvy = 0; qx = 0; qy = 0; rot = 0;

  constructor(w: number, h: number, ox: number, oy: number, s: number, private emit: Emit) {
    this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.s = s;
    this.col = new Uint8Array(w * h);
    this.sh = new Uint8Array(w * h);
    this.mask = new Uint8Array(w * h);
  }

  /** World -> jar-local coordinates under the current pose. */
  toLocal(wx: number, wy: number): [number, number] {
    const dx = wx - this.pvx, dy = wy - this.pvy;
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    return [this.qx + dx * c + dy * s, this.qy - dx * s + dy * c];
  }

  /** Re-rasterise the jar walls for a new pose and push grains out of cells that became wall. */
  setPose(pvx: number, pvy: number, rot: number): void {
    this.pvx = pvx; this.pvy = pvy; this.rot = rot;
    const { w, h, mask, col, sh } = this;
    const c = Math.cos(rot), s = Math.sin(rot);
    const hx = IW / 2, hw = IW / 2 + WALL;
    for (let j = 0; j < h; j++) {
      const wy = this.oy + (j + 0.5) * CELL - pvy;
      for (let i = 0; i < w; i++) {
        const wx = this.ox + (i + 0.5) * CELL - pvx;
        const lx = this.qx + wx * c + wy * s;
        const ly = this.qy - wx * s + wy * c;
        let m = 0;
        if (ly >= -IH && ly <= BASE) {
          if (lx >= -hx && lx <= hx && ly <= 0) m = 1;
          else if (lx >= -hw && lx <= hw) m = 2;
        }
        mask[j * w + i] = m;
      }
    }
    // eject
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (!col[k] || mask[k] !== 2) continue;
        let done = false;
        for (let o = 0; o < OFFS.length; o++) {
          const ni = i + OFFS[o][0], nj = j + OFFS[o][1];
          if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
          const nk = nj * w + ni;
          if (col[nk] || mask[nk] !== 1) continue;
          col[nk] = col[k]; sh[nk] = sh[k]; col[k] = 0; sh[k] = 0; done = true;
          break;
        }
        if (!done) { col[k] = 0; sh[k] = 0; this.lost++; }
      }
    }
  }

  private spill(i: number, j: number): void {
    const k = j * this.w + i;
    const c = this.col[k] - 1, s = this.sh[k];
    this.col[k] = 0; this.sh[k] = 0;
    this.emitted++;
    const sp = 45 + Math.random() * 55, a = this.rot;
    this.emit(this.ox + (i + 0.5) * CELL, this.oy + (j + 0.5) * CELL, c, s, Math.cos(a) * sp * this.s + (Math.random() - 0.5) * 12, Math.sin(a) * sp * this.s + 10 + Math.random() * 20);
  }

  /** Load grains from an upright-or-tilted local grid by sampling it for every in-jar world cell. */
  loadFromLocal(g: Grid): void {
    const { w, h, mask, col, sh } = this;
    col.fill(0); sh.fill(0);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (mask[j * w + i] !== 1) continue;
        const [lx, ly] = this.toLocal(this.ox + (i + 0.5) * CELL, this.oy + (j + 0.5) * CELL);
        const gx = Math.floor((lx + IW / 2) / CELL), gy = Math.floor((ly + IH) / CELL);
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
        const gi = gy * GW + gx;
        if (g.col[gi]) { col[j * w + i] = g.col[gi]; sh[j * w + i] = g.sh[gi]; }
      }
    }
  }

  /** One CA tick. Gravity is world-down; `lean` (0..2) tilts the preferred direction toward the lip. */
  step(lean: number): void {
    const { w, h, col, sh, mask, s } = this;
    const free = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < w && j < h && col[j * w + i] === 0 && mask[j * w + i] !== 2 && (mask[j * w + i] === 1 || this.emitted < this.limit);
    for (let j = h - 1; j >= 0; j--) {
      for (let n = 0; n < w; n++) {
        const i = s > 0 ? w - 1 - n : n;
        const k = j * w + i;
        if (!col[k]) continue;
        if (mask[k] === 2) continue;
        let dirs: number[][];
        const r = Math.random() < 0.5;
        if (lean === 0) dirs = [[0, 1], r ? [s, 1] : [-s, 1], r ? [-s, 1] : [s, 1]];
        else if (lean === 1) dirs = [[s, 1], [0, 1], [s, 0], [-s, 1]];
        else dirs = [[s, 0], [s, 1], [0, 1], [-s, 1]];
        for (let d = 0; d < dirs.length; d++) {
          const dx = dirs[d][0], dy = dirs[d][1];
          const ni = i + dx, nj = j + dy;
          if (!free(ni, nj)) continue;
          // do not squeeze through a diagonal gap between two solid cells
          if (dx !== 0 && dy !== 0 && !free(i + dx, j) && !free(i, j + dy)) continue;
          const nk = nj * w + ni;
          col[nk] = col[k]; sh[nk] = sh[k]; col[k] = 0; sh[k] = 0;
          if (mask[nk] === 0) this.spill(ni, nj);
          break;
        }
      }
    }
  }

  /** Grains left inside the jar. */
  remaining(): number {
    let n = 0;
    for (let i = 0; i < this.col.length; i++) if (this.col[i]) n++;
    return n;
  }
}

export { HEAD };
