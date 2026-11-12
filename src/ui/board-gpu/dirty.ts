/**
 * Which jars need redrawing (sprint 19 S2). A jar is redrawn only when its key changes. Pure.
 */
import type { Jar } from '../../core/board';

/**
 * A jar's drawn state as a string: its units, bottom first, how many are hidden, and its mechanics
 * (narrow, funnel, frozen, lock, sieve, clam; the hourglass count is DOM text) and which units are
 * wet (D189, §2.7: wet sand is drawn darker; its counts are DOM text). Example: `'0,2,2|1'`
 */
export function jarKey(jar: Jar): string {
  const m = [
    jar.cap !== undefined ? `n${jar.cap}` : '',
    jar.funnel ? 'f' : '',
    jar.frozen ? 'i' : '',
    jar.lock !== undefined ? `l${jar.lock}` : '',
    jar.sieve !== undefined ? `s${jar.sieve}` : '',
    jar.clam !== undefined ? 'c' : '',
    jar.hourglass ? 'h' : '',
    jar.wet ? `w${jar.wet.map((w) => (w > 0 ? 1 : 0)).join('')}` : '',
  ].join('');
  return `${jar.units.join(',')}|${jar.hidden}${m ? `|${m}` : ''}`;
}

/** Remembers the last key drawn per jar and reports which ones changed. */
export class DirtyTracker {
  private keys: string[] = [];

  /**
   * The indices whose key differs from the last call (all of them when the jar count changed),
   * and remembers `next`. Example: `tracker.diff(board.jars.map(jarKey)) // [3]`
   */
  diff(next: readonly string[]): number[] {
    const all = next.length !== this.keys.length;
    const changed: number[] = [];
    for (let i = 0; i < next.length; i++) if (all || next[i] !== this.keys[i]) changed.push(i);
    this.keys = [...next];
    return changed;
  }

  /** Records jar `i` as drawn with `key` without reporting it (a pour already drew it). */
  mark(i: number, key: string): void {
    this.keys[i] = key;
  }

  /** Forgets everything, so the next `diff` reports every jar (a new layout). */
  reset(): void {
    this.keys = [];
  }
}

/** What the Classic (DOM) board draws a jar from, besides the jar itself (sprint 21 P2, strata-8j3). */
export interface DomDrawInput {
  /** The jar is sealed (full of one colour). */
  readonly sealed: boolean;
  /** The colour-blind patterns setting. */
  readonly patterns: boolean;
  /** One unit's height in px (a narrow jar's glass height follows it). */
  readonly unitHeight: number;
}

/** A DOM jar's drawn state in two parts: its sand column, and everything else on the button. */
export interface DomDrawKeys {
  /** The units, bottom first, the hidden count, the patterns setting and the wet counts (drawn on the units). */
  readonly sand: string;
  /** The mechanics with their counts (hourglass, clam), the seal, the patterns setting and the unit height. */
  readonly rest: string;
}

/**
 * The keys the DOM board compares to skip redrawing a jar that did not change (strata-8j3: a pour
 * redrew all 16 jars of a 16-jar board). Unlike `jarKey` it carries the hourglass and clam counts,
 * which the DOM draws as text. Pure.
 * Example: `domDrawKeys({ units: [0, 2], hidden: 0 }, { sealed: false, patterns: false, unitHeight: 30 }).sand // '0,2|0|p0'`
 */
export function domDrawKeys(jar: Jar, d: DomDrawInput): DomDrawKeys {
  const p = d.patterns ? 'p1' : 'p0';
  const counts = `${jar.hourglass ? `h${jar.hourglass.left}/${jar.hourglass.every}` : ''}${jar.clam !== undefined ? `c${jar.clam}` : ''}`;
  return {
    sand: `${jar.units.join(',')}|${jar.hidden}|${p}${jar.wet ? `|w${jar.wet.join('.')}` : ''}`,
    rest: `${jarKey(jar)}|${counts}|${d.sealed ? 's' : ''}|${p}|u${d.unitHeight}`,
  };
}

/** Which parts of a DOM jar to redraw. */
export interface DomRedraw {
  /** Rebuild the sand column (its unit spans). */
  readonly sand: boolean;
  /** Redraw the mechanics, the seal and the label. */
  readonly rest: boolean;
  /** Refresh the selection state (class and `aria-pressed`). */
  readonly selection: boolean;
}

/**
 * What changed since a DOM jar was last drawn. `prev` is `null` for a jar never drawn (a new
 * button): everything is drawn. `grow` (units animating in after a pour) always rebuilds the sand.
 * Pure. Example: `domRedraw(keys, keys, false, true, false) // { sand: false, rest: false, selection: true }`
 */
export function domRedraw(prev: DomDrawKeys | null, next: DomDrawKeys, wasSelected: boolean, selected: boolean, grow: boolean): DomRedraw {
  if (!prev) return { sand: true, rest: true, selection: true };
  return { sand: grow || prev.sand !== next.sand, rest: prev.rest !== next.rest, selection: wasSelected !== selected };
}
