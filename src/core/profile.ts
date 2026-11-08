/**
 * The player profile: name rules, generated names, the cosmetics catalog and its
 * milestone unlocks, and the lifetime counters. Pure functions only, no DOM.
 * Implements design/gdd/player-profile.md (owner decisions PP-1 to PP-10).
 */
import type { Rng } from './rng';

/** What an unlock is measured against (player-profile.md §3.6). */
export type UnlockKind = 'levels' | 'perfectClears' | 'bestStreak' | 'dailiesSolved' | 'shells' | 'sets';

/** Every unlock kind, in display order. */
export const UNLOCK_KINDS: readonly UnlockKind[] = ['levels', 'perfectClears', 'bestStreak', 'dailiesSolved', 'shells', 'sets'];

/** A milestone: met when `progress[kind] >= count`. */
export interface Unlock {
  readonly kind: UnlockKind;
  readonly count: number;
}

/** Anything the player can pick. `unlock` is null for items open from the start. */
export interface Cosmetic {
  readonly id: string;
  readonly name: string;
  readonly unlock: Unlock | null;
}

/** An avatar: a seaside object drawn on a round tinted background. */
export interface AvatarItem extends Cosmetic {
  readonly bg: string;
}

/** A name plate. `bg2` is a second background colour for stripes or gradients. */
export interface PlateItem extends Cosmetic {
  readonly bg: string;
  readonly bg2?: string;
  readonly edge: string;
  readonly ink: string;
}

/** The profile part of game-config.json. The first item of each list is its default. */
export interface ProfileConfig {
  readonly profile: {
    readonly name: { readonly min: number; readonly max: number };
    readonly avatars: readonly AvatarItem[];
    readonly frames: readonly Cosmetic[];
    readonly plates: readonly PlateItem[];
  };
}

/** The three picker slots. */
export type Slot = 'avatar' | 'frame' | 'plate';

/** Every slot, in display order. */
export const SLOTS: readonly Slot[] = ['avatar', 'frame', 'plate'];

/** What the player has chosen. */
export interface Profile {
  readonly name: string;
  readonly avatar: string;
  readonly frame: string;
  readonly plate: string;
}

/** Lifetime counters that did not exist before the profile (player-profile.md §3.4). */
export interface Stats {
  readonly perfectClears: number;
  readonly dailiesSolved: number;
  readonly pours: number;
  readonly coinsEarned: number;
  readonly boostersUsed: number;
}

/** Every counter key. */
export const STAT_KEYS: readonly (keyof Stats)[] = ['perfectClears', 'dailiesSolved', 'pours', 'coinsEarned', 'boostersUsed'];

/** Progress values the unlocks are measured against. */
export type Progress = Readonly<Record<UnlockKind, number>>;

/** Word lists for generated names (player-facing, so they live in the UI string table). */
export interface NameWords {
  readonly adjectives: readonly string[];
  readonly nouns: readonly string[];
}

/** All counters at zero. */
export function emptyStats(): Stats {
  return { perfectClears: 0, dailiesSolved: 0, pours: 0, coinsEarned: 0, boostersUsed: 0 };
}

/** Adds to counters. Negative or non-integer deltas are ignored: counters only grow. */
export function bumpStats(stats: Stats, delta: Partial<Stats>): Stats {
  const next = { ...stats };
  for (const key of STAT_KEYS) {
    const d = delta[key];
    if (Number.isInteger(d) && (d as number) > 0) next[key] = stats[key] + (d as number);
  }
  return next;
}

/** Inputs for `progressOf`, all already in the save or derivable from it. */
export interface ProgressInput {
  /** The level the player is on (1-based), so levels cleared is `level - 1`. */
  readonly level: number;
  readonly bestStreak: number;
  readonly shellsOwned: number;
  readonly setsCompleted: number;
  readonly stats: Stats;
}

/** The progress values for unlocks. Example: on level 26 → `levels: 25`. */
export function progressOf(p: ProgressInput): Progress {
  return {
    levels: Math.max(0, p.level - 1),
    perfectClears: p.stats.perfectClears,
    bestStreak: p.bestStreak,
    dailiesSolved: p.stats.dailiesSolved,
    shells: p.shellsOwned,
    sets: p.setsCompleted,
  };
}

