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
  /**
   * Sieve jar (D96, design/gdd/jar-mechanics.md §2.5): banded in this colour. Only units of
   * this colour may be poured in (`pourRefusal` gives `'sieve'` otherwise); anything may be
   * poured out, and it seals like any jar. Part of the board, so undo, restart, the solver and
   * hints see it.
   */
  readonly sieve?: Color;
  /**
   * Clam jar (D96, design/gdd/jar-mechanics.md §2.6): closed under a shell, this many successful
   * pours from opening (1..opensAfter). While closed nothing may be poured into or out of it
   * (`pourRefusal` gives `'clam'`) and the UI hides its sand. Every successful pour anywhere
   * counts it down; the pour that reaches zero removes the field, so from then on it is an
   * ordinary jar (its burial unchanged). Part of the board, so undo, restart, the solver and
   * hints see it.
   */
  readonly clam?: number;
  /**
   * Wet sand (D189, design/gdd/jar-mechanics.md §2.7): one entry per unit, parallel to `units`
   * (bottom first), the successful pours left until that unit is dry; 0 is dry. Absent when every
   * unit is dry, so a jar without wet sand is exactly as before. A wet unit carries its count when
   * it is poured, flipped or shuffled. Part of the board, so undo, restart, the solver and hints see it.
   */
  readonly wet?: readonly number[];
  /**
   * Tide jar (D193–D195, design/gdd/jar-mechanics.md §2.8): every successful pour anywhere on the
   * board counts down `left`; the pour that reaches zero turns the tide: the stack rises by one
   * (the bottom unit moves to the top, every other unit moves down one place) and the count
   * restarts at `every`. A sealed tide jar never turns again: its count stops where it was. Part
   * of the board, so undo, restart, the solver and hints see it.
   */
  readonly tide?: Tide;
  /**
   * Crab jar (D207, design/gdd/jar-mechanics.md §2.9): the crab sits on this jar's lid. Nothing may be
   * poured out of it (`pourRefusal` gives `'crab'`); sand may still be poured in. At most one jar on
   * a board holds the crab (the field travels from jar to jar). Every successful pour on the board
   * counts `left` down; the pour that reaches zero moves the crab to the next jar in the row (index
   * order, wrapping) that is neither empty nor sealed, and its count restarts at `every`. Part of the
   * board, so undo, restart, the solver and hints see it.
   */
  readonly crab?: Crab;
  /**
   * Lighthouse jar (D208, D209, design/gdd/jar-mechanics.md §2.10): its sand is dark (the UI shows
   * no colours) except for the one pour after every `every`th successful pour on the board, when the
   * beam lights it (`lit`), and for good once it is sealed. It pours like an ordinary jar: the rules
   * never depend on seeing. Use `isLit` to know whether to show its colours.
   */
  readonly lighthouse?: Lighthouse;
}

/**
 * The crab's count (§2.9): it moves every `every` pours, `left` pours from now (1..every). Same shape
 * as the hourglass's count.
 */
export interface Crab {
  readonly every: number;
  readonly left: number;
}

/**
 * A lighthouse jar's beam (§2.10): it sweeps every `every` pours, `left` pours from now (1..every).
 * `lit` is true from the pour that sweeps until the next successful pour. Once the jar is sealed the
 * count stops and `isLit` is true for good.
 */
export interface Lighthouse {
  readonly every: number;
  readonly left: number;
  readonly lit: boolean;
}

/**
 * A tide jar's count (§2.8): it turns every `every` pours, `left` pours from now (1..every).
 * Same shape as the hourglass's count. Once the jar is sealed, `left` no longer changes.
 */
