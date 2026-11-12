/**
 * Keeps a game that stays open on a phone up to date (owner request after 0.14.1: no stale data
 * for players). Each time the page comes back to the foreground it asks the browser to check for a
 * new service worker. When a new version takes over, Home shows a calm bar, "New version ready ·
 * Update" (sprint 21 A3, D179), and Update reloads into it. A bar the player passes by falls back to
 * the silent reload on Home of 0.14.1: as soon as they are back on Home, from a board, or when the app
 * returns to the foreground. Every reload happens with Home on top, where no board is in play
 * (logic/update.ts). A first install never reloads the page.
 *
 * It also remembers whether the game is cached for offline play, for Settings' "Works offline".
 */
import { $, homeEl, layers } from './dom';
import { type UpdateEvent, type UpdatePhase, type UpdatePlace, takeoverGate, updateStep, worksOffline } from './logic/update';

let phase: UpdatePhase = 'none';
const offline = { supported: false, controlledAtBoot: false, readyMessage: false };

/** Where the player is now, for the update bar. */
function place(): UpdatePlace {
  if (layers.top() === homeEl) return 'home';
  return layers.has(homeEl) ? 'over-home' : 'away';
}

/** Feeds one event to the bar's state machine and does what it says. */
function step(event: UpdateEvent): void {
  const next = updateStep(phase, event, place());
  phase = next.phase;
  if (next.action === 'reload') {
    location.reload();
    return;
  }
  $('update-bar').hidden = phase !== 'offered';
}

/**
 * Reloads into the new version if one is waiting and Home is on top (the silent fallback); else
 * waits for Home. Kept for callers outside the bar.
 */
export function applyUpdateIfSafe(): void {
  if (phase === 'ignored') step('place');
}

/** sw.js reported (or a controlled boot proved) that every file is cached: Settings says "Works offline". */
export function noteOfflineReady(): void {
  offline.readyMessage = true;
}

/** Whether Settings shows "Works offline" (A3). */
export function offlineReady(): boolean {
  return worksOffline(offline);
}

/**
 * Wires the update checks for `container`. On a first visit the first `controllerchange` is the
 * install, not an update; every later one is (`takeoverGate`).
 */
export function watchForUpdates(container: ServiceWorkerContainer, registration: Promise<ServiceWorkerRegistration | undefined>): void {
  offline.supported = true;
  offline.controlledAtBoot = !!container.controller;
  $('btn-update').addEventListener('click', () => step('tap'));
  // A sheet closing back to Home (Settings, Scenes…) is a chance too (strata-bya). Checked once the
  // current action has finished, so a button that closes a sheet and starts a board is never cut short.
  layers.onChange(() => {
    if (phase !== 'none') window.setTimeout(() => step('place'), 0);
  });
  const isUpdate = takeoverGate(!!container.controller);
  container.addEventListener('controllerchange', () => {
    if (isUpdate()) step('takeover');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      step('hidden');
      return;
    }
    step('visible');
    void registration.then((r) => r?.update()).catch(() => undefined); // offline or blocked: try next time
  });
}

