/**
 * What the jar-tap feedback explains (AX-5; sprint 13 M2, D96; design/gdd/jar-mechanics.md 2.5).
 * Pure and DOM-free, so tests/unit/ui/logic/refusal.test.ts checks it in Node. The board turns the
 * answer into a toast with the strings in src/ui/strings.ts.
 */
import type { Jar, PourRefusal } from '../../core/board';
import type { MechanicId } from '../../core/levels';

/**
 * The note for a refused pour into a jar: `'mechanic'` (frozen or locked: the jar's own tap text),
 * `'sieve'` (a wrong colour into a sieve: "Only <colour> sand …"), `'sealed'`, `'full'` or `'colour'`.
 */
export type RefusalNote = 'mechanic' | 'sieve' | 'sealed' | 'full' | 'colour';

/**
 * The note for a pour refused with `reason` into a jar that is (`targetSealed`) or is not sealed.
 * A sealed target always says it is sealed, a sealed sieve included. Source-side reasons (a funnel,
 * an empty or sealed source) cannot follow a lift, so they get no note; nor does a legal pour.
 * Example: `refusalNote('sieve', false) // 'sieve'`
 */
export function refusalNote(reason: PourRefusal | null, targetSealed: boolean): RefusalNote | null {
  if (reason === 'closed') return 'mechanic';
  if (reason === 'sieve' || reason === 'full' || reason === 'colour') return targetSealed ? 'sealed' : reason;
  return null;
}

/**
 * The mechanic whose tap text explains a tap on `jar` that could not lift it, or `null`.
 * An empty sieve explains its band; a sealed sieve is just sealed.
 * Example: `tapMechanic({ units: [], hidden: 0, sieve: 2 }, false) // 'sieve'`
 */
export function tapMechanic(jar: Jar, sealed: boolean): MechanicId | null {
  if (jar.frozen) return 'frozen';
  if (jar.lock !== undefined) return 'locked';
  if (jar.funnel) return 'funnel';
  if (jar.cap !== undefined) return 'narrow';
  if (jar.sieve !== undefined && !sealed) return 'sieve';
  return null;
}
