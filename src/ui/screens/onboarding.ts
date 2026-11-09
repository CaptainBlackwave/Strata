/**
 * Install and onboarding on screen (sprint 11, D78): the one-time Add to Home Screen card (O1).
 * The rules are the DOM-free src/ui/logic/onboarding.ts; this reads the browser and shows them.
 */
import { type InstallPlatform, countVisit, installCardDue, installPlatform, isOfflineReady, offlineNoticeDue } from '../logic/onboarding';
import { saveStored, whatsNewDue, writeSave } from '../storage';
import { t } from '../strings';
import { $, closeLayer, homeEl, layers, openLayer, showToast } from '../dom';
import { config, state } from '../state';
import { startDaily } from './board';

/** How long Home settles before the card may open over it (ms): presentation only (D31). */
const INSTALL_ARRIVE_MS = 700;
/** Safari's share icon, drawn after the first iPhone step. */
const SHARE_SVG = '<svg class="install-share-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M7 10H5v10h14V10h-2" /></svg>';

/** Chrome's `beforeinstallprompt` event, which is not in the DOM typings. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** The captured install prompt (Android and Chrome), kept until the card's button uses it. */
let deferred: InstallPromptEvent | null = null;
let installTimer = 0;

/** Whether Strata is running from the home screen. */
function standalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** This device's install route, read from the browser. */
export function currentPlatform(): InstallPlatform {
  return installPlatform({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0, standalone: standalone(), promptReady: deferred !== null });
}

/** Counts this boot as a visit; boot writes the save right after (O1). */
export function countThisVisit(): void {
  state.save.onboarding = countVisit(state.save.onboarding);
}

/**
 * Opens the card over Home once Home has settled, if it is due (O1). Called whenever Home
 * shows and when the browser offers its install prompt; a later layer (the map, What's new)
 * on top means not this time.
 */
export function maybeShowInstall(): void {
  window.clearTimeout(installTimer);
  installTimer = window.setTimeout(() => {
    if (layers.top() !== homeEl || whatsNewDue(state.save)) return;
    const platform = currentPlatform();
    if (platform !== 'ios' && platform !== 'prompt') return;
    if (installCardDue(state.save.onboarding, state.save.level - 1, config.onboarding.installAfterLevels, platform)) openInstall(platform);
  }, INSTALL_ARRIVE_MS);
}

/** Fills and opens the card for `platform`, and remembers that it was shown. */
export function openInstall(platform: 'ios' | 'prompt'): void {
  const steps = $('install-steps');
  steps.hidden = platform !== 'ios';
  steps.replaceChildren(
    ...(platform === 'ios' ? t.onboarding.iosSteps : []).map((text, i) => {
      const li = document.createElement('li');
      li.textContent = text;
      if (i === 0) li.insertAdjacentHTML('beforeend', SHARE_SVG);
      return li;
    }),
  );
  $('install-note').hidden = platform !== 'ios';
  $('btn-install-later').hidden = platform === 'ios'; // iPhone has nothing to accept: one button closes
  $('btn-install').textContent = platform === 'ios' ? t.gotIt : t.onboarding.installButton;
  state.save.onboarding.installShown = true; // shown once, whatever the player picks
  writeSave(state.save);
  openLayer($('install'), $('btn-install'), $('btn-play'));
}

/** The card's main button: the browser's install prompt where there is one, else just close. */
async function install(): Promise<void> {
  const prompt = deferred;
  closeLayer($('install'));
  if (!prompt) return;
  deferred = null; // a prompt can be used once
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch {
    /* the browser refused the prompt; the card has been shown, so nothing more */
  }
}

/**
 * A `?daily=` link from an earlier day (O3): over Home, a gentle note that it has ended, with
 * today's daily one tap away.
 */
export function openDailyOver(date: string): void {
  $('daily-over-text').textContent = t.onboarding.dailyOverText(date);
  openLayer($('daily-over'), $('btn-daily-over-play'), $('btn-daily'));
}

/** The one-time "ready to play offline" toast (O4), unless already shown or storage is blocked. */
export function noticeOffline(): void {
  if (!offlineNoticeDue(state.save.onboarding, saveStored())) return;
  state.save.onboarding.offlineNoticed = true;
  writeSave(state.save);
  showToast(t.onboarding.offlineReady);
}

/**
 * Listens for sw.js's offline-ready message (O4), sent once its install has cached everything.
 * Call before registering the worker. A page that is already controlled was cached on an
 * earlier visit (sw.js only installs when complete), so it shows the notice too if it was missed.
 */
export function listenForOffline(container: ServiceWorkerContainer): void {
  container.addEventListener('message', (e) => {
    if (isOfflineReady(e.data)) noticeOffline();
  });
  container.startMessages();
  if (container.controller) noticeOffline();
}

/** Captures the install prompt and wires the card's buttons. */
export function wireOnboarding(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep Chrome's own banner away: the card offers it at the right moment
    deferred = e as InstallPromptEvent;
    maybeShowInstall();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    state.save.onboarding.installShown = true;
    writeSave(state.save);
    if (!$('install').hidden) closeLayer($('install'));
  });
  $('btn-install').addEventListener('click', () => void install());
  $('btn-install-later').addEventListener('click', () => closeLayer($('install')));
  $('btn-daily-over-later').addEventListener('click', () => closeLayer($('daily-over')));
  $('btn-daily-over-play').addEventListener('click', () => {
    closeLayer($('daily-over'), false);
    startDaily();
  });
}
