/** Boot: static labels, the repaired save, wiring every screen, the first screen. main.ts only calls boot(). */
import { knownShells } from '../core/collection';
import { type BoosterId } from '../core/economy';
import { launchLevel } from '../core/levels';
import { DICE_SVG } from './avatars';
import { whatsNewDue, writeSave } from './storage';
import { dailyLaunch, parseLaunch } from './logic/launch';
import { dailyKey } from './clock';
import { t } from './strings';
import { $, toolButtons } from './dom';
import { assistsOnMainThread, prefetcher, startDaily, startLevel, startTutorial, wireBoard } from './screens/board';
import { openWhatsNew, showHome, wireHome } from './screens/home';
import { wireOtherTab } from './screens/other-tab';
import { countThisVisit, openDailyOver, wireOnboarding } from './screens/onboarding';
import { wireKeys } from './screens/keys';
import { wireMap } from './screens/map';
import { wireCabinet } from './screens/sheets/cabinet';
import { wireEditProfile } from './screens/sheets/edit-profile';
import { wireGuide } from './screens/sheets/guide';
import { repairSaveProfile, wireProfile } from './screens/sheets/profile';
import { wireScenes } from './screens/sheets/scenes';
import { wireSettings } from './screens/sheets/settings';
import { wireTransfer } from './screens/sheets/transfer';
import { wireWin } from './screens/win';
import { BOOSTER_NAMES, config, state } from './state';
import { applyTheme, currentTheme } from './theme';

/** Reads a string from the table by key, with `a.b` for nested groups. Undefined if absent or not a string. */
function stringFor(key: string | undefined): string | undefined {
  const v = (key ?? '').split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], t);
  return typeof v === 'string' ? v : undefined;
}

/**
 * Fills the static labels. index.html names the key on each element: `data-s` sets the text,
 * `data-s-title` the title, `data-s-label` the aria-label (tests/unit/ui/index-strings.test.ts
 * checks every key exists). Only what needs code stays here.
 */
function applyStrings(): void {
  for (const btn of toolButtons) (btn.querySelector('.tool-name') as HTMLElement).textContent = BOOSTER_NAMES[btn.dataset.booster as BoosterId];
  for (const el of document.querySelectorAll<HTMLElement>('[data-s]')) el.textContent = stringFor(el.dataset.s) ?? el.textContent;
  for (const el of document.querySelectorAll<HTMLElement>('[data-s-title]')) el.title = stringFor(el.dataset.sTitle) ?? el.title;
  for (const el of document.querySelectorAll<HTMLElement>('[data-s-label]')) el.setAttribute('aria-label', stringFor(el.dataset.sLabel) ?? '');
  for (const el of document.querySelectorAll<HTMLElement>('.coins-sr')) el.textContent = ` ${t.coins}`; // UX-home-2
  $('btn-reroll').innerHTML = DICE_SVG;
}

/** Starts Strata: fills the labels, repairs the save, wires every screen, then shows Home (or the QA level). */
export function boot(): void {
  const launch = parseLaunch(location.search); // ?level=N (QA, D3), ?daily=YYYY-MM-DD (O3), ?weekly= (parsed only, D77)
  applyStrings();
  state.save.shells = knownShells(state.save.shells, config); // D26: before the profile repair counts them
  repairSaveProfile();
  countThisVisit(); // O1: the install card never shows on the first visit
  writeSave(state.save);
  applyTheme(currentTheme());
  window.setInterval(() => {
    if ($('scenes').hidden) applyTheme(currentTheme()); // follow the clock in auto mode
  }, 60_000);
  wireAll();
  if (launch.kind === 'level') {
    state.level = launchLevel(launch.level, state.save.level); // replay only, never beyond progress (D3)
    assistsOnMainThread(); // QA route: Hint and Shuffle stay synchronous, so a scripted check sees them at once (TD-13)
    startLevel(state.level);
  } else {
    // P4: the home screen covers the board, so the first board is made in the worker while
    // the player looks at home, then the next one. Without a worker this is synchronous as before.
    prefetcher.request([state.level, state.level + 1]);
    startLevel(state.level, true);
    showHome();
    if (launch.kind !== 'none') history.replaceState(history.state, '', location.pathname + location.hash); // a reload or the installed app opens Home
    if (launch.kind === 'daily' && state.save.tutorialDone) openSharedDaily(launch.date);
    else if (whatsNewDue(state.save)) openWhatsNew($('btn-play')); // once per version, never on a first install (D52)
    // A new player's daily link opens Home: the tutorial comes first, and the daily card appears after it.
    // A weekly link opens Home until the weekly set (D77, W2) is built.
  }
  registerServiceWorker();
}

/** A shared `?daily=` link (O3): today's daily at once, or a note first when the link's day is over. */
function openSharedDaily(date: string): void {
  if (dailyLaunch(date, dailyKey(state.clock)).over) openDailyOver(date);
  else startDaily();
}

/** Each screen wires its own buttons. */
function wireAll(): void {
  wireBoard();
  wireHome();
  wireMap();
  wireScenes();
  wireCabinet();
  wireProfile();
  wireEditProfile();
  wireWin();
  wireSettings({ home: showHome, tutorial: startTutorial });
  wireTransfer();
  wireGuide();
  wireOnboarding();
  wireKeys();
  wireOtherTab(); // last: a newer tab may make this one yield at once (D57)
}

/** Offline install (sprint 3, T8). */
function registerServiceWorker(): void {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        /* offline support unavailable; the game still works online */
      });
    });
  }
}
