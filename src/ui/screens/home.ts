/** The Home screen and the What's new card. */
import { applyUpdateIfSafe } from '../update';
import { allShells } from '../../core/collection';
import { streakStatus, weekday } from '../../core/daily';
import { byIdOr, isOwned } from '../../core/themes';
import { type TrackConfig, trackOf } from '../../core/streak-track';
import { type GoalsConfig } from '../../core/goals';
import { goalsCard } from '../logic/goals-card';
import { type TrackNames, nextRewardLine } from '../logic/streak-track';
import { scenesNewDue } from '../logic/onboarding';
import { whatsNewReleases } from '../logic/whats-new';
import { type FocusTarget } from '../layers';
import { shellSvg } from '../shells';
import { writeSave } from '../storage';
import { type WhatsNewRelease, t } from '../strings';
import { $, closeLayer, homeEl, layers, openLayer, winEl } from '../dom';
import { screenIn } from '../fx';
import { renderProfileChip } from './sheets/profile';
import { maybeShowInstall } from './onboarding';
import { renderWeeklyCard } from './sheets/weekly';
import { renderEventCard } from './sheets/event';
import { winterSnow } from '../winter';
import { activeEvent, type EventsConfig } from '../../core/events';
import { EVENT_MUSIC } from '../music';
import { applyStyles, renderStylesButton } from './sheets/styles';
import { dailyKey } from '../clock';
import { audio, config, state } from '../state';

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
  const next = nextRewardLine(state.save.track, status.current, trackOf(config as unknown as TrackConfig), trackNames()); // sprint 16: the next streak reward
  const link = next || t.track.allCollected;
  $('track-link-text').textContent = link;
  $('btn-track').setAttribute('aria-label', t.track.linkLabel(link));
  $('btn-track').hidden = !state.save.tutorialDone; // 0.15.1: opens the track sheet, never the daily
  renderWeeklyCard(); // sprint 11 W2: the weekly set's card, under the daily
  renderEventCard(today); // sprint 17: a seasonal event's card, while one runs
  const running = activeEvent(today, config as unknown as EventsConfig)?.event.id ?? null;
  audio.setEvent(running && EVENT_MUSIC[running] ? running : null); // sprint 18 W1: Winter Tide's music while it runs
  renderGoalsCard(today); // sprint 16: today's goals, under the weekly card
  const total = allShells(config).length;
  $('shells-label').textContent = t.shellCount(state.save.shells.length, total);
  const last = byIdOr(allShells(config), state.save.shells.at(-1) ?? '');
  $('shell-ico').innerHTML = shellSvg(last, state.save.shells.length === 0);
  $('btn-shells').hidden = !state.save.tutorialDone;
  $('btn-scenes').hidden = !state.save.tutorialDone;
  renderScenesMark();
  renderStylesButton(); // sprint 12: from level 60 (jar-styles.md §3.2)
  applyStyles(); // after a save reload or import too
  renderProfileChip();
  openLayer(homeEl, $('btn-play'), null);
  winterSnow('home', running); // sprint 18 W1: light snow behind Home while Winter Tide runs
  if (arriving) screenIn(homeEl); // a short cross-fade over the board (sprint 10 F5)
  maybeShowInstall(); // once, after a few levels, never on the first visit (O1, D78)
  applyUpdateIfSafe(); // a new release that took over while a board was in play loads now
}

