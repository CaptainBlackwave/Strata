/**
 * The Home hero's rules (sprint 20, D167, D169, D173; design/ux/home.md): a tiny sorting game that
 * plays itself. Which board each loop deals, the solver's moves it plays, the loop's phases, the
 * reduced-motion still, live or still, when it runs, and where the jars sit. Pure and DOM-free, so
 * they are unit-tested; the controller is screens/home-hero.ts and the drawing the board's own
 * renderer (board-gpu/renderer.ts) or, for the still, the board's DOM jars.
 */
import rawConfig from '../../config/game-config.json';
import { type Board, type Move, isSealed, makeBoard, pour } from '../../core/board';
import { createRng, mixSeed, shuffle } from '../../core/rng';
import { solve } from '../../core/solver';
import { chooseBoardMode } from '../board-gpu/switch';

/** The `homeHero` block of game-config.json. */
export interface HeroTuning {
  /** Colours a deal uses; each fills one jar. */
  readonly colors: number;
  /** Units a jar holds. */
  readonly capacity: number;
  /** Empty jars beside the full ones. */
  readonly empty: number;
  /** The first loop's seed; loop n deals from `mixSeed(seed, n)`. */
  readonly seed: number;
  /** Time from one pour's end to the next pour (ms). */
  readonly paceMs: number;
  /** The solved board rests this long before the re-mix (ms). */
  readonly solvedMs: number;
  /** Each half of the re-mix cross-fade (ms). */
  readonly fadeMs: number;
  /** A deal is kept only when the solver solves it in this many pours. */
  readonly minMoves: number;
  readonly maxMoves: number;
  /** The solver's node budget per deal. */
  readonly solveBudget: number;
  /** The hero's sand simulation rate (steps a second). */
  readonly stepsPerSecond: number;
  /** Colour ids the deals draw from. */
  readonly palette: readonly number[];
}

/** The shipped tuning. */
export const heroTuning: HeroTuning = rawConfig.homeHero;

/** A deal: the board and the solver's pours that sort it, in order. */
export interface HeroDeal {
  readonly board: Board;
  readonly moves: readonly Move[];
  /** The seed the deal came from. */
  readonly seed: number;
}

/** Deals tried before the fixed fallback. */
const DEAL_TRIES = 40;

/** The deal a tuning falls back to when no seeded try is kept: a short, known-solvable board. */
export function fallbackDeal(tuning: HeroTuning): HeroDeal {
  const [a, b, c] = tuning.palette;
  const board = makeBoard(4, [[a, b, a, c], [b, c, b, a], [c, a, c, b], [], []]);
  return { board, moves: solve(board, tuning.solveBudget).path, seed: 0 };
}

/**
 * The board for `seed`: `colors` colours (picked from the palette by the seed), each `capacity` units,
 * shuffled into full jars, then the empty jars. Kept when no jar starts sealed and the solver sorts it
 * in `minMoves`..`maxMoves` pours, so every pour the hero plays is legal; otherwise the next try's seed.
 * Deterministic. Example: `heroDeal(heroTuning, heroTuning.seed).moves.length // 6..14`.
 */
export function heroDeal(tuning: HeroTuning, seed: number): HeroDeal {
  for (let attempt = 0; attempt < DEAL_TRIES; attempt++) {
    const s = mixSeed(seed, attempt);
    const rng = createRng(s);
    const colors = shuffle([...tuning.palette], rng).slice(0, tuning.colors);
    const units = shuffle(colors.flatMap((c) => Array.from({ length: tuning.capacity }, () => c)), rng);
    const jars: number[][] = [];
    for (let j = 0; j < tuning.colors; j++) jars.push(units.slice(j * tuning.capacity, (j + 1) * tuning.capacity));
    for (let j = 0; j < tuning.empty; j++) jars.push([]);
    const board = makeBoard(tuning.capacity, jars);
    if (board.jars.some((jar) => jar.units.length > 0 && isSealed(jar, board.capacity))) continue;
    const result = solve(board, tuning.solveBudget);
    if (result.solvable !== true || result.path.length < tuning.minMoves || result.path.length > tuning.maxMoves) continue;
    return { board, moves: result.path, seed: s };
  }
  return fallbackDeal(tuning);
}

/** Loop `n`'s seed: the re-mix after each solve deals from the next one. */
export function remixSeed(tuning: HeroTuning, loop: number): number {
  return mixSeed(tuning.seed, loop);
}

/** The board after the first `n` pours of a deal. */
export function boardAfter(deal: HeroDeal, n: number): Board {
  return deal.moves.slice(0, Math.max(0, n)).reduce((b, m) => pour(b, m.from, m.to).board, deal.board);
}

/** The reduced-motion and Classic still: the first deal half sorted (a mid-sort board, a jar or so sealed). */
export function heroStill(deal: HeroDeal): Board {
  const n = deal.moves.length;
  let k = Math.floor(n / 2);
  // Prefer the first pour from the middle on that leaves a jar sealed: the still shows a cork.
  for (let i = k; i < n; i++) {
    const b = boardAfter(deal, i);
    if (b.jars.some((j) => j.units.length > 0 && isSealed(j, b.capacity))) {
      k = i;
      break;
    }
  }
  return boardAfter(deal, k);
}

