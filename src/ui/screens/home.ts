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
import { whatsNewDue, writeSave } from '../storage';
import { type WhatsNewRelease, t } from '../strings';
import { $, closeLayer, homeEl, layers, openLayer, winEl } from '../dom';
import { screenIn } from '../fx';
import { renderProfileChip } from './sheets/profile';
import { maybeShowInstall } from './onboarding';
import { renderWeeklyCard } from './sheets/weekly';
import { openEvent, renderEventCard } from './sheets/event';
import { winterSnow } from '../winter';
import { newTideSparkles } from '../sparkles';
import { activeEvent, type EventsConfig, startCardDue } from '../../core/events';
import { type GiftsConfig, applyGift, dueGift, giveGift } from '../../core/gifts';
import { type HomeNotice, homeNotice } from '../logic/event-card';
import { type StyleSlot } from '../../core/styles';
import { styleSwatchEl } from './sheets/styles';
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
  const notice = prepareNotice(dailyKey(state.clock)); // sprint 31: the gift is granted here, before the coins show
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
  newTideSparkles('home', running === 'newtide'); // sprint 31 (D240): a few sparkles while New Tide runs
  $('home-garland').hidden = running !== 'wintertide'; // sprint 31 (D241): the garland while Winter Tide runs
  if (notice) queueNotice(notice);
  if (arriving) screenIn(homeEl); // a short cross-fade over the board (sprint 10 F5)
  maybeShowInstall(); // after the 5th clear, at most twice, a week apart (O1, A1 D179)
  applyUpdateIfSafe(); // A3: the update bar for a release that took over while away, or the silent fallback
}

/** A Home card waiting to open, and the one open now (sprint 31). */
let pendingNotice: HomeNotice | null = null;
let noticeShown: HomeNotice | null = null;

/**
 * The one card Home shows now (events.md §3.9-§3.10, D238, D242), after the tutorial: the Christmas
 * gift first, else an event's start card. A due gift is granted and saved here, when the card is
 * due, so closing the app before tapping still keeps it; a start card the gift displaced is marked
 * seen for its year. A start card is marked seen when it opens ({@link showPendingNotice}).
 */
function prepareNotice(today: string): HomeNotice | null {
  const due = state.save.tutorialDone ? dueGift(today, (config as unknown as Partial<GiftsConfig>).gifts, state.save.gifts) : null;
  const start = startCardDue(today, config as unknown as EventsConfig, state.save.startCards);
  const plan = homeNotice(state.save.tutorialDone, due?.gift.id ?? null, start ? { id: start.event.id, year: start.year } : null);
  if (!plan.show) return null;
  if (due && plan.show.kind === 'gift') {
    const grant = giveGift(due.gift, due.year, state.save.gifts, state.save.styles.owned);
    state.save = applyGift(state.save, grant);
    giftPiece = grant.style;
  }
  if (plan.markSeen) state.save.startCards = { ...state.save.startCards, [plan.markSeen.id]: plan.markSeen.year };
  if (plan.show.kind === 'gift' || plan.markSeen) writeSave(state.save);
  return plan.show;
}

/** The jar piece the last gift granted (`slot:id`), or null when it was already owned (coins and hint only). */
let giftPiece: string | null = null;

/** Opens `notice` once Home is on top, after anything opened over it on arrival (What's new, a shared link). */
function queueNotice(notice: HomeNotice): void {
  pendingNotice = notice;
  window.setTimeout(showPendingNotice, 0);
}

/** Opens the waiting card when Home is on top and What's new is not due. A start card counts as seen once shown. */
function showPendingNotice(): void {
  const notice = pendingNotice;
  if (!notice || layers.top() !== homeEl || whatsNewDue(state.save)) return;
  pendingNotice = null;
  noticeShown = notice;
  const art = $('notice-art');
  const later = $('btn-notice-later');
  if (notice.kind === 'gift') {
    const words = notice.id === 'christmas' ? t.gift.christmas : { title: '', text: '' };
    $('notice-title').textContent = words.title;
    $('notice-text').textContent = giftPiece ? words.text : (t.gift.owned[notice.id] ?? words.text);
    $('btn-notice-ok').textContent = t.gift.claim;
    later.hidden = true;
    const [slot, id] = (giftPiece ?? '').split(':') as [StyleSlot, string];
    art.replaceChildren(...(giftPiece ? [styleSwatchEl(slot, id)] : []));
    art.hidden = !giftPiece;
    audio.play('unlock');
  } else {
    const words = t.event.start[notice.id] ?? { title: t.event.names[notice.id] ?? notice.id, text: '' };
    $('notice-title').textContent = words.title;
    $('notice-text').textContent = words.text;
    $('btn-notice-ok').textContent = t.event.startPlay;
    later.hidden = false;
    art.replaceChildren();
    art.hidden = true;
    state.save.startCards = { ...state.save.startCards, [notice.id]: notice.year }; // shown counts as seen (D242)
    writeSave(state.save);
  }
  openLayer($('home-notice'), $('btn-notice-ok'), $('btn-play'));
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

/** Wires the What's new card's buttons, the gift and start card, and Home's tabs. */
export function wireHome(): void {
  $('btn-whatsnew').addEventListener('click', () => openWhatsNew(undefined, true)); // Settings: the whole changelog
  $('btn-me-whatsnew').addEventListener('click', () => openWhatsNew($('btn-me-whatsnew'), true)); // the Profile tab
  $('btn-whatsnew-ok').addEventListener('click', () => {
    closeLayer($('whatsnew'));
    showPendingNotice(); // a gift or start card waiting behind What's new (one card at a time)
  });
  $('btn-notice-later').addEventListener('click', () => closeLayer($('home-notice')));
  $('btn-notice-ok').addEventListener('click', () => {
    const shown = noticeShown;
    closeLayer($('home-notice'), shown?.kind !== 'start');
    if (shown?.kind === 'start') {
      audio.unlock();
      audio.play('select');
      openEvent($('btn-play')); // Play: the event's chooser (D242)
    }
  });
  wireHomeTabs(realisticAvailable);
}
