/**
 * Install and onboarding on screen (sprint 11, D78): the one-time Add to Home Screen card (O1).
 * The rules are the DOM-free src/ui/logic/onboarding.ts; this reads the browser and shows them.
 */
import { type InstallPlatform, countVisit, installCardDue, installPlatform, isOfflineReady, offlineNotice, recordInstallAsk, recordInstalled } from '../logic/onboarding';
import { noteOfflineReady } from '../update';
import { type ShareKey, dailyLaunch } from '../logic/launch';
import { dailyKey } from '../clock';
import { saveStored, whatsNewDue, writeSave } from '../storage';
import { t } from '../strings';
import { selectHomeTab } from './home-tabs';
import { $, closeLayer, hideToast, homeEl, layers, openLayer, showToast } from '../dom';
import { config, state } from '../state';
import { startDaily } from './board';
import { showHome } from './home';
import { openWeekly } from './sheets/weekly';
import { openFriend } from './friend';

/** How long Home settles before the card may open over it (ms): presentation only (D31). */
const INSTALL_ARRIVE_MS = 700;
/**
 * The iPhone step pictures (sprint 21 A1, D179), one per step in `t.onboarding.iosSteps`: Safari's
 * toolbar with Share ringed, the share sheet with Add to Home Screen ringed, then the Add button.
 * Drawn for Strata in SVG with no words, so the captions beside them carry the (localised) text.
 * `.ip-hi` is the part to tap, in the scene's accent.
 */
const IOS_STEP_SVGS = [
  // Safari's bottom bar, close up: the address pill, the soft back/forward/tabs marks, and Share large and ringed.
  '<svg class="install-pic" viewBox="0 0 72 48" aria-hidden="true"><rect class="ip-frame" x="2" y="2" width="68" height="44" rx="8" /><rect class="ip-soft" x="9" y="7" width="54" height="9" rx="4.5" /><path class="ip-soft" d="M12 30l-3.5 3.5L12 37M16 30l3.5 3.5L16 37M51 29.5h7v8h-7zM60.5 31.5v8h-7" /><circle class="ip-ring" cx="36" cy="33" r="11" /><path class="ip-hi ip-glyph" d="M36 36V24.5m-4 4 4-4 4 4M32.5 30H30v11h12V30h-2.5" /></svg>',
  // The share sheet: a soft row above, the Add to Home Screen row ringed with its plus-in-a-square, a soft row below.
  '<svg class="install-pic" viewBox="0 0 72 48" aria-hidden="true"><rect class="ip-frame" x="2" y="2" width="68" height="44" rx="8" /><path class="ip-soft" d="M10 9h26" /><rect class="ip-soft" x="54" y="5" width="8" height="8" rx="2" /><rect class="ip-ring" x="5" y="15.5" width="62" height="17" rx="5" /><path class="ip-hi" d="M11 24h30" /><rect class="ip-hi ip-glyph" x="50" y="18" width="12" height="12" rx="3" /><path class="ip-hi ip-glyph" d="M56 20.8v6.4M52.8 24h6.4" /><path class="ip-soft" d="M10 39h22" /><rect class="ip-soft" x="54" y="35" width="8" height="8" rx="2" /></svg>',
  // The Add to Home Screen page: Cancel and the title soft, the Add button ringed, Strata's icon and name below.
  '<svg class="install-pic" viewBox="0 0 72 48" aria-hidden="true"><rect class="ip-frame" x="2" y="2" width="68" height="44" rx="8" /><path class="ip-line" d="M2 19h68" /><path class="ip-soft" d="M9 10.5h10M26 10.5h14" /><rect class="ip-ring" x="45" y="4" width="21" height="13" rx="6.5" /><path class="ip-hi ip-glyph" d="M50.5 10.5h10" /><rect class="ip-soft" x="9" y="25" width="15" height="15" rx="4" /><path class="ip-soft" d="M30 29h28M30 35h18" /></svg>',
];

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
    if (installCardDue(state.save.onboarding, state.save.level - 1, config.onboarding, platform, state.clock().getTime())) openInstall(platform);
  }, INSTALL_ARRIVE_MS);
}

