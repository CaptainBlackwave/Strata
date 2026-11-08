/**
 * The shell collection: guaranteed, duplicate-free milestones (every N levels, plus each
 * new daily solve), in catalog order. Completing a set pays a reward. Pure functions only.
 * Implements design/competitive-roadmap.md item C7 (sprint 2 decisions S2-3, S2-4).
 */
import type { BoosterId } from './economy';

/** One collectible shell. `kind` picks its drawing; `colors` are [body, accent]. */
export interface Shell {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly colors: readonly [string, string];
}

/** A themed set of shells. */
export interface ShellSet {
  readonly id: string;
  readonly name: string;
  /** A cabinet effect for the whole set: Night Shore glows, Ancient Cliffs are stone. */
  readonly effect?: ShellEffect;
  readonly shells: readonly Shell[];
}

/** Optional per-set look (shell-collection.md decision SC-6). */
export type ShellEffect = 'glow' | 'stone';

/** The collection part of game-config.json. */
export interface CollectionConfig {
  readonly collection: {
    readonly everyLevels: number;
    readonly coinsWhenComplete: number;
    readonly setReward: { readonly coins: number; readonly boosters: Readonly<Record<BoosterId, number>> };
    readonly sets: readonly ShellSet[];
  };
}

/** Every shell in catalog order, tagged with its set id. */
export function allShells(config: CollectionConfig): (Shell & { readonly setId: string; readonly effect?: ShellEffect })[] {
  return config.collection.sets.flatMap((set) => set.shells.map((s) => ({ ...s, setId: set.id, ...(set.effect ? { effect: set.effect } : {}) })));
}

/** The result of granting a shell. */
export interface GrantResult {
  readonly owned: string[];
  /** The new shell, or null when the collection is already complete. */
  readonly shell: (Shell & { readonly setId: string; readonly effect?: ShellEffect }) | null;
  /** The set this shell completed, if any. */
  readonly completedSet: ShellSet | null;
}

/** Grants the next unowned shell. Example: `grantShell(save.shells, config).shell?.name`. */
export function grantShell(owned: readonly string[], config: CollectionConfig): GrantResult {
  const have = new Set(owned);
  const next = allShells(config).find((s) => !have.has(s.id));
  if (!next) return { owned: owned as string[], shell: null, completedSet: null };
  const updated = [...owned, next.id];
  const set = config.collection.sets.find((x) => x.id === next.setId)!;
  const now = new Set(updated);
  const completedSet = set.shells.every((s) => now.has(s.id)) ? set : null;
  return { owned: updated, shell: next, completedSet };
}

/** Per-set progress for the cabinet screen. */
export function setProgress(owned: readonly string[], config: CollectionConfig) {
  const have = new Set(owned);
  return config.collection.sets.map((set) => {
    const n = set.shells.filter((s) => have.has(s.id)).length;
    return { set, owned: n, total: set.shells.length, complete: n === set.shells.length };
  });
}

/** True when clearing `level` earns a shell. */
export function milestoneDue(level: number, config: CollectionConfig): boolean {
  return level > 0 && level % config.collection.everyLevels === 0;
}
