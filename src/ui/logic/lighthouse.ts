/**
 * The lighthouse jar's look (sprint 27 K4, D208, D209; design/gdd/jar-mechanics.md §2.10). Pure and
 * DOM-free, so tests/unit/ui/lighthouse-ui.test.ts checks it in Node. While the jar is dark both
 * boards draw its sand as dark sand (no colour, no colour-blind pattern); the beam sweep after a
 * sweeping pour is a DOM overlay on both boards (src/ui/screens/jars.ts `beamFx`).
 */
import { type Jar, isLit, isSealed } from '../../core/board';

/** How long the beam takes to cross the jar (ms): presentation only. */
export const BEAM_MS = 600;

/**
 * The count on a lighthouse jar's mark: the pours until the beam next lights it while it still
 * counts, else nothing (a sealed lighthouse jar is lit for good, so it shows the lighthouse alone).
 * Example: `beamCount({ units: [0], hidden: 0, lighthouse: { every: 4, left: 3, lit: false } }, 4) // '3'`
 */
export function beamCount(jar: Jar, capacity: number): string {
  return jar.lighthouse && !isSealed(jar, capacity) ? String(jar.lighthouse.left) : '';
}

/**
 * Whether `jar`'s sand is drawn dark: a lighthouse jar the beam is not lighting, and not sealed
 * (`isLit` in the core). Every other jar is never dark. Example: `isDark(jar, 4) // true while dark`
 */
export function isDark(jar: Jar, capacity: number): boolean {
  return !isLit(jar, capacity);
}

/**
 * Whether the beam lit `jar` this pour in a way that can be seen: it holds sand. An empty lighthouse
 * jar still counts and is listed in `swept`, but there is nothing to light.
 * Example: `sweepsVisibly({ units: [], hidden: 0 }) // false`
 */
export function sweepsVisibly(jar: Jar): boolean {
  return jar.units.length > 0;
}

/**
 * The sweep's two keyframe lists: the dark cover over the sand is wiped away from the left (a
 * `clip-path` inset growing to 100%), in step with a soft light band crossing the glass, so the
 * colours show where the light has passed. Example: `beamFrames().cover[0].clipPath // 'inset(0 0 0 0%)'`
 */
export function beamFrames(): { readonly cover: Keyframe[]; readonly band: Keyframe[] } {
  return {
    cover: [{ clipPath: 'inset(0 0 0 0%)' }, { clipPath: 'inset(0 0 0 100%)' }],
    band: [
      { transform: 'translateX(-110%)', opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { opacity: 1, offset: 0.8 },
      { transform: 'translateX(110%)', opacity: 0 },
    ],
  };
}
