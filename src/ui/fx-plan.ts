/**
 * The pure plan behind the celebration and transition effects (sprint 10 F5, decision D68:
 * calm, a little richer; nothing loud or long; reduced motion respected). Timings, particle
 * counts, the reduced-motion switch and the map path geometry live here, DOM-free, so they
 * are unit-tested (tests/unit/ui/fx-plan.test.ts). The DOM side is fx.ts.
 * Presentation only, so these stay in src/ui as named constants (D31).
 */

/** Live particles allowed at once across these effects: the same cap as scene-fx (MAX_PARTICLES). */
export const FX_BUDGET = 60;

/** Effect timings in milliseconds. */
export const FX_MS = {
  /** The shimmer sweeping up a sealed jar, and its motes. */
  seal: 600,
  /** The bloom behind the win card: glow up and motes drifting, then still. */
  winBloom: 1000,
  /** The whole coin flight from the reward pill to the coin counter, all coins included. */
  coinFlight: 500,
  /** Gap between one coin and the next. */
  coinStagger: 40,
  /** A screen cross-fade (Home, map, board). */
  transition: 200,
  /** How far the map rises as it fades in, in px (a slide, transform only). */
  mapRise: 10,
  /** A map touch waits for the map's own fade-in. */
  mapDelay: 160,
  /** The Perfect mark's pop on its stone. */
  mapPop: 360,
  /** Dots and the solid path fading in along the newly unlocked stretch. */
  pathReveal: 700,
  /** Sprint 18 F1: one grain's fall from the jar's mouth to the sand, at most. */
  grainFall: 260,
  /** Sprint 18 F1: the soft pile on the target settling flat. */
  pileSettle: 360,
  /** Sprint 18 F3: the whole glow run before the win card, chord included: at most this. */
  winGlowMax: 1200,
  /** Sprint 18 F3: one jar's glow (up and back down a little). */
  winGlowEach: 320,
  /** Sprint 18 F3: the longest gap between one jar's glow and the next. */
  winGlowGap: 90,
  /** Sprint 18 F3: the chord's ring before the card opens. */
  winChordLead: 220,
  /** Sprint 18 F4: a sheet or card closing (the fade and slide out). */
  layerOut: 160,
} as const;

/** Particle counts per effect. */
export const FX_COUNT = {
  /** The splash where a pour lands (pour.ts). */
  pourSplash: 10,
  /** Sprint 18 F1: the most grains in one pour's stream (see {@link pourGrainCount}). */
  pourGrains: 14,
  /** Sprint 18 F2: the sparkle where the cork lands. */
  corkSparkle: 5,
  /** Sand motes rising off a sealed jar. */
  sealMotes: 6,
  /** The level-clear grains thrown from the board (two bursts of 12). */
  celebrate: 24,
  /** Motes drifting around the win card. */
  winMotes: 18,
  /** Dots per stone-to-stone gap of a newly unlocked stretch, and the most in one stretch. */
  pathDotsPerGap: 6,
  pathDotsMax: 24,
} as const;

/**
 * The most particles alive at once. The last pour of a level streams, splashes and seals; the
 * grains and splash are gone before the win starts (it waits for the jar to fly home, longer than
 * either lives), while the seal's motes and sparkle overlap the win's. Sprint 18: two phases.
 */
export function worstCaseParticles(): number {
  const pour = FX_COUNT.pourGrains + FX_COUNT.pourSplash + FX_COUNT.sealMotes + FX_COUNT.corkSparkle;
  const win = FX_COUNT.sealMotes + FX_COUNT.corkSparkle + FX_COUNT.celebrate + FX_COUNT.winMotes;
  return Math.max(pour, win);
}

/** Sprint 18 F1: grains in one pour's stream, more for more sand: 6 plus 2 a unit, at most {@link FX_COUNT.pourGrains}. */
export function pourGrainCount(units: number): number {
  return Math.min(FX_COUNT.pourGrains, 6 + 2 * Math.max(1, Math.floor(units)));
}

/** One jar's place in the glow run: its index on the board and when its glow starts (ms after the run starts). */
export interface GlowStep {
  readonly jar: number;
  readonly at: number;
}

/** The glow run before the win card (sprint 18 F3). */
export interface WinGlowPlan {
  readonly steps: readonly GlowStep[];
  /** When the final chord plays, ms after the run starts. */
  readonly chordAt: number;
  /** When the card opens, ms after the run starts (never over {@link FX_MS.winGlowMax}). */
  readonly total: number;
}

/**
 * The sealed jars glow one by one, left to right, then the chord, then the card (F3). The gap
 * shrinks for many jars so the run fits {@link FX_MS.winGlowMax}. Reduced motion (or a hidden
 * tab) skips the run: no steps, the chord at once and the card at once.
 * Example: `winGlowPlan([0, 2, 3], false)` glows jars 0, 2 and 3, 90 ms apart.
 */
