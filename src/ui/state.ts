/**
 * Shared UI state (sprint 9 M2, TD-1). One mutable object instead of module-level `let`s spread
 * across screens: every screen reads and writes `state.x`. The rules stay in `src/core`.
 */
import rawConfig from '../config/game-config.json';
import type { BadgeConfig } from '../core/badges';
import type { CollectionConfig } from '../core/collection';
import type { DailyConfig } from '../core/daily';
import type { BoosterId, EconomyConfig } from '../core/economy';
import type { GameConfig } from '../core/levels';
import type { MapConfig } from '../core/map';
import type { ProfileConfig } from '../core/profile';
import type { GameSession } from '../core/session';
import type { ThemeConfig } from '../core/themes';
import type { WeeklyConfig } from '../core/weekly';
import { GameAudio } from './audio';
import { type Clock, type Random, systemClock } from './clock';
import { type SaveData, loadSave } from './storage';
import { t } from './strings';

/** The whole tuning file, typed. */
export const config = rawConfig as unknown as GameConfig & EconomyConfig & DailyConfig & CollectionConfig & ThemeConfig & ProfileConfig & MapConfig & BadgeConfig & WeeklyConfig;
/** Presentation-only timings (ms) and tilt angle: animation feel, not gameplay. */
export const ANIM = { lift: 210, streamIn: 90, flow: 230, streamOut: 90, back: 220, tilt: 100, winDelay: 650 } as const;
/** The booster names shown on the tools and in their labels. */
export const BOOSTER_NAMES: Record<BoosterId, string> = { undo: t.undo, shuffle: t.shuffle, extraJar: t.jar, hint: t.hint };

/** What is being played: a numbered level, today's daily puzzle, a weekly-set board, or the tutorial. */
export type Mode = 'level' | 'daily' | 'weekly' | 'tutorial';

/** Everything more than one screen reads or writes. Screen-private values stay private to their module. */
export interface UiState {
  save: SaveData;
  level: number;
  mode: Mode;
  dailyDate: string;
  dailyName: string;
  /** The weekly board being played (weekly mode): its week key, fixed at the start (weekly-set.md §3.6), and 0-based index. */
  weeklyWeek: string;
  weeklyIndex: number;
  session: GameSession;
  challenge: boolean;
  /** The level was started as a replay from the map (D50): Continue goes back to the map. */
  replay: boolean;
  selected: number | null;
  busy: boolean;
  pendingWin: boolean;
  jarEls: HTMLButtonElement[];
  unitHeight: number;
  returning: Set<number>;
  /** A coin purchase waiting for its second tap (UX-board-7). */
  armedBooster: BoosterId | null;
  /** The clock every UI date read goes through (TD-16); the real one by default. Animation timing is exempt. */
  clock: Clock;
  /** Randomness for UI choices such as a re-rolled name (TD-16); `Math.random` by default. */
  rng: Random;
  /** Hint or Shuffle waiting for the worker (TD-13): its button is disabled and `aria-busy`. */
  thinking: 'hint' | 'shuffle' | null;
  /** The thinking cue is visible (after a short delay, so a fast answer doesn't flicker). */
  thinkingShown: boolean;
}

const initialSave = loadSave(config);
/** The one shared state object. `session` is assigned by the board before any code reads it. */
export const state: UiState = {
  save: initialSave,
  level: initialSave.level,
  mode: 'level',
  dailyDate: '',
  dailyName: '',
  weeklyWeek: '',
  weeklyIndex: 0,
  session: undefined as unknown as GameSession,
  challenge: false,
  replay: false,
  selected: null,
  busy: false,
  pendingWin: false,
  jarEls: [],
  unitHeight: 0,
  returning: new Set<number>(),
  armedBooster: null,
  clock: systemClock,
  rng: Math.random,
  thinking: null,
  thinkingShown: false,
};
export const audio = new GameAudio(initialSave.settings);
/**
 * The seed for one Shuffle, read from the app clock (TD-16) so `src/core` never reads it.
 * The seed travels with the job, so the worker and the main thread deal the same (TD-13).
 */
export const shuffleSeed = (): number => state.clock().getTime() >>> 0;
