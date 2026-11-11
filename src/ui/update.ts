/**
 * Keeps a game that stays open on a phone up to date (owner request after 0.14.1: no stale data
 * for players). Each time the page comes back to the foreground it asks the browser to check for a
 * new service worker; when a new version takes over, the page reloads into it on Home, where no
 * board is in play (logic/update.ts). A first install never reloads the page.
 */
import { homeEl, layers } from './dom';
import { reloadForUpdate, takeoverGate } from './logic/update';

let updateReady = false;

/** Reloads into the new version if one has taken over and Home is showing; else waits for Home. */
export function applyUpdateIfSafe(): void {
  if (reloadForUpdate({ updateReady, onHome: layers.top() === homeEl })) location.reload();
}

/**
 * Wires the update checks for `container`. On a first visit the first `controllerchange` is the
 * install, not an update; every later one is (`takeoverGate`).
 */
export function watchForUpdates(container: ServiceWorkerContainer, registration: Promise<ServiceWorkerRegistration | undefined>): void {
  const isUpdate = takeoverGate(!!container.controller);
  container.addEventListener('controllerchange', () => {
    if (!isUpdate()) return;
    updateReady = true;
    applyUpdateIfSafe();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    void registration.then((r) => r?.update()).catch(() => undefined); // offline or blocked: try next time
  });
}