/** Names for the streak track's words, from the config: frames, plates and scenes by id. */
export function trackNames(): TrackNames {
  const name = (list: readonly { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? id;
  return {
    frame: (id) => name(config.profile.frames, id),
    plate: (id) => name(config.profile.plates, id),
    scene: (id) => name(config.themes.list, id),
  };
}

/**
 * Fills Home's "Today's goals" card (sprint 16, D137): each goal with its progress ("12/25") or a
 * tick, and the bonus line. Hidden until the tutorial is done. A save for another day shows zeros.
 */
export function renderGoalsCard(today: string): void {
  const el = $('goals-card');
  el.hidden = !state.save.tutorialDone;
  if (el.hidden) return;
  const card = goalsCard(state.save.goals, today, config as unknown as GoalsConfig);
  $('goals-title').textContent = t.goals.title;
  $('goals-list').replaceChildren(
    ...card.rows.map((row) => {
      const li = document.createElement('li');
      li.className = row.done ? 'goal-row done' : 'goal-row';
      const text = document.createElement('span');
      text.className = 'goal-text';
      text.textContent = row.text;
      const prog = document.createElement('span');
      prog.className = 'goal-progress';
      if (row.done) {
        const tick = document.createElement('span');
        tick.setAttribute('aria-hidden', 'true');
        tick.textContent = '\u2713';
        const sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = t.goals.done;
        prog.append(tick, sr);
      } else prog.textContent = row.progress;
      li.append(text, prog);
      return li;
    }),
  );
  $('goals-foot').textContent = card.foot;
  el.classList.toggle('solved', card.allDone);
}

/**
 * The quiet "New" mark on Scenes (D82 R4): shown from the first Home where the cheapest scene not
 * owned is affordable, until the player opens Scenes once.
 */
export function renderScenesMark(): void {
  const unowned = config.themes.list.filter((th) => th.earned === undefined && !isOwned(th, state.save.themes.owned)).map((th) => th.price); // streak-only scenes are never for sale
  $('scenes-new').hidden = !scenesNewDue(state.save.onboarding, state.save.wallet.coins, unowned);
}

/** One posting: its version heading (with a "Latest" mark on the newest), its name and its lines. */
function releaseEl(release: WhatsNewRelease, latest: boolean): HTMLElement {
  const section = document.createElement('section');
  section.className = latest ? 'whatsnew-release latest' : 'whatsnew-release';
  const head = document.createElement('h3');
  head.className = 'whatsnew-version';
  head.id = `whatsnew-v-${release.version.replace(/\W/g, '-')}`;
  const label = document.createElement('span');
  label.textContent = t.whatsNew.versionLabel(release.version);
  head.append(label);
  if (latest) {
    const mark = document.createElement('span');
    mark.className = 'new-mark';
    mark.textContent = t.whatsNew.latest;
    head.append(' ', mark);
  }
  section.setAttribute('aria-labelledby', head.id);
  const name = document.createElement('p');
  name.className = 'whatsnew-name';
  name.textContent = release.name;
  const list = document.createElement('ul');
  list.className = 'whatsnew-list';
  list.append(
    ...release.lines.map((line) => {
      const li = document.createElement('li');
      li.textContent = line;
      return li;
    }),
  );
  section.append(head, name, list);
  return section;
}

/**
 * Shows "What's new" (D46, D52) and records that this version has been seen. With `all` (Settings)
 * it is the whole changelog, newest first; without it (once on Home after an update) it is only the
 * newest posting. Focus goes to its button and returns to `opener` on close.
 */
export function openWhatsNew(opener: FocusTarget | null = document.activeElement as HTMLElement | null, all = false): void {
  const log = $('whatsnew-log');
  log.replaceChildren(...whatsNewReleases(t.whatsNew.releases, all).map((release, i) => releaseEl(release, i === 0)));
  log.classList.toggle('all', all);
  log.scrollTop = 0;
  if (state.save.seenWhatsNew !== t.whatsNew.version) {
    state.save.seenWhatsNew = t.whatsNew.version;
    writeSave(state.save);
  }
  openLayer($('whatsnew'), $('btn-whatsnew-ok'), opener);
}

/** Wires the What's new card's buttons. */
export function wireHome(): void {
  $('btn-whatsnew').addEventListener('click', () => openWhatsNew(undefined, true)); // Settings: the whole changelog
  $('btn-whatsnew-ok').addEventListener('click', () => closeLayer($('whatsnew')));
}
