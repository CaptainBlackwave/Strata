/**
 * Progress save in localStorage (design/game-brief.md MVP 6).
 * Every access is guarded, so a private window or blocked storage just means no save.
 */

const KEY = 'strata.progress.v1';

/** What we persist. */
export interface Progress {
  /** The level the player is on (1-based). */
  level: number;
  /** Fewest pours used to clear each level, keyed by level number. */
  best: Record<string, number>;
}

/** Abstracts the storage backend so it can be swapped in tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Loads progress, falling back to level 1 on any problem. */
export function loadProgress(store: KeyValueStore | null = defaultStore()): Progress {
  const fallback: Progress = { level: 1, best: {} };
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    const level = Number.isInteger(parsed.level) && (parsed.level as number) >= 1 ? (parsed.level as number) : 1;
    const best = parsed.best && typeof parsed.best === 'object' ? parsed.best : {};
    return { level, best };
  } catch {
    return fallback;
  }
}

/** Saves progress. Failures are ignored. */
export function saveProgress(progress: Progress, store: KeyValueStore | null = defaultStore()): void {
  try {
    store?.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable: progress simply isn't kept */
  }
}
