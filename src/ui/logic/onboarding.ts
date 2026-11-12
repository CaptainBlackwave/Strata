/**
 * Install and onboarding rules (sprint 11 O1, O2, O4; D78), DOM-free so they are unit-tested
 * with an injected user agent, display mode and save. The screens in src/ui/screens/onboarding.ts
 * read the browser and call these. 0.11.1 adds the first-run fixes (D81, D82): the Home hint on the
 * win card, a shared link kept through the tutorial, and the Scenes "New" mark.
 */
import { type Launch, type ShareKey, isChallengeLevel, isChallengePours, isDateKey, isWeekKey } from './launch';

/** The `onboarding` object in the save: one-time notices, each remembered once shown. */
export interface Onboarding {
  /** Boots of the app on this device, this one included. 1 means the first visit. */
  visits: number;
  /**
   * How many times the Add to Home Screen card has asked (O1; sprint 21 A1, D179: at most
   * `installMaxAsks`, whatever the player chose). A save from before 0.20 that saw the old
   * one-time card (`installShown`) loads as 1.
   */
  installAsks: number;
  /** When the card last asked, in epoch ms (A1: asks are `installGapDays` apart), or null. */
  installLastAsk: number | null;
  /** The browser reported Strata installed (`appinstalled`) or the player accepted its prompt: never ask again (A1). */
  installed: boolean;
  /** The offline-ready toast has been shown (O4). */
  offlineNoticed: boolean;
  /** The one-time line that explains the beach path on its first open (O2). */
  mapHintSeen: boolean;
  /** The one-time line about the boosters on the first numbered level (O2). */
  boosterHintSeen: boolean;
  /** The one-time win-card line that points to Home and the daily (R1, D81). */
  homeHintSeen: boolean;
  /** The Scenes button's "New" mark has been cleared by opening Scenes (R4, D82). */
  scenesNewSeen: boolean;
  /** The Styles button's "New" mark has been cleared by opening Styles (sprint 12 S4). */
  stylesNewSeen: boolean;
  /** A shared daily or weekly link opened before the tutorial, offered once after it (R2, D82). */
  pendingShare: ShareKey | null;
}

/** Tuning for the card: `onboarding` in game-config.json. */
export interface OnboardingConfig {
  /** Cleared levels before the Add to Home Screen card may show (A1: after the 5th clear). */
  readonly installAfterLevels: number;
  /** The most times the card ever asks (A1: twice). */
  readonly installMaxAsks: number;
  /** The fewest days between two asks (A1: 7). */
  readonly installGapDays: number;
  /** The level whose first clear shows the one-time Home hint on the win card (R1, D81). */
  readonly homeHintLevel: number;
}

/** How this device can put Strata on its home screen. */
export type InstallPlatform = 'installed' | 'ios' | 'prompt' | 'none';

/** What {@link installPlatform} reads from the browser, injected so tests can fake any device. */
export interface InstallEnv {
  /** `navigator.userAgent`. */
  readonly userAgent: string;
  /** `navigator.maxTouchPoints`: an iPad on iPadOS 13+ reports a desktop Mac user agent. */
  readonly maxTouchPoints: number;
  /** Running from the home screen: `display-mode: standalone`, or Safari's `navigator.standalone`. */
  readonly standalone: boolean;
  /** A `beforeinstallprompt` event has been captured and not used yet (Android and Chrome). */
  readonly promptReady: boolean;
}

/** Highest visit count kept; past it the counter stops, which no rule can tell apart. */
const MAX_VISITS = 1_000_000;
/** Highest ask count kept: far above any `installMaxAsks`, so a repaired count never wraps. */
const MAX_ASKS = 99;
/** One day in milliseconds. */
const DAY_MS = 86_400_000;
/** In-app browsers (Instagram, Facebook, Line, ...) that cannot add a page to the home screen. */
const IN_APP = /FBAN|FBAV|Instagram|Line\/|GSA\/|Snapchat|TikTok/i;

/** A new device's onboarding: no visits yet and nothing shown. */
export function freshOnboarding(): Onboarding {
  return { visits: 0, installAsks: 0, installLastAsk: null, installed: false, offlineNoticed: false, mapHintSeen: false, boosterHintSeen: false, homeHintSeen: false, scenesNewSeen: false, stylesNewSeen: false, pendingShare: null };
}

