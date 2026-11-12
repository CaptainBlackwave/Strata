/**
 * The simulated pour (sprint 19 S1, docs/architecture/adr-0001-gpu-sand-board.md, decision 2).
 * The rules have already decided the pour; this only plays it out as sand:
 * 1. the source tips toward the target, and its loose grains flow toward the lip;
 * 2. grains that cross the lip fall through the air as particles;
 * 3. they enter the target's top and pile with falling-sand rules (down, else diagonal);
 * 4. the source tips back, and both grids settle. `finish` then snaps both to the board.
 *
 * Exactly `pourAmount × grainsPerUnit` grains leave the source, all of the top colour: only the
 * grains of the poured bands are loose, and every other grain is held where it is, so no other
 * colour can reach the lip (the prototype's "jar empties, then snaps back" bug can't happen).
 *
 * The source grid stays in jar-local cells: tilting rotates the flow direction instead of
 * re-rasterising walls, so no grain is ever pushed out of the glass or lost. Upright the flow is
 * straight down; as the jar tips it turns toward the lip wall, and at full tilt it points up the
 * tipped wall and out of the mouth (`flowEndDeg`). At full tilt every loose grain has an upward
 * move, so all of them leave: the pour always completes. The renderer draws the spilled grains
 * leaving from the lip.
 */
import { type Board, type Color, pourAmount, topRun } from '../../core/board';
import { createRng, mixSeed, type Rng } from '../../core/rng';
import { type SandConfig, sandConfig } from './config';
import { EMPTY, type SandDims, type SandGrid, bandRows, grainsPerUnit, gridFromJar, NEUTRAL } from './grid';

/** Where a pour is: tipping (and spilling), tipping back, settling upright, or done. */
export type PourPhase = 'tilt' | 'return' | 'settle' | 'done';

/**
 * Falling grains, in the target's cell space: `x` runs across the target (0..cols) and `y`
 * is cells below its mouth. It starts at `-airRows` (the lip), is negative above the mouth, and
 * positive once the grain falls inside the target, toward the pile, where it lands.
 * Only the first `count` entries are live.
 */
export interface ParticleView {
  readonly count: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** The grain's cell value (colour id + 1). */
  readonly cell: Uint8Array;
  readonly shade: Uint8Array;
}

/** A pour being played out. Read-only views for the renderer; drive it with `step`. */
export interface PourSim {
  readonly from: number;
  readonly to: number;
  /** Units the rules move. */
  readonly amount: number;
  /** The poured colour. */
  readonly color: Color;
  /** Grains that must move: `amount × grainsPerUnit`. */
  readonly required: number;
  /** Which side of the source the lip is on: 1 right, -1 left (toward the target). */
  readonly side: 1 | -1;
  readonly dims: SandDims;
  readonly source: SandGrid;
  readonly target: SandGrid;
  /** The source's tilt in radians (0 upright, positive toward `side`). */
  readonly tilt: number;
  readonly particles: ParticleView;
  readonly phase: PourPhase;
  /** Steps run so far. */
  readonly steps: number;
  /** Grains that have crossed the lip. */
  readonly emitted: number;
  /** Grains that have entered the target. */
  readonly landed: number;
}

/** Optional settings for `planPour`. */
export interface PourOptions {
  /** The lip's side; defaults to toward the target by jar index (right when `to > from`). */
  readonly side?: 1 | -1;
  /** Tuning; defaults to game-config.json `sand`. */
  readonly config?: SandConfig;
  /**
   * Where the stream falls, as a column in the target's cells (the lip held over the opening).
   * Given, each grain falls straight down within `streamWidth` of it (strata-085). Absent, grains
   * leave from the target's near edge and fan out across `streamSpread` of its width.
   */
  readonly streamCol?: number;
  /** The stream's width in cells around `streamCol` (default 1). */
  readonly streamWidth?: number;
}

/** Optional settings for one `step`. */
export interface StepOptions {
  /**
   * Hold the spill: the jar still tips and its grains still flow to the mouth, but none leaves
   * (strata-r8z: the renderer holds it until the lip is over the target).
   */
  readonly holdSpill?: boolean;
}

/** How much `finish` had to change. */
export interface SnapReport {
  /** Cells whose content changed, not counting reveals. */
  readonly changed: number;
  /** Hidden cells that turned into their real colour (the board revealed a unit). */
  readonly revealed: number;
  /** All cells in both grids. */
  readonly cells: number;
  /** `changed / cells`. */
  readonly ratio: number;
}

