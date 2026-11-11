/**
 * Save data in localStorage: progress, wallet, tutorial flag, settings, profile and stats.
 * Every access is guarded, so a private window or blocked storage just means no save.
 * Implements design/game-brief.md MVP 6 and design/competitive-roadmap.md C2/C5.
 */
import gameConfig from '../config/game-config.json';
import { type BadgeConfig, repairBadges } from '../core/badges';
import type { DailyShareRecord, StreakState } from '../core/daily';
import { type StyleState, type StylesConfig, defaultStyles, stylesOf } from '../core/styles';
import type { ThemeState } from '../core/themes';
import { type WeeklyConfig, type WeeklyState, emptyWeekly, repairWeekly } from '../core/weekly';
import { type GoalsState, emptyGoals, repairGoals } from '../core/goals';
import { type Profile, STAT_KEYS, type Stats, emptyStats } from '../core/profile';
import { type BoosterId, type EconomyConfig, type Wallet, newWallet } from '../core/economy';
import { WHATS_NEW_VERSION } from './strings';
import { type Onboarding, freshOnboarding, onboardingOf } from './logic/onboarding';

/** The scene every save owns and falls back to: `themes.default` in the config (TD-3). */
const DEFAULT_THEME: string = (gameConfig as unknown as { themes: { default: string } }).themes.default;
/** Every scene id, for repairing `scenesPlayed`. */
const SCENE_IDS: ReadonlySet<string> = new Set((gameConfig as unknown as { themes: { list: { id: string }[] } }).themes.list.map((x) => x.id));

/** The localStorage key of the save. Other tabs' writes to it arrive as `storage` events (D57). */
export const SAVE_KEY = 'strata.save.v2';
const KEY = SAVE_KEY;
const LEGACY_PROGRESS = 'strata.progress.v1';
const LEGACY_PREFS = 'strata.prefs.v1';

/** Player-facing toggles. */
export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  patterns: boolean;
  /** Season scenes use southern-hemisphere windows, six months on (D42, sprint 8 P2). Off by default. */
  southern: boolean;
  /** Sound effects volume, 0..1 (D66, sprint 10 F3). The `sound` switch still mutes. */
  soundVolume: number;
  /** Music volume, 0..1 (D66, sprint 10 F3). The `music` switch still mutes. */
  musicVolume: number;
}

/** Everything we persist. */
export interface SaveData {
  /** The level the player is on (1-based). */
  level: number;
  /** Fewest pours used to clear each level, keyed by level number. */
  best: Record<string, number>;
  /**
   * Levels cleared Perfect (no hint, shuffle or extra jar), sorted, each once (level-map.md D50, D52).
   * Counted from the M3 update on: an older save loads it as `[]` and keeps its Perfect stat.
   */
  perfect: number[];
  /**
   * The newest `boardChanges` version this save has been through (D110). A save on an older one
   * loses its best pours for the changed levels on load, once. An older save loads as 1.
   */
  boards: number;
  wallet: Wallet;
  tutorialDone: boolean;
  settings: Settings;
  /** Daily puzzle streak. */
  daily: StreakState;
  /** Owned shell ids, in the order they were earned. */
  shells: string[];
  /** Jar mechanics whose intro card has been shown. */
  seenMechanics: string[];
  /** Owned and selected time-of-day scenes. */
  themes: ThemeState;
  /**
   * Name, avatar, frame and name plate (design/gdd/player-profile.md). Stored as read:
   * main.ts runs `repairProfile` after every load, which needs the catalog and progress.
   */
  profile: Profile;
  /** Lifetime counters that start at 0 from the profile update (player-profile.md §3.4). */
  stats: Stats;
  /** Pours of the latest date's first counted daily solve, for Share (GA-DP-6). */
  dailyShare: DailyShareRecord | null;
  /**
   * The "What's new" version this player has seen (D46, D52). A fresh save stores the
   * current version, so a first install never sees the card; an older save has none
   * (`''`), so the card shows once.
   */
  seenWhatsNew: string;
  /**
   * How many of `shells` the player has seen in the cabinet; later ones show "New" there
   * (UX-cab-4). An older save without it counts every owned shell as seen.
   */
  seenShells: number;
  /**
   * Earned badge ids, in the order earned (design/gdd/badges.md §3.3, D76). Repaired on load:
   * unknown ids and duplicates are dropped. An older save loads `[]`, and boot back-fills it quietly.
   */
  badges: string[];
  /** Scenes the player has won a level, daily or weekly board in, each once (badges.md §3.2). */
  scenesPlayed: string[];
  /** One-time install and onboarding notices and the visit count (sprint 11 O1, O2, O4; D78). */
  onboarding: Onboarding;
  /**
   * The weekly set's progress (design/gdd/weekly-set.md §3.10, D77): its week, the boards cleared and
   * their best pours. Repaired field by field on load; an older save loads an empty set.
   */
  weekly: WeeklyState;
  /**
   * Jar styles (design/gdd/jar-styles.md §3.5, sprint 12 S2): bought pieces as `slot:id` (defaults never
   * stored) and the piece worn in each slot. Repaired field by field on load; an older save gets defaults.
   */
  styles: StyleState;
  /**
   * Streak track days already claimed (sprint 16, D136, D140; daily-puzzle.md §2.4), ascending, each once.
   * A claimed day never pays again. An older save loads none.
   */
  track: number[];
  /** Today's daily goals progress (sprint 16, D137; daily-goals.md). Repaired field by field. */
  goals: GoalsState;
}

