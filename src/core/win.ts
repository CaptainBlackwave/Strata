/**
 * What a win changes in the save and what the win card says (TD-2, sprint-8 P6).
 * Pure and DOM-free: `src/ui/main.ts` applies the returned state and renders the card.
 * Rules: design/gdd/economy.md (M1 first clear only), daily-challenge GDD (D10, GA-DP-6),
 * collection GDD (shell milestones), player-profile.md (stats, D25).
 */
import { type CollectionConfig, type Shell, type ShellSet, grantShell, milestoneDue, setProgress } from './collection';
import { type DailyConfig, type DailyShareRecord, type StreakState, recordDailySolve } from './daily';
import { type EconomyConfig, type Wallet, addBoosters, addCoins, clearReward } from './economy';
import { type ProfileConfig, type Progress, type SlotItem, type Stats, bumpStats, newlyUnlocked, progressOf } from './profile';

/** The slice of the save a win reads and writes. `SaveData` satisfies it structurally. */
export interface WinState {
  readonly level: number;
  readonly best: Readonly<Record<string, number>>;
  readonly wallet: Wallet;
  readonly tutorialDone: boolean;
  readonly daily: StreakState;
  readonly shells: readonly string[];
  readonly stats: Stats;
  readonly dailyShare: DailyShareRecord | null;
}

/** The config a win needs. */
export type WinConfig = EconomyConfig & DailyConfig & CollectionConfig & ProfileConfig;

export type WinMode = 'tutorial' | 'daily' | 'level';

/** The finished session and where it was played. */
export interface WinResult {
  readonly mode: WinMode;
  /** The level played (level mode). */
  readonly level: number;
  readonly challenge: boolean;
  /** The daily's date key (daily mode). */
  readonly dailyDate: string;
  readonly moves: number;
  /** Boosters that count against Perfect; free Undo is not one. */
  readonly assists: number;
}

/** The shell row of the win card. */
export type ShellAward =
  | { readonly kind: 'shell'; readonly shell: Shell; readonly completedSet: ShellSet | null; readonly setCoins: number }
  | { readonly kind: 'complete'; readonly coins: number };

/** The note line under the win card's text. `none` shows nothing. */
export type WinNote = 'none' | 'replay' | 'perfect' | 'outOfOrder' | 'dailyReplay' | 'usedPass' | 'earnedPass';

/** What the win card should say. */
export interface WinCard {
  readonly mode: WinMode;
  readonly perfect: boolean;
  /** True when the reward row shows and counts up (level first clear, daily counted). */
  readonly rewardShown: boolean;
  /** Coins for the clear or solve itself (0 on a replay). */
  readonly reward: number;
  /** The previous best pours for this level before this win, if any. */
  readonly prevBest: number | undefined;
  readonly moves: number;
  /** The daily streak after this solve. */
  readonly streak: number;
  readonly note: WinNote;
  readonly shell: ShellAward | null;
  readonly unlocks: SlotItem[];
}

/** The new state and the card. */
export interface WinOutcome {
  readonly state: WinState;
  readonly card: WinCard;
}

function progressOfState(s: WinState, config: WinConfig): Progress {
  return progressOf({
    level: s.level,
    bestStreak: s.daily.best,
    shellsOwned: s.shells.length,
    setsCompleted: setProgress(s.shells, config).filter((p) => p.complete).length,
    stats: s.stats,
  });
}

/** Credits coins earned by play and counts them for the "Coins earned" stat. */
function earn(s: WinState, coins: number): WinState {
  return { ...s, wallet: addCoins(s.wallet, coins), stats: bumpStats(s.stats, { coinsEarned: coins }) };
}