export interface Tide {
  readonly every: number;
  readonly left: number;
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
 * A jar is complete when it is full of a single colour at the board's normal capacity, wet or
 * dry. Narrow jars are never complete. A complete jar is sealed once all its sand is dry (§2.7);
 * a board of empty and complete jars is won.
 */
export function isComplete(jar: Jar, capacity: number): boolean {
  if ((jar.cap ?? capacity) !== capacity || jar.units.length !== capacity) return false;
  return jar.units.every((c) => c === jar.units[0]);
}

/**
 * A jar is sealed when it is full of a single colour at the board's normal capacity and none of
 * its sand is wet (D189, §2.7). Narrow jars never seal.
 */
export function isSealed(jar: Jar, capacity: number): boolean {
  return isComplete(jar, capacity) && !isJarWet(jar);
}

/** True when any unit in `jar` is wet (§2.7). */
export function isJarWet(jar: Jar): boolean {
  return jar.wet !== undefined && jar.wet.some((w) => w > 0);
}

/** True when any unit on the board is wet (§2.7). */
export function hasWet(board: Board): boolean {
  return board.jars.some(isJarWet);
}

/**
 * True when the top run of `jar` (the units a pour would move, `topRun`) holds a wet unit, so
 * the whole run follows the wet rule: it may only go onto its own colour, never into an empty
 * jar (D189, §2.7). False for an empty jar.
 */
export function isRunWet(jar: Jar): boolean {
  const run = topRun(jar);
  if (!run || !jar.wet) return false;
  for (let k = 1; k <= run.count; k++) if ((jar.wet[jar.units.length - k] ?? 0) > 0) return true;
  return false;
}

/** `jar` with its wet counts set to `wet`, or with no `wet` field when every count is dry. */
function withWet(jar: Jar, wet: readonly number[] | undefined): Jar {
  const { wet: _old, ...rest } = jar;
  return wet && wet.some((w) => w > 0) ? { ...rest, wet } : rest;
}

/** True when every unit in a non-empty jar has the same colour. */
export function isMonochrome(jar: Jar): boolean {
  return jar.units.length > 0 && jar.units.every((c) => c === jar.units[0]);
}

/**
 * Why a pour is refused, so the UI can explain it (sprint 13 M2):
 * `'same'` source is the target; `'missing'` no such jar; `'closed'` either jar is frozen or
 * locked; `'funnel'` the source is a funnel; `'sealed'` the source is sealed; `'empty'` the
 * source is empty; `'sieve'` the target is a sieve and the poured colour is not its band (D96);
 * `'clam'` either jar is a closed clam (D96, §2.6); `'crab'` the crab sits on the source (D207, §2.9: pouring
 * into its jar is allowed); `'full'` the target has no room; `'wet'` the
 * moving run holds wet sand and the target is empty (D189, §2.7); `'colour'` the target's top is
 * another colour.
 */
export type PourRefusal = 'same' | 'missing' | 'closed' | 'clam' | 'funnel' | 'sealed' | 'crab' | 'empty' | 'sieve' | 'full' | 'wet' | 'colour';

/**
 * Teardown rule R5: a pour is legal when the source is non-empty, the target has
 * room, and the target is empty or its top colour matches. A sealed jar is done and
 * can't be poured from (decision D-b, production/qa/sprint-6-findings.md GA-PR-1), which
 * matches the UI and the solver, so `usefulMoves` and `isStuck` follow too. A sieve takes
 * only its own colour, and a closed clam takes and gives nothing (D96). Returns `null` for a legal pour, otherwise the first reason in
 * the order of `PourRefusal`. Example: `pourRefusal(board, 2, 0) // 'sieve'`
 */
export function pourRefusal(board: Board, from: number, to: number): PourRefusal | null {
  if (from === to) return 'same';
  const src = board.jars[from];
  const dst = board.jars[to];
  if (!src || !dst) return 'missing';
  if (isClosed(src) || isClosed(dst)) return 'closed';
  if (src.clam !== undefined || dst.clam !== undefined) return 'clam';
  if (src.funnel) return 'funnel';
  if (isSealed(src, board.capacity)) return 'sealed';
  // The crab (D207, §2.9) blocks pouring out of its jar only.
  if (src.crab) return 'crab';
  const run = topRun(src);
  if (!run) return 'empty';
  // The sieve's band is checked before room and top colour: it is the jar's own rule.
  if (dst.sieve !== undefined && run.color !== dst.sieve) return 'sieve';
  if (dst.units.length >= (dst.cap ?? board.capacity)) return 'full';
  const dstTop = topRun(dst);
  // Wet sand (D189, §2.7) goes only onto its own colour, so never into an empty jar.
  if (dstTop === null) return isRunWet(src) ? 'wet' : null;
  return dstTop.color === run.color ? null : 'colour';
}

/** True when `pourRefusal` finds no reason to refuse the pour (teardown rule R5, D96). */
export function canPour(board: Board, from: number, to: number): boolean {
  return pourRefusal(board, from, to) === null;
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
  /** Indices of clam jars that opened right after this pour (D96, §2.6); usually empty. */
  readonly opened: readonly number[];
  /**
   * Indices of jars where at least one wet unit dried right after this pour (D189, §2.7),
   * including every jar the winning pour dried; usually empty.
   */
  readonly dried: readonly number[];
  /**
   * Indices of tide jars that turned right after this pour (D194, §2.8), the count reset
   * included, even when the turn changes nothing visible (an empty or one-colour jar); usually empty.
   */
  readonly turned: readonly number[];
  /**
   * Where the crab went right after this pour (D207, §2.9), when it changed jars; `null` when it
   * stayed (its count may still have restarted) or there is no crab.
   */
  readonly crabMoved: { readonly from: number; readonly to: number } | null;
  /** Indices of lighthouse jars the beam lit right after this pour (D208, §2.10); usually empty. */
  readonly swept: readonly number[];
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
  let newSrc: Jar = { ...src, units: newSrcUnits, hidden: clampHidden(src.hidden, newSrcUnits.length) };
  let newDst: Jar = { ...dst, units: [...dst.units, ...new Array<Color>(moved).fill(color)] };
  if (src.wet || dst.wet) {
    // Each moved unit takes its own count along (§2.7).
    const srcWet = src.wet ?? new Array<number>(src.units.length).fill(0);
    newSrc = withWet(newSrc, srcWet.slice(0, newSrcUnits.length));
    newDst = withWet(newDst, [...(dst.wet ?? new Array<number>(dst.units.length).fill(0)), ...srcWet.slice(newSrcUnits.length)]);
  }
  const poured = board.jars.map((j, i) => (i === from ? newSrc : i === to ? newDst : j));
  const { jars: flippedJars, flipped } = tickHourglasses(poured);
  const { jars: openedJars, opened } = tickClams(flippedJars);
  const { jars: driedJars, dried } = tickWet(openedJars);
  const { jars, turned } = tickTides(driedJars, board.capacity);
  let next = settle({ capacity: board.capacity, jars });
  // The winning pour dries the board (§2.7), so a won board is all sealed.
  if (hasWet(next) && isWon(next)) {
    next.jars.forEach((j, i) => {
      if (isJarWet(j) && !dried.includes(i)) dried.push(i);
    });
    dried.sort((a, b) => a - b);
    next = settle({ capacity: next.capacity, jars: next.jars.map((j) => (j.wet ? withWet(j, undefined) : j)) });
  }
  // The crab and the beam run last, on the settled board, so "sealed" is judged after drying (§2.9, §2.10).
  const { jars: crabJars, crabMoved } = tickCrab(next.jars, next.capacity);
  const { jars: litJars, swept } = tickLighthouses(crabJars, next.capacity);
  if (litJars !== next.jars) next = { capacity: next.capacity, jars: litJars };
  return { board: next, moved, color, flipped, opened, dried, turned, crabMoved, swept };
}

/**
 * The tide rule (D194, D195, §2.8), applied after every successful pour, last of the per-pour
 * rules (after the hourglasses, the clams and the drying), so it sees the board this pour
 * leaves. Each tide jar that is not sealed counts down one; one that reaches zero turns: its
 * bottom unit moves to the top and every other unit moves down one place, each unit's wet
 * count moving with it (§2.7), the whole stack is shown (`hidden: 0`) and the count restarts
 * at `every`. A turn keeps the jar's colours, so it never seals or unseals a jar by itself. A
 * sealed tide jar (sealed on this pour or earlier) never turns again: its count is left as it
 * was. Returns the same array when there is none.
 */
function tickTides(jars: readonly Jar[], capacity: number): { jars: readonly Jar[]; turned: number[] } {
  const turned: number[] = [];
  if (!jars.some((j) => j.tide)) return { jars, turned };
  const next = jars.map((j, i) => {
    if (!j.tide || isSealed(j, capacity)) return j;
    const left = j.tide.left - 1;
    if (left > 0) return { ...j, tide: { every: j.tide.every, left } };
    turned.push(i);
    return { ...j, units: riseByOne(j.units), hidden: 0, tide: { every: j.tide.every, left: j.tide.every }, ...(j.wet ? { wet: riseByOne(j.wet) } : {}) };
  });
  return { jars: next, turned };
}

/** The index of the jar the crab sits on, or -1 when the board has no crab (§2.9). */
export function crabAt(board: Board): number {
  return board.jars.findIndex((j) => j.crab !== undefined);
}

/**
 * Where the crab would step from jar `from` (§2.9): the next jar after it in the row, wrapping round,
 * that is neither empty nor sealed. `from` itself is never a step; -1 when no other jar can take it.
 * Example: `crabStep(board, 3) // 5 when jars 4 is empty`
 */
export function crabStep(board: Board, from: number): number {
  const n = board.jars.length;
  for (let k = 1; k < n; k++) {
    const i = (from + k) % n;
    const j = board.jars[i];
    if (j.units.length > 0 && !isSealed(j, board.capacity)) return i;
  }
  return -1;
}

/**
 * The crab rule (D207, §2.9), applied after every successful pour, after every other per-pour rule
 * and the seal-triggered ones (on the settled board). The crab counts down one; at zero it steps to
 * `crabStep` and its count restarts at `every`, or, when no other jar can take it, it stays and the
 * count restarts. A crab whose jar is sealed (by this pour: pours into its jar are allowed) steps off
 * at once, whatever its count, and its count restarts, so a sealed jar never holds the crab while
 * another jar can. Returns the same array when there is no crab.
 */
function tickCrab(jars: readonly Jar[], capacity: number): { jars: readonly Jar[]; crabMoved: { from: number; to: number } | null } {
  const at = jars.findIndex((j) => j.crab !== undefined);
  if (at < 0) return { jars, crabMoved: null };
  const crab = jars[at].crab!;
  const sealed = isSealed(jars[at], capacity);
  const left = crab.left - 1;
  if (!sealed && left > 0) return { jars: jars.map((j, i) => (i === at ? { ...j, crab: { every: crab.every, left } } : j)), crabMoved: null };
  const reset: Crab = { every: crab.every, left: crab.every };
  const to = crabStep({ capacity, jars }, at);
  if (to < 0) return { jars: jars.map((j, i) => (i === at ? { ...j, crab: reset } : j)), crabMoved: null };
  const next = jars.map((j, i) => {
    if (i === to) return { ...j, crab: reset };
    if (i !== at) return j;
    const { crab: _gone, ...rest } = j;
    return rest;
  });
  return { jars: next, crabMoved: { from: at, to } };
}

/** True while the board has a crab (§2.9): every pour moves its count, so a swap can be the wait a plan needs. */
export function hasCrab(board: Board): boolean {
  return board.jars.some((j) => j.crab !== undefined);
}

/**
 * The beam rule (D208, §2.10), applied after every successful pour, last of all. Each lighthouse jar
 * that is not sealed goes dark if it was lit, counts down one, and at zero is lit for this one pour
 * and restarts at `every`. A sealed lighthouse jar's beam stops where it was (`isLit` is true for good).
 * Returns the same array when there is none.
 */
function tickLighthouses(jars: readonly Jar[], capacity: number): { jars: readonly Jar[]; swept: number[] } {
  const swept: number[] = [];
  if (!jars.some((j) => j.lighthouse)) return { jars, swept };
  const next = jars.map((j, i) => {
    if (!j.lighthouse || isSealed(j, capacity)) return j;
    const { every } = j.lighthouse;
    const left = j.lighthouse.left - 1;
    if (left > 0) return { ...j, lighthouse: { every, left, lit: false } };
    swept.push(i);
    return { ...j, lighthouse: { every, left: every, lit: true } };
  });
  return { jars: next, swept };
}

/**
 * True when the player may see `jar`'s colours (D208, D209, §2.10): any jar that is not a lighthouse
 * jar, and a lighthouse jar while the beam lights it or once it is sealed. A dark jar's units are
 * shown like buried sand: no colour, no colour-blind pattern, no colour in the screen reader. Buried
 * units (`hidden`) stay buried either way. Example: `isLit(jar, board.capacity) // false while dark`.
 */
export function isLit(jar: Jar, capacity: number): boolean {
  return !jar.lighthouse || jar.lighthouse.lit || isSealed(jar, capacity);
}

/**
 * One tide turn of a bottom-first list (§2.8): the first entry (the bottom) moves to the end (the
 * top) and every other entry moves down one place. Example: `riseByOne([0, 1, 2]) // [1, 2, 0]`.
 */
export function riseByOne<T>(xs: readonly T[]): T[] {
  return xs.length < 2 ? [...xs] : [...xs.slice(1), xs[0]];
}

/**
 * True when a tide jar's next turn changes its sand (§2.8): it is not sealed and holds two or more
 * colours. Only then can a pour that merely swaps two jars matter, as a wait that brings the turn
 * closer (like `hasLiveHourglass`). An empty, one-colour or sealed tide jar looks the same after a
 * turn, so while every tide jar is like that the usual pruning stands.
 */
export function hasLiveTide(board: Board): boolean {
  return board.jars.some((j) => j.tide !== undefined && !isMonochrome(j) && j.units.length > 0 && !isSealed(j, board.capacity));
}

/**
 * The drying rule (D189, §2.7), applied after every successful pour (after the hourglasses and
 * the clams): every wet unit on the board counts down one, the units just poured included; at 0
 * it is dry. A jar whose last wet unit dries drops its `wet` field. Returns the same array when
 * there is no wet sand.
 */
function tickWet(jars: readonly Jar[]): { jars: readonly Jar[]; dried: number[] } {
  const dried: number[] = [];
  if (!jars.some((j) => j.wet)) return { jars, dried };
  const next = jars.map((j, i) => {
    if (!j.wet) return j;
    if (j.wet.some((w) => w === 1)) dried.push(i);
    return withWet(j, j.wet.map((w) => Math.max(0, w - 1)));
  });
  return { jars: next, dried };
}

/**
 * The clam rule (D96, §2.6), applied after every successful pour (after the hourglasses, which
 * can never be clams): each closed clam counts down one, and one that reaches zero opens for
 * good, dropping its `clam` field. Its sand and burial are untouched, since nothing could pour
 * into or out of it while it was closed. Returns the same array when there is none.
 */
function tickClams(jars: readonly Jar[]): { jars: readonly Jar[]; opened: number[] } {
  const opened: number[] = [];
  if (!jars.some((j) => j.clam !== undefined)) return { jars, opened };
  const next = jars.map((j, i) => {
    if (j.clam === undefined) return j;
    if (j.clam > 1) return { ...j, clam: j.clam - 1 };
    opened.push(i);
    const { clam: _open, ...rest } = j;
    return rest;
  });
  return { jars: next, opened };
}

/**
 * True when a clam is still closed (D96, §2.6). Then every legal pour brings it closer to
 * opening, so even a pour that merely swaps two jars is a wait a plan may need: `usefulMoves`
 * keeps them all, and the board is never reported stuck while any pour is left. A closed clam
 * with no legal pour anywhere can never open, so that board is truly stuck.
 */
export function hasClosedClam(board: Board): boolean {
  return board.jars.some((j) => j.clam !== undefined);
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
    // Wet counts turn over with their units (§2.7).
    return { ...j, units: [...j.units].reverse(), hidden: 0, hourglass: { every: j.hourglass.every, left: j.hourglass.every }, ...(j.wet ? { wet: [...j.wet].reverse() } : {}) };
  });
  return { jars: next, flipped };
}

