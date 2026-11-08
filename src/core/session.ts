/**
 * One play session of a level: history, undo, restart, the extra-jar booster,
 * hints and status. The UI listens through `onChange`, so nothing here knows about the DOM.
 * Implements design/game-brief.md MVP 1 and MVP 4.
 */
import { type Board, type Jar, type LostReason, type Move, addEmptyJar, canPour, isClosed, isSealed, isStuck, isWon, jarKey, lostReason as boardLostReason, pour, settle } from './board';
import { type Rng, shuffle as shuffleInPlace } from './rng';
import { solve } from './solver';

/** Where the level stands. */
export type SessionStatus = 'playing' | 'won' | 'stuck';

/** What just happened, for the UI to animate. */
export type SessionEvent =
  | { readonly type: 'pour'; readonly move: Move; readonly moved: number; readonly color: number; readonly sealed: boolean }
  | { readonly type: 'undo' }
  | { readonly type: 'restart' }
  | { readonly type: 'extraJar' }
  | { readonly type: 'shuffle' }
  | { readonly type: 'won' }
  | { readonly type: 'stuck' };

/** Tuning a session needs. It comes from game-config.json. */
export interface SessionOptions {
  /** Extra jars allowed per level. Omitted or null means no cap (decision D5). */
  readonly extraJarsPerLevel?: number | null;
  readonly hintNodeBudget: number;
  /** Shuffle tries this many re-deals before giving up. Default 40. */
  readonly shuffleAttempts?: number;
  /** Solver budget used to prove a shuffled board is winnable. Defaults to `hintNodeBudget`. */
  readonly shuffleNodeBudget?: number;
}

/**
 * Example:
 * ```ts
 * const s = new GameSession(level.board, { extraJarsPerLevel: 1, hintNodeBudget: 40000 });
 * s.onChange((e) => render(s.board, e));
 * s.pour(0, 3);
 * ```
 */
export class GameSession {
  private readonly initial: Board;
  private history: Board[] = [];
  private current: Board;
  private extraLeft: number;
  private moveCount = 0;
  private extrasAdded = 0;
  private assistCount = 0;
  private readonly listeners = new Set<(e: SessionEvent) => void>();
  /** The last solver plan: `steps[i]` is the move to make from the board whose exact key is `keys[i]`. */
  private plan: { keys: string[]; steps: Move[] } | null = null;

  constructor(board: Board, private readonly options: SessionOptions) {
    this.initial = board;
    this.current = board;
    this.extraLeft = options.extraJarsPerLevel ?? Infinity;
  }

  /** The board as it stands now. */
  get board(): Board {
    return this.current;
  }

  /** Pours made so far (undo takes one back). */
  get moves(): number {
    return this.moveCount;
  }

  /** Extra jars still available this level. */
  get extraJarsLeft(): number {
    return this.extraLeft;
  }

  /**
   * Boosters that count against Perfect this level: a hint that returned a move, the
   * extra jar, and shuffle. Undo is free, and a hint that finds nothing doesn't count
   * (design/gdd/session-boosters.md, M2). Zero means a Perfect clear.
   */
  get assists(): number {
    return this.assistCount;
  }

  /** Whether there is anything to undo. */
  get canUndo(): boolean {
    return this.history.length > 0;
  }

  /** The current status. */
  get status(): SessionStatus {
    if (isWon(this.current)) return 'won';
    if (isStuck(this.current)) return 'stuck';
    return 'playing';
  }

  /**
   * Why the current board can certainly no longer be won, or `null` (decision D-c).
   * Independent of `status`: a lost board can still have legal pours. Undo, restart,
   * shuffle and the extra jar still work. See `lostReason` in board.ts for the rules.
   */
  get lostReason(): LostReason | null {
    return boardLostReason(this.current);
  }