export function winGlowPlan(sealed: readonly number[], reduced: boolean): WinGlowPlan {
  if (reduced || sealed.length === 0) return { steps: [], chordAt: 0, total: 0 };
  const room = FX_MS.winGlowMax - FX_MS.winGlowEach - FX_MS.winChordLead;
  const gap = sealed.length > 1 ? Math.min(FX_MS.winGlowGap, Math.floor(room / (sealed.length - 1))) : 0;
  const steps = sealed.map((jar, i) => ({ jar, at: i * gap }));
  const chordAt = steps[steps.length - 1].at + Math.round(FX_MS.winGlowEach / 2);
  return { steps, chordAt, total: Math.min(FX_MS.winGlowMax, chordAt + FX_MS.winChordLead) };
}

/** What an effect needs to know about the page before it starts. */
export interface FxEnv {
  /** `prefers-reduced-motion: reduce` is set. */
  readonly reduced: boolean;
  /** The tab is hidden (`document.hidden`). */
  readonly hidden: boolean;
}

/**
 * The reduced-motion switch: an effect runs only with motion allowed and the page visible.
 * Under reduced motion nothing moves at all (a static highlight in CSS may stay).
 */
export function effectAllowed(env: FxEnv): boolean {
  return !env.reduced && !env.hidden;
}

/** One coin flight: how many coins, how long each flies (ms) and the gap between them (ms). */
export interface CoinFlight {
  readonly count: number;
  readonly each: number;
  readonly stagger: number;
}

/** 3 to 5 coins (one per 10 coins earned, at least 3), all landing within {@link FX_MS.coinFlight}. */
export function coinFlightPlan(reward: number): CoinFlight {
  const count = reward > 0 ? Math.min(5, Math.max(3, Math.ceil(reward / 10))) : 0;
  const stagger = FX_MS.coinStagger;
  return { count, each: FX_MS.coinFlight - stagger * Math.max(0, count - 1), stagger };
}

/**
 * The win bloom. When the scene's own win display draws by the card (New Year, Meteor
 * shower, Aurora night; D40), the bloom stays out of its way, so the two never stack.
 */
export function winBloomPlan(sceneWinDisplay: boolean): { glow: boolean; motes: number } {
  return sceneWinDisplay ? { glow: false, motes: 0 } : { glow: true, motes: FX_COUNT.winMotes };
}

/** Folds a first clear into the pending reveal: the lowest level cleared since the map was last seen. */
export function noteFirstClear(pending: number | null, level: number): number {
  return pending === null ? level : Math.min(pending, level);
}

/** The newly unlocked stretch, from the first level cleared since the last map visit to the next stone. */
export function revealStretch(pending: number | null, next: number): { from: number; to: number } | null {
  return pending !== null && pending < next ? { from: pending, to: next } : null;
}

type Pt = readonly [number, number];

/**
 * A point on the map path between two stones, at `t` in 0..1. The map draws each gap as a
 * cubic curve with both control points at the gap's middle height (map.ts `drawPath`).
 */
export function pathPoint(a: Pt, b: Pt, t: number): [number, number] {
  const my = (a[1] + b[1]) / 2;
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return [w0 * a[0] + w1 * a[0] + w2 * b[0] + w3 * b[0], w0 * a[1] + (w1 + w2) * my + w3 * b[1]];
}

/**
 * Dots along the path from stone `from` to stone `to`, in path order, none on a stone.
 * A long stretch keeps the gaps nearest the next stone and thins them to {@link FX_COUNT.pathDotsMax}.
 */
export function stretchDots(from: number, to: number, pt: (level: number) => Pt): [number, number][] {
  const gaps = to - from;
  if (gaps <= 0) return [];
  const max = FX_COUNT.pathDotsMax;
  const perGap = Math.max(1, Math.min(FX_COUNT.pathDotsPerGap, Math.floor(max / gaps)));
  const first = Math.max(from, to - Math.floor(max / perGap));
  const out: [number, number][] = [];
  for (let lv = first + 1; lv <= to; lv++) {
    for (let k = 0; k < perGap; k++) out.push(pathPoint(pt(lv - 1), pt(lv), (k + 0.5) / perGap));
  }
  return out;
}

/** Sprint 18 W1 (D151): the winter snowfall layer during Winter Tide. */
export const SNOW = {
  /** Flakes on screen at once (well under {@link FX_BUDGET}; the layer draws on its own canvas). */
  flakes: 40,
  /** Frames a second, at most. */
  fps: 30,
  /** Fall speed range, px a second, and flake radius range, px. */
  speed: [12, 30] as const,
  radius: [1.2, 3] as const,
} as const;

/**
 * Whether the winter snowfall shows (W1): only while Winter Tide runs (`eventId`), on Home or an
 * event board, with motion allowed and the tab visible, and not when the scene already snows
 * (Winter snow's own layer), so flakes never double up. Example: `snowShows(env, 'wintertide', 'home', false)`.
 */
export function snowShows(env: FxEnv, eventId: string | null, where: 'home' | 'event' | 'off', sceneSnows: boolean): boolean {
  return effectAllowed(env) && eventId === 'wintertide' && where !== 'off' && !sceneSnows;
}