/** Where the loop is: waiting between pours, a pour playing, the solved rest, or the re-mix fade out and in. */
export interface HeroLoop {
  readonly phase: 'wait' | 'pour' | 'solved' | 'fadeOut' | 'fadeIn';
  /** Loops dealt; picks the seed. */
  readonly loop: number;
  /** The next pour's index in the deal's moves. */
  readonly step: number;
}

/** The first loop, waiting before its first pour. */
export const HERO_START: HeroLoop = { phase: 'wait', loop: 0, step: 0 };

/** How long a phase lasts before `nextPhase` (ms); `null` for a pour, which ends when it has played. */
export function phaseMs(phase: HeroLoop['phase'], tuning: HeroTuning): number | null {
  switch (phase) {
    case 'wait':
      return tuning.paceMs;
    case 'solved':
      return tuning.solvedMs;
    case 'fadeOut':
    case 'fadeIn':
      return tuning.fadeMs;
    default:
      return null;
  }
}

/**
 * The phase after `loop`'s, with `moves` pours in the deal: wait → pour (or solved once every pour has
 * played) → wait …; solved → fade out → fade in, on the next loop's deal from its first pour → wait.
 */
export function nextPhase(loop: HeroLoop, moves: number): HeroLoop {
  switch (loop.phase) {
    case 'wait':
      return loop.step < moves ? { ...loop, phase: 'pour' } : { ...loop, phase: 'solved' };
    case 'pour':
      return loop.step + 1 >= moves ? { ...loop, phase: 'solved', step: loop.step + 1 } : { ...loop, phase: 'wait', step: loop.step + 1 };
    case 'solved':
      return { ...loop, phase: 'fadeOut' };
    case 'fadeOut':
      return { phase: 'fadeIn', loop: loop.loop + 1, step: 0 };
    case 'fadeIn':
      return { ...loop, phase: 'wait' };
  }
}

/** What decides live or still. */
export interface HeroModeInput {
  /** `location.search`: `?board=dom` forces Classic, `?board=gpu` Realistic, as on the board. */
  readonly search: string;
  readonly webgl: boolean;
  /** The Settings choice (D164). */
  readonly realistic: boolean;
  /** The hero's WebGL context is lost now. */
  readonly lost: boolean;
}

/**
 * `'live'` (the Realistic board playing itself) when the board would be Realistic and the context is
 * alive; `'still'` (the mid-sort board in the DOM jar look) on Classic, without WebGL or with the
 * context lost. Example: `heroMode({ search: '', webgl: true, realistic: true, lost: false }) // 'live'`.
 */
export function heroMode(i: HeroModeInput): 'live' | 'still' {
  const board = chooseBoardMode({ search: i.search, storedFlag: null, dev: false, webgl: i.webgl, realistic: i.realistic });
  return board === 'gpu' && !i.lost ? 'live' : 'still';
}

/** What decides whether the live hero plays. */
export interface HeroRunInput {
  /** Home is open. */
  readonly homeShown: boolean;
  /** The Play tab is the one shown. */
  readonly onPlay: boolean;
  /** The browser tab is visible. */
  readonly pageVisible: boolean;
  /** The player asked for reduced motion: the hero is the still. */
  readonly reduced: boolean;
}

/** True when the hero should play: only while it can be seen, never under reduced motion (D169). */
export function heroRuns(i: HeroRunInput): boolean {
  return i.homeShown && i.onPlay && i.pageVisible && !i.reduced;
}

/** One jar's glass box in the stage (CSS px, origin top left) and its band height. */
export interface HeroJarBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly unitHeight: number;
}

/** The glass's wall and base inset (board-gpu/geometry.ts `DOM_INSET`). */
const INSET = 5.5;
/** A jar's band height and gap as shares of its width, near the board's own proportions. */
const UNIT_OF_WIDTH = 0.52;
const GAP_OF_WIDTH = 0.55;
/** The jars never grow wider than this (CSS px). */
const MAX_JAR_W = 62;

/**
 * The row of `count` jars of `capacity` along the bottom of a `width × height` stage, centred, with the
 * upper part left free for a lifted, tipped jar. Example: `heroLayout(412, 305, 5, 4)`.
 */
export function heroLayout(width: number, height: number, count: number, capacity: number): HeroJarBox[] {
  const base = height - 20;
  const byWidth = (width - 32) / (count + (count - 1) * GAP_OF_WIDTH);
  // The glass may take at most half the stage's height: the rest is room for the pour.
  const byHeight = (height * 0.5 - INSET) / (capacity * UNIT_OF_WIDTH + 0.3);
  const w = Math.max(24, Math.min(MAX_JAR_W, byWidth, byHeight));
  const unit = w * UNIT_OF_WIDTH;
  const h = capacity * unit + INSET + w * 0.3;
  const gap = w * GAP_OF_WIDTH;
  const left0 = (width - (count * w + (count - 1) * gap)) / 2;
  return Array.from({ length: count }, (_, i) => ({ left: left0 + i * (w + gap), top: base - h, width: w, height: h, unitHeight: unit }));
}