/**
 * True when an hourglass holds two or more colours, so its next flip changes the board (D96).
 * Only then can a pour that merely swaps two jars matter: it is a wait move that brings the
 * flip closer. An empty or one-colour hourglass is unchanged by a flip, so while every
 * hourglass is like that, waiting never creates a useful pour and the usual pruning is exact
 * for `isStuck`.
 */
export function hasLiveHourglass(board: Board): boolean {
  return board.jars.some((j) => j.hourglass !== undefined && j.units.length > 0 && !isMonochrome(j));
}

/**
 * Applies the seal-triggered rules: once any jar is sealed every frozen jar thaws,
 * and a locked lid opens when a jar of its colour is sealed. Returns the same
 * board object when nothing changes.
 */
export function settle(board: Board): Board {
  const sealedColors = new Set<Color>();
  for (const j of board.jars) if (isSealed(j, board.capacity)) sealedColors.add(j.units[0]);
  // A complete jar that is still wet seals nothing yet (§2.7), but its burial is revealed below.
  if (sealedColors.size === 0 && !board.jars.some((j) => j.hidden && isComplete(j, board.capacity))) return board;
  let changed = false;
  const jars = board.jars.map((j0) => {
    // A sealed jar is one colour, so its buried units are revealed (owner bug report 2026-11-08).
    // A complete jar that is still wet is one colour too (§2.7).
    let j = j0;
    if (j0.hidden && isComplete(j0, board.capacity)) {
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

/**
 * Teardown rule R8: won when every jar is empty or sealed, and every sieve is sealed in its band
 * (D214, §2.5): an empty sieve is not a finished board. A complete jar that is still wet counts
 * (§2.7): its colour is all in it, so it can never move again, and the winning pour dries the
 * board (`pour`), so a won board is all sealed (a sieve included).
 * Example: `isWon(boardWithEmptySieve) // false`
 */
export function isWon(board: Board): boolean {
  return board.jars.every((j) => (j.sieve !== undefined ? isSieveDone(j, board.capacity) : j.units.length === 0 || isComplete(j, board.capacity)));
}

/**
 * True when a sieve holds its goal (D214, §2.5): complete in its band colour. Still-wet sand counts,
 * as in `isWon`, since the winning pour dries the board. False for a jar that is not a sieve.
 * Example: `isSieveDone({ units: [2, 2, 2, 2], hidden: 0, sieve: 2 }, 4) // true`
 */
export function isSieveDone(jar: Jar, capacity: number): boolean {
  return jar.sieve !== undefined && isComplete(jar, capacity) && jar.units[0] === jar.sieve;
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
  // With a closed clam any pour counts it down, so a swap is a wait too (D96, §2.6).
  if (hasClosedClam(board)) return legalMoves(board);
  // With wet sand any pour dries it, so a swap is a wait too (D189, §2.7).
  if (hasWet(board)) return legalMoves(board);
  // With a live tide jar any pour brings its turn closer, so a swap is a wait too (D194, §2.8).
  if (hasLiveTide(board)) return legalMoves(board);
  // With a crab any pour brings its step closer, and where it steps depends on jar order, so a swap is a wait too (D207, §2.9).
  if (hasCrab(board)) return legalMoves(board);
  return legalMoves(board).filter(({ from, to }) => {
    const src = board.jars[from];
    const dst = board.jars[to];
    // Moving a whole one-colour jar into an empty jar of the same kind only swaps them.
    // A sieve is its own kind (D96): filling an empty sieve frees an ordinary jar, which is progress.
    // So is a tide jar (§2.8): moving sand into or out of it changes which sand the tide turns.
    const sameKind = jarCapacity(board, from) === jarCapacity(board, to) && !dst.funnel && src.sieve === dst.sieve && !src.tide === !dst.tide;
    return !(dst.units.length === 0 && isMonochrome(src) && sameKind);
  });
}

/**
 * Teardown rule R9: stuck when the level isn't won and no useful pour is left. With a closed
 * clam or wet sand every legal pour is useful (D96 §2.6, D189 §2.7), so this is true only when
 * no pour at all is left.
 */
export function isStuck(board: Board): boolean {
  return !isWon(board) && usefulMoves(board).length === 0;
}

/** Why a board can certainly no longer be won (decision D-c; `'sieve'` from D215). */
export type LostReason = 'funnel' | 'lock' | 'sieve';

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
 * - A closed clam adds no reason of its own (D96, §2.6): its sand counts as reachable, since it
 *   opens after enough pours, and a board with no pour left to open it is already `isStuck`.
 * - `'lock'`: a locked, non-empty, unsealed jar can never open, because its key colour
 *   can never be sealed for the first time. Units of the key inside jars locked by that
 *   same key, inside funnels (except the one funnel that could seal it) or inside jars
 *   behind another lock that can never open are out of reach.
 *
 * - `'sieve'` (D215, §2.5): a sieve that is not yet complete in its band can never be, because
 *   too much of its band colour is sealed in other jars. Sealed sand never moves again, so a band
 *   needs `capacity` units outside sealed jars for each of its unfinished sieves. A complete jar
 *   that is still wet is not sealed yet (§2.7) and counts as free sand.
 *
 * Example: `lostReason(boardWithMixedFunnel) // 'funnel'`
 */
export function lostReason(board: Board): LostReason | null {
  const b = settle(board);
  const cap = b.capacity;
  if (sieveLost(b)) return 'sieve';
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
 * The band colour of a sieve that can never be complete (D215, §2.5), or `null`: a band whose
 * sand outside sealed jars is less than `capacity` for each of its unfinished sieves, with some of
 * it sealed in a jar that is not a sieve. Only sealed sand is counted out (it never moves again).
 * Example: `sieveLostColor(boardWithPinkSealedOutsideItsSieve) // the pink index`
 */
export function sieveLostColor(board: Board): Color | null {
  const cap = board.capacity;
  for (const s of board.jars) {
    if (s.sieve === undefined || isSieveDone(s, cap)) continue;
    const band = s.sieve;
    let need = 0;
    let free = 0;
    let sealedOutside = false;
    for (const j of board.jars) {
      if (j.sieve === band && !isSieveDone(j, cap)) need += cap;
      if (isSealed(j, cap)) {
        if (j.sieve === undefined && j.units[0] === band) sealedOutside = true;
        continue;
      }
      free += countColor(j, band);
    }
    if (sealedOutside && free < need) return band;
  }
  return null;
}

function sieveLost(board: Board): boolean {
  return sieveLostColor(board) !== null;
}

/**
 * A canonical string for a board, ignoring jar order and burial. An hourglass's count, a
 * sieve's band, a clam's count, wet sand's counts (§2.7), a tide jar's count (§2.8), the crab's count
 * (§2.9) are part of their jar's key, so states that differ only in them are not merged (D96). With a crab,
 * jar order is kept (the crab steps in index order). A lighthouse's beam (§2.10) is left out on purpose:
 * no rule depends on it, so boards that differ only in the beam play exactly alike, and keeping it would
 * split every state four ways and slow the solver for nothing. Two boards
 * with the same key are equivalent for solving purposes.
 */
export function boardKey(board: Board): string {
  // The crab steps in jar order (§2.9), so with a crab the order is part of the state: no sorting.
  if (hasCrab(board)) return board.jars.map(jarKey).join('|');
  return board.jars
    .map(jarKey)
    .sort()
    .join('|');
}

/** One jar's state and contents as a string (used by solver and plan keys). */
export function jarKey(j: Jar): string {
  const glass = j.hourglass ? `H${j.hourglass.left}/${j.hourglass.every}` : '';
  const sieve = j.sieve !== undefined ? `S${j.sieve}` : '';
  const clam = j.clam !== undefined ? `C${j.clam}` : '';
  const wet = j.wet ? `W${j.wet.join('.')}` : '';
  const tide = j.tide ? `T${j.tide.left}/${j.tide.every}` : '';
  const crab = j.crab ? `K${j.crab.left}/${j.crab.every}` : '';
  const tag = `${j.cap ?? ''}${j.frozen ? 'F' : ''}${j.lock !== undefined ? `L${j.lock}` : ''}${j.funnel ? 'U' : ''}${glass}${sieve}${clam}${wet}${tide}${crab}`;
  return tag ? `${tag}:${j.units.join(',')}` : j.units.join(',');
}

/** Adds one empty jar (the extra-jar booster). */
export function addEmptyJar(board: Board): Board {
  return { capacity: board.capacity, jars: [...board.jars, { units: [], hidden: 0 }] };
}
