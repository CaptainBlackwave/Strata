/**
 * Save data in localStorage: progress, wallet, tutorial flag, settings, profile and stats.
 * Every access is guarded, so a private window or blocked storage just means no save.
 * Implements design/game-brief.md MVP 6 and design/competitive-roadmap.md C2/C5.
 */
import type { DailyShareRecord, StreakState } from '../core/daily';
import type { ThemeState } from '../core/themes';
import { type Profile, STAT_KEYS, type Stats, emptyStats } from '../core/profile';
import { type BoosterId, type EconomyConfig, type Wallet, newWallet } from '../core/economy';

const KEY = 'strata.save.v2';
const LEGACY_PROGRESS = 'strata.progress.v1';
const LEGACY_PREFS = 'strata.prefs.v1';

/** Player-facing toggles. */
export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  patterns: boolean;
}

/** Everything we persist. */
export interface SaveData {
  /** The level the player is on (1-based). */
  level: number;
  /** Fewest pours used to clear each level, keyed by level number. */
  best: Record<string, number>;
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
}

/** Abstracts the storage backend so it can be swapped in tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DEFAULT_SETTINGS: Settings = { sound: true, music: true, haptics: true, patterns: false };
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

function read(store: KeyValueStore | null, key: string): unknown {
  try {
    const raw = store?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const nonNegInt = (v: unknown, fallback: number) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : fallback);

/** A de-duplicated list of the strings in `v`, or [] if it isn't an array. */
const strings = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : []);

/** A brand-new player's save. */
export function freshSave(econ: EconomyConfig): SaveData {
  return { level: 1, best: {}, wallet: newWallet(econ), tutorialDone: false, settings: { ...DEFAULT_SETTINGS }, daily: { ...NO_STREAK }, shells: [], seenMechanics: [], themes: { owned: ['midday'], selected: 'midday', auto: false }, profile: { ...NO_PROFILE }, stats: emptyStats(), dailyShare: null };
}

/**
 * Loads the save, migrating the v1 progress/prefs keys if there is no v2 save yet.
 * Anything missing or invalid falls back to its default, field by field.
 */
export function loadSave(econ: EconomyConfig, store: KeyValueStore | null = defaultStore()): SaveData {
  const base = freshSave(econ);
  const v2 = read(store, KEY);
  if (!isObj(v2)) {
    const v1 = read(store, LEGACY_PROGRESS);
    const prefs = read(store, LEGACY_PREFS);
    if (isObj(v1)) {
      base.level = Number.isInteger(v1.level) && (v1.level as number) >= 1 ? (v1.level as number) : 1;
      if (isObj(v1.best)) base.best = v1.best as Record<string, number>;
      base.tutorialDone = base.level > 1; // returning players skip the tutorial
    }
    if (isObj(prefs) && prefs.patterns === true) base.settings.patterns = true;
    return base;
  }
  const level = Number.isInteger(v2.level) && (v2.level as number) >= 1 ? (v2.level as number) : 1;
  const w = isObj(v2.wallet) ? v2.wallet : {};
  const b = isObj(w.boosters) ? w.boosters : {};
  const s = isObj(v2.settings) ? v2.settings : {};
  const d = isObj(v2.daily) ? v2.daily : {};
  const pr = isObj(v2.profile) ? v2.profile : {};
  const st = isObj(v2.stats) ? v2.stats : {};
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    level,
    best: isObj(v2.best) ? (v2.best as Record<string, number>) : {},
    wallet: {
      coins: nonNegInt(w.coins, base.wallet.coins),
      boosters: Object.fromEntries(BOOSTERS.map((id) => [id, nonNegInt(b[id], base.wallet.boosters[id])])) as Record<BoosterId, number>,
    },
    tutorialDone: v2.tutorialDone === true,
    settings: {
      sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
      music: typeof s.music === 'boolean' ? s.music : DEFAULT_SETTINGS.music,
      haptics: typeof s.haptics === 'boolean' ? s.haptics : DEFAULT_SETTINGS.haptics,
      patterns: typeof s.patterns === 'boolean' ? s.patterns : DEFAULT_SETTINGS.patterns,
    },
    daily: {
      last: typeof d.last === 'string' && DATE_KEY.test(d.last) ? d.last : null,
      streak: nonNegInt(d.streak, 0),
      best: nonNegInt(d.best, 0),
      passes: nonNegInt(d.passes, 0),
    },
    shells: strings(v2.shells),
    seenMechanics: strings(v2.seenMechanics),
    themes: {
      owned: [...new Set(['midday', ...strings(isObj(v2.themes) ? v2.themes.owned : [])])],
      selected: isObj(v2.themes) && typeof v2.themes.selected === 'string' ? v2.themes.selected : 'midday',
      auto: isObj(v2.themes) && v2.themes.auto === true,
    },
    profile: { name: str(pr.name), avatar: str(pr.avatar), frame: str(pr.frame), plate: str(pr.plate) },
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, nonNegInt(st[k], 0)])) as unknown as Stats,
    dailyShare:
      isObj(v2.dailyShare) && typeof v2.dailyShare.date === 'string' && DATE_KEY.test(v2.dailyShare.date) && nonNegInt(v2.dailyShare.pours, -1) >= 0
        ? { date: v2.dailyShare.date, pours: v2.dailyShare.pours as number }
        : null,
  };
}

/** Saves. Failures are ignored. */
export function writeSave(save: SaveData, store: KeyValueStore | null = defaultStore()): void {
  try {
    store?.setItem(KEY, JSON.stringify(save));
  } catch {
    /* storage unavailable: progress simply isn't kept */
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
 * in a pasted code are ignored.
 */
export function importSave(code: string, econ: EconomyConfig): SaveData | null {
  const compact = code.replace(/\s+/g, '');
  if (!compact.startsWith(CODE_PREFIX)) return null;
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
