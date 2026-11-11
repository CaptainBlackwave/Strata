/**
 * Depth-first solver with canonical-state memoisation.
 * Proves generated levels are solvable (design/game-brief.md MVP 2) and powers hints.
 * It finds *a* solution, not necessarily the shortest one.
 */
import { type Board, type Move, boardKey, isSealed, isWon, jarCapacity, pour, topRun, usefulMoves } from './board';

/** The outcome of a solve attempt. */
export interface SolveResult {
  /** `true` if solved, `false` if proven unsolvable, `null` if the node budget ran out first. */
  readonly solvable: boolean | null;
  /** The moves that solve the board (empty unless `solvable` is true). */
  readonly path: readonly Move[];
  /** How many states were expanded. */
  readonly nodes: number;
}

/**
 * Solves `board` within `nodeBudget` expanded states.
 * Example: `solve(board, 50_000).path[0]` gives a hint move.
 */
export function solve(board: Board, nodeBudget: number): SolveResult {
  const seen = new Set<string>();
  const path: Move[] = [];
  let nodes = 0;
  let exhausted = false;

  const dfs = (b: Board): boolean => {
    if (isWon(b)) return true;
    const key = boardKey(b);
    if (seen.has(key)) return false;
    seen.add(key);
    if (++nodes > nodeBudget) {
      exhausted = true;
      return false;
    }
    for (const move of orderedMoves(b)) {
      path.push(move);
      if (dfs(pour(b, move.from, move.to).board)) return true;
      path.pop();
      if (exhausted) return false;
    }
    return false;
  };

  const ok = dfs(board);
  return { solvable: ok ? true : exhausted ? null : false, path: ok ? [...path] : [], nodes };
}

/**
 * Useful moves with symmetry pruning (only the first empty jar is tried as a target,
 * and sealed jars are never poured from), best-first by a cheap heuristic.
 */
function orderedMoves(board: Board): Move[] {
  // Symmetry pruning: of several empty jars of the same kind, only try the first. A sieve's band and a clam's count are part of its kind (D96).
  const firstEmptyOfKind = new Map<string, number>();
  board.jars.forEach((j, i) => {
    if (j.units.length) return;
    const kind = `${jarCapacity(board, i)}${j.funnel ? 'U' : ''}${j.frozen ? 'F' : ''}${j.lock ?? ''}${j.hourglass ? `H${j.hourglass.left}` : ''}${j.sieve !== undefined ? `S${j.sieve}` : ''}${j.clam !== undefined ? `C${j.clam}` : ''}`;
    if (!firstEmptyOfKind.has(kind)) firstEmptyOfKind.set(kind, i);
  });
  const firstEmpties = new Set(firstEmptyOfKind.values());
  const isFirstEmpty = (i: number) => firstEmpties.has(i);
  const scored: { move: Move; score: number }[] = [];
  for (const move of usefulMoves(board)) {
    const src = board.jars[move.from];
    const dst = board.jars[move.to];
    if (isSealed(src, board.capacity)) continue;
    if (dst.units.length === 0 && !isFirstEmpty(move.to)) continue;
    const run = topRun(src)!;
    const free = jarCapacity(board, move.to) - dst.units.length;
    let score = 0;
    if (dst.units.length > 0) score += 2; // stacking onto a match beats using a spare jar
    if (run.count <= free) score += 1; // the whole run moves
    if (run.count === src.units.length && dst.units.length > 0) score += 2; // empties the source
    if (dst.units.length + Math.min(run.count, free) === board.capacity && topRun(dst)?.count === dst.units.length) score += 3; // seals the target
    scored.push({ move, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.move);
}
