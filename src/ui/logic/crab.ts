/**
 * The crab's look (sprint 27 K4, D207; design/gdd/jar-mechanics.md §2.9). Pure and DOM-free, so
 * tests/unit/ui/crab-ui.test.ts checks it in Node. The crab is drawn by the DOM on both boards
 * (src/ui/screens/jars.ts): its jar can never be lifted, so it never travels with a pour, and the
 * Realistic board shows it over its canvas like the hourglass's count.
 */
import type { Jar } from '../../core/board';

/** How long the crab's scuttle from jar to jar takes (ms): presentation only. */
export const CRAB_MS = 560;

/**
 * The count on the crab: the pours left until it moves, or nothing when `jar` has no crab.
 * Example: `crabCount({ units: [0], hidden: 0, crab: { every: 3, left: 2 } }) // '2'`
 */
export function crabCount(jar: Jar): string {
  return jar.crab ? String(jar.crab.left) : '';
}

/** A point, in CSS px. */
export interface Offset {
  readonly x: number;
  readonly y: number;
}

/**
 * Where the crab starts its scuttle, relative to its new jar: the old jar's resting box minus the new
 * one's (both without any lift or pour transform). Example: `scuttleFrom({ x: 10, y: 0 }, { x: 90, y: 0 }) // { x: -80, y: 0 }`
 */
export function scuttleFrom(oldJar: Offset, newJar: Offset): Offset {
  return { x: oldJar.x - newJar.x, y: oldJar.y - newJar.y };
}

/**
 * The scuttle's keyframes for a crab drawn on its new jar that starts `from` it: a sideways walk in
 * `steps` little hops (a lift of `bob` px and a rock of the body each step), ending exactly in place.
 * The first frame is the old place, so with `fill: 'backwards'` the crab waits there while the pour
 * finishes. Example: `scuttleFrames({ x: -80, y: 0 })[0].transform // 'translate(-80px, 0px) rotate(0deg)'`
 */
export function scuttleFrames(from: Offset, steps = 4, bob = 3): Keyframe[] {
  const frames: Keyframe[] = [];
  const n = steps * 2;
  for (let k = 0; k <= n; k++) {
    const p = k / n;
    const left = 1 - p;
    // Odd frames are mid-hop: lifted and rocked, alternately left and right.
    const up = k % 2 === 1 ? bob : 0;
    const rock = k % 2 === 1 ? (k % 4 === 1 ? -7 : 7) : 0;
    frames.push({ offset: p, transform: `translate(${round(from.x * left)}px, ${round(from.y * left - up)}px) rotate(${rock}deg)` });
  }
  return frames;
}

function round(v: number): number {
  return Math.round(v * 100) / 100 + 0; // + 0 turns -0 into 0
}
