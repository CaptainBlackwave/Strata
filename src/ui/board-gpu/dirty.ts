/**
 * Which jars need redrawing (sprint 19 S2). A jar is redrawn only when its key changes. Pure.
 */
import type { Jar } from '../../core/board';

/**
 * A jar's drawn state as a string: its units, bottom first, how many are hidden, and its mechanics
 * (narrow, funnel, frozen, lock, sieve, clam; the hourglass count is DOM text). Example: `'0,2,2|1'`
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
