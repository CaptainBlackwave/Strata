/**
 * The December look (sprint 31, D241; level-map.md §2.4, scenes.md "Festive in December"). Pure and
 * DOM-free: whether today is in the festive window, the scenes listed first, where the map's string of
 * lights runs between two stones, and which Christmas decorations stand in each scenery band.
 */

/** The `festive` block of game-config.json. */
export interface FestiveConfig {
  readonly festive?: {
    /** First and last day, `MM-DD`, UTC, every year. `to` before `from` runs into the next year. */
    readonly from: string;
    readonly to: string;
    /** Lights along the level map's path while the window runs. */
    readonly mapLights?: boolean;
    /** Small Christmas decorations (a fir tree, a snowman, presents) in the map's scenery while the window runs. */
    readonly mapDecor?: boolean;
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

/** Whether the level map shows its Christmas decorations on `date`: the window runs and `mapDecor` is on. */
export function mapDecorOn(date: string, config: FestiveConfig): boolean {
  return config.festive?.mapDecor === true && festiveActive(date, config);
}

/** The map's Christmas decorations, in the order they take turns band by band. */
export const FESTIVE_DECOR = ['tree', 'snowman', 'presents'] as const;
export type FestiveDecor = (typeof FESTIVE_DECOR)[number];

/**
 * The decoration at spot `slot` (0, 1, …, bottom up) of scenery band `band` (0 = levels 1 to bandSize).
 * They take turns, and each band starts one further on, so neighbouring bands never open alike.
 * Example: `festiveDecorFor(0, 0)` is `'tree'`, `festiveDecorFor(0, 1)` and `festiveDecorFor(1, 0)` are `'snowman'`.
 */
export function festiveDecorFor(band: number, slot: number): FestiveDecor {
  const n = FESTIVE_DECOR.length;
  return FESTIVE_DECOR[(((Math.floor(band) + Math.floor(slot)) % n) + n) % n];
}

/**
 * Where a band's decorations stand, on the land side: each spot is a level `L` in `first + 1 .. last`
 * whose stone and the stone below it (`L - 1`) both sit at `minX` or more of the width (`xOf`, a fraction),
 * so the path swings well away from the land there. A decoration stands between those two stones, so a
 * stone's height or more above the band's name (by its first stone) and inside the band. Example:
 * `decorSpots(1, 20, pathX, 0.65)` with the map's 7-stone wave gives levels 3, 10 and 17.
 */
export function decorSpots(first: number, last: number, xOf: (level: number) => number, minX: number): number[] {
  const out: number[] = [];
  for (let lv = first + 1; lv <= last; lv++) if (xOf(lv - 1) >= minX && xOf(lv) >= minX) out.push(lv);
  return out;
}

/** A point, px. */
export type Pt = readonly [number, number];

/** A box to keep the lights out of, px: `[left, top, right, bottom]` (a stone's tags, lock or Perfect mark). */
export type Box = readonly [number, number, number, number];

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
 * stay clear. `drop` is how far a bulb hangs below the wire: the whole drop keeps the gap, and stays out
 * of every `avoid` box. Example: `lightRun([100, 400], [160, 320], 40, 24, 13)`.
 */
export function lightRun(a: Pt, b: Pt, gap: number, spacing: number, offset: number, drop = 0, avoid: readonly Box[] = []): LightRun {
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
  // The nearest point to `c` on the drop from `p` straight down `drop` px.
  const reach = (p: Pt, c: Pt) => Math.hypot(p[0] - c[0], Math.min(p[1] + drop, Math.max(p[1], c[1])) - c[1]);
  const inBox = (p: Pt, [l, t, r, btm]: Box) => p[0] >= l && p[0] <= r && p[1] <= btm && p[1] + drop >= t;
  const far = (p: Pt) => reach(p, a) >= gap && reach(p, b) >= gap && !avoid.some((box) => inBox(p, box));
  const wire: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y, dx, dy] = at(i / n);
    const len = Math.hypot(dx, dy) || 1;
    // The normal on the path's right-hand side (going up the map), so the string keeps one side.
    const p: Pt = [x - (dy / len) * offset, y + (dx / len) * offset];
    // The ends near the stones drop out; what is left is one stretch in the middle.
    if (far(p)) wire.push(p);
  }
  if (wire.length < 2) return { wire: [], bulbs: [] };
  // Bulbs evenly along the stretch, about `spacing` apart, at least one.
  const acc = [0];
  for (let i = 1; i < wire.length; i++) acc.push(acc[i - 1] + Math.hypot(wire[i][0] - wire[i - 1][0], wire[i][1] - wire[i - 1][1]));
  const total = acc[acc.length - 1];
  const count = Math.max(1, Math.floor(total / spacing));
  const bulbs: Pt[] = [];
  for (let k = 0; k < count; k++) {
    const want = ((k + 0.5) * total) / count;
    let i = 1;
    while (i < acc.length - 1 && acc[i] < want) i++;
    bulbs.push(wire[acc[i] - want < want - acc[i - 1] ? i : i - 1]);
  }
  return { wire, bulbs };
}

/**
 * The SVG path data for a light string through `points` (the wire's ends and its bulbs, in order), drooping
 * `sag` px between each pair like a real string. Steep stretches droop less, as gravity pulls them along
 * themselves. Example: `sagWire([[0, 0], [20, 0]], 3)` is `'M0.0 0.0Q10.0 6.0 20.0 0.0'` (the curve's
 * lowest point is `sag` below the chord).
 */
export function sagWire(points: readonly Pt[], sag: number): string {
  const pts = points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 0.5);
  if (pts.length < 2) return '';
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const flat = Math.abs(x1 - x0) / len; // 1 level, 0 straight up
    d += `Q${f((x0 + x1) / 2)} ${f((y0 + y1) / 2 + 2 * sag * flat)} ${f(x1)} ${f(y1)}`;
  }
  return d;
}
