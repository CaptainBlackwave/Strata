/**
 * Board model and pour rules for Strata.
 * Implements design/game-brief.md MVP 1 (pour rules, win and stuck).
 * Pure functions only: nothing here touches the DOM, storage or time.
 */

/** A sand colour, as an index into the palette. */
export type Color = number;

/** One glass jar. `units[0]` is the bottom layer, the last element is the top. */
export interface Jar {
  readonly units: readonly Color[];
  /**
   * How many units, counted from the bottom, are still buried (drawn as unknown).
   * Always below `units.length` for a non-empty jar, so the top is always visible.
   */
  readonly hidden: number;
}

/** A whole puzzle. Every jar shares the same capacity. */
export interface Board {
  readonly capacity: number;
  readonly jars: readonly Jar[];
}

/** A pour from one jar index to another. */
export interface Move {
  readonly from: number;
  readonly to: number;
}

/** The top run of a jar: its top colour and how many units of it are stacked there. */
export interface Run {
  readonly color: Color;
  readonly count: number;
}

/** Builds a board from plain colour arrays (bottom first). Handy for tests and saves. */
export function makeBoard(capacity: number, jars: readonly (readonly Color[])[], hidden: readonly number[] = []): Board {
  return {
    capacity,
    jars: jars.map((units, i) => ({ units: [...units], hidden: clampHidden(hidden[i] ?? 0, units.length) })),
  };
}

function clampHidden(hidden: number, length: number): number {
  return Math.max(0, Math.min(hidden, length - 1));
}

/** Returns the top run of `jar`, or `null` if it is empty. */
export function topRun(jar: Jar): Run | null {
  const n = jar.units.length;
  if (n === 0) return null;
  const color = jar.units[n - 1];
  let count = 1;
  while (count < n && jar.units[n - 1 - count] === color) count++;
  return { color, count };
}

/** A jar is sealed when it is full of a single colour. */
export function isSealed(jar: Jar, capacity: number): boolean {
  if (jar.units.length !== capacity) return false;
  return jar.units.every((c) => c === jar.units[0]);
}

/** True when every unit in a non-empty jar has the same colour. */
export function isMonochrome(jar: Jar): boolean {
  return jar.units.length > 0 && jar.units.every((c) => c === jar.units[0]);
}

/**
 * Teardown rule R5: a pour is legal when the source is non-empty, the target has
 * room, and the target is empty or its top colour matches.
 */
export function canPour(board: Board, from: number, to: number): boolean {
  if (from === to) return false;
  const src = board.jars[from];
  const dst = board.jars[to];
  if (!src || !dst) return false;
  const run = topRun(src);
  if (!run) return false;
  if (dst.units.length >= board.capacity) return false;
  const dstTop = topRun(dst);
  return dstTop === null || dstTop.color === run.color;
}

/** How many units a pour would move (rule R6): `min(run, free space)`. 0 if illegal. */
export function pourAmount(board: Board, from: number, to: number): number {
  if (!canPour(board, from, to)) return 0;
  const run = topRun(board.jars[from])!;
  const free = board.capacity - board.jars[to].units.length;
  return Math.min(run.count, free);
}

/** The result of applying a pour. */
export interface PourResult {
  readonly board: Board;
  readonly moved: number;
  readonly color: Color;
}

/**
 * Applies a pour and returns a new board. Burial on the source is re-clamped,
 * so a unit that becomes the top is revealed. Throws if the pour is illegal.
 */
export function pour(board: Board, from: number, to: number): PourResult {
  const moved = pourAmount(board, from, to);
  if (moved === 0) throw new Error(`Illegal pour ${from} -> ${to}`);
  const src = board.jars[from];
  const dst = board.jars[to];
  const color = src.units[src.units.length - 1];
  const newSrcUnits = src.units.slice(0, src.units.length - moved);
  const newSrc: Jar = { units: newSrcUnits, hidden: clampHidden(src.hidden, newSrcUnits.length) };
  const newDst: Jar = { units: [...dst.units, ...new Array<Color>(moved).fill(color)], hidden: dst.hidden };
  const jars = board.jars.map((j, i) => (i === from ? newSrc : i === to ? newDst : j));
  return { board: { capacity: board.capacity, jars }, moved, color };
}

/** Teardown rule R8: won when every jar is empty or sealed. */
export function isWon(board: Board): boolean {
  return board.jars.every((j) => j.units.length === 0 || isSealed(j, board.capacity));
}

/** Every legal pour on the board. */
export function legalMoves(board: Board): Move[] {
  const moves: Move[] = [];
  for (let from = 0; from < board.jars.length; from++) {
    for (let to = 0; to < board.jars.length; to++) {
      if (canPour(board, from, to)) moves.push({ from, to });
    }
  }
  return moves;
}

/**
 * Legal pours that change the board in a meaningful way. Moving a whole
 * single-colour jar into an empty jar only swaps two jars, so it is excluded.
 */
export function usefulMoves(board: Board): Move[] {
  return legalMoves(board).filter(({ from, to }) => {
    const src = board.jars[from];
    const dst = board.jars[to];
    return !(dst.units.length === 0 && isMonochrome(src));
  });
}

/** Teardown rule R9: stuck when the level isn't won and no useful pour is left. */
export function isStuck(board: Board): boolean {
  return !isWon(board) && usefulMoves(board).length === 0;
}

/**
 * A canonical string for a board, ignoring jar order and burial. Two boards
 * with the same key are equivalent for solving purposes.
 */
export function boardKey(board: Board): string {
  return board.jars
    .map((j) => j.units.join(','))
    .sort()
    .join('|');
}

/** Adds one empty jar (the extra-jar booster). */
export function addEmptyJar(board: Board): Board {
  return { capacity: board.capacity, jars: [...board.jars, { units: [], hidden: 0 }] };
}