/** Grants the next shell, or the completion bonus when the collection is full. */
function awardShell(s: WinState, config: WinConfig): { state: WinState; award: ShellAward } {
  const r = grantShell(s.shells, config);
  if (!r.shell) {
    const coins = config.collection.coinsWhenComplete;
    return { state: earn(s, coins), award: { kind: 'complete', coins } };
  }
  let state: WinState = { ...s, shells: r.owned };
  let setCoins = 0;
  if (r.completedSet) {
    const bonus = config.collection.setReward;
    setCoins = bonus.coins;
    state = earn(state, bonus.coins);
    state = { ...state, wallet: addBoosters(state.wallet, bonus.boosters) };
  }
  return { state, award: { kind: 'shell', shell: r.shell, completedSet: r.completedSet, setCoins } };
}

function emptyCard(result: WinResult): WinCard {
  return { mode: result.mode, perfect: false, rewardShown: false, reward: 0, prevBest: undefined, moves: result.moves, streak: 0, note: 'none', shell: null, unlocks: [] };
}

function winTutorial(s: WinState, result: WinResult): WinOutcome {
  return { state: { ...s, tutorialDone: true }, card: emptyCard(result) };
}

function winDaily(s: WinState, result: WinResult, config: WinConfig): WinOutcome {
  const before = progressOfState(s, config);
  const r = recordDailySolve(s.daily, result.dailyDate, config);
  const counts = !r.alreadySolved && !r.outOfOrder;
  let state = earn({ ...s, daily: r.state }, r.reward);
  state = { ...state, stats: bumpStats(state.stats, { pours: result.moves, dailiesSolved: counts ? 1 : 0 }) };
  let shell: ShellAward | null = null;
  if (counts) {
    const a = awardShell(state, config);
    state = { ...a.state, dailyShare: { date: result.dailyDate, pours: result.moves } }; // Share reports this solve, not a replay (GA-DP-6)
    shell = a.award;
  }
  const note: WinNote = r.outOfOrder ? 'outOfOrder' : r.alreadySolved ? 'dailyReplay' : r.usedPass ? 'usedPass' : r.earnedPass ? 'earnedPass' : 'none';
  const card: WinCard = { ...emptyCard(result), rewardShown: counts, reward: r.reward, streak: r.state.streak, note, shell, unlocks: newlyUnlocked(config, before, progressOfState(state, config)) };
  return { state, card };
}

function winLevel(s: WinState, result: WinResult, config: WinConfig): WinOutcome {
  const { level, moves } = result;
  const before = progressOfState(s, config);
  const perfect = result.assists === 0;
  const firstClear = level >= s.level;
  // Coins on the first clear only; replays pay nothing (M1).
  const reward = clearReward({ level, nextLevel: s.level, perfect, challenge: result.challenge }, config);
  const key = String(level);
  const prevBest = s.best[key];
  const best = prevBest === undefined || moves < prevBest ? { ...s.best, [key]: moves } : s.best;
  let state = earn({ ...s, best, level: Math.max(s.level, level + 1) }, reward);
  state = { ...state, stats: bumpStats(state.stats, { pours: moves, perfectClears: firstClear && perfect ? 1 : 0 }) };
  let shell: ShellAward | null = null;
  if (firstClear && milestoneDue(level, config)) {
    const a = awardShell(state, config);
    state = a.state;
    shell = a.award;
  }
  const note: WinNote = !firstClear ? 'replay' : perfect ? 'perfect' : 'none';
  const card: WinCard = { ...emptyCard(result), perfect, rewardShown: firstClear, reward, prevBest, note, shell, unlocks: newlyUnlocked(config, before, progressOfState(state, config)) };
  return { state, card };
}

/**
 * Applies a win to the save-like state. Returns the new state (the input is not modified) and the card.
 * Example: `applyWin(save, { mode: 'level', level: 5, challenge: false, dailyDate: '', moves: 12, assists: 0 }, config)`.
 */
export function applyWin(state: WinState, result: WinResult, config: WinConfig): WinOutcome {
  if (result.mode === 'tutorial') return winTutorial(state, result);
  return result.mode === 'daily' ? winDaily(state, result, config) : winLevel(state, result, config);
}
