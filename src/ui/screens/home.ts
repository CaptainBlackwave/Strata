/**
 * The Home screen (sprint 20, D166-D172; design/ux/home.md) and the What's new card. Home is a hero
 * of live sand with the level and one Play, the Today strip under it, and a bottom tab bar (Play,
 * Today, Collection, Profile) once the tutorial is done. The tabs are screens/home-tabs.ts and the
 * hero screens/home-hero.ts.
 */
import { applyUpdateIfSafe } from '../update';
import { streakStatus, weekday } from '../../core/daily';
import { isOwned } from '../../core/themes';
import { type GoalsConfig } from '../../core/goals';
import { goalsCard } from '../logic/goals-card';
import { type TrackNames } from '../logic/streak-track';
import { type HomeTab, landingTab } from '../logic/home-tabs';
import { scenesNewDue } from '../logic/onboarding';
import { whatsNewReleases } from '../logic/whats-new';
import { type FocusTarget } from '../layers';
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
import { realisticAvailable } from '../board-gpu/hooks';
import { audio, config, state } from '../state';
import { currentHomeTab, renderCollectionPanel, renderStreakCard, renderTabs, selectHomeTab, wireHomeTabs } from './home-tabs';
import { renderHero } from './home-hero';

/**
 * Shows Home and fills it from the save. Arriving from the board it lands on Play (or `tab`, if it
 * shows yet); refreshed while open it keeps the tab shown. Focus goes to Play, or to the tab.
 */
export function showHome(tab?: HomeTab): void {
  const arriving = !layers.has(homeEl);
  closeLayer(winEl, false);
  const done = state.save.tutorialDone;
  $('home-coins').textContent = String(state.save.wallet.coins);
  $('btn-play').textContent = t.playTutorial;
  $('home-level').textContent = done ? t.level(state.save.level) : t.brand;
  const eyebrow = $('home-eyebrow');
  eyebrow.textContent = done ? t.homeScreen.eyebrow : t.tagline;
  eyebrow.classList.toggle('intro', !done);
  $('btn-play').setAttribute('aria-describedby', 'home-level');
  $('today-strip').hidden = !done;
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
  $('btn-daily').hidden = !done;
  renderStreakCard(); // D171: the next streak reward and its track (opens the track sheet)
  renderWeeklyCard(); // sprint 11 W2: on the Today tab
  renderEventCard(today); // sprint 17: a seasonal event's card, while one runs
  const running = activeEvent(today, config as unknown as EventsConfig)?.event.id ?? null;
  audio.setEvent(running && EVENT_MUSIC[running] ? running : null); // sprint 18 W1: Winter Tide's music while it runs
  renderGoalsCard(today); // D172: today's goals, on the Today tab
  $('btn-shells').hidden = !done;
  $('btn-scenes').hidden = !done;
  renderScenesMark();
  renderStylesButton(); // sprint 12: from level 60 (jar-styles.md §3.2)
  renderCollectionPanel();
  applyStyles(); // after a save reload or import too
  renderProfileChip();
  renderTabs();
  const shown = selectHomeTab(landingTab(tab ?? (arriving ? 'play' : currentHomeTab()), renderTabs()));
  openLayer(homeEl, shown === 'play' ? $('btn-play') : $(`home-tab-${shown}`), null);
  renderHero(); // sprint 20 H2: the live sand scene, or its still
  winterSnow('home', running); // sprint 18 W1: light snow behind Home while Winter Tide runs
  if (arriving) screenIn(homeEl); // a short cross-fade over the board (sprint 10 F5)
  maybeShowInstall(); // after the 5th clear, at most twice, a week apart (O1, A1 D179)
  applyUpdateIfSafe(); // A3: the update bar for a release that took over while away, or the silent fallback
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
 * Fills the "Today's goals" card on the Today tab (sprint 16, D137; D172): each goal with a bar and
 * its progress ("12/25") or a tick, and the bonus line. Hidden until the tutorial is done.
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
      const bar = document.createElement('span');
      bar.className = 'bar';
      bar.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('i');
      fill.style.width = `${Math.min(100, (100 * row.have) / Math.max(1, row.target))}%`;
      bar.append(fill);
      const prog = document.createElement('span');
      prog.className = 'goal-progress';
      if (row.done) {
        const tick = document.createElement('span');
        tick.setAttribute('aria-hidden', 'true');
        tick.textContent = '✓';
        const sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = t.goals.done;
        prog.append(tick, sr);
      } else prog.textContent = row.progress;
      li.append(text, bar, prog);
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
 * Shows "What's new" (D46, D52) and records that this version has been seen. With `all` (Settings,
 * Profile) it is the whole changelog, newest first; without it (once on Home after an update) it is
 * only the newest posting. Focus goes to its button and returns to `opener` on close.
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

/** Wires the What's new card's buttons and Home's tabs. */
export function wireHome(): void {
  $('btn-whatsnew').addEventListener('click', () => openWhatsNew(undefined, true)); // Settings: the whole changelog
  $('btn-me-whatsnew').addEventListener('click', () => openWhatsNew($('btn-me-whatsnew'), true)); // the Profile tab
  $('btn-whatsnew-ok').addEventListener('click', () => closeLayer($('whatsnew')));
  wireHomeTabs(realisticAvailable);
}