/**
 * Repairs a saved `onboarding` value field by field. `returning` marks a save that existed
 * before this field did: it counts as one earlier visit, so a player updating from 0.10 can
 * see the card on this boot rather than waiting a visit.
 * Example: `onboardingOf(v2.onboarding, true)`.
 */
export function onboardingOf(v: unknown, returning: boolean): Onboarding {
  const base = freshOnboarding();
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  const visits = o?.visits;
  const flag = (k: keyof Onboarding) => o?.[k] === true;
  return {
    visits: Number.isInteger(visits) && (visits as number) >= 0 ? Math.min(visits as number, MAX_VISITS) : returning ? 1 : base.visits,
    installAsks: asksOf(o?.installAsks, o?.installShown === true),
    installLastAsk: typeof o?.installLastAsk === 'number' && Number.isFinite(o.installLastAsk) && o.installLastAsk >= 0 ? o.installLastAsk : null,
    installed: flag('installed'),
    offlineNoticed: flag('offlineNoticed'),
    mapHintSeen: flag('mapHintSeen'),
    boosterHintSeen: flag('boosterHintSeen'),
    homeHintSeen: flag('homeHintSeen'),
    scenesNewSeen: flag('scenesNewSeen'),
    stylesNewSeen: flag('stylesNewSeen'),
    pendingShare: shareKeyOf(o?.pendingShare),
  };
}

/** A saved ask count; a pre-0.20 save that saw the one-time card (`legacyShown`) counts one ask. */
function asksOf(v: unknown, legacyShown: boolean): number {
  if (Number.isInteger(v) && (v as number) >= 0) return Math.min(v as number, MAX_ASKS);
  return legacyShown ? 1 : 0;
}

/** A saved share key, or null when it is missing or not a real date or week (no free text is kept). */
function shareKeyOf(v: unknown): ShareKey | null {
  if (!v || typeof v !== 'object') return null;
  const k = v as { daily?: unknown; weekly?: unknown; challenge?: unknown; pours?: unknown };
  if (typeof k.daily === 'string' && isDateKey(k.daily)) return { daily: k.daily };
  if (typeof k.weekly === 'string' && isWeekKey(k.weekly)) return { weekly: k.weekly };
  if (isChallengeLevel(k.challenge) && isChallengePours(k.pours)) return { challenge: k.challenge, pours: k.pours };
  return null;
}

/** The onboarding after one more boot. Example: `save.onboarding = countVisit(save.onboarding)`. */
export function countVisit(o: Onboarding): Onboarding {
  return { ...o, visits: Math.min(o.visits + 1, MAX_VISITS) };
}

/**
 * How this device installs: already `installed`; `ios` (Safari's Share, then Add to Home
 * Screen, also iPadOS reporting a Mac); `prompt` once Android or Chrome has offered its
 * install prompt; otherwise `none` (desktop Firefox, in-app browsers).
 */
export function installPlatform(env: InstallEnv): InstallPlatform {
  if (env.standalone) return 'installed';
  if (IN_APP.test(env.userAgent)) return 'none';
  const ios = /iPhone|iPad|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1);
  if (ios) return 'ios';
  return env.promptReady ? 'prompt' : 'none';
}

/**
 * Whether the Add to Home Screen card shows now (sprint 21 A1, D179): never once installed
 * (`installed` platform, or the saved `installed` flag after `appinstalled`); only with a way to
 * install; after `installAfterLevels` cleared levels; at most `installMaxAsks` times, and at least
 * `installGapDays` days after the last ask. A clock set back before the last ask waits, so a changed
 * date can never bring the second ask early. `now` is epoch ms from the app clock.
 * Example: `installCardDue(save.onboarding, save.level - 1, config.onboarding, 'ios', Date.now())`.
 */
export function installCardDue(o: Onboarding, cleared: number, cfg: OnboardingConfig, platform: InstallPlatform, now: number): boolean {
  if (o.installed || (platform !== 'ios' && platform !== 'prompt')) return false;
  if (cleared < cfg.installAfterLevels || o.installAsks >= cfg.installMaxAsks) return false;
  return o.installLastAsk === null || now - o.installLastAsk >= cfg.installGapDays * DAY_MS;
}

