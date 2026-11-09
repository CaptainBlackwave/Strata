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
} as const;

/** Particle counts per effect. */
export const FX_COUNT = {
  /** The splash where a pour lands (pour.ts). */
  pourSplash: 10,
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
 * The most particles alive at once: the last pour of a level splashes, seals and wins, and
 * those effects overlap. Every one of them must fit {@link FX_BUDGET} together.
 */
export function worstCaseParticles(): number {
  return FX_COUNT.pourSplash + FX_COUNT.sealMotes + FX_COUNT.celebrate + FX_COUNT.winMotes;
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