  /** Subscribes to events. Returns an unsubscribe function. */
  onChange(listener: (e: SessionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Tries a pour. Returns false, and changes nothing, if it is illegal or the level is over. */
  pour(from: number, to: number): boolean {
    if (this.status === 'won' || !canPour(this.current, from, to)) return false;
    const result = pour(this.current, from, to);
    this.history.push(this.current);
    this.current = result.board;
    this.moveCount++;
    const sealed = isSealed(result.board.jars[to], result.board.capacity);
    this.emit({ type: 'pour', move: { from, to }, moved: result.moved, color: result.color, sealed });
    this.emitStatus();
    return true;
  }

  /**
   * Takes back the last pour. Free and unlimited (decision D-a), and it never counts
   * against Perfect (design/gdd/session-boosters.md, M2).
   */
  undo(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.current = prev;
    this.moveCount = Math.max(0, this.moveCount - 1);
    this.emit({ type: 'undo' });
    return true;
  }

  /** Goes back to the dealt board. An extra jar already used stays in place and isn't refunded. */
  restart(): void {
    let board = this.initial;
    for (let i = 0; i < this.extrasAdded; i++) board = addEmptyJar(board);
    this.current = board;
    this.history = [];
    this.moveCount = 0;
    this.emit({ type: 'restart' });
  }

  /**
   * Adds an empty jar, if any are left. It's added to every history state too,
   * so undo never removes it.
   */
  addExtraJar(): boolean {
    if (this.extraLeft <= 0 || this.status === 'won') return false;
    this.extraLeft--;
    this.extrasAdded++;
    this.assistCount++;
    this.plan = null;
    this.current = addEmptyJar(this.current);
    this.history = this.history.map(addEmptyJar);
    this.emit({ type: 'extraJar' });
    this.emitStatus();
    return true;
  }

  /**
   * Re-deals the sand in every unsealed jar, keeping each jar's fill level, and only
   * accepts a deal the solver proves winnable. Undoable. Returns false if no such
   * deal was found or the level is already won.
   */
  shuffle(rng: Rng): boolean {
    if (this.status === 'won') return false;
    const board = this.current;
    // Only free jars are re-dealt: sealed, frozen, locked and funnel jars keep their sand.
    const open = board.jars.map((j, i) => (isSealed(j, board.capacity) || isClosed(j) || j.funnel ? -1 : i)).filter((i) => i >= 0);
    const pool = open.flatMap((i) => board.jars[i].units);
    const before = exactKey(board);
    const attempts = this.options.shuffleAttempts ?? 40;
    const budget = this.options.shuffleNodeBudget ?? this.options.hintNodeBudget;
    for (let a = 0; a < attempts; a++) {
      shuffleInPlace(pool, rng);
      let k = 0;
      const jars: Jar[] = board.jars.map((j, i) => {
        if (!open.includes(i)) return j;
        const units = pool.slice(k, k + j.units.length);
        k += j.units.length;
        return { ...j, units, hidden: Math.min(j.hidden, Math.max(0, units.length - 1)) };
      });
      const next: Board = settle({ capacity: board.capacity, jars });
      if (exactKey(next) === before || isWon(next)) continue;
      if (solve(next, budget).solvable !== true) continue;
      this.history.push(board);
      this.current = next;
      this.plan = null;
      this.assistCount++;
      this.emit({ type: 'shuffle' });
      this.emitStatus();
      return true;
    }
    return false;
  }

  /**
   * Suggests the next move from the current board, using the solver.
   * Returns `null` if the board can't be won from here, or the solver ran out of budget.
   */
  hint(): Move | null {
    if (this.status === 'won') return null;
    // Keep following one plan while the player stays on it. Re-solving from every state
    // can suggest moves that undo each other, so the hints would loop forever.
    const key = exactKey(this.current);
    const onPlan = this.plan?.keys.indexOf(key) ?? -1;
    if (onPlan >= 0) {
      this.assistCount++;
      return this.plan!.steps[onPlan];
    }
    const result = solve(this.current, this.options.hintNodeBudget);
    if (!result.solvable || result.path.length === 0) {
      this.plan = null;
      return null;
    }
    const keys: string[] = [];
    let b = this.current;
    for (const m of result.path) {
      keys.push(exactKey(b));
      b = pour(b, m.from, m.to).board;
    }
    this.plan = { keys, steps: [...result.path] };
    this.assistCount++; // only a hint that actually helps counts against Perfect (M2)
    return result.path[0];
  }

  private emitStatus(): void {
    const s = this.status;
    if (s === 'won') this.emit({ type: 'won' });
    else if (s === 'stuck') this.emit({ type: 'stuck' });
  }

  private emit(e: SessionEvent): void {
    for (const l of this.listeners) l(e);
  }
}

/** An order-sensitive board key. Plans use jar indices, so jar order matters here. */
function exactKey(board: Board): string {
  return board.jars.map(jarKey).join('|');
}