/** Abstracts the storage backend so it can be swapped in tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The volume a new player, or a save without a valid value, starts with (D66). */
export const DEFAULT_VOLUME = 0.8;
const DEFAULT_SETTINGS: Settings = { sound: true, music: true, haptics: true, patterns: false, southern: false, soundVolume: DEFAULT_VOLUME, musicVolume: DEFAULT_VOLUME };
const BOOSTERS: BoosterId[] = ['undo', 'shuffle', 'extraJar', 'hint'];
const NO_STREAK: StreakState = { last: null, streak: 0, best: 0, passes: 0 };
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
/** An empty profile: repairProfile fills in a generated name and the default picks. */
const NO_PROFILE: Profile = { name: '', avatar: '', frame: '', plate: '' };

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Whether `key` holds anything at all, readable or not. */
function hasKey(store: KeyValueStore | null, key: string): boolean {
  try {
    return (store?.getItem(key) ?? null) !== null;
  } catch {
    return false;
  }
}

function read(store: KeyValueStore | null, key: string): unknown {
  try {
    const raw = store?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** A plain object: not null and not a list (a list is never a valid save or save section, strata-9hb). */
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const nonNegInt = (v: unknown, fallback: number) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : fallback);

/**
 * A saved volume: a finite number clamped to 0..1, else {@link DEFAULT_VOLUME} (D66).
 * Example: `volumeOf(1.4)` is 1, `volumeOf('0.5')` is 0.8.
 */
export function volumeOf(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;
}

/** Highest level number a save may hold. Above it the value is treated as corrupt or edited (TD-6). */
const MAX_LEVEL = 1_000_000;
/** Longest save code `importSave` reads, in characters (256 KB). A real save is a few KB. */
const MAX_CODE_LENGTH = 256 * 1024;

/** Most coins a save may hold; more is clamped, so an edited save never shows "1e+300" (strata-6og). */
const MAX_COINS = 999_999_999;

/**
 * The level to resume when a save's `level` is unusable (strata-6og): one past the furthest
 * level in `best` or `perfect`, else 1. Example: best for 1-44 gives 45.
 */
function inferredLevel(best: Record<string, number>, perfect: readonly number[]): number {
  const furthest = Math.max(0, ...Object.keys(best).map(Number), ...perfect);
  return Math.min(MAX_LEVEL, furthest + 1);
}

/** A level number: an integer from 1 to {@link MAX_LEVEL}, else 1. */
const levelOf = (v: unknown): number => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_LEVEL ? (v as number) : 1);

/** The usable part of a `best` map: keys that are positive level numbers, values non-negative integers. */
function bestOf(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const [k, n] of Object.entries(v)) {
    if (/^[1-9]\d*$/.test(k) && Number.isInteger(n) && (n as number) >= 0) out[k] = n as number;
  }
  return out;
}

/** The usable part of a `perfect` list: level numbers (1 to {@link MAX_LEVEL}), each once, ascending. */
function perfectOf(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const levels = v.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= MAX_LEVEL);
  return [...new Set(levels)].sort((a, b) => a - b);
}

/** A de-duplicated list of the strings in `v`, or [] if it isn't an array. */
const strings = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : []);

/** One release that changed the boards behind level numbers (D110): every level from `fromLevel` on. */
interface BoardChange {
  readonly version: number;
  readonly fromLevel: number;
}

/** Releases that changed the boards behind level numbers: `boardChanges` in the config (D110). */
const BOARD_CHANGES: readonly BoardChange[] = (gameConfig as unknown as { boardChanges?: BoardChange[] }).boardChanges ?? [];
/** The boards version a save has before any change. */
const FIRST_BOARDS = 1;
/** The newest boards version; a save written today carries it. */
const LATEST_BOARDS = Math.max(FIRST_BOARDS, ...BOARD_CHANGES.map((c) => c.version));

