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
