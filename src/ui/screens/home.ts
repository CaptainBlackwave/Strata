/** The Home screen and the What's new card. */
import { allShells } from '../../core/collection';
import { streakStatus, weekday } from '../../core/daily';
import { byIdOr, isOwned } from '../../core/themes';
import { scenesNewDue } from '../logic/onboarding';
import { type FocusTarget } from '../layers';
import { shellSvg } from '../shells';
import { writeSave } from '../storage';
import { t } from '../strings';
import { $, closeLayer, homeEl, layers, openLayer, winEl } from '../dom';
import { screenIn } from '../fx';
import { renderProfileChip } from './sheets/profile';
import { maybeShowInstall } from './onboarding';
import { renderWeeklyCard } from './sheets/weekly';
import { dailyKey } from '../clock';
import { config, state } from '../state';

export function showHome(): void {
  const arriving = !layers.has(homeEl);
  closeLayer(winEl, false);
  $('home-coins').textContent = String(state.save.wallet.coins);
  $('btn-play').textContent = state.save.tutorialDone ? t.play(state.save.level) : t.playTutorial;
  const today = dailyKey(state.clock); // the daily follows UTC (design/gdd/daily-puzzle.md, M4)
  const day = config.daily.week[weekday(today)];
  const status = streakStatus(state.save.daily, today);
  const [y, m, d] = today.split('-').map(Number);
  $('daily-dow').textContent = new Date(y, m - 1, d).toLocaleDateString('en', { weekday: 'short' });
  $('daily-dom').textContent = String(d);
  $('daily-date-sr').textContent = t.dailyDate(new Date(y, m - 1, d).toLocaleDateString('en', { weekday: 'long' }), d); // UX-home-3
  $('daily-title').textContent = t.daily;
  $('daily-sub').textContent = status.solvedToday ? t.dailySolved : t.dailyNew(day.name);
  $('daily-streak').textContent = status.passAtRisk ? t.passAtRisk : status.current > 0 ? `${t.streakDays(status.current)}${state.save.daily.passes ? ` · ${t.passes(state.save.daily.passes)}` : ''}` : t.noStreak;
  $('btn-daily').classList.toggle('solved', status.solvedToday);
  $('btn-daily').hidden = !state.save.tutorialDone;
  renderWeeklyCard(); // sprint 11 W2: the weekly set's card, under the daily
  const total = allShells(config).length;
  $('shells-label').textContent = t.shellCount(state.save.shells.length, total);
  const last = byIdOr(allShells(config), state.save.shells.at(-1) ?? '');
  $('shell-ico').innerHTML = shellSvg(last, state.save.shells.length === 0);
  $('btn-shells').hidden = !state.save.tutorialDone;
  $('btn-scenes').hidden = !state.save.tutorialDone;
  renderScenesMark();
  renderProfileChip();
  openLayer(homeEl, $('btn-play'), null);
  if (arriving) screenIn(homeEl); // a short cross-fade over the board (sprint 10 F5)
  maybeShowInstall(); // once, after a few levels, never on the first visit (O1, D78)
}

/**
 * The quiet "New" mark on Scenes (D82 R4): shown from the first Home where the cheapest scene not
 * owned is affordable, until the player opens Scenes once.
 */
export function renderScenesMark(): void {
  const unowned = config.themes.list.filter((th) => !isOwned(th, state.save.themes.owned)).map((th) => th.price);
  $('scenes-new').hidden = !scenesNewDue(state.save.onboarding, state.save.wallet.coins, unowned);
}

/**
 * Shows the "What's new" card (D46, D52) and records that this version has been seen.
 * Focus goes to its button and returns to `opener` on close.
 */
export function openWhatsNew(opener: FocusTarget | null = document.activeElement as HTMLElement | null): void {
  $('whatsnew-list').replaceChildren(
    ...t.whatsNew.lines.map((line) => {
      const li = document.createElement('li');
      li.textContent = line;
      return li;
    }),
  );
  if (state.save.seenWhatsNew !== t.whatsNew.version) {
    state.save.seenWhatsNew = t.whatsNew.version;
    writeSave(state.save);
  }
  openLayer($('whatsnew'), $('btn-whatsnew-ok'), opener);
}

/** Wires the What's new card's buttons. */
export function wireHome(): void {
  $('btn-whatsnew').addEventListener('click', () => openWhatsNew());
  $('btn-whatsnew-ok').addEventListener('click', () => closeLayer($('whatsnew')));
}
