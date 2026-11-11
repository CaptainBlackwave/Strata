/**
 * Per-jar sand grids (sprint 19 S1, docs/architecture/adr-0001-gpu-sand-board.md).
 * A grid is `cols × rows` cells, row 0 at the top. A cell is 0 when empty, otherwise a colour id
 * plus one, or `NEUTRAL` for hidden sand. A parallel shade byte travels with each grain.
 * Pure typed arrays: no Pixi, no DOM, no timers.
 */
import type { Color, Jar } from '../../core/board';
import { mixSeed } from '../../core/rng';

/** An empty cell. */
export const EMPTY = 0;
/** The cell value for hidden (buried, unknown) sand. Never a real colour's cell. */
export const NEUTRAL = 255;
/** The largest colour id a grid can store (its cell is `MAX_COLOR + 1`, just below `NEUTRAL`). */
export const MAX_COLOR = NEUTRAL - 2;

/** The size of one jar grid in cells. */
export interface SandDims {
  readonly cols: number;
  readonly rows: number;
}

/** One jar's sand. Index a cell as `y * cols + x`. Treat the arrays as read-only outside the simulation. */
export interface SandGrid {
  readonly cols: number;
  readonly rows: number;
  /** 0 empty, colour id + 1, or `NEUTRAL`. */
  readonly cells: Uint8Array;
  /** Per-grain shade (0..255) that moves with the grain; 0 where empty. */
  readonly shade: Uint8Array;
}

/** The cell value for a colour. Throws for a colour the grid can't store. Example: `cellOf(0) // 1` */
export function cellOf(color: Color): number {
  if (!Number.isInteger(color) || color < 0 || color > MAX_COLOR) throw new Error(`Colour ${color} can't be stored in a sand grid`);
  return color + 1;
}

/** The colour in a cell, or `null` for an empty or neutral cell. Example: `colorOfCell(3) // 2` */
export function colorOfCell(cell: number): Color | null {
  return cell === EMPTY || cell === NEUTRAL ? null : cell - 1;
}

/**
 * Rows in one unit's band: `floor(rows / capacity)`. Leftover rows are headroom at the top.
 * Throws when a band would be empty. Example: `bandRows(4, { cols: 32, rows: 72 }) // 18`
 */
export function bandRows(capacity: number, dims: SandDims): number {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error(`Bad capacity ${capacity}`);
  if (!Number.isInteger(dims.cols) || !Number.isInteger(dims.rows) || dims.cols < 1) throw new Error('Bad sand dims');
  const band = Math.floor(dims.rows / capacity);
  if (band < 1) throw new Error(`${dims.rows} rows can't hold ${capacity} units`);
  return band;
}

/** Grains in one unit: exactly one band's cells. Example: `grainsPerUnit(4, { cols: 32, rows: 72 }) // 576` */
export function grainsPerUnit(capacity: number, dims: SandDims): number {
  return dims.cols * bandRows(capacity, dims);
}

/** An empty grid. */
export function createGrid(dims: SandDims): SandGrid {
  const n = dims.cols * dims.rows;
  return { cols: dims.cols, rows: dims.rows, cells: new Uint8Array(n), shade: new Uint8Array(n) };
}

/** A grain's shade from a seed and its cell index, so a fresh grid is deterministic. */
export function grainShade(seed: number, index: number): number {
  return mixSeed(seed, index) & 255;
}

/**
 * The exact discrete state of a jar as sand: one band of `bandRows(capacity)` rows per unit,
 * bottom first. Units below `jar.hidden` are `NEUTRAL`. Shades come from `seed`.
 * Pass the board's capacity (not a narrow jar's own) so every jar has the same grains per unit.
 * Example: `gridFromJar({ units: [0, 1], hidden: 1 }, 4, dims)`
 */
export function gridFromJar(jar: Jar, capacity: number, dims: SandDims, seed = 0): SandGrid {
  const band = bandRows(capacity, dims);
  if (jar.units.length * band > dims.rows) throw new Error(`A jar of ${jar.units.length} units doesn't fit ${dims.rows} rows`);
  const grid = createGrid(dims);
  const { cols, rows, cells, shade } = grid;
  for (let k = 0; k < jar.units.length; k++) {
    const value = k < jar.hidden ? NEUTRAL : cellOf(jar.units[k]);
    for (let y = rows - (k + 1) * band; y < rows - k * band; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        cells[i] = value;
        shade[i] = grainShade(seed, i);
      }
    }
  }
  return grid;
}

/** Non-empty cells in a grid. */
export function countGrains(grid: SandGrid): number {
  let n = 0;
  const { cells } = grid;
  for (let i = 0; i < cells.length; i++) if (cells[i] !== EMPTY) n++;
  return n;
}

/** Cells holding exactly `cell`. Example: `countCell(grid, cellOf(2))` */
export function countCell(grid: SandGrid, cell: number): number {
  let n = 0;
  const { cells } = grid;
  for (let i = 0; i < cells.length; i++) if (cells[i] === cell) n++;
  return n;
}
