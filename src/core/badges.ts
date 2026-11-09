/**
 * The badge shelf's rules: the catalogue's rule shapes, the progress each badge reads, earning,
 * back-fill and save repair. Pure functions only, no DOM. Badges are recognition only: nothing
 * here touches the wallet or any reward (decision D76).
 * Implements design/gdd/badges.md (sprint 11 A1, A2).
 */
import { type CollectionConfig, setProgress } from './collection';
import { type GameConfig, isClassicMechanic, levelSpec } from './levels';
import type { Stats } from './profile';
import { type ThemeConfig, isOwned } from './themes';

/** The shelf's families (badges.md §3.1). `weekly` is reserved for the weekly set (§3.9). */
export type BadgeFamily = 'play' | 'mastery' | 'collection' | 'exploration' | 'daily' | 'weekly';

/** Every family, in shelf order. */
export const BADGE_FAMILIES: readonly BadgeFamily[] = ['play', 'mastery', 'collection', 'exploration', 'daily', 'weekly'];

/** A progress value a count rule can read (badges.md §3.2). */
export type BadgeStat = 'levels' | 'jarsSealed' | 'pours' | 'perfectClears' | 'tallPerfect' | 'shells' | 'sets' | 'scenesOwned' | 'scenesPlayed' | 'mechanicsSeen' | 'dailiesSolved' | 'bestStreak';

/** A badge's rule: a count of one stat, or "won in every scene you own" (badges.md §3.1). */
export type BadgeRule = { readonly kind: 'count'; readonly of: BadgeStat; readonly count: number } | { readonly kind: 'everyOwnedScene'; readonly min: number };

/** One catalogue entry. `name` is a key into `t.badges` in the UI string table. */
export interface Badge {
  readonly id: string;
  readonly family: BadgeFamily;
  readonly name: string;
  readonly rule: BadgeRule;
}

/** The badges part of game-config.json. */
export interface BadgeConfig {
  readonly badges: { readonly list: readonly Badge[] };
}

/** Everything `badgeProgressOf` reads from the config. */
export type BadgeSourceConfig = BadgeConfig & CollectionConfig & ThemeConfig & GameConfig;

/** The values the rules are measured against. `ownedScenesPlayed` serves every-shore. */
export type BadgeProgress = Readonly<Record<BadgeStat | 'ownedScenesPlayed', number>>;

/** The slice of the save the progress is derived from. `SaveData` satisfies it structurally. */
export interface BadgeInput {
  readonly level: number;
  readonly perfect: readonly number[];
  readonly shells: readonly string[];
  readonly stats: Stats;
  readonly daily: { readonly best: number };
  readonly themes: { readonly owned: readonly string[] };
  readonly scenesPlayed: readonly string[];
  readonly seenMechanics: readonly string[];
}

/**
 * The progress values from a save-like input (badges.md §3.2). Example: on level 26 → `levels: 25`;
 * `perfect: [10, 13, 20]` → `tallPerfect: 2`.
 */
export function badgeProgressOf(s: BadgeInput, config: BadgeSourceConfig): BadgeProgress {
  const scenes = config.themes.list;
  const owned = scenes.filter((x) => isOwned(x, s.themes.owned)).map((x) => x.id);
  const played = new Set(s.scenesPlayed.filter((id) => scenes.some((x) => x.id === id)));
  const shellIds = new Set(config.collection.sets.flatMap((set) => set.shells.map((x) => x.id)));
  return {
    levels: Math.max(0, s.level - 1),
    jarsSealed: s.stats.jarsSealed,
    pours: s.stats.pours,
    perfectClears: s.stats.perfectClears,
    tallPerfect: s.perfect.filter((n) => Number.isInteger(n) && n >= 1 && levelSpec(n, config).challenge).length,
    shells: s.shells.filter((id) => shellIds.has(id)).length,
    sets: setProgress(s.shells, config).filter((p) => p.complete).length,
    scenesOwned: owned.length,
    scenesPlayed: played.size,
    ownedScenesPlayed: owned.filter((id) => played.has(id)).length,
    // The Jar guide's "known" rule: its intro card was shown, or its debut level is behind the player.
    // The four classic mechanics only: "Odd Jars Out" says "Meet all four special jars", so the
    // hourglass (D96, level 101) is not counted and the stat's need stays 4 (sprint 13 M1).
    mechanicsSeen: config.mechanics.list.filter((m) => isClassicMechanic(m.id) && (s.seenMechanics.includes(m.id) || s.level > m.unlockAt)).length,
    dailiesSolved: s.stats.dailiesSolved,
    bestStreak: s.daily.best,
  };
}

