/**
 * What a win changes in the save and what the win card says (TD-2, sprint-8 P6).
 * Pure and DOM-free: `src/ui/main.ts` applies the returned state and renders the card.
 * Rules: design/gdd/economy.md (M1 first clear only), daily-challenge GDD (D10, GA-DP-6),
 * collection GDD (shell milestones), player-profile.md (stats, D25), level-map.md (replays and
 * the per-level Perfect mark, D50, D52), badges.md (jars sealed, scenes played and the badges a win
 * earns; recognition only, D76), weekly-set.md (a weekly win records the board and can earn the week's
 * badge; it pays nothing, D77).
 */
import { type BadgeSourceConfig, awardBadges, badgeProgressOf } from './badges';
import { type CollectionConfig, type Shell, type ShellSet, grantShell, milestoneDue, setProgress } from './collection';
import { type DailyConfig, type DailyShareRecord, type StreakState, recordDailySolve } from './daily';
import { type EconomyConfig, type Wallet, addBoosters, addCoins, clearReward } from './economy';
import { type WeeklyConfig, type WeeklyState, emptyWeekly, recordWeeklyClear } from './weekly';
import { type ProfileConfig, type Progress, type SlotItem, type Stats, bumpStats, newlyUnlocked, progressOf } from './profile';
import { type Goal, type GoalsConfig, type GoalsState, emptyGoals, goalsFor, recordGoals } from './goals';
import { type TrackConfig, type TrackStep, claimTrack, trackOf } from './streak-track';
import type { StyleState } from './styles';
import { type EventsConfig, type EventsState, emptyEventProgress, eventById, recordEventClear } from './events';

/** The slice of the save a win reads and writes. `SaveData` satisfies it structurally. */
export interface WinState {
  readonly level: number;
  readonly best: Readonly<Record<string, number>>;
  /** Levels cleared Perfect from the M3 update on, sorted (D52). */
  readonly perfect: readonly number[];
  readonly wallet: Wallet;
  readonly tutorialDone: boolean;
  readonly daily: StreakState;
  readonly shells: readonly string[];
  readonly stats: Stats;
  readonly dailyShare: DailyShareRecord | null;
  /** Earned badge ids, in the order earned (badges.md §3.3). */
  readonly badges: readonly string[];
  /** Scenes won in, each once (badges.md §3.2). */
  readonly scenesPlayed: readonly string[];
  /** Read by the special-jar badges; a win never changes it. */
  readonly seenMechanics: readonly string[];
  /** Read by the scene badges; a win never changes it. */
  readonly themes: { readonly owned: readonly string[] };
  /** The weekly set's progress (weekly-set.md §3.10). Optional so older callers need not carry it. */
  readonly weekly?: WeeklyState;
  /** Streak-track days claimed (sprint 16, daily-puzzle.md §2.4). */
  readonly track?: readonly number[];
  /** Today's goals progress (sprint 16, daily-goals.md). */
  readonly goals?: GoalsState;
  /** Jar styles; a track day can add a streak-only piece to `owned`. */
  readonly styles?: StyleState;
  /** Seasonal event progress by event id (sprint 17, events.md). */
  readonly events?: EventsState;
}

/** The config a win needs. */
export type WinConfig = EconomyConfig & DailyConfig & CollectionConfig & ProfileConfig & BadgeSourceConfig & WeeklyConfig & TrackConfig & Partial<GoalsConfig> & Partial<EventsConfig>;

