/**
 * One play session of a level: history, undo, restart, the extra-jar booster,
 * hints and status. The UI listens through `onChange`, so nothing here knows about the DOM.
 * Implements design/game-brief.md MVP 1 and MVP 4.
 */
import { type Board, type Jar, type LostReason, type Move, addEmptyJar, canPour, isClosed, isSealed, isStuck, isWon, jarKey, lostReason as boardLostReason, pour, settle } from './board';
import type { GameConfig } from './levels';
import { type Rng, shuffle as shuffleInPlace } from './rng';
import { solve } from './solver';

/** Where the level stands. */
export type SessionStatus = 'playing' | 'won' | 'stuck';

/** What just happened, for the UI to animate. */
export type SessionEvent =
  | {
      readonly type: 'pour';
      readonly move: Move;
      readonly moved: number;
      readonly color: number;
      readonly sealed: boolean;
      /** Hourglass jars that flipped right after this pour (D96). Absent when none did. */
      readonly flipped?: readonly number[];
      /** Clam jars that opened right after this pour (D96, §2.6). Absent when none did. */
      readonly opened?: readonly number[];
      /** Jars where wet sand dried right after this pour (D189, §2.7). Absent when none did. */
      readonly dried?: readonly number[];
      /**
       * Jars other than the target that sealed on this pour because their last wet sand dried
       * (§2.7), for the seal effect. Absent when none did.
       */
      readonly sealedDry?: readonly number[];
      /**
       * Tide jars that turned right after this pour (D194, §2.8): the stack rose by one and the
       * count restarted. Includes turns that change nothing visible (an empty or one-colour jar).
       * Absent when none did.
       */
      readonly turned?: readonly number[];
      /** Where the crab stepped right after this pour (D207, §2.9). Absent when it stayed. */
      readonly crabMoved?: { readonly from: number; readonly to: number };
      /** Lighthouse jars the beam lit right after this pour (D208, §2.10). Absent when none. */
      readonly swept?: readonly number[];
    }
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
  /**
   * Solver states one shuffle may spend across all its attempts (F7, GA-SB-4). Defaults to
   * the per-attempt budget, so a session built without it still can't freeze for long.
   */
  readonly shuffleTotalNodeBudget?: number;
}

/**
 * The session tuning from game-config.json, so callers don't map each key by hand.
 * Example: `new GameSession(level.board, sessionOptions(config))`
 */
export function sessionOptions(config: Pick<GameConfig, 'extraJarsPerLevel' | 'hint' | 'shuffle'>): SessionOptions {
  return {
    extraJarsPerLevel: config.extraJarsPerLevel,
    hintNodeBudget: config.hint.solverNodeBudget,
    shuffleAttempts: config.shuffle.maxAttempts,
    shuffleNodeBudget: config.shuffle.solverNodeBudget,
    shuffleTotalNodeBudget: config.shuffle.totalNodeBudget,
  };
}

/**
 * What a hint request found (F7, GA-SB-2). `'unwinnable'`: the board is proven lost
 * (structurally or by the solver). `'budget'`: the search ran out before an answer, so
 * the board may still be winnable. `'won'`: the level is already won.
 */
