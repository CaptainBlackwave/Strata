/**
 * A simulated player (sprint 15 G1, owner decision D132): a stand-in for a person, used to judge
 * whether levels are gentle enough. Unlike the solver it never sees buried sand, and it gives up.
 *
 * How it plays:
 * - It orders the useful pours by what a person can see: stacking onto a match, filling a jar
 *   with one visible colour, emptying a jar or uncovering sand are good; splitting a run or
 *   spending an empty jar on a jar that is already one colour is bad (`score`).
 * - It tries the best pour it has not tried from this position and has not seen before. When none
 *   is left it backs out with Undo, which is free in the game (D19).
 * - Every pour and every Undo is one action. After `patience` actions without a win it gives up:
 *   "stuck, would need a booster". It never uses a booster.
 *
 * - Dark-aware (sprint 30 S1, D232; on by default): while a lighthouse jar is dark (`isLit` false,
 *   design/gdd/jar-mechanics.md §2.10) it sees that jar's units like buried sand, colour unknown.
 *   It may still pour into and out of it (any pour the rules allow, a refused try being free), but
 *   its liking for such a pour uses no dark colour. It remembers nothing a beam showed it once the
 *   jar is dark again, so it is a pessimistic bound; `{ darkAware: false }` is the sprint 15-29
 *   player, which sees dark colours (the optimistic bound). The two agree on boards with no
 *   lighthouse jar.
 *
 * It is deterministic: the same board, patience and options always give the same result.
 * It is not a person: it plays worse than a careful player and better than a hurried one, so its
 * stuck rate is for comparing curves, not a promise about players.
 */
import { type Board, boardKey, isLit, isSealed, isWon, jarCapacity, pour, topRun, usefulMoves } from '../../src/core/board';

/** How the simulated player plays. */
export interface SimOptions {
  /**
   * True (the default): a dark lighthouse jar's units are unknown, like buried sand, until the beam
   * lights it or it is sealed (sprint 30 S1, D232). False: it sees them (the sprint 15-29 player).
   */
  readonly darkAware?: boolean;
}

/**
 * How many of jar `i`'s units, from the bottom, a person cannot see: the buried ones, or all of
 * them while it is a dark lighthouse jar (when `darkAware`). Example: `unseen(board, 3) // 4 while dark`.
 */
export function unseen(b: Board, i: number, darkAware = true): number {
  const jar = b.jars[i];
  return darkAware && !isLit(jar, b.capacity) ? jar.units.length : jar.hidden;
}

/**
 * What a person sees of jar `i`: its units above the unseen ones, top last. Empty for a dark
 * lighthouse jar (when `darkAware`). Example: `visible(board, 0) // [2, 5]`.
 */
export function visible(b: Board, i: number, darkAware = true): readonly number[] {
  return b.jars[i].units.slice(unseen(b, i, darkAware));
}

/**
 * A person's liking for the pour `from` → `to`, from visible sand only. Higher is tried first.
 * With `darkAware`, a pour out of a dark jar is blind (its colour and run are unknown) and a pour
 * into one gets no credit for a match or a one-colour fill it cannot see.
 */
export function score(b: Board, from: number, to: number, darkAware = true): number {
  const src = b.jars[from];
  const dst = b.jars[to];
  const run = topRun(src);
  if (!run || isSealed(src, b.capacity)) return -99;
  const seen = visible(b, from, darkAware);
  if (!seen.length) return dst.units.length ? 0 : -1; // a blind pour out of a dark jar; spending an empty jar on it is worse
  const dstDark = dst.units.length > 0 && unseen(b, to, darkAware) === dst.units.length;
  const free = jarCapacity(b, to) - dst.units.length;
  const amount = Math.min(run.count, free);
  const left = src.units.length - amount;
  let s = 0;
  if (dst.units.length && !dstDark) s += 4; // stacking onto a match
  if (amount < run.count) s -= 3; // splits a run
  if (left === 0) s += 2; // empties a jar
  if (left > 0 && src.hidden >= left) s += 1; // uncovers buried sand
  if (unseen(b, to, darkAware) === 0 && dst.units.length + amount === jarCapacity(b, to) && visible(b, to, darkAware).every((c) => c === run.color)) s += 5; // fills a jar with one colour
  if (!dst.units.length && seen.length === src.units.length && seen.every((c) => c === run.color)) s -= 4; // moves a one-colour jar for nothing
  if (!dst.units.length) s -= 1; // spends an empty jar
  return s;
}

/** The outcome of one board. */
export interface SimResult {
  /** True when it won within its patience. */
  readonly won: boolean;
  /** Pours and Undos used (the patience when it gave up). */
  readonly actions: number;
}

/**
 * Plays `start` with free Undo and no boosters. Example: `simPlay(generateLevel(40, config).board, 150).won`.
 * `options.darkAware` defaults to true (see `SimOptions`).
 */
export function simPlay(start: Board, patience: number, options: SimOptions = {}): SimResult {
  const darkAware = options.darkAware ?? true;
  const stack: { board: Board; tried: Set<number> }[] = [{ board: start, tried: new Set() }];
  const seen = new Set([boardKey(start)]);
  const n = start.jars.length + 8; // room for extra jars in the move key
  let actions = 0;
  while (stack.length && actions < patience) {
    const top = stack[stack.length - 1];
    if (isWon(top.board)) return { won: true, actions };
    const moves = usefulMoves(top.board)
      .filter((m) => !top.tried.has(m.from * n + m.to))
      .map((m) => ({ m, s: score(top.board, m.from, m.to, darkAware) }))
      .sort((a, b) => b.s - a.s || a.m.from - b.m.from || a.m.to - b.m.to);
    let moved = false;
    for (const { m } of moves) {
      top.tried.add(m.from * n + m.to);
      const next = pour(top.board, m.from, m.to).board;
      const key = boardKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push({ board: next, tried: new Set() });
      actions++;
      moved = true;
      break;
    }
    if (!moved) {
      stack.pop(); // Undo
      actions++;
    }
  }
  return { won: stack.length > 0 && isWon(stack[stack.length - 1].board), actions };
}
