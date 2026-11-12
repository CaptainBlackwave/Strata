/**
 * The Home hero's rules (sprint 21 H1, D175, D176; design/ux/home.md): the three logo jars from before
 * 0.19, the middle one taller, three layers of sand each, made larger. On Realistic they are drawn once
 * with the board's own renderer (Realistic sand, matte glass) as a still, with a rare soft sparkle on
 * the sand; on Classic, without WebGL and before the renderer's chunk loads they are the CSS logo jars.
 * Which look, whether the sparkle runs, when the next sparkle comes and where, and where the jars sit.
 * Pure and DOM-free, so they are unit-tested; the controller is screens/home-hero.ts.
 */
import rawConfig from '../../config/game-config.json';
import { type Board, makeBoard } from '../../core/board';
import { createRng, mixSeed } from '../../core/rng';
import { chooseBoardMode } from '../board-gpu/switch';

/** The `homeHero` block of game-config.json. */
export interface HeroTuning {
  /** The three jars' colour ids, bottom layer first (the logo's red, amber and teal, permuted). */
  readonly jars: readonly (readonly number[])[];
  /** The first sparkle comes this long after the hero is shown (ms). */
  readonly firstSparkleMs: number;
  /** Then one sparkle about every `sparkleEveryMs`, give or take `sparkleJitterMs` (ms). */
  readonly sparkleEveryMs: number;
  readonly sparkleJitterMs: number;
  /** One sparkle's whole life, in and out (ms). */
  readonly sparkleMs: number;
  /** Seeds where and when the sparkles fall. */
  readonly seed: number;
}

/** The shipped tuning. */
export const heroTuning: HeroTuning = rawConfig.homeHero;

/** The logo's board: three full jars of three layers each, none sealed. */
export function logoBoard(tuning: HeroTuning = heroTuning): Board {
  const capacity = Math.max(...tuning.jars.map((j) => j.length));
  return makeBoard(capacity, tuning.jars);
}

/** What decides the look. */
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
 * `'realistic'` (the jars drawn by the board's renderer) when the board would be Realistic and the
 * context is alive; `'css'` (the CSS logo jars) on Classic, without WebGL or with the context lost.
 * Example: `heroMode({ search: '?board=dom', webgl: true, realistic: true, lost: false }) // 'css'`.
 */
export function heroMode(i: HeroModeInput): 'realistic' | 'css' {
  const board = chooseBoardMode({ search: i.search, storedFlag: null, dev: false, webgl: i.webgl, realistic: i.realistic });
  return board === 'gpu' && !i.lost ? 'realistic' : 'css';
}

/** What decides whether the sparkle runs. */
export interface SparkleRunInput {
  /** The hero shows the Realistic jars (the CSS jars never sparkle). */
  readonly realistic: boolean;
  /** Home is open. */
  readonly homeShown: boolean;
  /** The Play tab is the one shown. */
  readonly onPlay: boolean;
  /** The browser tab is visible. */
  readonly pageVisible: boolean;
  /** The player asked for reduced motion: nothing moves (D176). */
  readonly reduced: boolean;
}

/** True when the sparkle timer should run: only on the Realistic jars, while they can be seen, never under reduced motion. */
export function sparkleRuns(i: SparkleRunInput): boolean {
  return i.realistic && i.homeShown && i.onPlay && i.pageVisible && !i.reduced;
}

/**
 * The wait before sparkle `n` (ms): `firstSparkleMs` for the first, then `sparkleEveryMs` give or
 * take `sparkleJitterMs`, seeded, so it never settles into a beat. Never under the sparkle's own life.
 * Example: `sparkleDelay(heroTuning, 0) // heroTuning.firstSparkleMs`.
 */
export function sparkleDelay(tuning: HeroTuning, n: number): number {
  if (n <= 0) return tuning.firstSparkleMs;
  const r = createRng(mixSeed(tuning.seed, n))();
  return Math.max(tuning.sparkleMs, Math.round(tuning.sparkleEveryMs + (r * 2 - 1) * tuning.sparkleJitterMs));
}

/** One jar's glass box in the stage (CSS px, origin top left) and its band height. */
export interface HeroJarBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly unitHeight: number;
}

/**
 * The logo's proportions, from the pre-0.19 CSS (46 × 92 px side jars, a 112 px middle one, 12 px
 * apart, sand to 84% of the glass). style.css `.hero-logo` draws the same row, so the CSS jars and
 * the canvas sit in the same place and nothing jumps when the renderer arrives.
 */
export const LOGO = {
  /** The side jars' height as a share of the stage's height, and its cap (px). */
  heightShare: 0.46,
  maxHeight: 176,
  /** The middle jar's height over a side jar's. */
  middle: 112 / 92,
  /** A jar's width over a side jar's height. */
  width: 46 / 92,
  /** The gap over a jar's width. */
  gap: 12 / 46,
  /** The sand's top as a share of the glass's height. */
  fill: 0.84,
  /** Room under the jars for their shadows (px). */
  foot: 18,
} as const;

/** The glass's base inset (board-gpu/geometry.ts `DOM_INSET`). */
const INSET = 5.5;

/**
 * The three logo jars along the bottom of a `width × height` stage, centred, the middle one taller.
 * Each jar's `capacity` bands fill its glass to `LOGO.fill`. Example: `heroLayout(390, 336, 3)`.
 */
export function heroLayout(width: number, height: number, capacity: number): HeroJarBox[] {
  // The row (three jars, two gaps) also stays 16 px clear of each side.
  const side = Math.min(LOGO.maxHeight, height * LOGO.heightShare, (width - 32) / (LOGO.width * (3 + 2 * LOGO.gap)));
  const w = side * LOGO.width;
  const gap = w * LOGO.gap;
  const left0 = (width - (3 * w + 2 * gap)) / 2;
  const base = height - LOGO.foot;
  return [1, LOGO.middle, 1].map((k, i) => {
    const h = side * k;
    return { left: left0 + i * (w + gap), top: base - h, width: w, height: h, unitHeight: (h * LOGO.fill - INSET) / capacity };
  });
}

/** Where a sparkle sits in the stage (its centre, CSS px) and how large it is. */
export interface SparkleSpot {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  /** The jar it falls on. */
  readonly jar: number;
}

/**
 * Sparkle `n`'s spot: a seeded jar, somewhere on its sand (inside the walls, between the base and the
 * top of the sand, never on the very edge). Example: `sparkleSpot(heroLayout(390, 336, 3), 3, 1)`.
 */
export function sparkleSpot(boxes: readonly HeroJarBox[], capacity: number, n: number, tuning: HeroTuning = heroTuning): SparkleSpot {
  const rng = createRng(mixSeed(tuning.seed ^ 0x5a5a, n));
  const jar = Math.min(boxes.length - 1, Math.floor(rng() * boxes.length));
  const b = boxes[jar];
  const sandTop = b.top + b.height - INSET - b.unitHeight * capacity;
  const sandH = b.unitHeight * capacity;
  const x = b.left + INSET + (b.width - 2 * INSET) * (0.2 + 0.6 * rng());
  const y = sandTop + sandH * (0.08 + 0.8 * rng());
  // Large enough to read as a glint at a glance (D183): about half the jar's width, 18 to 40 px.
  return { x, y, size: Math.max(18, Math.min(40, b.width * 0.45)), jar };
}