const DEG = Math.PI / 180;
/** The 8 neighbours as [dx, dy]. */
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
];

/** One allowed move for loose source grains this step. `tie` means it ties with the next one. */
interface Dir {
  readonly dx: number;
  readonly dy: number;
  readonly tie: boolean;
}

class Sim implements PourSim {
  phase: PourPhase = 'tilt';
  tilt = 0;
  steps = 0;
  emitted = 0;
  landed = 0;
  /** Steps since every grain landed with the source upright. */
  settling = 0;
  /** Consecutive steps without movement. */
  quiet = 0;
  looseLeft: number;
  readonly loose: Uint8Array;
  readonly stamp: Uint32Array;
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly pvx: Float32Array;
  readonly pvy: Float32Array;
  readonly pcell: Uint8Array;
  readonly pshade: Uint8Array;
  pcount = 0;
  /** Source flow passes run so far; stamps which grains already moved in a pass. */
  pass = 0;
  /** Grains spilled in the current step, against `spillPerStep`. */
  spilledThisStep = 0;
  /** The spill is held this step. */
  hold = false;
  /** The stream's column and width, when the pour has one. */
  streamCol: number | null = null;
  streamWidth = 1;
  /** Steps a grain takes to fall `airRows` from rest. */
  readonly fallSteps: number;
  readonly particles: ParticleView;

  constructor(
    readonly from: number,
    readonly to: number,
    readonly amount: number,
    readonly color: Color,
    readonly required: number,
    readonly side: 1 | -1,
    readonly dims: SandDims,
    readonly source: SandGrid,
    readonly target: SandGrid,
    readonly seed: number,
    readonly rng: Rng,
    readonly config: SandConfig,
  ) {
    const n = dims.cols * dims.rows;
    this.loose = new Uint8Array(n);
    this.stamp = new Uint32Array(n);
    this.looseLeft = required;
    this.px = new Float32Array(required);
    this.py = new Float32Array(required);
    this.pvx = new Float32Array(required);
    this.pvy = new Float32Array(required);
    this.pcell = new Uint8Array(required);
    this.pshade = new Uint8Array(required);
    let t = 0;
    let fallen = 0;
    while (fallen < config.airRows) fallen += ++t * config.airGravity;
    this.fallSteps = Math.max(1, t);
    const self = this;
    this.particles = {
      get count() { return self.pcount; },
      x: this.px,
      y: this.py,
      cell: this.pcell,
      shade: this.pshade,
    };
  }
}

function asSim(sim: PourSim): Sim {
  if (!(sim instanceof Sim)) throw new Error('Not a PourSim from planPour');
  return sim;
}

/**
 * Plans the sand for a legal pour. `seed` makes every step reproducible. Grids are built with the
 * board's capacity, so the source and target share one band size. Throws for an illegal pour.
 * Example: `const sim = planPour(board, 0, 3, defaultDims(), 7); while (!done(sim)) step(sim);`
 */
export function planPour(board: Board, from: number, to: number, dims: SandDims, seed: number, options: PourOptions = {}): PourSim {
  const amount = pourAmount(board, from, to);
  if (amount === 0) throw new Error(`Illegal pour ${from} -> ${to}`);
  const config = options.config ?? sandConfig;
  const capacity = board.capacity;
  const src = board.jars[from];
  const color = topRun(src)!.color;
  const source = gridFromJar(src, capacity, dims, mixSeed(seed, 1));
  const target = gridFromJar(board.jars[to], capacity, dims, mixSeed(seed, 2));
  const required = amount * grainsPerUnit(capacity, dims);
  const side = options.side ?? (to > from ? 1 : -1);
  const sim = new Sim(from, to, amount, color, required, side, dims, source, target, seed, createRng(seed), config);
  if (options.streamCol !== undefined) {
    sim.streamCol = Math.min(dims.cols, Math.max(0, options.streamCol));
    sim.streamWidth = Math.max(0, options.streamWidth ?? 1);
  }
  // The poured bands are the top `amount` of the source's units; only they may move.
  const band = bandRows(capacity, dims);
  const n = src.units.length;
  const top = dims.rows - n * band;
  const bottom = dims.rows - (n - amount) * band;
  sim.loose.fill(1, top * dims.cols, bottom * dims.cols);
  return sim;
}