/** Fills and opens the card for `platform`, and remembers the ask (A1: at most twice, a week apart). */
export function openInstall(platform: 'ios' | 'prompt'): void {
  hideToast(); // a toast (e.g. the offline notice) must not sit over the card; the card says it plays offline
  const steps = $('install-steps');
  steps.hidden = platform !== 'ios';
  steps.replaceChildren(
    ...(platform === 'ios' ? t.onboarding.iosSteps : []).map((text, i) => {
      const li = document.createElement('li');
      li.innerHTML = IOS_STEP_SVGS[i] ?? '';
      const caption = document.createElement('span');
      caption.className = 'install-step-text';
      caption.textContent = text;
      li.append(caption);
      return li;
    }),
  );
  $('install-note').hidden = platform !== 'ios';
  $('btn-install-later').hidden = platform === 'ios'; // iPhone has nothing to accept: one button closes
  $('btn-install').textContent = platform === 'ios' ? t.gotIt : t.onboarding.installButton;
  state.save.onboarding = recordInstallAsk(state.save.onboarding, state.clock().getTime()); // an ask, whatever the player picks
  writeSave(state.save);
  openLayer($('install'), $('btn-install'), $('btn-play'));
}

/** Strata is on the home screen: the card never asks again (A1). */
function markInstalled(): void {
  state.save.onboarding = recordInstalled(state.save.onboarding);
  writeSave(state.save);
}

/** The card's main button: the browser's install prompt where there is one, else just close. */
async function install(): Promise<void> {
  const prompt = deferred;
  closeLayer($('install'));
  if (!prompt) return;
  deferred = null; // a prompt can be used once
  try {
    await prompt.prompt();
    if ((await prompt.userChoice).outcome === 'accepted') markInstalled();
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

/**
 * Opens what a shared link asks for (O3, D82 R2): today's daily, or a note first when the link's
 * day is over; or the weekly set's chooser over Home. The chooser shows the current week (a set is
 * playable only in its own week, weekly-set.md §3.6).
 */
export function openShared(share: ShareKey): void {
  if ('daily' in share) {
    if (dailyLaunch(share.daily, dailyKey(state.clock)).over) {
      if (!layers.has(homeEl)) showHome(); // at boot Home is already open
      openDailyOver(share.daily);
    } else startDaily();
  } else if ('weekly' in share) {
    if (!layers.has(homeEl)) showHome('today');
    else selectHomeTab('today'); // the weekly set lives on the Today tab (sprint 20)
    openWeekly($('btn-weekly'));
  } else {
    if (!layers.has(homeEl)) showHome();
    openFriend(share.challenge, share.pours);
  }
}

/**
 * The one-time "ready to play offline" toast (O4), unless already shown or storage is blocked.
 * While the install card is open it is remembered without a toast (the card says it already).
 */
export function noticeOffline(): void {
  const what = offlineNotice(state.save.onboarding, saveStored(), !$('install').hidden);
  if (what === 'none') return;
  state.save.onboarding.offlineNoticed = true;
  writeSave(state.save);
  if (what === 'toast') showToast(t.onboarding.offlineReady);
}

/**
 * Listens for sw.js's offline-ready message (O4), sent once its install has cached everything.
 * Call before registering the worker. A page that is already controlled was cached on an
 * earlier visit (sw.js only installs when complete), so it shows the notice too if it was missed.
 */
export function listenForOffline(container: ServiceWorkerContainer): void {
  container.addEventListener('message', (e) => {
    if (!isOfflineReady(e.data)) return;
    noteOfflineReady(); // Settings shows "Works offline" from now on (A3)
    noticeOffline();
  });
  container.startMessages();
  if (container.controller) {
    noteOfflineReady(); // a controlled page was fully cached: sw.js only installs when complete
    noticeOffline();
  }
}

/** Whether the booster line shows on this board: level 1, the first time it is played (O2). */
let boosterHintOn = false;

/**
 * The first time the map opens, a line above Play says what the path is (O2). It stays while
 * the map is open and Play is described by it; later opens do not show it.
 */
export function mapHintOnOpen(): void {
  const hint = $('map-hint');
  const show = !state.save.onboarding.mapHintSeen;
  hint.hidden = !show;
  if (show) {
    $('btn-map-play').setAttribute('aria-describedby', 'map-hint');
    state.save.onboarding.mapHintSeen = true;
    writeSave(state.save);
  } else $('btn-map-play').removeAttribute('aria-describedby');
}

/**
 * Called as a numbered level starts. Level 1 shows the booster line until it is cleared (O2):
 * boot quietly prepares level 1 under Home, so a once-on-start flag would be spent unseen.
 * The flag is recorded once the player is past level 1.
 */
export function boosterHintOnStart(level: number, replay: boolean): void {
  const o = state.save.onboarding;
  boosterHintOn = level === 1 && !replay && state.save.level === 1 && !o.boosterHintSeen;
  if (state.save.level > 1 && !o.boosterHintSeen) {
    o.boosterHintSeen = true;
    writeSave(state.save);
  }
}

/** Whether the board's note above the tools shows the booster line now (read by the HUD). */
export function boosterHintShown(): boolean {
  return boosterHintOn && state.mode === 'level';
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
    markInstalled();
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
