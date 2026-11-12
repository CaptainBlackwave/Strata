/**
 * The jar name a screen reader hears (UX-board-5; the clam, sprint 13 M3, D96;
 * design/gdd/jar-mechanics.md 2.6). Pure and DOM-free, so tests/unit/ui/clam-ui.test.ts checks it
 * in Node. `updateJar` (src/ui/screens/jars.ts) wraps it in `t.jarLabel`.
 */
import { type Jar, isComplete } from '../../core/board';
import { t } from '../strings';

/**
 * A jar's contents and states, as in "terracotta, lagoon (sieve, lagoon only)". `colour` names a
 * palette colour. A closed clam's sand is hidden on screen, so it is hidden here too: the name is
 * only its states, "clam, closed, opens in 4 pours", and no colour or burial is listed. An open
 * clam is an ordinary jar and has no state of its own. A wet unit (D189, §2.7) names its pours
 * left, "wet lagoon, dries in 3 pours", and the units are then listed with semicolons so its own
 * comma reads as part of it; a full jar of one colour still wet says "full, seals when dry".
 * `capacity` is the board's (a complete jar is full at it). Example: `jarSummary({ units: [], hidden: 0 }, false, name) // 'empty'`
 */
export function jarSummary(jar: Jar, sealed: boolean, colour: (c: number) => string, capacity = Infinity): string {
  const states = [
    jar.clam !== undefined ? t.jarStates.clam(jar.clam) : '',
    jar.cap !== undefined ? t.jarStates.narrow : '',
    jar.frozen ? t.jarStates.frozen : '',
    jar.lock !== undefined ? t.jarStates.locked(colour(jar.lock)) : '',
    jar.funnel ? t.jarStates.funnel : '',
    jar.hourglass ? t.jarStates.hourglass(jar.hourglass.left) : '',
    jar.sieve !== undefined ? t.jarStates.sieve(colour(jar.sieve)) : '',
    !sealed && jar.wet && isComplete(jar, capacity) ? t.jarStates.wet : '',
    sealed ? t.sealed : '',
  ].filter(Boolean);
  if (jar.clam !== undefined) return states.join(', ');
  const wet = jar.wet?.some((w) => w > 0) ?? false;
  const name = (c: number, k: number) => (k < jar.hidden ? t.buried : (jar.wet?.[k] ?? 0) > 0 ? t.wetUnit(colour(c), jar.wet![k]) : colour(c));
  const contents = jar.units.length ? jar.units.map(name).join(wet ? '; ' : ', ') : t.jarEmpty;
  return states.length ? `${contents} (${states.join(', ')})` : contents;
}
