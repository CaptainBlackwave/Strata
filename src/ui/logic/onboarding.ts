/**
 * Install and onboarding rules (sprint 11 O1, O2, O4; D78), DOM-free so they are unit-tested
 * with an injected user agent, display mode and save. The screens in src/ui/screens/onboarding.ts
 * read the browser and call these.
 */

/** The `onboarding` object in the save: one-time notices, each remembered once shown. */
export interface Onboarding {
  /** Boots of the app on this device, this one included. 1 means the first visit. */
  visits: number;
  /** The Add to Home Screen card has been shown (O1). Shown once, whatever the player chose. */
  installShown: boolean;
  /** The offline-ready toast has been shown (O4). */
  offlineNoticed: boolean;
  /** The one-time line that explains the beach path on its first open (O2). */
  mapHintSeen: boolean;
  /** The one-time line about the boosters on the first numbered level (O2). */
  boosterHintSeen: boolean;
}

/** Tuning for the card: `onboarding` in game-config.json. */
export interface OnboardingConfig {
  /** Cleared levels before the Add to Home Screen card may show. */
  readonly installAfterLevels: number;
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
/** In-app browsers (Instagram, Facebook, Line, ...) that cannot add a page to the home screen. */
const IN_APP = /FBAN|FBAV|Instagram|Line\/|GSA\/|Snapchat|TikTok/i;

/** A new device's onboarding: no visits yet and nothing shown. */
export function freshOnboarding(): Onboarding {
  return { visits: 0, installShown: false, offlineNoticed: false, mapHintSeen: false, boosterHintSeen: false };
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
    installShown: flag('installShown'),
    offlineNoticed: flag('offlineNoticed'),
    mapHintSeen: flag('mapHintSeen'),
    boosterHintSeen: flag('boosterHintSeen'),
  };
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
 * Whether the Add to Home Screen card shows now: not shown before, not the first visit,
 * at least `afterLevels` levels cleared, and a way to install.
 * Example: `installCardDue(save.onboarding, save.level - 1, 3, 'ios')`.
 */
export function installCardDue(o: Onboarding, cleared: number, afterLevels: number, platform: InstallPlatform): boolean {
  return !o.installShown && o.visits >= 2 && cleared >= afterLevels && (platform === 'ios' || platform === 'prompt');
}