export type WinMode = 'tutorial' | 'daily' | 'level' | 'weekly' | 'event';

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
  /** Jars sealed on the winning board (badges.md §3.2). */
  readonly sealed: number;
  /** The scene active when the board was won (badges.md §3.2). */
  readonly scene: string;
  /** The weekly board played (weekly mode): its week key and 0-based index (weekly-set.md §3.5). */
  readonly weekly?: { readonly week: string; readonly index: number };
  /** Today's UTC date key, for the daily goals (sprint 16). Without it no goal moves. */
  readonly today?: string;
  /** The event board played (event mode, sprint 17): event id, the event's year and the 1-based board. */
  readonly event?: { readonly id: string; readonly year: number; readonly board: number };
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
  /** This win gave the level its first Perfect mark (a first clear or a replay, D52). */
  readonly perfectEarned: boolean;
  /** This win beat a recorded best (D50). False on a first clear: there was no best before. */
  readonly newBest: boolean;
  readonly moves: number;
  /** The daily streak after this solve. */
  readonly streak: number;
  readonly note: WinNote;
  readonly shell: ShellAward | null;
  readonly unlocks: SlotItem[];
  /** Badge ids this win earned: the week's badge first, then catalogue order (badges.md §3.6). They pay nothing (D76). */
  readonly badges: string[];
  /** What a weekly win did to the set (weekly mode only, weekly-set.md §3.8). */
  readonly weekly?: WeeklyCard;
  /** What an event win did (event mode only, sprint 17, events.md). */
  readonly event?: EventCard;
  /** Streak-track days this daily solve claimed, in day order (sprint 16, D140). */
  readonly track: TrackStep[];
  /** Goals reached by this win and the all-goals bonus paid now (sprint 16, D137). */
  readonly goals: { readonly paid: readonly { readonly index: number; readonly goal: Goal; readonly coins: number }[]; readonly bonus: number };
}

/** The weekly part of the win card (weekly-set.md §3.8). */
export interface WeeklyCard {
  /** The board played, 0-based. */
  readonly index: number;
  /** Boards cleared this week after this win, and the set's size. */
  readonly cleared: number;
  readonly total: number;
  readonly firstClear: boolean;
  readonly newBest: boolean;
  readonly prevBest: number | undefined;
  /** This win cleared the set's last board. */
  readonly completedNow: boolean;
  /** The board's week is older than the saved week: nothing was recorded (§3.6). */
  readonly outOfDate: boolean;
}

/** The event part of the win card (sprint 17, events.md). */
export interface EventCard {
  readonly id: string;
  readonly board: number;
  readonly cleared: number;
  readonly total: number;
  readonly firstClear: boolean;
  readonly newBest: boolean;
  readonly prevBest: number | undefined;
  /** Coins this clear paid (every `coinsEvery`-th board). */
  readonly coins: number;
  /** This clear finished every board: the prize was granted. */
  readonly completedNow: boolean;
  /** The prize's jar piece `slot:id`, when `completedNow`. */
  readonly prizeStyle?: string;
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
    track: s.track,
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
  return { mode: result.mode, perfect: false, rewardShown: false, reward: 0, prevBest: undefined, perfectEarned: false, newBest: false, moves: result.moves, streak: 0, note: 'none', shell: null, unlocks: [], badges: [], track: [], goals: { paid: [], bonus: 0 } };
}

/** How a win reads for the daily goals. */
interface GoalFacts {
  /** False for a daily already solved today or out of order: the goals ignore it. */
  readonly counted: boolean;
  /** A replay that beat the level's best pours. */
  readonly beatBest: boolean;
}

/**
 * What every counted win (level or daily, replays included) adds for the badges: the jars sealed,
 * the scene, then any badge now met (badges.md §3.2, §3.4). Credits nothing (D76). Then today's goals
 * (sprint 16, D137): a goal reached pays its coins, all of them the bonus.
 */
function finishWin(s: WinState, result: WinResult, config: WinConfig, facts: GoalFacts = { counted: true, beatBest: false }): { state: WinState; badges: string[]; goals: WinCard['goals'] } {
  const scenesPlayed = result.scene && !s.scenesPlayed.includes(result.scene) ? [...s.scenesPlayed, result.scene] : s.scenesPlayed;
  let state: WinState = { ...s, scenesPlayed, stats: bumpStats(s.stats, { jarsSealed: result.sealed }) };
  const r = awardBadges(state.badges, badgeProgressOf(state, config), config);
  state = { ...state, badges: r.badges };
  let goals: WinCard['goals'] = { paid: [], bonus: 0 };
  if (result.today && config.goals && result.mode !== 'tutorial') {
    const g = recordGoals(state.goals ?? emptyGoals(), result.today, { mode: result.mode, jarsSealed: result.sealed, perfect: result.assists === 0, beatBest: facts.beatBest, counted: facts.counted }, config as GoalsConfig);
    const list = goalsFor(result.today, config as GoalsConfig);
    goals = { paid: g.paid.map((p) => ({ ...p, goal: list[p.index] })), bonus: g.bonus };
    state = earn({ ...state, goals: g.state }, g.paid.reduce((a, p) => a + p.coins, 0) + g.bonus);
  }
  return { state, badges: r.fresh, goals };
}

