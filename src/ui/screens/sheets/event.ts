/**
 * A seasonal event's Home card and its chooser of boards (sprint 17, D141-D147; design/gdd/events.md).
 * The rules are the pure core/events.ts; the words and states are logic/event-card.ts.
 */
import { type EventsConfig } from '../../../core/events';
import { eventView } from '../../logic/event-card';
import { dailyKey } from '../../clock';
import { type FocusTarget } from '../../layers';
import { $, closeLayer, openLayer } from '../../dom';
import { startEvent } from '../board';
import { audio, config, state } from '../../state';

/** The view for today by the app clock (UTC, like the daily), or null when no event runs. */
function todayView() {
  return eventView(state.save.events, state.save.badges, dailyKey(state.clock), config as unknown as EventsConfig);
}

/** Fills Home's card: shown only while an event runs and after the tutorial. */
export function renderEventCard(today: string): void {
  const btn = $('btn-event');
  const v = state.save.tutorialDone ? eventView(state.save.events, state.save.badges, today, config as unknown as EventsConfig) : null;
  btn.hidden = !v;
  if (!v) return;
  $('event-title').textContent = v.name;
  $('event-sub').textContent = v.sub;
  $('event-days').textContent = v.days;
  btn.classList.toggle('solved', v.cleared >= v.total);
}

/**
 * Opens the chooser: the days left and progress, the prize line, then every board (open, cleared with
 * its best pours, or locked until its day). Focus goes to the first open board not cleared and returns
 * to `opener` on close. Nothing opens when no event runs (the clock passed the end).
 */
export function openEvent(opener: FocusTarget | null = document.activeElement as HTMLElement | null): void {
  const v = todayView();
  if (!v) return;
  $('event-sheet-title').textContent = v.name;
  $('event-sheet-sub').textContent = `${v.sub} · ${v.days}`;
  $('event-prize').textContent = v.prize;
  $('event-prize').classList.toggle('done', v.prizeCollected);
  const items = v.boards.map((b) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `event-board ${b.state}`;
    btn.dataset.board = String(b.n);
    btn.setAttribute('aria-label', b.label);
    btn.innerHTML = '<b aria-hidden="true"></b><span aria-hidden="true"></span>';
    btn.querySelector('b')!.textContent = String(b.n);
    btn.querySelector('span')!.textContent = b.status;
    if (b.state === 'locked') {
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
    } else
      btn.addEventListener('click', () => {
        audio.play('select');
        closeLayer($('event'), false);
        startEvent(v.event.id, v.year, b.n);
      });
    li.append(btn);
    return li;
  });
  $('event-boards').replaceChildren(...items);
  openLayer($('event'), items[v.focus - 1]?.querySelector('button') ?? null, opener);
}

/** Wires Home's card and the chooser's Close. */
export function wireEvent(): void {
  $('btn-event').addEventListener('click', () => {
    audio.unlock();
    openEvent($('btn-event'));
  });
  $('btn-close-event').addEventListener('click', () => closeLayer($('event')));
}
