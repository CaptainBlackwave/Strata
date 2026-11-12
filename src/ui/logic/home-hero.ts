/**
 * The Home hero's rules (sprint 20 H2, D167, D169; design/ux/home.md §5.5): live or still, when it
 * draws, where its three jars and the funnel sit, and its loop. Pure and DOM-free, so they are
 * unit-tested; the Pixi scene is board-gpu/hero-scene.ts and the controller screens/home-hero.ts.
 */
import rawConfig from '../../config/game-config.json';
import type { Board } from '../../core/board';
import { chooseBoardMode } from '../board-gpu/switch';

/** The `homeHero` block of game-config.json. */
export interface HeroTuning {
  readonly stepsPerSecond: number;
  readonly spillPerStep: number;
  readonly airRows: number;
  readonly restMs: number;
  readonly fadeMs: number;
  /** Palette indexes, bottom first. */
  readonly middle: readonly number[];
  readonly tops: readonly number[];
  readonly left: readonly number[];
  readonly right: readonly number[];
}

/** The shipped tuning. */
export const heroTuning: HeroTuning = rawConfig.homeHero;

/** The hero's jars hold this many bands, like a standard board jar. */
export const HERO_CAPACITY = 4;

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
 * `'live'` (the Realistic-sand scene) when the board would be Realistic and the context is alive;
 * `'still'` (a matching DOM picture in the Classic jar look) on Classic, without WebGL or with the
 * context lost. Example: `heroMode({ search: '', webgl: true, realistic: true, lost: false }) // 'live'`.
 */
export function heroMode(i: HeroModeInput): 'live' | 'still' {
  const board = chooseBoardMode({ search: i.search, storedFlag: null, dev: false, webgl: i.webgl, realistic: i.realistic });
  return board === 'gpu' && !i.lost ? 'live' : 'still';
}

/** What decides whether the live scene animates. */
export interface HeroRunInput {
  /** Home is open (not hidden behind or replaced by the board). */
  readonly homeShown: boolean;
  /** The Play tab is the one shown. */
  readonly onPlay: boolean;
  /** The browser tab is visible. */
  readonly pageVisible: boolean;
  /** The player asked for reduced motion: the scene is a settled still. */
  readonly reduced: boolean;
}

/** True when the live scene should run its frame loop: only while it can be seen, and never under reduced motion (D169). */
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

/** The funnel: its spout's bottom centre and its cone's size. */
export interface HeroFunnelBox {
  readonly x: number;
  readonly y: number;
  readonly topWidth: number;
  readonly coneHeight: number;
  readonly neckWidth: number;
  readonly neckHeight: number;
}

/** Where everything sits for a stage of `width × height`. */
export interface HeroLayout {
  /** Left, middle, right. */
  readonly jars: readonly [HeroJarBox, HeroJarBox, HeroJarBox];
  readonly funnel: HeroFunnelBox;
}

/** The share of a jar's interior its four bands fill: the side jars nearly full, the middle one to the rim once poured. */
const SIDE_FILL = 0.88;
const MIDDLE_FILL = 0.94;
/** The glass's wall and base inset (board-gpu/geometry.ts `DOM_INSET`). */
const INSET = 5.5;

/**
 * The scene for a stage: a tall middle jar with a smaller one either side standing a little further
 * up the beach, and the funnel above the middle one so that the stream falls `airRows` cells into
 * it. Sizes follow the stage's width and height, whichever is tighter. Example: `heroLayout(412, 300, 10, 72)`.
 */
export function heroLayout(width: number, height: number, airRows: number, rows: number): HeroLayout {
  const base = height - 22;
  // Height budget for the middle jar: the glass (2.05 widths), the drop and the funnel above it.
  const glassW = Math.max(40, Math.min(width * 0.26, (height - 34) / 2.75));
  const glassH = glassW * 2.05;
  const innerH = glassH - INSET;
  const unit = (innerH * MIDDLE_FILL) / HERO_CAPACITY;
  const cellH = (unit * HERO_CAPACITY) / rows;
  const sideW = glassW * 0.76;
  const sideH = sideW * 1.95;
  const sideUnit = ((sideH - INSET) * SIDE_FILL) / HERO_CAPACITY;
  const gap = glassW * 1.12;
  const cx = width / 2;
  const middle: HeroJarBox = { left: cx - glassW / 2, top: base - glassH, width: glassW, height: glassH, unitHeight: unit };
  const side = (x: number): HeroJarBox => ({ left: x - sideW / 2, top: base - 10 - sideH, width: sideW, height: sideH, unitHeight: sideUnit });
  const gridTop = base - INSET - unit * HERO_CAPACITY;
  const topWidth = (glassW - 2 * INSET) * 0.62;
  return {
    jars: [side(cx - gap), middle, side(cx + gap)],
    funnel: { x: cx, y: gridTop - airRows * cellH, topWidth, coneHeight: topWidth * 0.55, neckWidth: Math.max(4, topWidth * 0.1), neckHeight: Math.max(8, topWidth * 0.2) },
  };
}

/**
 * The two-jar board one loop pours: the funnel holding the loop's colour, and an empty jar. The pour
 * is planned into an empty jar so it is always legal (a band never matches the colour under it);
 * the scene then lays the middle jar's own bands (`tuning.middle`) into the target grid before the
 * first step, so the grains pile on them.
 */
export function heroBoard(tuning: HeroTuning, cycle: number): Board {
  const top = tuning.tops[((cycle % tuning.tops.length) + tuning.tops.length) % tuning.tops.length];
  return { capacity: HERO_CAPACITY, jars: [{ units: [top], hidden: 0 }, { units: [], hidden: 0 }] };
}

/** Where the loop is: the funnel pouring, the settled scene resting, or the cross-fade back to the start. */
export interface HeroLoop {
  readonly phase: 'pour' | 'rest' | 'fade';
  /** Time spent in this phase (ms). */
  readonly ms: number;
  /** Loops begun; picks the colour. */
  readonly cycle: number;
}

/** A new loop at its start. */
export const HERO_START: HeroLoop = { phase: 'pour', ms: 0, cycle: 0 };

/**
 * Moves the loop on by `dtMs`. `settled` is the pour having played out. Pour → rest once settled;
 * rest → fade (the next cycle begins) after `restMs`; fade → pour after `fadeMs`.
 */
export function advanceLoop(loop: HeroLoop, dtMs: number, settled: boolean, tuning: HeroTuning): HeroLoop {
  const ms = loop.ms + Math.max(0, dtMs);
  if (loop.phase === 'pour') return settled ? { phase: 'rest', ms: 0, cycle: loop.cycle } : { ...loop, ms };
  if (loop.phase === 'rest') return ms >= tuning.restMs ? { phase: 'fade', ms: 0, cycle: loop.cycle + 1 } : { ...loop, ms };
  return ms >= tuning.fadeMs ? { phase: 'pour', ms: 0, cycle: loop.cycle } : { ...loop, ms };
}