export type HintResult = { readonly move: Move } | { readonly reason: 'won' | 'unwinnable' | 'budget' };

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
  /** For each history entry, whether the step it undoes was a pour (a shuffle is not; strata-gbw.1). */
  private counted: boolean[] = [];
  private current: Board;
  private extraLeft: number;
  private moveCount = 0;
  private extrasAdded = 0;
  private assistCount = 0;
  private rev = 0;
  private readonly listeners = new Set<(e: SessionEvent) => void>();
  /** The last solver plan: `steps[i]` is the move to make from the board whose exact key is `keys[i]`. */
  private plan: { keys: string[]; steps: Move[] } | null = null;

  constructor(board: Board, private readonly options: SessionOptions) {
    this.initial = board;
    this.current = board;
    this.extraLeft = options.extraJarsPerLevel ?? Infinity;
  }

  /**
   * Changes with every board change (each emitted event) and never with a hint. A worker
   * reply asked for at an older revision is stale (TD-13).
   */
  get revision(): number {
    return this.rev;
  }

  /** The tuning this session was built with; a worker job carries it (TD-13). */
  get tuning(): SessionOptions {
    return this.options;
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
    this.counted.push(true);
    this.current = result.board;
    this.moveCount++;
    const sealed = isSealed(result.board.jars[to], result.board.capacity);
    const flipped = result.flipped.length ? { flipped: result.flipped } : {};
    const opened = result.opened.length ? { opened: result.opened } : {};
    const dried = result.dried.length ? { dried: result.dried } : {};
    const turned = result.turned.length ? { turned: result.turned } : {};
    const crabMoved = result.crabMoved ? { crabMoved: result.crabMoved } : {};
    const swept = result.swept.length ? { swept: result.swept } : {};
    const before = this.history[this.history.length - 1];
    const dry = result.dried.filter((i) => i !== to && isSealed(result.board.jars[i], result.board.capacity) && !isSealed(before.jars[i], before.capacity));
    const sealedDry = dry.length ? { sealedDry: dry } : {};
    this.emit({ type: 'pour', move: { from, to }, moved: result.moved, color: result.color, sealed, ...flipped, ...opened, ...dried, ...sealedDry, ...turned, ...crabMoved, ...swept });
    this.emitStatus();
    return true;
  }

  /**
   * Takes back the last pour or shuffle. Free and unlimited (decision D-a), and it never counts
   * against Perfect (design/gdd/session-boosters.md, M2). Only a pour taken back lowers the
   * pour count (strata-gbw.1), and a board it lands on that is stuck says so again (strata-gbw.2).
   */
  undo(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    const wasPour = this.counted.pop() ?? true;
    this.current = prev;
    if (wasPour) this.moveCount = Math.max(0, this.moveCount - 1);
    this.emit({ type: 'undo' });
    this.emitStatus();
    return true;
  }

  /** Goes back to the dealt board. An extra jar already used stays in place and isn't refunded. */
  restart(): void {
    let board = this.initial;
    for (let i = 0; i < this.extrasAdded; i++) board = addEmptyJar(board);
    this.current = board;
    this.history = [];
    this.counted = [];
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
   * deal was found or the level is already won. All attempts together spend at most
   * `shuffleTotalNodeBudget` solver states (F7, GA-SB-4), so it can't freeze the game.
   * The same as `applyShuffle(findShuffle(board, tuning, rng))`, which is how the worker
   * path splits it (TD-13, `src/core/assist.ts`).
   */
  shuffle(rng: Rng): boolean {
    if (this.status === 'won') return false;
    const next = findShuffle(this.current, this.options, rng);
    return next !== null && this.applyShuffle(next);
  }

  /**
   * Puts a re-deal that `findShuffle` found for the current board on the table, as an
   * undoable move that counts against Perfect. Returns false once the level is won.
   * `next` must come from the board as it stands now: the caller drops replies for a
   * board that changed (TD-13).
   */
  applyShuffle(next: Board): boolean {
    if (this.status === 'won') return false;
    this.history.push(this.current);
    this.counted.push(false);
    this.current = next;
    this.plan = null;
    this.assistCount++;
    this.emit({ type: 'shuffle' });
    this.emitStatus();
    return true;
  }

  /**
   * Suggests the next move from the current board, using the solver.
   * Returns `null` if the board can't be won from here, or the solver ran out of budget.
   * Use `hintResult()` to tell those two apart.
   */
  hint(): Move | null {
    const r = this.hintResult();
    return 'move' in r ? r.move : null;
  }

  /**
   * Like `hint()`, but says why there is no move. Only a result with a move counts
   * against Perfect (M2). A structurally lost board (`lostReason`) answers at once,
   * without spending any search.
   * Example: `const r = s.hintResult(); if ('move' in r) show(r.move); else toast(r.reason);`
   */
  hintResult(): HintResult {
    return this.hintWithoutSearch() ?? this.adoptHint(searchHint(this.current, this.options.hintNodeBudget));
  }

  /**
   * The hint when no solver search is needed: the level is won, the player is still on the
   * last plan (this counts against Perfect, like any hint with a move), or the board is
   * structurally lost. `null` means a search is needed: run `searchHint` (on a worker,
   * TD-13) and pass its result to `adoptHint`.
   */
  hintWithoutSearch(): HintResult | null {
    if (this.status === 'won') return { reason: 'won' };
    // Keep following one plan while the player stays on it. Re-solving from every state
    // can suggest moves that undo each other, so the hints would loop forever.
    const key = exactKey(this.current);
    const onPlan = this.plan?.keys.indexOf(key) ?? -1;
    if (onPlan >= 0) {
      this.assistCount++;
      return { move: this.plan!.steps[onPlan] };
    }
    if (boardLostReason(this.current) !== null) {
      this.plan = null;
      return { reason: 'unwinnable' };
    }
    return null;
  }

  /**
   * Turns a `searchHint` of the current board into the hint, and keeps its path as the plan
   * later hints follow. Only a hint with a move counts against Perfect (M2).
   * Example: `const r = s.hintWithoutSearch() ?? s.adoptHint(searchHint(s.board, budget));`
   */
  adoptHint(search: HintSearch): HintResult {
    if (this.status === 'won') return { reason: 'won' };
    if ('reason' in search) {
      this.plan = null;
      return { reason: search.reason };
    }
    const keys: string[] = [];
    let b = this.current;
    for (const m of search.path) {
      keys.push(exactKey(b));
      b = pour(b, m.from, m.to).board;
    }
    this.plan = { keys, steps: [...search.path] };
    this.assistCount++; // only a hint that actually helps counts against Perfect (M2)
    return { move: search.path[0] };
  }

  private emitStatus(): void {
    const s = this.status;
    if (s === 'won') this.emit({ type: 'won' });
    else if (s === 'stuck') this.emit({ type: 'stuck' });
  }

  private emit(e: SessionEvent): void {
    this.rev++; // every event is a board change (won and stuck come with the pour)
    for (const l of this.listeners) l(e);
  }
}

