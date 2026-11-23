/**
 * What the jar-tap feedback explains (AX-5; sprint 13 M2, D96; design/gdd/jar-mechanics.md 2.5), and
 * the dead-end banner's words (D21, D215, D221). Pure and DOM-free, so tests/unit/ui/logic/refusal.test.ts
 * and tests/unit/ui/sun-words.test.ts check it in Node. The board turns the answer into a toast with
 * the strings in src/ui/strings.ts.
 */
import type { Color, Jar, LostReason, PourRefusal } from '../../core/board';
import type { MechanicId } from '../../core/levels';
import { t } from '../strings';

/**
 * The note for a refused pour into a jar: `'mechanic'` (frozen or locked: the jar's own tap text),
 * `'clam'` (a closed clam: "This clam opens in N pours.", D96 §2.6), `'sieve'` (a wrong colour
 * into a sieve: "Only <colour> sand …"), `'wet'` (wet sand towards an empty jar: "Wet sand only goes
 * onto its own colour.", D189 §2.7), `'sun'` (a wrong colour into a sunrise or sunset jar: "Only
 * <colour> greets the sunrise." / "… waits for sunset.", D223 §2.11), `'sunrise'` (the pour would
 * fill a jar before the sunrise jar: "The sun hasn't risen yet …"), `'sunset'` (the pour would fill
 * the sunset jar without winning: "Sunset comes last …"), `'sealed'`, `'full'` or `'colour'`.
 */
export type RefusalNote = 'mechanic' | 'clam' | 'sieve' | 'wet' | 'sun' | 'sunrise' | 'sunset' | 'sealed' | 'full' | 'colour';

/**
 * The note for a pour refused with `reason` into a jar that is (`targetSealed`) or is not sealed.
 * A sealed target always says it is sealed, a sealed sieve or sunrise/sunset jar included. Source-side
 * reasons (a funnel, an empty or sealed source) cannot follow a lift, so they get no note; nor does a
 * legal pour. `'sunrise'` and `'sunset'` (D219) judge the board the pour would leave, not the target
 * alone, but they are only ever given to an otherwise legal pour, so the target has room and is not
 * sealed; they still yield to a sealed target, so a sealed jar never reads as anything else.
 * Example: `refusalNote('sieve', false) // 'sieve'`, `refusalNote('sunrise', false) // 'sunrise'`
 */
export function refusalNote(reason: PourRefusal | null, targetSealed: boolean): RefusalNote | null {
  if (reason === 'closed') return 'mechanic';
  // A closed clam is never sealed (it is dealt unsealed and nothing pours in while it is shut).
  if (reason === 'clam') return 'clam';
  // Only an empty target refuses wet sand, and an empty jar is never sealed.
  if (reason === 'wet') return 'wet';
  if (reason === 'sieve' || reason === 'sun' || reason === 'full' || reason === 'colour' || reason === 'sunrise' || reason === 'sunset') return targetSealed ? 'sealed' : reason;
  return null;
}

/**
 * The mechanic whose tap text explains a tap on `jar` that could not lift it, or `null`.
 * An empty sieve explains its band; a sealed sieve is just sealed. An empty sunrise or sunset jar
 * explains the pair ("Sunrise first, sunset last …", D223 §2.11) and a filled one is just sealed, as
 * for the sieve. A closed clam explains its count first, whatever else it is (D96, §2.6); an open
 * clam is an ordinary jar. A jar with the crab on it says so ("The crab is on that jar.", §2.9) unless
 * it is shut by its own mechanic first; the crab may sit on a sunrise or sunset jar (D222).
 * Example: `tapMechanic({ units: [], hidden: 0, sieve: 2 }, false) // 'sieve'`
 */
export function tapMechanic(jar: Jar, sealed: boolean): MechanicId | null {
  if (jar.clam !== undefined) return 'clam';
  if (jar.frozen) return 'frozen';
  if (jar.lock !== undefined) return 'locked';
  if (jar.funnel) return 'funnel';
  // The crab (D207, §2.9) blocks lifting its jar: a source-side refusal, so `refusalNote` never sees it.
  if (jar.crab) return 'crab';
  if (jar.cap !== undefined) return 'narrow';
  if (jar.sieve !== undefined && !sealed) return 'sieve';
  if (jar.sun !== undefined && !sealed) return 'sun';
  return null;
}

/**
 * The dead-end banner's words for a board lost for `reason` (D21): the sieve (D215) and the sunrise
 * and sunset jars (D221, §2.11) name the colour that can no longer finish, the rest say the board
 * can't be won. `bandOf` gives that colour for a named reason, as `sieveLostColor`,
 * `sunriseLostColor` and `sunsetLostColor` (src/core/board.ts) do, or `null` when it can't name one,
 * which falls back to the plain message. `colour` names a palette colour.
 * Example: `lostMessage('sunrise', () => 1, (c) => palette[c].id) // 'Lagoon can no longer reach the sunrise jar: Undo or Restart.'`
 */
export function lostMessage(reason: LostReason | null, bandOf: (reason: 'sieve' | 'sunrise' | 'sunset') => Color | null, colour: (c: Color) => string): string {
  if (reason !== 'sieve' && reason !== 'sunrise' && reason !== 'sunset') return t.cantWin;
  const band = bandOf(reason);
  if (band === null) return t.cantWin;
  const name = colour(band);
  return reason === 'sieve' ? t.sieveLost(name) : reason === 'sunrise' ? t.sunriseLost(name) : t.sunsetLost(name);
}
