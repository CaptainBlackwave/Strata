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
  /** Narrow jar: its own smaller capacity. Narrow jars never seal, so they must end empty. */
  readonly cap?: number;
  /** Frozen jar: no pours in or out until any jar seals (sprint-3 decision S3-5). */
  readonly frozen?: boolean;
  /** Locked lid: no pours in or out until a jar of this colour seals. */
  readonly lock?: Color;
  /** One-way funnel: can be poured into, never out of. */
  readonly funnel?: boolean;
  /**
   * Hourglass jar (D96, design/gdd/jar-mechanics.md): every successful pour anywhere on the
   * board counts down `left`; the pour that reaches zero flips this jar's stack and restarts
   * the count at `every`. Part of the board, so undo, restart, the solver and hints see it.
   */
  readonly hourglass?: Hourglass;
}

/** An hourglass jar's count: it flips every `every` pours, `left` pours from now (1..every). */
export interface Hourglass {
  readonly every: number;
  readonly left: number;
}

/** A whole puzzle. `capacity` is the normal jar size; narrow jars override it with `cap`. */
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
    // A jar that is already sealed shows its sand: it is one colour, so nothing is hidden.
    jars: jars.map((units, i) => {
      const jar: Jar = { units: [...units], hidden: clampHidden(hidden[i] ?? 0, units.length) };
      return jar.hidden && isSealed(jar, capacity) ? { ...jar, hidden: 0 } : jar;
    }),
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

/** How many units jar `i` can hold. Example: `jarCapacity(board, 2) // 2 for a narrow jar` */
export function jarCapacity(board: Board, i: number): number {
  return board.jars[i].cap ?? board.capacity;
}

/** True when a jar can't be poured into or out of right now (frozen or locked). */
export function isClosed(jar: Jar): boolean {
  return jar.frozen === true || jar.lock !== undefined;
}

/**
 * A jar is sealed when it is full of a single colour at the board's normal capacity.
 * Narrow jars never seal.
 */
export function isSealed(jar: Jar, capacity: number): boolean {
  if ((jar.cap ?? capacity) !== capacity || jar.units.length !== capacity) return false;
  return jar.units.every((c) => c === jar.units[0]);
}

/** True when every unit in a non-empty jar has the same colour. */
export function isMonochrome(jar: Jar): boolean {
  return jar.units.length > 0 && jar.units.every((c) => c === jar.units[0]);
}

/**
 * Teardown rule R5: a pour is legal when the source is non-empty, the target has
 * room, and the target is empty or its top colour matches. A sealed jar is done and
 * can't be poured from (decision D-b, production/qa/sprint-6-findings.md GA-PR-1), which
 * matches the UI and the solver, so `usefulMoves` and `isStuck` follow too.
 */
export function canPour(board: Board, from: number, to: number): boolean {
  if (from === to) return false;
  const src = board.jars[from];
  const dst = board.jars[to];
  if (!src || !dst) return false;
  if (isClosed(src) || isClosed(dst) || src.funnel || isSealed(src, board.capacity)) return false;
  const run = topRun(src);
  if (!run) return false;
  if (dst.units.length >= (dst.cap ?? board.capacity)) return false;
  const dstTop = topRun(dst);
  return dstTop === null || dstTop.color === run.color;
}

/** How many units a pour would move (rule R6): `min(run, free space)`. 0 if illegal. */
export function pourAmount(board: Board, from: number, to: number): number {
  if (!canPour(board, from, to)) return 0;
  const run = topRun(board.jars[from])!;
  const free = jarCapacity(board, to) - board.jars[to].units.length;
  return Math.min(run.count, free);
}

/** The result of applying a pour. */
export interface PourResult {
  readonly board: Board;
  readonly moved: number;
  readonly color: Color;
  /** Indices of hourglass jars that flipped right after this pour (D96); usually empty. */
  readonly flipped: readonly number[];
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
  const newSrc: Jar = { ...src, units: newSrcUnits, hidden: clampHidden(src.hidden, newSrcUnits.length) };
  const newDst: Jar = { ...dst, units: [...dst.units, ...new Array<Color>(moved).fill(color)] };
  const poured = board.jars.map((j, i) => (i === from ? newSrc : i === to ? newDst : j));
  const { jars, flipped } = tickHourglasses(poured);
  return { board: settle({ capacity: board.capacity, jars }), moved, color, flipped };
}

/**
 * The hourglass rule (D96), applied after every successful pour: each hourglass counts down
 * one, and one that reaches zero reverses its stack (bottom becomes top) and restarts at
 * `every`. A flip shows the whole stack (`hidden: 0`); a one-colour stack is unchanged by it,
 * so a flip never seals or unseals a jar by itself. Returns the same array when there is none.
 */
function tickHourglasses(jars: readonly Jar[]): { jars: readonly Jar[]; flipped: number[] } {
  const flipped: number[] = [];
  if (!jars.some((j) => j.hourglass)) return { jars, flipped };
  const next = jars.map((j, i) => {
    if (!j.hourglass) return j;
    const left = j.hourglass.left - 1;
    if (left > 0) return { ...j, hourglass: { every: j.hourglass.every, left } };
    flipped.push(i);
    return { ...j, units: [...j.units].reverse(), hidden: 0, hourglass: { every: j.hourglass.every, left: j.hourglass.every } };
  });
  return { jars: next, flipped };
}

/** True when the board has an unsealed hourglass, so the pour count still matters (D96). */
export function hasLiveHourglass(board: Board): boolean {
  return board.jars.some((j) => j.hourglass !== undefined && !isSealed(j, board.capacity));
}

/**
 * Applies the seal-triggered rules: once any jar is sealed every frozen jar thaws,
 * and a locked lid opens when a jar of its colour is sealed. Returns the same
 * board object when nothing changes.
 */
