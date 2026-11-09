/**
 * Shared UI state (sprint 9 M2, TD-1). One mutable object instead of module-level `let`s spread
 * across screens: every screen reads and writes `state.x`. The rules stay in `src/core`.
 */
import rawConfig from '../config/game-config.json';
import type { CollectionConfig } from '../core/collection';
import type { DailyConfig } from '../core/daily';
import type { BoosterId, EconomyConfig } from '../core/economy';
import type { GameConfig } from '../core/levels';
import type { MapConfig } from '../core/map';
import type { ProfileConfig } from '../core/profile';
import { createRng } from '../core/rng';
import type { GameSession } from '../core/session';
import type { ThemeConfig } from '../core/themes';
import { GameAudio } from './audio';
import { type Clock, type Random, systemClock } from './clock';
import { type SaveData, loadSave } from './storage';
import { t } from './strings';

/** The whole tuning file, typed. */
export const config = rawConfig as unknown as GameConfig & EconomyConfig & DailyConfig & CollectionConfig & ThemeConfig & ProfileConfig & MapConfig;
/** Presentation-only timings (ms) and tilt angle: animation feel, not gameplay. */
export const ANIM = { lift: 210, streamIn: 90, flow: 230, streamOut: 90, back: 220, tilt: 100, winDelay: 650 } as const;
/** The booster names shown on the tools and in their labels. */
export const BOOSTER_NAMES: Record<BoosterId, string> = { undo: t.undo, shuffle: t.shuffle, extraJar: t.jar, hint: t.hint };

/** What is being played: a numbered level, today's daily puzzle, or the tutorial. */
export type Mode = 'level' | 'daily' | 'tutorial';

/** Everything more than one screen reads or writes. Screen-private values stay private to their module. */
export interface UiState {
  save: SaveData;
  level: number;
  mode: Mode;
  dailyDate: string;
  dailyName: string;
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
}

const initialSave = loadSave(config);
/** The one shared state object. `session` is assigned by the board before any code reads it. */
export const state: UiState = {
  save: initialSave,
  level: initialSave.level,
  mode: 'level',
  dailyDate: '',
  dailyName: '',
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
};
export const audio = new GameAudio(initialSave.settings);
/** The Shuffle booster's RNG, seeded once from the app clock at load (TD-16). */
export const shuffleRng = createRng(state.clock().getTime() >>> 0);