/**
 * `best` without the levels whose boards changed after boards version `seen` (D110): the best
 * pours of a board that no longer exists are dropped; nothing else in the save is touched.
 * Example: a save on version 1 with the version-2 change from level 12 keeps `best` for 1-11.
 */
function bestOnCurrentBoards(best: Record<string, number>, seen: number): Record<string, number> {
  const from = Math.min(...BOARD_CHANGES.filter((c) => c.version > seen).map((c) => c.fromLevel));
  return Object.fromEntries(Object.entries(best).filter(([level]) => Number(level) < from));
}

/** A brand-new player's save. */
export function freshSave(econ: EconomyConfig): SaveData {
  return { level: 1, best: {}, perfect: [], boards: LATEST_BOARDS, wallet: newWallet(econ), tutorialDone: false, settings: { ...DEFAULT_SETTINGS }, daily: { ...NO_STREAK }, shells: [], seenMechanics: [], themes: { owned: [DEFAULT_THEME], selected: DEFAULT_THEME, auto: false }, profile: { ...NO_PROFILE }, stats: emptyStats(), dailyShare: null, seenWhatsNew: WHATS_NEW_VERSION, seenShells: 0, badges: [], scenesPlayed: [], onboarding: freshOnboarding(), weekly: emptyWeekly(), styles: defaultStyles(gameConfig as unknown as StylesConfig), track: [], goals: emptyGoals() };
}

/**
 * Loads the save, migrating the v1 progress/prefs keys if there is no v2 save yet.
 * Anything missing or invalid falls back to its default, field by field.
 */
export function loadSave(econ: EconomyConfig, store: KeyValueStore | null = defaultStore()): SaveData {
  const base = freshSave(econ);
  const v2 = read(store, KEY);
  if (!isObj(v2)) {
    // A v2 save that exists but is unreadable gives a fresh save (save-data.md): never fall back to
    // the v1 keys, which a phone may still hold from before the v2 format (strata-wry).
    if (hasKey(store, KEY)) return base;
    const v1 = read(store, LEGACY_PROGRESS);
    const prefs = read(store, LEGACY_PREFS);
    if (isObj(v1)) {
      base.level = levelOf(v1.level);
      base.best = bestOnCurrentBoards(bestOf(v1.best), FIRST_BOARDS);
      base.tutorialDone = base.level > 1; // returning players skip the tutorial
      base.seenWhatsNew = ''; // a returning player is updating, so the card shows once
    }
    if (isObj(prefs) && prefs.patterns === true) base.settings.patterns = true;
    return base;
  }
  const rawBest = bestOf(v2.best);
  const perfect = perfectOf(v2.perfect);
  const level = levelOf(v2.level) === v2.level ? (v2.level as number) : inferredLevel(rawBest, perfect);
  const w = isObj(v2.wallet) ? v2.wallet : {};
  const b = isObj(w.boosters) ? w.boosters : {};
  const s = isObj(v2.settings) ? v2.settings : {};
  const d = isObj(v2.daily) ? v2.daily : {};
  const pr = isObj(v2.profile) ? v2.profile : {};
  const st = isObj(v2.stats) ? v2.stats : {};
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const shells = strings(v2.shells);
  return {
    level,
    best: bestOnCurrentBoards(rawBest, Math.max(FIRST_BOARDS, nonNegInt(v2.boards, FIRST_BOARDS))),
    perfect,
    boards: LATEST_BOARDS,
    wallet: {
      coins: Math.min(MAX_COINS, nonNegInt(w.coins, base.wallet.coins)),
      boosters: Object.fromEntries(BOOSTERS.map((id) => [id, nonNegInt(b[id], base.wallet.boosters[id])])) as Record<BoosterId, number>,
    },
    // A save without the flag (edited or damaged) skips the tutorial past level 1, as v1 does (strata-6og).
    tutorialDone: typeof v2.tutorialDone === 'boolean' ? v2.tutorialDone : level > 1,
    settings: {
      sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
      music: typeof s.music === 'boolean' ? s.music : DEFAULT_SETTINGS.music,
      haptics: typeof s.haptics === 'boolean' ? s.haptics : DEFAULT_SETTINGS.haptics,
      patterns: typeof s.patterns === 'boolean' ? s.patterns : DEFAULT_SETTINGS.patterns,
      southern: typeof s.southern === 'boolean' ? s.southern : DEFAULT_SETTINGS.southern,
      soundVolume: volumeOf(s.soundVolume),
      musicVolume: volumeOf(s.musicVolume),
    },
    daily: {
      last: typeof d.last === 'string' && DATE_KEY.test(d.last) ? d.last : null,
      streak: nonNegInt(d.streak, 0),
      best: nonNegInt(d.best, 0),
      passes: nonNegInt(d.passes, 0),
    },
    shells,
    seenMechanics: strings(v2.seenMechanics),
    themes: {
      owned: [...new Set([DEFAULT_THEME, ...strings(isObj(v2.themes) ? v2.themes.owned : [])])],
      selected: isObj(v2.themes) && typeof v2.themes.selected === 'string' ? v2.themes.selected : DEFAULT_THEME,
      auto: isObj(v2.themes) && v2.themes.auto === true,
    },
    profile: { name: str(pr.name), avatar: str(pr.avatar), frame: str(pr.frame), plate: str(pr.plate) },
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, nonNegInt(st[k], 0)])) as unknown as Stats,
    dailyShare:
      isObj(v2.dailyShare) && typeof v2.dailyShare.date === 'string' && DATE_KEY.test(v2.dailyShare.date) && nonNegInt(v2.dailyShare.pours, -1) >= 0
        ? { date: v2.dailyShare.date, pours: v2.dailyShare.pours as number }
        : null,
    seenWhatsNew: typeof v2.seenWhatsNew === 'string' ? v2.seenWhatsNew : '',
    seenShells: Math.min(nonNegInt(v2.seenShells, shells.length), shells.length),
    badges: repairBadges(v2.badges, gameConfig as unknown as BadgeConfig),
    scenesPlayed: strings(v2.scenesPlayed).filter((id) => SCENE_IDS.has(id)),
    onboarding: onboardingOf(v2.onboarding, true), // any v2 save is from an earlier visit (D78)
    weekly: repairWeekly(v2.weekly, gameConfig as unknown as WeeklyConfig),
    styles: stylesOf(v2.styles, gameConfig as unknown as StylesConfig),
    track: Array.isArray(v2.track) ? [...new Set(v2.track.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 100_000))].sort((a, b) => a - b) : [],
    goals: repairGoals(v2.goals),
  };
}

