/**
 * Picking up a new release in a game left open (owner request after 0.14.1: no stale data for
 * players). DOM-free. When a new service worker has taken over, the page reloads into it on Home.
 * Home never has a board in play: a board left for Home is not kept (sprint 10 F6, logic/leave.ts),
 * and every board started from Home is new. So reloading there loses nothing; on a board, the win
 * card or any other screen it waits until the player is back on Home.
 */

/** What decides whether the page may reload for an update now. */
export interface UpdateState {
  /** A new version's service worker has taken control of this page. */
  readonly updateReady: boolean;
  /** Home is the top screen. */
  readonly onHome: boolean;
}

/** True when the page should reload into the new version now. Example: `reloadForUpdate({ updateReady: true, onHome: true }) // true`. */
export function reloadForUpdate(s: UpdateState): boolean {
  return s.updateReady && s.onHome;
}

/**
 * Tells updates apart from the first install among service worker takeovers (`controllerchange`).
 * `controlledAtBoot` is whether a worker controlled the page when it loaded. On a first visit the
 * first takeover is the install; every later one, even in the same open page, is an update (review
 * of PR #33). Example: `const isUpdate = takeoverGate(!!navigator.serviceWorker.controller)`.
 */
export function takeoverGate(controlledAtBoot: boolean): () => boolean {
  let controlled = controlledAtBoot;
  return () => {
    const update = controlled;
    controlled = true;
    return update;
  };
}

/**
 * Where the player is, for the update bar (sprint 21 A3, D179): `home` when Home is the top screen,
 * `over-home` when a sheet (Settings, Scenes...) covers it, `away` on a board, the map or the win card.
 */
export type UpdatePlace = 'home' | 'over-home' | 'away';

/**
 * The update bar's state: `none` (no new version), `ready` (a new version has taken over, the bar
 * not yet shown), `offered` (the bar is on Home), `ignored` (the player left Home or the app without
 * tapping Update, so today's silent reload on the next return to Home is the fallback).
 */
export type UpdatePhase = 'none' | 'ready' | 'offered' | 'ignored';

/**
 * What happens to the page: `bar` shows "New version ready · Update", `reload` reloads into the new
 * version, `none` changes nothing on screen.
 */
export type UpdateAction = 'none' | 'bar' | 'reload';

/**
 * What the page notices: `takeover` (a new worker took control: an update, never the install),
 * `place` (the top screen changed), `hidden` (the app went to the background), `visible` (it came
 * back), `tap` (the player pressed Update).
 */
export type UpdateEvent = 'takeover' | 'place' | 'hidden' | 'visible' | 'tap';

/**
 * The update bar's state machine (A3). The bar only ever shows on Home, and every reload happens
 * with Home on top, where no board is in play (`reloadForUpdate`). A bar the player passes by (they
 * start a board, or leave the app) falls back to the silent reload when Home is next on top.
 * Example: `const { phase, action } = updateStep('offered', 'tap', 'home') // { phase: 'none', action: 'reload' }`.
 */
export function updateStep(phase: UpdatePhase, event: UpdateEvent, place: UpdatePlace): { readonly phase: UpdatePhase; readonly action: UpdateAction } {
  const onHome = place === 'home';
  switch (event) {
    case 'takeover':
      if (phase === 'none' || phase === 'ready') return onHome ? { phase: 'offered', action: 'bar' } : { phase: 'ready', action: 'none' };
      return { phase, action: 'none' }; // a second takeover changes nothing: one reload picks up the newest
    case 'place':
      if (phase === 'ready' && onHome) return { phase: 'offered', action: 'bar' };
      if (phase === 'offered' && place === 'away') return { phase: 'ignored', action: 'none' };
      if (phase === 'ignored' && reloadForUpdate({ updateReady: true, onHome })) return { phase: 'none', action: 'reload' };
      return { phase, action: 'none' };
    case 'hidden':
      return phase === 'offered' ? { phase: 'ignored', action: 'none' } : { phase, action: 'none' };
    case 'visible':
      return phase === 'ignored' && onHome ? { phase: 'none', action: 'reload' } : { phase, action: 'none' };
    case 'tap':
      return phase !== 'none' && onHome ? { phase: 'none', action: 'reload' } : { phase, action: 'none' };
  }
}

/** What decides whether Settings shows "Works offline" (A3). */
export interface OfflineState {
  /** The browser has service workers and this build registers one (production only). */
  readonly supported: boolean;
  /** A worker controlled the page at boot: sw.js only installs once every file is cached. */
  readonly controlledAtBoot: boolean;
  /** sw.js has posted its offline-ready message on this visit. */
  readonly readyMessage: boolean;
}

/** True once the game is cached for offline play. Example: `worksOffline({ supported: true, controlledAtBoot: false, readyMessage: true }) // true`. */
export function worksOffline(s: OfflineState): boolean {
  return s.supported && (s.controlledAtBoot || s.readyMessage);
}