/** Pays the streak-track days a counted daily solve claims (sprint 16, D140): boosters, a jar style, a scene. Frames and plates unlock through `trackDay` progress. */
function payTrack(s: WinState, streak: number, config: WinConfig): { state: WinState; steps: TrackStep[] } {
  const c = claimTrack(s.track ?? [], streak, trackOf(config));
  let state: WinState = { ...s, track: c.claimed };
  for (const step of c.rewards) {
    const rw = step.reward;
    if (rw.kind === 'boosters') state = { ...state, wallet: addBoosters(state.wallet, rw.boosters) };
    else if (rw.kind === 'style' && state.styles && !state.styles.owned.includes(rw.piece)) state = { ...state, styles: { ...state.styles, owned: [...state.styles.owned, rw.piece] } };
    else if (rw.kind === 'scene' && !state.themes.owned.includes(rw.id)) state = { ...state, themes: { ...state.themes, owned: [...state.themes.owned, rw.id] } };
  }
  return { state, steps: c.rewards };
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
  let track: TrackStep[] = [];
  if (counts) {
    const t = payTrack(state, r.state.streak, config);
    state = t.state;
    track = t.steps;
  }
  const note: WinNote = r.outOfOrder ? 'outOfOrder' : r.alreadySolved ? 'dailyReplay' : r.usedPass ? 'usedPass' : r.earnedPass ? 'earnedPass' : 'none';
  const f = finishWin(state, result, config, { counted: counts, beatBest: false });
  state = f.state;
  const card: WinCard = { ...emptyCard(result), badges: f.badges, goals: f.goals, track, rewardShown: counts, reward: r.reward, streak: r.state.streak, note, shell, unlocks: newlyUnlocked(config, before, progressOfState(state, config)) };
  return { state, card };
}

/**
 * A weekly board (weekly-set.md §3.5–§3.7): records the clear and best pours, adds the week's badge
 * when the set is complete, counts pours and sealed jars. Single boards pay nothing; the win that
 * completes the set pays `weekly.completeBonus` (D83), once a week because `completedNow` is.
 */
function winWeekly(s: WinState, result: WinResult, config: WinConfig): WinOutcome {
  const before = progressOfState(s, config);
  const played = result.weekly ?? { week: '', index: -1 };
  const r = recordWeeklyClear(s.weekly ?? emptyWeekly(), played.week, played.index, result.moves, config);
  const weeklyBadges = r.badge && !s.badges.includes(r.badge) ? [r.badge] : [];
  let state: WinState = { ...s, weekly: r.state, badges: [...s.badges, ...weeklyBadges], stats: bumpStats(s.stats, { pours: result.moves }) };
  const bonus = r.completedNow ? config.weekly.completeBonus : 0;
  if (bonus > 0) state = earn(state, bonus);
  const f = finishWin(state, result, config);
  state = f.state;
  const weekly: WeeklyCard = { index: played.index, cleared: r.state.cleared.length, total: config.weekly.boards.length, firstClear: r.firstClear, newBest: r.newBest, prevBest: r.prevBest, completedNow: r.completedNow, outOfDate: r.outOfDate };
  const card: WinCard = { ...emptyCard(result), rewardShown: bonus > 0, reward: bonus, badges: [...weeklyBadges, ...f.badges], goals: f.goals, weekly, unlocks: newlyUnlocked(config, before, progressOfState(state, config)) };
  return { state, card };
}