/**
 * Whether the save is really kept on this device: it reads back after boot's write. False when
 * storage is blocked or throws (O4). Example: `saveStored()`.
 */
export function saveStored(store: KeyValueStore | null = defaultStore()): boolean {
  try {
    return !!store && store.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

/** Whether the "What's new" card is due: the save has not seen `version` yet. */
export function whatsNewDue(save: Pick<SaveData, 'seenWhatsNew'>, version: string = WHATS_NEW_VERSION): boolean {
  return save.seenWhatsNew !== version;
}

let savesPaused = false;
let saveError: (() => void) | null = null;

/**
 * Stops (`true`) or resumes every {@link writeSave}. Paused while another tab owns the save,
 * so this older tab can't overwrite newer progress (D57, TD-14, src/ui/tab-lock.ts).
 */
export function pauseSaves(paused: boolean): void {
  savesPaused = paused;
}

/** Sets what runs when a write fails (full or blocked storage), or `null` for nothing (TD-14). */
export function onSaveError(fn: (() => void) | null): void {
  saveError = fn;
}

/**
 * Saves, unless saves are paused. A failure calls the {@link onSaveError} handler and is otherwise
 * ignored. No store at all (reading `localStorage` threw: blocked site data) is a failure too, so
 * the player is told progress isn't kept (strata-gtl).
 */
export function writeSave(save: SaveData, store: KeyValueStore | null = defaultStore()): void {
  if (savesPaused) return;
  try {
    if (!store) throw new Error('storage unavailable');
    store.setItem(KEY, JSON.stringify(save));
  } catch {
    saveError?.(); // storage full or blocked: progress isn't kept, and the player is told once
  }
}

const CODE_PREFIX = 'STRATA1:';

/**
 * A save as a text code the player can copy to another device (decision D16):
 * `STRATA1:` followed by base64 of the save's JSON. Example: `exportSave(save)`.
 */
export function exportSave(save: SaveData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(save));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return CODE_PREFIX + btoa(bin);
}

/**
 * Reads a save code. Returns null if it isn't a Strata save code; otherwise every
 * field is checked and repaired exactly like a normal load. Spaces and line breaks
 * in a pasted code are ignored. A code over 256 KB is refused (TD-6).
 */
export function importSave(code: string, econ: EconomyConfig): SaveData | null {
  const compact = code.replace(/\s+/g, '');
  if (!compact.startsWith(CODE_PREFIX) || compact.length > MAX_CODE_LENGTH) return null;
  let json: string;
  try {
    const bin = atob(compact.slice(CODE_PREFIX.length));
    json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const parsed: unknown = JSON.parse(json);
    if (!isObj(parsed)) return null;
  } catch {
    return null;
  }
  const memory: KeyValueStore = { getItem: (k) => (k === KEY ? json : null), setItem: () => undefined };
  return loadSave(econ, memory);
}