/**
 * What the solver says from a board, without touching any session: a winning path, or why
 * there is none (`'budget'`: the search ran out, so the board may still be winnable).
 */
export type HintSearch = { readonly path: readonly Move[] } | { readonly reason: 'unwinnable' | 'budget' };

/**
 * Runs the hint search. Pure, so the worker and the main thread run the same code (TD-13).
 * Example: `searchHint(board, 40000) // { path: [{ from: 0, to: 14 }, ...] }`
 */
export function searchHint(board: Board, budget: number): HintSearch {
  const result = solve(board, budget);
  if (result.solvable !== true || result.path.length === 0) return { reason: result.solvable === null ? 'budget' : 'unwinnable' };
  return { path: result.path };
}

/**
 * Finds a re-deal of `board`'s free jars that the solver proves winnable, or `null`. Only
 * free jars are re-dealt: sealed, frozen, locked and funnel jars keep their sand. An unsealed
 * hourglass is a free jar: its sand is re-dealt and its count is kept (a shuffle is not a pour, D96). A closed clam keeps its sand and its count (D96, §2.6): it is shut,
 * and a shuffle is not a pour; once open it is a free jar like any other. Wet sand (D189, §2.7)
 * keeps its count with its unit: each unit is re-dealt together with its count. An unsealed tide jar
 * (§2.8) is a free jar like the hourglass: its sand is re-dealt and its count is kept. The crab's jar (§2.9)
 * keeps its sand, the crab and its count; a lighthouse jar (§2.10) is a free jar and keeps its beam. Pure and
 * deterministic for a given `rng`, so a worker given the same seed finds the same board
 * (TD-13). All attempts together spend at most `shuffleTotalNodeBudget` states (F7, GA-SB-4).
 * Example: `findShuffle(board, sessionOptions(config), createRng(seed))`
 */
export function findShuffle(board: Board, options: SessionOptions, rng: Rng): Board | null {
  // The crab's jar keeps its sand, the crab and its count (§2.9): it can't be poured from, like a closed clam.
  const open = board.jars.map((j, i) => (isSealed(j, board.capacity) || isClosed(j) || j.clam !== undefined || j.funnel || j.crab ? -1 : i)).filter((i) => i >= 0);
  // Each unit travels with its wet count (0 when dry), §2.7.
  const pool = open.flatMap((i) => board.jars[i].units.map((c, k) => [c, board.jars[i].wet?.[k] ?? 0] as const));
  const before = exactKey(board);
  const attempts = options.shuffleAttempts ?? 40;
  const budget = options.shuffleNodeBudget ?? options.hintNodeBudget;
  const total = options.shuffleTotalNodeBudget ?? budget;
  let spent = 0;
  for (let a = 0; a < attempts && spent < total; a++) {
    shuffleInPlace(pool, rng);
    let k = 0;
    const jars: Jar[] = board.jars.map((j, i) => {
      if (!open.includes(i)) return j;
      const dealt = pool.slice(k, k + j.units.length);
      k += j.units.length;
      const units = dealt.map(([c]) => c);
      const wet = dealt.map(([, w]) => w);
      const { wet: _old, ...rest } = j;
      return { ...rest, units, hidden: Math.min(j.hidden, Math.max(0, units.length - 1)), ...(wet.some((w) => w > 0) ? { wet } : {}) };
    });
    const next: Board = settle({ capacity: board.capacity, jars });
    if (exactKey(next) === before || isWon(next)) continue;
    const allowed = Math.min(budget, total - spent);
    const proof = solve(next, allowed);
    spent += Math.min(proof.nodes, allowed);
    if (proof.solvable === true) return next;
  }
  return null;
}

/** An order-sensitive board key. Plans use jar indices, so jar order matters here. */
function exactKey(board: Board): string {
  return board.jars.map(jarKey).join('|');
}
