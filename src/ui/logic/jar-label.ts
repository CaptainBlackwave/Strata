/**
 * The jar name a screen reader hears (UX-board-5; the clam, sprint 13 M3, D96;
 * design/gdd/jar-mechanics.md 2.6). Pure and DOM-free, so tests/unit/ui/clam-ui.test.ts checks it
 * in Node. `updateJar` (src/ui/screens/jars.ts) wraps it in `t.jarLabel`.
 */
import type { Jar } from '../../core/board';
import { t } from '../strings';

/**
 * A jar's contents and states, as in "terracotta, lagoon (sieve, lagoon only)". `colour` names a
 * palette colour. A closed clam's sand is hidden on screen, so it is hidden here too: the name is
 * only its states, "clam, closed, opens in 4 pours", and no colour or burial is listed. An open
 * clam is an ordinary jar and has no state of its own.
 * Example: `jarSummary({ units: [], hidden: 0 }, false, name) // 'empty'`
 */
export function jarSummary(jar: Jar, sealed: boolean, colour: (c: number) => string): string {
  const states = [
    jar.clam !== undefined ? t.jarStates.clam(jar.clam) : '',
    jar.cap !== undefined ? t.jarStates.narrow : '',
    jar.frozen ? t.jarStates.frozen : '',
    jar.lock !== undefined ? t.jarStates.locked(colour(jar.lock)) : '',
    jar.funnel ? t.jarStates.funnel : '',
    jar.hourglass ? t.jarStates.hourglass(jar.hourglass.left) : '',
    jar.sieve !== undefined ? t.jarStates.sieve(colour(jar.sieve)) : '',
    sealed ? t.sealed : '',
  ].filter(Boolean);
  if (jar.clam !== undefined) return states.join(', ');
  const contents = jar.units.length ? jar.units.map((c, k) => (k < jar.hidden ? t.buried : colour(c))).join(', ') : t.jarEmpty;
  return states.length ? `${contents} (${states.join(', ')})` : contents;
}
