/**
 * Save data in localStorage: progress, wallet, tutorial flag and settings.
 * Every access is guarded, so a private window or blocked storage just means no save.
 * Implements design/game-brief.md MVP 6 and design/competitive-roadmap.md C2/C5.
 */
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
}

/** Abstracts the storage backend so it can be swapped in tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DEFAULT_SETTINGS: Settings = { sound: true, music: true, haptics: true, patterns: false };
const BOOSTERS: BoosterId[] = ['undo', 'shuffle', 'extraJar', 'hint'];

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

/** A brand-new player's save. */
export function freshSave(econ: EconomyConfig): SaveData {
  return { level: 1, best: {}, wallet: newWallet(econ), tutorialDone: false, settings: { ...DEFAULT_SETTINGS } };
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
