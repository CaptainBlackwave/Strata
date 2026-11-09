/**
 * The weekly set's Home card and its chooser of five boards (design/gdd/weekly-set.md §3.8), and
 * its Share (§3.9). The rules are the pure core/weekly.ts; this only shows them.
 */
import { type WeeklyState, daysLeft, parseWeek, weekKey, weeklyFor, weeklyPours, weeklyTheme } from '../../../core/weekly';
import { writeSave } from '../../storage';
import { t } from '../../strings';
import { $, closeLayer, openLayer } from '../../dom';
import { type FocusTarget } from '../../layers';
import { startWeekly } from '../board';
import { shareTo } from '../win';
import { shareLink } from '../../logic/launch';
import { audio, config, state } from '../../state';

/** The current week by the app clock (TD-16), on the UTC calendar like the daily (§3.1). */
function currentWeek(): string {
  return weekKey(state.clock());
}

/** A week's theme name, e.g. "Lock and Key" (§3.3). */
export function weeklyThemeName(week: string): string {
  const id = weeklyTheme(week, config).id;
  return t.weekly.themes[id] ?? id;
}

/**
 * The set to show for this week. A later week than the saved one resets the save (§3.6); an earlier
 * one (the clock moved back) shows as not started and leaves the save alone.
 */
function currentSet(): WeeklyState {
  const week = currentWeek();
  const saved = state.save.weekly;
  if (saved.week !== '' && week > saved.week) {
    state.save.weekly = weeklyFor(saved, week);
    writeSave(state.save);
  }
  return weeklyFor(state.save.weekly, week);
}

/** Fills the Home card (§3.8): theme, days left, progress, and five little jars that fill as boards clear. */
export function renderWeeklyCard(): void {
  const btn = $('btn-weekly');
  btn.hidden = !state.save.tutorialDone;
  const set = currentSet();
  const total = config.weekly.boards.length;
  $('weekly-title').textContent = t.weekly.title;
  $('weekly-sub').textContent = t.weekly.cardSub(weeklyThemeName(set.week), t.weekly.daysLeft(daysLeft(set.week, state.clock())));
  $('weekly-progress').textContent = t.weekly.progress(set.cleared.length, total);
  btn.classList.toggle('solved', set.cleared.length >= total);
  [...$('weekly-jars').children].forEach((jar, i) => jar.classList.toggle('on', set.cleared.includes(i)));
}

/** One board's row in the chooser: a button named "Board 2, Cleared · best 31 pours". */
function boardButton(set: WeeklyState, i: number): HTMLLIElement {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.type = 'button';
  const done = set.cleared.includes(i);
  btn.className = `weekly-board${done ? ' cleared' : ''}`;
  btn.dataset.board = String(i);
  const pours = set.pours[String(i)];
  btn.innerHTML = '<span class="weekly-board-jar" aria-hidden="true"></span><span class="weekly-board-text"><b></b><span></span></span>';
  const name = t.weekly.board(i + 1);
  const status = done && pours !== undefined ? t.weekly.boardCleared(pours) : t.weekly.boardOpen;
  btn.querySelector('b')!.textContent = name;
  btn.querySelector('.weekly-board-text > span')!.textContent = status;
  btn.setAttribute('aria-label', `${name}, ${status}`); // one spoken name, "Board 2, Not cleared yet"
  btn.addEventListener('click', () => {
    audio.play('select');
    closeLayer($('weekly'), false);
    startWeekly(set.week, i);
  });
  li.append(btn);
  return li;
}

/**
 * Opens the chooser (§3.8): the week, theme and progress, then the five boards. Focus goes to the
 * first board not cleared (board 1 when all are), and returns to `opener` on close.
 */
export function openWeekly(opener: FocusTarget | null = document.activeElement as HTMLElement | null): void {
  const set = currentSet();
  const total = config.weekly.boards.length;
  $('weekly-sheet-sub').textContent = t.weekly.sheetSub(parseWeek(set.week)?.week ?? 0, weeklyThemeName(set.week), t.weekly.progress(set.cleared.length, total));
  const items = config.weekly.boards.map((_, i) => boardButton(set, i));
  $('weekly-boards').replaceChildren(...items);
  $('btn-weekly-share').hidden = set.cleared.length === 0;
  $('weekly-share-status').textContent = '';
  const first = config.weekly.boards.findIndex((_, i) => !set.cleared.includes(i));
  openLayer($('weekly'), items[Math.max(0, first)].querySelector('button'), opener);
}

/** Shares this set's pours (§3.9) with a link that opens the weekly set (D82), reporting the outcome in `status`. */
export function shareWeekly(status: HTMLElement): Promise<void> {
  const week = state.mode === 'weekly' && state.weeklyWeek ? state.weeklyWeek : currentWeek();
  return shareTo(t.weekly.shareText(week, weeklyThemeName(week), weeklyPours(state.save.weekly, week, config), shareLink(location.href, { weekly: week })), status);
}

/** Wires the Home card, the chooser's Close and its Share. */
export function wireWeekly(): void {
  $('btn-weekly').addEventListener('click', () => {
    audio.unlock();
    openWeekly($('btn-weekly'));
  });
  $('btn-close-weekly').addEventListener('click', () => closeLayer($('weekly')));
  $('btn-weekly-share').addEventListener('click', () => {
    const week = currentWeek();
    void shareTo(t.weekly.shareText(week, weeklyThemeName(week), weeklyPours(state.save.weekly, week, config), shareLink(location.href, { weekly: week })), $('weekly-share-status'));
  });
}
