/**
 * Depth-first solver with canonical-state memoisation.
 * Proves generated levels are solvable (design/game-brief.md MVP 2) and powers hints.
 * It finds *a* solution, not necessarily the shortest one.
 */
import { type Board, type Move, boardKey, canPour, hasCrab, isSealed, jarKey, isWon, jarCapacity, pour, topRun, usefulMoves } from './board';

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

  // With a crab (§2.9) the search is not exhaustive (see `searchKey`), so it never claims "unwinnable".
  const exact = !hasCrab(board);
  const dfs = (b: Board): boolean => {
    if (isWon(b)) return true;
    const key = exact ? boardKey(b) : searchKey(b);
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
  return { solvable: ok ? true : exhausted || !exact ? null : false, path: ok ? [...path] : [], nodes };
}

/**
 * The pours the search tries: `usefulMoves`, except that a crab (§2.9) alone does not make a pure swap
 * worth trying (a whole one-colour jar into an empty jar of the same kind). Every legal pour is a wait
 * for the crab, so `usefulMoves` keeps swaps for stuck detection, but the search finds its waits among
 * the pours that also move sand, which keeps proofs short. Other waits (a live hourglass or tide jar,
 * a closed clam, wet sand) are kept as before.
 */
function searchMoves(board: Board): Move[] {
  if (!hasCrab(board)) return usefulMoves(board);
  const free: Board = { capacity: board.capacity, jars: board.jars.map((j) => (j.crab ? { ...j, crab: undefined } : j)) };
  return usefulMoves(free).filter((m) => canPour(board, m.from, m.to));
}

/**
 * The solver's memo key on a board with a crab (D207, §2.9): the jars in order (the crab steps in index
 * order) with the crab's jar marked but not its count. Merging states that differ only in the crab's
 * count stops the search from pouring sand back and forth just to run the count down, which otherwise
 * gives proofs hundreds of pours long. The search is then not exhaustive: a found path is always legal
 * (it is replayed through `pour`), but a failed search proves nothing, so `solve` answers `null`.
 */
function searchKey(board: Board): string {
  return board.jars.map((j) => (j.crab ? `K:${jarKey({ ...j, crab: undefined })}` : jarKey(j))).join('|');
}

/**
 * Useful moves with symmetry pruning (only the first empty jar is tried as a target,
 * and sealed jars are never poured from), best-first by a cheap heuristic.
 */
function orderedMoves(board: Board): Move[] {
  // Symmetry pruning: of several empty jars of the same kind, only try the first. A sieve's band, a clam's count and a tide jar's count are part of its kind (D96, §2.8).
  const firstEmptyOfKind = new Map<string, number>();
  // With a crab (§2.9) jar order matters (it steps in index order), so two empty jars of a kind are not
  // truly alike; the pruning is kept anyway for speed, and `solve` then never claims a board unwinnable.
  board.jars.forEach((j, i) => {
    if (j.units.length) return;
    const kind = `${jarCapacity(board, i)}${j.funnel ? 'U' : ''}${j.frozen ? 'F' : ''}${j.lock ?? ''}${j.hourglass ? `H${j.hourglass.left}` : ''}${j.sieve !== undefined ? `S${j.sieve}` : ''}${j.clam !== undefined ? `C${j.clam}` : ''}${j.tide ? `T${j.tide.left}` : ''}`;
    if (!firstEmptyOfKind.has(kind)) firstEmptyOfKind.set(kind, i);
  });
  const firstEmpties = new Set(firstEmptyOfKind.values());
  const isFirstEmpty = (i: number) => firstEmpties.has(i);
  const scored: { move: Move; score: number }[] = [];
  for (const move of searchMoves(board)) {
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