/** Advances the pour one tick. Does nothing once `done`. `holdSpill` keeps every grain in the source this step. */
export function step(pourSim: PourSim, options: StepOptions = {}): void {
  const sim = asSim(pourSim);
  if (sim.phase === 'done') return;
  const c = sim.config;
  sim.steps++;
  sim.spilledThisStep = 0;
  sim.hold = options.holdSpill === true;
  const maxTilt = c.maxTiltDeg * DEG;
  if (sim.phase === 'tilt') {
    sim.tilt = Math.min(maxTilt, sim.tilt + c.tiltPerStepDeg * DEG);
    if (sim.looseLeft === 0) sim.phase = 'return';
  } else if (sim.phase === 'return') {
    sim.tilt = Math.max(0, sim.tilt - c.returnPerStepDeg * DEG);
    if (sim.tilt === 0) sim.phase = 'settle';
  }
  let moved = false;
  for (let pass = 0; pass < c.flowPassesPerStep && sim.looseLeft > 0; pass++) moved = flowSource(sim) || moved;
  if (sim.phase !== 'tilt') moved = settleGrid(sim.source, sim.rng, c) || moved;
  moved = advanceAir(sim) || moved;
  moved = settleGrid(sim.target, sim.rng, c) || moved;
  sim.quiet = moved ? 0 : sim.quiet + 1;
  const allLanded = sim.landed === sim.required;
  if (allLanded && sim.phase === 'settle') sim.settling++;
  const settled = allLanded && sim.phase === 'settle' && sim.quiet >= c.quietSteps;
  if (settled || sim.settling >= c.settleSteps || sim.steps >= c.maxSteps) sim.phase = 'done';
}

/** True when every grain has landed and both grids have settled, or the step cap was reached. */
export function done(sim: PourSim): boolean {
  return sim.phase === 'done';
}

/**
 * Ends the pour: clears the air and snaps both grids exactly to `gridFromJar` of the post-pour
 * jars in `boardAfter` (the board `pour` returned). A grain whose cell doesn't change keeps its
 * shade, so the snap doesn't shimmer. Reports how many cells changed.
 */
export function finish(pourSim: PourSim, boardAfter: Board): SnapReport {
  const sim = asSim(pourSim);
  const capacity = boardAfter.capacity;
  const a = snapGrid(sim.source, gridFromJar(boardAfter.jars[sim.from], capacity, sim.dims, mixSeed(sim.seed, 3)));
  const b = snapGrid(sim.target, gridFromJar(boardAfter.jars[sim.to], capacity, sim.dims, mixSeed(sim.seed, 4)));
  sim.pcount = 0;
  sim.loose.fill(0);
  sim.looseLeft = 0;
  sim.tilt = 0;
  sim.phase = 'done';
  const cells = sim.source.cells.length + sim.target.cells.length;
  const changed = a.changed + b.changed;
  return { changed, revealed: a.revealed + b.revealed, cells, ratio: changed / cells };
}

function snapGrid(grid: SandGrid, want: SandGrid): { changed: number; revealed: number } {
  let changed = 0;
  let revealed = 0;
  const { cells, shade } = grid;
  for (let i = 0; i < cells.length; i++) {
    const was = cells[i];
    const now = want.cells[i];
    if (was === now) continue;
    if (was === NEUTRAL && now !== EMPTY) revealed++;
    else changed++;
    cells[i] = now;
    if (now === EMPTY) shade[i] = 0;
    else if (was === EMPTY) shade[i] = want.shade[i];
  }
  return { changed, revealed };
}

/** The moves loose source grains may make at this tilt, best first, ties flagged. */
function flowDirs(sim: Sim): Dir[] {
  const c = sim.config;
  // Flow angle below the horizontal, toward the lip side: 90 deg (straight down) upright, through
  // 0 (along the floor to the lip wall), to `flowEndDeg` (up the tipped wall, out of the mouth) at full tilt.
  const frac = c.maxTiltDeg > 0 ? sim.tilt / (c.maxTiltDeg * DEG) : 1;
  const angle = (90 + (c.flowEndDeg - 90) * frac) * DEG;
  const gx = sim.side * Math.cos(angle);
  const gy = Math.sin(angle);
  const minCos = Math.cos(c.reposeDeg * DEG);
  const scored = NEIGHBOURS.map(([dx, dy]) => ({ dx, dy, cos: (dx * gx + dy * gy) / Math.hypot(dx, dy) }))
    .filter((d) => d.cos >= minCos)
    .sort((p, q) => q.cos - p.cos || p.dy - q.dy || p.dx - q.dx);
  return scored.map((d, k) => ({ dx: d.dx, dy: d.dy, tie: k + 1 < scored.length && Math.abs(scored[k + 1].cos - d.cos) < 1e-9 }));
}