/**
 * An event board (sprint 17, events.md): records the clear and best pours, pays `coins` on every
 * `coinsEvery`-th board, and on the last board grants the prize (a jar piece and a badge, each once
 * and kept for good, D143, D146).
 */
function winEvent(s: WinState, result: WinResult, config: WinConfig): WinOutcome {
  const played = result.event;
  const event = played && config.events ? eventById(played.id, config as EventsConfig) : undefined;
  if (!played || !event) {
    const f = finishWin(s, result, config);
    return { state: f.state, card: { ...emptyCard(result), badges: f.badges, goals: f.goals } };
  }
  const before = progressOfState(s, config);
  const r = recordEventClear(s.events?.[event.id] ?? emptyEventProgress(), event, played.year, played.board, result.moves);
  let state: WinState = { ...s, events: { ...(s.events ?? {}), [event.id]: r.state }, stats: bumpStats(s.stats, { pours: result.moves }) };
  if (r.coins > 0) state = earn(state, r.coins);
  const prizeBadges: string[] = [];
  if (r.completedNow) {
    const { style, badge } = event.prize;
    if (style && state.styles && !state.styles.owned.includes(style)) state = { ...state, styles: { ...state.styles, owned: [...state.styles.owned, style] } };
    if (badge && !state.badges.includes(badge)) {
      state = { ...state, badges: [...state.badges, badge] };
      prizeBadges.push(badge);
    }
  }
  const f = finishWin(state, result, config);
  state = f.state;
  const card: WinCard = {
    ...emptyCard(result),
    rewardShown: r.coins > 0,
    reward: r.coins,
    badges: [...prizeBadges, ...f.badges],
    goals: f.goals,
    event: { id: event.id, board: played.board, cleared: r.state.cleared.length, total: event.boards, firstClear: r.firstClear, newBest: r.newBest, prevBest: r.prevBest, coins: r.coins, completedNow: r.completedNow, ...(r.completedNow && event.prize.style ? { prizeStyle: event.prize.style } : {}) },
    unlocks: newlyUnlocked(config, before, progressOfState(state, config)),
  };
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
  const newBest = prevBest !== undefined && moves < prevBest;
  // D52: a level's first Perfect counts once, from a first clear or a replay.
  const perfectEarned = perfect && !s.perfect.includes(level);
  const perfectList = perfectEarned ? [...s.perfect, level].sort((a, b) => a - b) : s.perfect;
  let state = earn({ ...s, best, perfect: perfectList, level: Math.max(s.level, level + 1) }, reward);
  state = { ...state, stats: bumpStats(state.stats, { pours: moves, perfectClears: perfectEarned ? 1 : 0 }) };
  let shell: ShellAward | null = null;
  if (firstClear && milestoneDue(level, config)) {
    const a = awardShell(state, config);
    state = a.state;
    shell = a.award;
  }
  const note: WinNote = !firstClear ? 'replay' : perfect ? 'perfect' : 'none';
  const f = finishWin(state, result, config, { counted: true, beatBest: newBest });
  state = f.state;
  const card: WinCard = { ...emptyCard(result), badges: f.badges, goals: f.goals, perfect, rewardShown: firstClear, reward, prevBest, perfectEarned, newBest, note, shell, unlocks: newlyUnlocked(config, before, progressOfState(state, config)) };
  return { state, card };
}

/**
 * Applies a win to the save-like state. Returns the new state (the input is not modified) and the card.
 * Example: `applyWin(save, { mode: 'level', level: 5, challenge: false, dailyDate: '', moves: 12, assists: 0 }, config)`.
 */
export function applyWin(state: WinState, result: WinResult, config: WinConfig): WinOutcome {
  if (result.mode === 'tutorial') return winTutorial(state, result);
  if (result.mode === 'weekly') return winWeekly(state, result, config);
  if (result.mode === 'event') return winEvent(state, result, config);
  return result.mode === 'daily' ? winDaily(state, result, config) : winLevel(state, result, config);
}
