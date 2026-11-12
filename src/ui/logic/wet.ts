/**
 * Wet sand's look (sprint 23 W4, D189; design/gdd/jar-mechanics.md §2.7). Pure and DOM-free, so
 * tests/unit/ui/logic/wet.test.ts checks it in Node. Both boards draw from it: the Classic board's
 * unit spans (src/ui/screens/jars.ts) and the Realistic board's sand texels (src/ui/board-gpu/).
 */
import type { Board, Jar } from '../../core/board';

/** How long the drying shimmer sweeps over a unit that just dried (ms): presentation only. */
export const DRY_MS = 620;

/** The tone damp sand is mixed toward: a deep wet-beach brown. */
const DAMP = { r: 43, g: 30, b: 20 } as const;
/** How far wet sand is mixed toward {@link DAMP} (0 dry, 1 all damp). */
const DAMP_MIX = 0.34;

/** A colour as 0..255 channels. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * Wet sand's colour from its dry colour: darker and a touch richer, still clearly the same hue, so
 * the colour (and its colour-blind pattern) stays readable. Example: `wetRgb({ r: 200, g: 85, b: 61 }) // { r: 147, g: 66, b: 47 }`
 */
export function wetRgb(c: Rgb): Rgb {
  const mix = (v: number, d: number) => Math.round(v + (d - v) * DAMP_MIX);
  return { r: mix(c.r, DAMP.r), g: mix(c.g, DAMP.g), b: mix(c.b, DAMP.b) };
}

/** {@link wetRgb} for `#rrggbb`. Example: `wetHex('#c8553d') // '#93422f'` */
export function wetHex(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const w = wetRgb({ r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 });
  return `#${((1 << 24) | (w.r << 16) | (w.g << 8) | w.b).toString(16).slice(1)}`;
}

/** The pours left until unit `k` of `jar` dries: 0 when it is dry. Example: `wetLeft({ units: [0], hidden: 0, wet: [3] }, 0) // 3` */
export function wetLeft(jar: Jar, k: number): number {
  return jar.wet?.[k] ?? 0;
}

/** How many units of `jar` are wet. Example: `wetCount({ units: [0, 0], hidden: 0, wet: [0, 2] }) // 1` */
export function wetCount(jar: Jar): number {
  return jar.wet ? jar.wet.filter((w) => w > 0).length : 0;
}

/**
 * Marks the sand-grid rows of `jar`'s wet units in `out` (one entry per grid row, top first; 1 wet,
 * 0 dry), for the Realistic board: unit `k` fills rows `rows − (k+1)·band … rows − k·band − 1`, as
 * `gridFromJar` lays it. Fills `out` in place (no allocation; it is redrawn during pours) and
 * returns whether any row is wet. Example: `wetRows({ units: [0, 1], hidden: 0, wet: [0, 2] }, 4, out)` marks rows 4..7 of 12.
 */
export function wetRows(jar: Jar | null, band: number, out: Uint8Array): boolean {
  out.fill(0);
  if (!jar?.wet) return false;
  const rows = out.length;
  let any = false;
  for (let k = 0; k < jar.units.length; k++) {
    if (!(jar.wet[k] > 0)) continue;
    any = true;
    for (let y = Math.max(0, rows - (k + 1) * band); y < rows - k * band; y++) out[y] = 1;
  }
  return any;
}

/** What the pour event says about the pour, for {@link driedUnits}. */
export interface DryPour {
  readonly move: { readonly from: number; readonly to: number };
  readonly moved: number;
  readonly flipped?: readonly number[];
  readonly dried?: readonly number[];
}

/**
 * The units that dried on a pour, per jar (only jars in `e.dried`): their indices in `after`, the
 * board after the pour, so the shimmer plays on them. `before` is the board as shown before the
 * pour. Every unit's count before the pour's drying tick is rebuilt from `before` by the same path
 * as `pour()` (§2.7 rule 4): the source keeps its bottom units, the target gains the moved ones with
 * their counts, and a flipped hourglass turns its counts over; a unit dried if it was wet then and
 * is dry now (the winning pour dries everything, so this covers it too). A board whose jar count
 * changed gives nothing. Example: `driedUnits(before, after, { move: { from: 0, to: 1 }, moved: 1, dried: [1] }) // [{ jar: 1, units: [2] }]`
 */
export function driedUnits(before: Board, after: Board, e: DryPour): { jar: number; units: number[] }[] {
  if (!e.dried?.length || before.jars.length !== after.jars.length) return [];
  const { from, to } = e.move;
  const counts = (j: Jar) => j.units.map((_, k) => wetLeft(j, k));
  const src = counts(before.jars[from]);
  const keep = src.length - e.moved;
  const out: { jar: number; units: number[] }[] = [];
  for (const i of e.dried) {
    const now = after.jars[i];
    if (!now) continue;
    let pre = i === from ? src.slice(0, keep) : i === to ? [...counts(before.jars[to]), ...src.slice(keep)] : counts(before.jars[i]);
    if (e.flipped?.includes(i)) pre = [...pre].reverse();
    const units = now.units.map((_, k) => k).filter((k) => (pre[k] ?? 0) > 0 && wetLeft(now, k) === 0);
    if (units.length) out.push({ jar: i, units });
  }
  return out;
}

/**
 * How long a unit that just dried waits before it shimmers: until the pour's sand has landed, as
 * the clam's opening. Reduced motion: no shimmer at all, so `null`. Example: `dryDelay(false, { flow: 230 }) // 230`
 */
export function dryDelay(reduced: boolean, anim: { readonly flow: number }): number | null {
  return reduced ? null : anim.flow;
}