/** One flow pass of the tilted source. Only loose grains move; a grain that leaves through the mouth spills. */
function flowSource(sim: Sim): boolean {
  const c = sim.config;
  const { cols, rows, cells, shade } = sim.source;
  const { loose, stamp, side, rng } = sim;
  const tick = ++sim.pass;
  const dirs = flowDirs(sim);
  if (dirs.length === 0) return false;
  let moved = false;
  // A cell a grain could enter: an empty in-glass cell, or the open mouth above row 0 while the spill allows.
  const open = (x: number, y: number): boolean => {
    if (x < 0 || x >= cols || y >= rows) return false;
    if (y < 0) return !sim.hold && sim.spilledThisStep < c.spillPerStep;
    return cells[y * cols + x] === EMPTY;
  };
  const upward = dirs[0].dy < 0;
  const order = new Array<Dir>(dirs.length);
  for (let r = 0; r < rows; r++) {
    const y = upward ? r : rows - 1 - r;
    for (let k = 0; k < cols; k++) {
      const x = side > 0 ? cols - 1 - k : k;
      const i = y * cols + x;
      if (!loose[i] || stamp[i] === tick) continue;
      if (rng() >= c.slideChance) continue;
      for (let d = 0; d < dirs.length; d++) {
        if (dirs[d].tie && rng() < 0.5) {
          order[d] = dirs[d + 1];
          order[d + 1] = dirs[d];
          d++;
        } else order[d] = dirs[d];
      }
      for (let d = 0; d < order.length; d++) {
        const { dx, dy } = order[d];
        const nx = x + dx;
        const ny = y + dy;
        if (!open(nx, ny)) continue;
        // No squeezing through a diagonal gap between two solid cells.
        if (dx !== 0 && dy !== 0 && !open(x + dx, y) && !open(x, y + dy)) continue;
        moved = true;
        if (ny < 0) {
          spill(sim, cells[i], shade[i]);
          sim.spilledThisStep++;
        } else {
          const j = ny * cols + nx;
          cells[j] = cells[i];
          shade[j] = shade[i];
          loose[j] = 1;
          stamp[j] = tick;
        }
        cells[i] = EMPTY;
        shade[i] = 0;
        loose[i] = 0;
        break;
      }
    }
  }
  return moved;
}

/** A grain leaves the source and starts falling toward a seeded spot across the target's mouth. */
function spill(sim: Sim, cell: number, grainShade: number): void {
  const c = sim.config;
  const cols = sim.dims.cols;
  const p = sim.pcount++;
  if (sim.streamCol !== null) {
    // A narrow stream straight down under the lip.
    sim.px[p] = sim.streamCol + (sim.rng() - 0.5) * sim.streamWidth;
    sim.pvx[p] = 0;
  } else {
    const x0 = sim.side > 0 ? 0 : cols;
    const land = cols / 2 + (sim.rng() - 0.5) * c.streamSpread * cols;
    sim.px[p] = x0;
    sim.pvx[p] = (land - x0) / sim.fallSteps;
  }
  sim.py[p] = -c.airRows;
  sim.pvy[p] = 0;
  sim.pcell[p] = cell;
  sim.pshade[p] = grainShade;
  sim.emitted++;
  sim.looseLeft--;
}

/**
 * Moves the falling grains one tick. Above the mouth a grain falls freely; inside the target it
 * keeps falling down its column until it meets the pile, then rolls downhill (to whichever side
 * goes lower, one column per row of drop) and rests there. So a narrow stream heaps into a cone
 * instead of a tower, and its width never limits how fast it pours. With every column full to the
 * mouth a grain waits in the air.
 */