/** The onboarding after the card has asked once at `now` (epoch ms). Example: `save.onboarding = recordInstallAsk(save.onboarding, Date.now())`. */
export function recordInstallAsk(o: Onboarding, now: number): Onboarding {
  return { ...o, installAsks: Math.min(o.installAsks + 1, MAX_ASKS), installLastAsk: now };
}

/** The onboarding once Strata is installed: the card never asks again. */
export function recordInstalled(o: Onboarding): Onboarding {
  return { ...o, installed: true };
}

/** The `type` of the message sw.js posts once its install has cached every file (O4). */
export const OFFLINE_READY = 'strata:offline-ready';

/** Whether a service worker message is the offline-ready one. Example: `isOfflineReady(e.data)`. */
export function isOfflineReady(data: unknown): boolean {
  return !!data && typeof data === 'object' && (data as { type?: unknown }).type === OFFLINE_READY;
}

/**
 * Whether the offline-ready toast shows (O4): once, and never when storage is blocked, since
 * then it could not be remembered and would show on every visit.
 */
export function offlineNoticeDue(o: Onboarding, storageOk: boolean): boolean {
  return storageOk && !o.offlineNoticed;
}

/**
 * What the offline-ready message does (O4, 0.11.1): a `toast`; or `covered` while the install card
 * is open, which already says Strata plays offline, so it is remembered without a toast over the
 * card; or `none` when not due. Example: `offlineNotice(save.onboarding, saveStored(), !install.hidden)`.
 */
export function offlineNotice(o: Onboarding, storageOk: boolean, installCardOpen: boolean): 'toast' | 'covered' | 'none' {
  if (!offlineNoticeDue(o, storageOk)) return 'none';
  return installCardOpen ? 'covered' : 'toast';
}

/** What {@link homeHintDue} needs from a win. */
export interface HintWin {
  readonly mode: string;
  readonly level: number;
  readonly firstClear: boolean;
}

/**
 * Whether the level win card adds the one-time line "Today's daily puzzle is on Home" (R1, D81):
 * the first clear of exactly `hintLevel`, once. A player already past it has found Home.
 * Example: `homeHintDue(save.onboarding, { mode: 'level', level: 3, firstClear: true }, 3)`.
 */
export function homeHintDue(o: Onboarding, win: HintWin, hintLevel: number): boolean {
  return !o.homeHintSeen && win.mode === 'level' && win.firstClear && win.level === hintLevel;
}

/**
 * Whether the Scenes button carries its quiet "New" mark (R4, D82): the player can afford the
 * cheapest scene they do not own, and has not opened Scenes since the mark appeared.
 * Example: `scenesNewDue(save.onboarding, save.wallet.coins, [300, 500])`.
 */
export function scenesNewDue(o: Onboarding, coins: number, unownedPrices: readonly number[]): boolean {
  return !o.scenesNewSeen && unownedPrices.length > 0 && coins >= Math.min(...unownedPrices);
}

/**
 * Keeps a shared daily or weekly link that arrives before the tutorial is done, so it can be
 * offered right after it (R2, D82). A newer link replaces an older one; anything else changes nothing.
 * Example: `save.onboarding = keepShare(save.onboarding, parseLaunch(location.search), save.tutorialDone)`.
 */
export function keepShare(o: Onboarding, launch: Launch, tutorialDone: boolean): Onboarding {
  if (tutorialDone) return o;
  if (launch.kind === 'daily') return { ...o, pendingShare: { daily: launch.date } };
  if (launch.kind === 'weekly') return { ...o, pendingShare: { weekly: launch.week } };
  if (launch.kind === 'challenge') return { ...o, pendingShare: { challenge: launch.level, pours: launch.pours } };
  return o;
}

/** Hands over the kept link once and clears it. Example: `const { onboarding, share } = takeShare(save.onboarding)`. */
export function takeShare(o: Onboarding): { readonly onboarding: Onboarding; readonly share: ShareKey | null } {
  return { onboarding: { ...o, pendingShare: null }, share: o.pendingShare };
}
