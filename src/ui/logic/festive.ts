/**
 * The December look (sprint 31, D241; level-map.md §2.4, scenes.md "Festive in December"). Pure and
 * DOM-free: whether today is in the festive window, the scenes listed first, and where the map's
 * string of lights runs between two stones.
 */

/** The `festive` block of game-config.json. */
export interface FestiveConfig {
  readonly festive?: {
    /** First and last day, `MM-DD`, UTC, every year. `to` before `from` runs into the next year. */
    readonly from: string;
    readonly to: string;
    /** Lights along the level map's path while the window runs. */
    readonly mapLights?: boolean;
    /** Scene ids listed first (with a Festive tag) in the scene picker while the window runs. */
    readonly scenesFirst?: readonly string[];
  };
}

/**
 * True when `date` (`YYYY-MM-DD`, UTC, as the events use) falls in the festive window, ends included.
 * Example: `festiveActive('2026-12-01', config)` is true; `festiveActive('2027-01-01', config)` is false.
 */
export function festiveActive(date: string, config: FestiveConfig): boolean {
  const f = config.festive;
  if (!f || !/^\d{4}-\d{2}-\d{2}/.test(date)) return false;
  const md = date.slice(5, 10);
  return f.from <= f.to ? md >= f.from && md <= f.to : md >= f.from || md <= f.to;
}

/** The scene ids the picker lists first in the festive window (config order), or none. */
export function festiveScenesFirst(config: FestiveConfig): readonly string[] {
  return config.festive?.scenesFirst ?? [];
}

/** Whether the level map shows its lights on `date`: the window runs and `mapLights` is on. */
export function mapLightsOn(date: string, config: FestiveConfig): boolean {
  return config.festive?.mapLights === true && festiveActive(date, config);
}

/** A point, px. */
export type Pt = readonly [number, number];

/** One stretch of the map's light string between two stones: its wire and its bulbs. */
export interface LightRun {
  /** The wire's points, in order (empty when the stones are too close for any light). */
  readonly wire: readonly Pt[];
  /** The bulbs' centres, along the wire. */
  readonly bulbs: readonly Pt[];
}

/**
 * The lights between stones `a` and `b` on the map path (map.ts draws the path from `a` to `b` as the
 * cubic `a, (a.x, mid), (b.x, mid), b`). The string runs `offset` px beside the path, with a bulb every
 * `spacing` px, and never comes within `gap` px of either stone's centre, so stones and their numbers
 * stay clear. Example: `lightRun([100, 400], [160, 320], 40, 24, 13)`.
 */
export function lightRun(a: Pt, b: Pt, gap: number, spacing: number, offset: number): LightRun {
  const my = (a[1] + b[1]) / 2;
  const n = 64;
  const at = (t: number): [number, number, number, number] => {
    const u = 1 - t;
    const x = u * u * u * a[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * b[0];
    const y = u * u * u * a[1] + 3 * u * u * t * my + 3 * u * t * t * my + t * t * t * b[1];
    const dx = 3 * u * u * 0 + 6 * u * t * (b[0] - a[0]) + 3 * t * t * 0;
    const dy = 3 * u * u * (my - a[1]) + 3 * t * t * (b[1] - my);
    return [x, y, dx, dy];
  };
  const far = (p: Pt) => Math.hypot(p[0] - a[0], p[1] - a[1]) >= gap && Math.hypot(p[0] - b[0], p[1] - b[1]) >= gap;
  const wire: Pt[] = [];
  const bulbs: Pt[] = [];
  let run = spacing / 2;
  let prev: Pt | null = null;
  for (let i = 0; i <= n; i++) {
    const [x, y, dx, dy] = at(i / n);
    const len = Math.hypot(dx, dy) || 1;
    // The normal on the path's right-hand side (going up the map), so the string keeps one side.
    const p: Pt = [x - (dy / len) * offset, y + (dx / len) * offset];
    if (!far(p)) {
      prev = null;
      continue;
    }
    if (prev) run += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    wire.push(p);
    if (run >= spacing) {
      bulbs.push(p);
      run = 0;
    }
    prev = p;
  }
  return { wire, bulbs };
}