function advanceAir(sim: Sim): boolean {
  if (sim.pcount === 0) return false;
  const g = sim.config.airGravity;
  const { cols, rows, cells, shade } = sim.target;
  const { px, py, pvx, pvy, pcell, pshade } = sim;
  // The lowest empty row from the mouth down column `c` (-1 when it is full to the mouth).
  const restAt = (c: number): number => {
    let r = -1;
    while (r + 1 < rows && cells[(r + 1) * cols + c] === EMPTY) r++;
    return r;
  };
  let p = 0;
  while (p < sim.pcount) {
    pvy[p] += g;
    py[p] += pvy[p];
    px[p] += pvx[p];
    if (py[p] < 0) { p++; continue; }
    const want = Math.min(cols - 1, Math.max(0, Math.floor(px[p])));
    const here = restAt(want);
    if (py[p] < here) { p++; continue; } // still falling inside the jar
    let best = want;
    let bestRest = here;
    const first = sim.rng() < 0.5 ? -1 : 1;
    for (const dir of [first, -first]) {
      let c = want;
      let r = here;
      while (c + dir >= 0 && c + dir < cols) {
        const next = restAt(c + dir);
        if (next <= r) break;
        c += dir;
        r = next;
      }
      if (r > bestRest) { best = c; bestRest = r; }
    }
    if (bestRest < 0) {
      // Full to the mouth around here: take the nearest column with room, as a brimming jar's last grains must.
      for (let r = 1; r < cols && bestRest < 0; r++) {
        for (const c of [want - r, want + r]) {
          if (c < 0 || c >= cols || bestRest >= 0) continue;
          const rest = restAt(c);
          if (rest >= 0) { best = c; bestRest = rest; }
        }
      }
    }
    if (bestRest < 0) { py[p] = 0; pvy[p] = 0; p++; continue; } // the mouth is full: wait in the air
    const slot = bestRest * cols + best;
    cells[slot] = pcell[p];
    shade[slot] = pshade[p];
    sim.landed++;
    const last = --sim.pcount;
    px[p] = px[last]; py[p] = py[last]; pvx[p] = pvx[last]; pvy[p] = pvy[last];
    pcell[p] = pcell[last]; pshade[p] = pshade[last];
  }
  return true;
}

/**
 * One tick of upright falling sand: a grain falls up to `fallCellsPerStep` cells, else slides
 * diagonally down (seeded side first), else, by `levelChance`, creeps along the surface up to
 * `levelReach` columns to a lower spot, so piles level out. Every move goes down a row, so a
 * bottom-up sweep moves each grain at most once. Returns true when anything moved.
 */
function settleGrid(grid: SandGrid, rng: Rng, c: SandConfig): boolean {
  const { cols, rows, cells, shade } = grid;
  let moved = false;
  for (let y = rows - 2; y >= 0; y--) {
    const ltr = ((y + rows) & 1) === 0;
    for (let k = 0; k < cols; k++) {
      const x = ltr ? k : cols - 1 - k;
      const i = y * cols + x;
      if (cells[i] === EMPTY) continue;
      let to = -1;
      if (cells[i + cols] === EMPTY) {
        to = i + cols;
        for (let f = 1, yy = y + 2; f < c.fallCellsPerStep && yy < rows && cells[yy * cols + x] === EMPTY; f++, yy++) to = yy * cols + x;
      } else {
        // Skip grains with no room on either side below them before spending random numbers.
        const leftOpen = x > 0 && cells[i - 1] === EMPTY;
        const rightOpen = x < cols - 1 && cells[i + 1] === EMPTY;
        if (!leftOpen && !rightOpen) continue;
        const first = rng() < 0.5 ? -1 : 1;
        const reach = rng() < c.levelChance ? c.levelReach : 1;
        for (let t = 0; t < 2 && to < 0; t++) {
          const dx = t === 0 ? first : -first;
          for (let s = 1; s <= reach; s++) {
            const nx = x + dx * s;
            if (nx < 0 || nx >= cols || cells[y * cols + nx] !== EMPTY) break;
            if (cells[(y + 1) * cols + nx] === EMPTY) { to = (y + 1) * cols + nx; break; }
          }
        }
      }
      if (to < 0) continue;
      cells[to] = cells[i];
      shade[to] = shade[i];
      cells[i] = EMPTY;
      shade[i] = 0;
      moved = true;
    }
  }
  return moved;
}

/** Grains in the air right now. */
export function airCount(sim: PourSim): number {
  return sim.particles.count;
}