/** The items of one slot. */
export function catalog(config: ProfileConfig, slot: Slot): readonly Cosmetic[] {
  const p = config.profile;
  return slot === 'avatar' ? p.avatars : slot === 'frame' ? p.frames : p.plates;
}

/** The default item of a slot: the first in its list. */
export function defaultId(config: ProfileConfig, slot: Slot): string {
  return catalog(config, slot)[0].id;
}

/** True if the item is open: a start item, or its milestone is met. */
export function isUnlocked(item: Cosmetic, progress: Progress): boolean {
  return item.unlock === null || (progress[item.unlock.kind] ?? 0) >= item.unlock.count;
}

/** How far along a locked item is: `have` is capped at `need`. Start items are 1/1. */
export function unlockProgress(item: Cosmetic, progress: Progress): { have: number; need: number } {
  if (!item.unlock) return { have: 1, need: 1 };
  return { have: Math.min(progress[item.unlock.kind] ?? 0, item.unlock.count), need: item.unlock.count };
}

/** One unlocked item, tagged with its slot. */
export interface SlotItem {
  readonly slot: Slot;
  readonly item: Cosmetic;
}

/** Every unlocked item, in display order (avatars, frames, plates). */
export function unlockedItems(config: ProfileConfig, progress: Progress): SlotItem[] {
  return SLOTS.flatMap((slot) => catalog(config, slot).filter((item) => isUnlocked(item, progress)).map((item) => ({ slot, item })));
}

/** Items unlocked by going from `before` to `after`, in display order (player-profile.md §3.7). */
export function newlyUnlocked(config: ProfileConfig, before: Progress, after: Progress): SlotItem[] {
  return unlockedItems(config, after).filter(({ item }) => !isUnlocked(item, before));
}

/** Trims, and collapses runs of spaces to one. Example: `"  Sea   Gull "` → `"Sea Gull"`. */
export function normaliseName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Letters (any script, with their combining marks), numbers, single spaces and hyphens. */
const NAME_CHARS = /^[\p{L}\p{M}\p{N}]+(?:[ -][\p{L}\p{M}\p{N}]+)*$/u;

/** True if the name, once normalised, is `min`–`max` characters of allowed text. */
export function isValidName(raw: string, config: ProfileConfig): boolean {
  const name = normaliseName(raw);
  const length = [...name].length;
  const { min, max } = config.profile.name;
  return length >= min && length <= max && NAME_CHARS.test(name);
}

/** A friendly name: `Adjective Noun NN`, with NN in 10–99. Example: "Saffron Gull 42". */
export function generateName(rng: Rng, words: NameWords): string {
  const pick = <T>(list: readonly T[]) => list[Math.floor(rng() * list.length) % list.length];
  return `${pick(words.adjectives)} ${pick(words.nouns)} ${10 + (Math.floor(rng() * 90) % 90)}`;
}

/**
 * A profile that is safe to show. Unknown or locked picks fall back to the slot's default
 * (a save code from another device could name one), and an invalid name is replaced by
 * `newName()`. Example: `repairProfile(save.profile, config, progress, () => generateName(rng, words))`.
 */
export function repairProfile(raw: Partial<Profile> | null | undefined, config: ProfileConfig, progress: Progress, newName: () => string): Profile {
  const pick = (slot: Slot, id: unknown) => {
    const item = catalog(config, slot).find((x) => x.id === id);
    return item && isUnlocked(item, progress) ? item.id : defaultId(config, slot);
  };
  const name = typeof raw?.name === 'string' && isValidName(raw.name, config) ? normaliseName(raw.name) : newName();
  return { name, avatar: pick('avatar', raw?.avatar), frame: pick('frame', raw?.frame), plate: pick('plate', raw?.plate) };
}

/** The profile's pick for a slot. */
export function selected(profile: Profile, slot: Slot): string {
  return slot === 'avatar' ? profile.avatar : slot === 'frame' ? profile.frame : profile.plate;
}

/** A copy of the profile with one slot changed. */
export function withPick(profile: Profile, slot: Slot, id: string): Profile {
  return { ...profile, [slot]: id };
}

/** True if two profiles are the same (used to decide whether closing needs "Discard changes?"). */
export function sameProfile(a: Profile, b: Profile): boolean {
  return normaliseName(a.name) === normaliseName(b.name) && a.avatar === b.avatar && a.frame === b.frame && a.plate === b.plate;
}