export function settle(board: Board): Board {
  const sealedColors = new Set<Color>();
  for (const j of board.jars) if (isSealed(j, board.capacity)) sealedColors.add(j.units[0]);
  if (sealedColors.size === 0) return board;
  let changed = false;
  const jars = board.jars.map((j0) => {
    // A sealed jar is one colour, so its buried units are revealed (owner bug report 2026-11-08).
    let j = j0;
    if (j0.hidden && isSealed(j0, board.capacity)) {
      j = { ...j0, hidden: 0 };
      changed = true;
    }
    const thaw = j.frozen === true;
    const unlock = j.lock !== undefined && sealedColors.has(j.lock);
    if (!thaw && !unlock) return j;
    changed = true;
    const { frozen, lock, ...rest } = j;
    return {
      ...rest,
      ...(!thaw && frozen !== undefined ? { frozen } : {}),
      ...(!unlock && lock !== undefined ? { lock } : {}),
    } as Jar;
  });
  return changed ? { capacity: board.capacity, jars } : board;
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
  // With a live hourglass any pour moves its count, so even a swap can be the wait a plan needs (D96).
  if (hasLiveHourglass(board)) return legalMoves(board);
  return legalMoves(board).filter(({ from, to }) => {
    const src = board.jars[from];
    const dst = board.jars[to];
    // Moving a whole one-colour jar into an empty jar of the same kind only swaps them.
    const sameKind = jarCapacity(board, from) === jarCapacity(board, to) && !dst.funnel;
    return !(dst.units.length === 0 && isMonochrome(src) && sameKind);
  });
}

/** Teardown rule R9: stuck when the level isn't won and no useful pour is left. */
export function isStuck(board: Board): boolean {
  return !isWon(board) && usefulMoves(board).length === 0;
}

/** Why a board can certainly no longer be won (decision D-c). */
export type LostReason = 'funnel' | 'lock';

function countColor(jar: Jar, color: Color): number {
  let n = 0;
  for (const u of jar.units) if (u === color) n++;
  return n;
}

/**
 * A cheap, exact dead-end check (decision D-c, production/qa/sprint-6-findings.md GA-JAR-3).
 * It only reports boards that are certainly lost; `null` means "not proven lost", not
 * "winnable" (the solver is the only full answer). Works on the settled board.
 *
 * - `'funnel'`: a non-empty funnel can never seal, so it can never end empty or sealed:
 *   it holds two or more colours, has a non-standard capacity, or its colour can't reach
 *   a full jar any more (units in other funnels never come out).
 * - `'lock'`: a locked, non-empty, unsealed jar can never open, because its key colour
 *   can never be sealed for the first time. Units of the key inside jars locked by that
 *   same key, inside funnels (except the one funnel that could seal it) or inside jars
 *   behind another lock that can never open are out of reach.
 *
 * Example: `lostReason(boardWithMixedFunnel) // 'funnel'`
 */
export function lostReason(board: Board): LostReason | null {
  const b = settle(board);
  const cap = b.capacity;
  const sealableFunnel = (j: Jar) => j.funnel === true && (j.cap ?? cap) === cap && (j.units.length === 0 || isMonochrome(j));
  for (const f of b.jars) {
    if (!f.funnel || f.units.length === 0) continue;
    if (!sealableFunnel(f)) return 'funnel';
    const color = f.units[0];
    let reach = f.units.length;
    for (const j of b.jars) if (!j.funnel) reach += countColor(j, color);
    if (reach < cap) return 'funnel';
  }
  const locked = b.jars.filter((j) => j.lock !== undefined && j.units.length > 0 && !isSealed(j, cap));
  if (locked.length === 0) return null;
  const keys = [...new Set(locked.map((j) => j.lock!))];
  // Fixpoint: a key that can never be sealed keeps its jars shut forever, which can trap other keys.
  const dead = new Set<Color>();
  for (let changed = true; changed; ) {
    changed = false;
    for (const key of keys) {
      if (dead.has(key)) continue;
      let free = 0;
      let bestFunnel = 0;
      for (const j of b.jars) {
        if (j.funnel) {
          if (sealableFunnel(j) && j.units.length > 0 && j.units[0] === key) bestFunnel = Math.max(bestFunnel, j.units.length);
          continue;
        }
        if (j.lock !== undefined && (j.lock === key || dead.has(j.lock))) continue;
        free += countColor(j, key);
      }
      if (free + bestFunnel < cap) {
        dead.add(key);
        changed = true;
      }
    }
  }
  return locked.some((j) => dead.has(j.lock!)) ? 'lock' : null;
}

/**
 * A canonical string for a board, ignoring jar order and burial. An hourglass's count is
 * part of its jar's key, so states that differ only in the count are not merged (D96). Two boards
 * with the same key are equivalent for solving purposes.
 */
export function boardKey(board: Board): string {
  return board.jars
    .map(jarKey)
    .sort()
    .join('|');
}

/** One jar's state and contents as a string (used by solver and plan keys). */
export function jarKey(j: Jar): string {
  const glass = j.hourglass ? `H${j.hourglass.left}/${j.hourglass.every}` : '';
  const tag = `${j.cap ?? ''}${j.frozen ? 'F' : ''}${j.lock !== undefined ? `L${j.lock}` : ''}${j.funnel ? 'U' : ''}${glass}`;
  return tag ? `${tag}:${j.units.join(',')}` : j.units.join(',');
}

/** Adds one empty jar (the extra-jar booster). */
export function addEmptyJar(board: Board): Board {
  return { capacity: board.capacity, jars: [...board.jars, { units: [], hidden: 0 }] };
}
