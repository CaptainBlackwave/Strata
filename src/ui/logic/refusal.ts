/**
 * What the jar-tap feedback explains (AX-5; sprint 13 M2, D96; design/gdd/jar-mechanics.md 2.5).
 * Pure and DOM-free, so tests/unit/ui/logic/refusal.test.ts checks it in Node. The board turns the
 * answer into a toast with the strings in src/ui/strings.ts.
 */
import type { Jar, PourRefusal } from '../../core/board';
import type { MechanicId } from '../../core/levels';

/**
 * The note for a refused pour into a jar: `'mechanic'` (frozen or locked: the jar's own tap text),
 * `'clam'` (a closed clam: "This clam opens in N pours.", D96 §2.6), `'sieve'` (a wrong colour
 * into a sieve: "Only <colour> sand …"), `'wet'` (wet sand towards an empty jar: "Wet sand only goes
 * onto its own colour.", D189 §2.7), `'sealed'`, `'full'` or `'colour'`.
 */
export type RefusalNote = 'mechanic' | 'clam' | 'sieve' | 'wet' | 'sealed' | 'full' | 'colour';

/**
 * The note for a pour refused with `reason` into a jar that is (`targetSealed`) or is not sealed.
 * A sealed target always says it is sealed, a sealed sieve included. Source-side reasons (a funnel,
 * an empty or sealed source) cannot follow a lift, so they get no note; nor does a legal pour.
 * Example: `refusalNote('sieve', false) // 'sieve'`
 */
export function refusalNote(reason: PourRefusal | null, targetSealed: boolean): RefusalNote | null {
  if (reason === 'closed') return 'mechanic';
  // A closed clam is never sealed (it is dealt unsealed and nothing pours in while it is shut).
  if (reason === 'clam') return 'clam';
  // Only an empty target refuses wet sand, and an empty jar is never sealed.
  if (reason === 'wet') return 'wet';
  if (reason === 'sieve' || reason === 'full' || reason === 'colour') return targetSealed ? 'sealed' : reason;
  return null;
}

/**
 * The mechanic whose tap text explains a tap on `jar` that could not lift it, or `null`.
 * An empty sieve explains its band; a sealed sieve is just sealed. A closed clam explains its
 * count first, whatever else it is (D96, §2.6); an open clam is an ordinary jar. A jar with the crab
 * on it says so ("The crab is on that jar.", §2.9) unless it is shut by its own mechanic first.
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
  return null;
}