/** True if the badge's rule is met by `progress` (badges.md §4). */
export function isEarned(badge: Badge, progress: BadgeProgress): boolean {
  const r = badge.rule;
  if (r.kind === 'count') return (progress[r.of] ?? 0) >= r.count;
  return progress.scenesOwned >= r.min && progress.ownedScenesPlayed >= progress.scenesOwned;
}

/** How far along a badge is, `have` capped at `need`. Example: 34 jars of 100 → `{ have: 34, need: 100 }`. */
export function badgeProgress(badge: Badge, progress: BadgeProgress): { have: number; need: number } {
  const r = badge.rule;
  const need = r.kind === 'count' ? r.count : Math.max(r.min, progress.scenesOwned);
  const have = r.kind === 'count' ? progress[r.of] ?? 0 : progress.ownedScenesPlayed;
  return { have: Math.min(have, need), need };
}

/** The ids whose rules `progress` meets, in catalogue order. */
export function earnedBadges(progress: BadgeProgress, config: BadgeConfig): string[] {
  return config.badges.list.filter((b) => isEarned(b, progress)).map((b) => b.id);
}

/** Ids met in `after` that are not in `before` (the saved list), in catalogue order (badges.md §3.3). */
export function newlyEarned(before: readonly string[], after: BadgeProgress, config: BadgeConfig): string[] {
  return earnedBadges(after, config).filter((id) => !before.includes(id));
}

/** The saved list with the newly earned ids appended (`badges`), and those ids alone (`fresh`). */
export function awardBadges(saved: readonly string[], progress: BadgeProgress, config: BadgeConfig): { badges: string[]; fresh: string[] } {
  const fresh = newlyEarned(saved, progress, config);
  return { badges: [...saved, ...fresh], fresh };
}

/** The badge list after a load's quiet back-fill (badges.md §3.5): every badge already met, added once. */
export function backfillBadges(save: BadgeInput & { readonly badges: readonly string[] }, config: BadgeSourceConfig): string[] {
  return awardBadges(save.badges, badgeProgressOf(save, config), config).badges;
}

const WEEKLY_ID = /^weekly-(\d{4})-W(\d{2})$/;

/** True for a well-formed weekly-set badge id, `weekly-YYYY-Www` with a week of 01 to 53 (badges.md §3.9). */
export function isWeeklyBadgeId(id: string): boolean {
  const m = WEEKLY_ID.exec(id);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 53;
}

/** The weekly-set badge id of an ISO week. Example: `weeklyBadgeId(2026, 46)` → `"weekly-2026-W46"`. */
export function weeklyBadgeId(isoYear: number, week: number): string {
  return `weekly-${isoYear}-W${String(week).padStart(2, '0')}`;
}

/**
 * A saved badge list made safe (badges.md §3.10): catalogue ids and well-formed weekly ids, each
 * once, in their saved order. Anything else is dropped. Example: `repairBadges(['a', 'first-seal'])` → `['first-seal']`.
 */
export function repairBadges(raw: unknown, config: BadgeConfig): string[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(config.badges.list.map((b) => b.id));
  const ids = raw.filter((x): x is string => typeof x === 'string' && (known.has(x) || isWeeklyBadgeId(x)));
  return [...new Set(ids)];
}
