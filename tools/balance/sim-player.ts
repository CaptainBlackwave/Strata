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
 * It is deterministic: the same board and patience always give the same result.
 * It is not a person: it plays worse than a careful player and better than a hurried one, so its
 * stuck rate is for comparing curves, not a promise about players.
 */
import { type Board, boardKey, isSealed, isWon, jarCapacity, pour, topRun, usefulMoves } from '../../src/core/board';

/** What a person sees of jar `i`: its units above the buried ones, top last. */
function visible(b: Board, i: number): readonly number[] {
  return b.jars[i].units.slice(b.jars[i].hidden);
}

/** A person's liking for the pour `from` → `to`, from visible sand only. Higher is tried first. */
export function score(b: Board, from: number, to: number): number {
  const src = b.jars[from];
  const dst = b.jars[to];
  const run = topRun(src);
  if (!run || isSealed(src, b.capacity)) return -99;
  const free = jarCapacity(b, to) - dst.units.length;
  const amount = Math.min(run.count, free);
  const left = src.units.length - amount;
  const seen = visible(b, from);
  let s = 0;
  if (dst.units.length) s += 4; // stacking onto a match
  if (amount < run.count) s -= 3; // splits a run
  if (left === 0) s += 2; // empties a jar
  if (left > 0 && src.hidden >= left) s += 1; // uncovers buried sand
  if (dst.hidden === 0 && dst.units.length + amount === jarCapacity(b, to) && visible(b, to).every((c) => c === run.color)) s += 5; // fills a jar with one colour
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
 */
export function simPlay(start: Board, patience: number): SimResult {
  const stack: { board: Board; tried: Set<number> }[] = [{ board: start, tried: new Set() }];
  const seen = new Set([boardKey(start)]);
  const n = start.jars.length + 8; // room for extra jars in the move key
  let actions = 0;
  while (stack.length && actions < patience) {
    const top = stack[stack.length - 1];
    if (isWon(top.board)) return { won: true, actions };
    const moves = usefulMoves(top.board)
      .filter((m) => !top.tried.has(m.from * n + m.to))
      .map((m) => ({ m, s: score(top.board, m.from, m.to) }))
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
