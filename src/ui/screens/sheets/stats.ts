/**
 * The "Your stats" sheet (sprint 18 S1, D150): a player's progress, today, boosters and coins, and
 * the game version and device, shown and copied as plain text to send with feedback. Nothing is
 * sent automatically. The text is built by the pure logic/stats-sheet.ts.
 */
import { streakStatus } from '../../../core/daily';
import { activeEvent, type EventsConfig } from '../../../core/events';
import type { GoalsConfig } from '../../../core/goals';
import { type StatsInput, browserName, statsSections, statsText } from '../../logic/stats-sheet';
import { dailyKey } from '../../clock';
import { type FocusTarget } from '../../layers';
import { WHATS_NEW_VERSION, t } from '../../strings';
import { $, closeLayer, openLayer } from '../../dom';
import { audio, config, state } from '../../state';

/** The sheet's input, read from the save, the clock and the device. */
function inputNow(): StatsInput {
  const today = dailyKey(state.clock);
  const s = state.save;
  const run = activeEvent(today, config as unknown as EventsConfig);
  const progress = run ? s.events[run.event.id] : undefined;
  return {
    version: WHATS_NEW_VERSION,
    level: s.level,
    streak: streakStatus(s.daily, today).current,
    bestStreak: s.daily.best,
    stats: s.stats,
    shells: s.shells.length,
    badges: s.badges.length,
    goalsDone: s.goals.date === today ? s.goals.done.length : 0,
    goalsTotal: (config as unknown as GoalsConfig).goals.perDay,
    dailySolvedToday: s.daily.last === today,
    event: run ? { name: t.event.names[run.event.id] ?? run.event.id, cleared: progress && progress.year === run.year ? progress.cleared.length : 0, total: run.event.boards } : null,
    coins: s.wallet.coins,
    browser: browserName(navigator.userAgent),
    screen: { width: window.screen.width, height: window.screen.height, ratio: Math.round((window.devicePixelRatio || 1) * 100) / 100 },
    today,
  };
}

/** Fills the sheet: a heading and label/value rows per section. */
function render(): void {
  const sections = statsSections(inputNow(), t.stats.labels);
  $('stats-list').replaceChildren(
    ...sections.map((sec) => {
      const box = document.createElement('section');
      const h = document.createElement('h3');
      h.textContent = sec.heading;
      const dl = document.createElement('dl');
      for (const r of sec.rows) {
        const dt = document.createElement('dt');
        dt.textContent = r.label;
        const dd = document.createElement('dd');
        dd.textContent = r.value;
        dl.append(dt, dd);
      }
      box.append(h, dl);
      return box;
    }),
  );
  $('stats-status').textContent = '';
}

/** Copies the text, saying whether it worked; when the clipboard is blocked the list stays selectable. */
async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(statsText(inputNow(), t.stats.labels));
    $('stats-status').textContent = t.stats.copied;
  } catch {
    $('stats-status').textContent = t.stats.copyFailed;
    const range = document.createRange();
    range.selectNodeContents($('stats-list'));
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }
}

/** Opens the sheet over Settings; focus goes to Copy and returns to `opener`. */
export function openStats(opener: FocusTarget | null = document.activeElement as HTMLElement | null): void {
  render();
  openLayer($('stats'), $('btn-copy-stats'), opener);
}

/** Wires the Settings button, Copy and Close. */
export function wireStats(): void {
  $('btn-stats').addEventListener('click', () => {
    audio.play('select');
    openStats($('btn-stats'));
  });
  $('btn-copy-stats').addEventListener('click', () => void copy());
  $('btn-close-stats').addEventListener('click', () => closeLayer($('stats')));
}
