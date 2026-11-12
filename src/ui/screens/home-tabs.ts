/**
 * Home's tab bar and its Today, Collection and Profile tabs (sprint 20 H3, D168, D171, D172;
 * design/ux/home.md). A real tablist: role tablist/tab, aria-selected, a roving tab stop, arrow keys,
 * Home and End. The unlock rules and dots are logic/home-tabs.ts; the streak card is logic/streak-card.ts.
 * Every element that opened a sheet from the old Home keeps its id, so each sheet's own wiring still works.
 */
import { allShells } from '../../core/collection';
import { streakStatus, weekday } from '../../core/daily';
import { type EventsConfig } from '../../core/events';
import { mapAvailable } from '../../core/map';
import { stylesOpen } from '../../core/styles';
import { type TrackConfig, trackOf } from '../../core/streak-track';
import { byIdOr, isOwned } from '../../core/themes';
import { badgeSvg, medalSvg } from '../badge-art';
import { dailyKey } from '../clock';
import { $, homeEl, layers } from '../dom';
import { eventView } from '../logic/event-card';
import { HOME_TABS, type HomeTab, type HomeTabsInput, homeTabs, landingTab, tabDots, tabKey } from '../logic/home-tabs';
import { scenesNewDue } from '../logic/onboarding';
import { type StreakCardView, rewardTitle, streakCard } from '../logic/streak-card';
import { trackSheetRows } from '../logic/streak-track';
import { stylesNewDue } from '../logic/styles-sheet';
import { shellSvg } from '../shells';
import { t } from '../strings';
import { audio, config, state } from '../state';
import { setHeroOnPlay } from './home-hero';
import { trackNames } from './home';
import { openMap } from './map';
import { play, startDaily } from './board';
import { openEvent } from './sheets/event';
import { openEditProfile } from './sheets/edit-profile';
import { openProfile, plateEl, portraitOf } from './sheets/profile';
import { openSettings } from './sheets/settings';
import { openStats } from './sheets/stats';
import { openTransfer } from './sheets/transfer';
import { sceneSwatchEl } from './sheets/scenes';
import { trackArtEl } from './sheets/track';
import type { StylesConfig } from '../../core/styles';

let current: HomeTab = 'play';
let shownTabs: HomeTab[] = [];

const tabEl = (tab: HomeTab) => $<HTMLButtonElement>(`home-tab-${tab}`);
const panelEl = (tab: HomeTab) => $(`home-panel-${tab}`);
const CHECK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/** The tab shown now. */
export function currentHomeTab(): HomeTab {
  return current;
}

/** The unlock rules' input, from the live save. */
function tabsInput(): HomeTabsInput {
  const s = state.save;
  const open = stylesOpen(s.level, s.styles, config);
  const unowned = config.themes.list.filter((th) => th.earned === undefined && !isOwned(th, s.themes.owned)).map((th) => th.price);
  return {
    tutorialDone: s.tutorialDone,
    level: s.level,
    shells: s.shells.length,
    unseenShells: Math.max(0, s.shells.length - s.seenShells),
    badges: s.badges.length,
    scenesOwned: config.themes.list.filter((th) => isOwned(th, s.themes.owned)).length,
    stylesOpen: open,
    scenesNew: scenesNewDue(s.onboarding, s.wallet.coins, unowned),
    stylesNew: stylesNewDue(s.onboarding, open),
  };
}

/** Shows the tabs that hold something, their dots, and the bar (none before the tutorial is done). */
export function renderTabs(): HomeTab[] {
  const input = tabsInput();
  shownTabs = homeTabs(input);
  const dots = tabDots(input);
  $('home-tabbar').hidden = shownTabs.length === 0;
  for (const tab of HOME_TABS) {
    const btn = tabEl(tab);
    btn.hidden = !shownTabs.includes(tab);
    const dot = dots.has(tab) && tab !== current;
    (btn.querySelector('.new-dot') as HTMLElement).hidden = !dot;
    const sr = btn.querySelector('.tab-new') as HTMLElement;
    sr.hidden = !dot;
    sr.textContent = dot ? t.homeScreen.newSr : '';
    const panel = panelEl(tab);
    if (shownTabs.length) {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `home-tab-${tab}`);
    } else {
      panel.removeAttribute('role');
      panel.setAttribute('aria-labelledby', tab === 'play' ? 'home-level' : `home-tab-${tab}`);
    }
  }
  return shownTabs;
}

/**
 * Shows `tab` (Play if it does not show yet): its panel, the header for it, the roving tab stop.
 * With `focus`, focus moves to the tab. The hero runs only on Play.
 */
export function selectHomeTab(wanted: HomeTab, focus = false): HomeTab {
  if (!shownTabs.length) renderTabs();
  const tab = landingTab(wanted, shownTabs);
  const changed = tab !== current;
  current = tab;
  for (const x of HOME_TABS) {
    const on = x === tab;
    tabEl(x).setAttribute('aria-selected', String(on));
    tabEl(x).tabIndex = on ? 0 : -1;
    panelEl(x).hidden = !on;
  }
  const title = $('home-heading');
  title.textContent = tab === 'play' ? '' : t.homeScreen.tabs[tab];
  title.hidden = tab === 'play';
  $('btn-profile').hidden = tab !== 'play' || !state.save.tutorialDone;
  // The gear: on Today and Collection, and on Play until Profile (which holds Settings) shows.
  $('btn-home-settings').hidden = tab === 'profile' || (tab === 'play' && shownTabs.includes('profile'));
  if (tab === 'today') renderTodayPanel();
  if (tab === 'collection') renderCollectionPanel();
  if (tab === 'profile') renderProfilePanel();
  if (changed) $('home-views').scrollTop = 0;
  renderTabs(); // the selected tab's dot hides
  setHeroOnPlay(tab === 'play');
  if (focus) tabEl(tab).focus();
  return tab;
}

/** Draws a track of reward days into `el`: collected ticked, the streak marked, the next highlighted. */
function drawTrack(el: HTMLElement, view: StreakCardView): void {
  const line = document.createElement('span');
  line.className = 'strk-line';
  const fill = document.createElement('i');
  fill.style.width = `${view.marker ?? 0}%`;
  line.append(fill);
  const parts: HTMLElement[] = [line];
  if (view.marker !== null) {
    const here = document.createElement('span');
    here.className = 'strk-here';
    here.style.left = `${view.marker}%`;
    const b = document.createElement('b');
    b.textContent = view.lead;
    here.append(b);
    parts.push(here);
  }
  for (const stop of view.stops) {
    const s = document.createElement('span');
    s.className = `strk-stop ${stop.state}`;
    s.style.left = `${stop.at}%`;
    s.innerHTML = `<i>${stop.state === 'got' ? CHECK : ''}</i><small></small>`;
    s.querySelector('small')!.textContent = String(stop.day);
    parts.push(s);
  }
  el.replaceChildren(...parts);
}

function liveStreak(): number {
  return streakStatus(state.save.daily, dailyKey(state.clock)).current;
}

function cardView(): StreakCardView {
  return streakCard(state.save.track, liveStreak(), trackOf(config as unknown as TrackConfig), trackNames());
}

/** The Play tab's streak reward card (D171): the next reward's picture and name, "Day N · … in K days" and the track. */
export function renderStreakCard(): void {
  const btn = $('btn-track');
  btn.hidden = !state.save.tutorialDone;
  if (btn.hidden) return;
  const view = cardView();
  const art = $('streak-art');
  art.replaceChildren(...(view.reward ? [trackArtEl(view.reward)] : []));
  if (!view.reward) art.innerHTML = CHECK;
  $('streak-title').textContent = view.title;
  $('streak-line').textContent = view.what ? `${view.lead} · ${view.what}` : view.lead;
  $('streak-when').textContent = view.when;
  btn.setAttribute('aria-label', view.label);
  drawTrack($('streak-track'), view);
}

/** The Today tab: the daily, streak rewards, goals (D172), the weekly set and the event. */
export function renderTodayPanel(): void {
  const today = dailyKey(state.clock);
  const status = streakStatus(state.save.daily, today);
  const day = config.daily.week[weekday(today)];
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  $('today-dow').textContent = date.toLocaleDateString('en', { weekday: 'short' });
  $('today-dom').textContent = String(d);
  $('today-daily-title').textContent = t.homeScreen.dailyTitle(date.toLocaleDateString('en', { weekday: 'long' }), day.name);
  const streakLine = status.current > 0 ? t.streakDays(status.current) : t.noStreak;
  $('today-daily-sub').textContent = status.solvedToday ? `${t.dailySolved} · ${streakLine}` : `${t.homeScreen.dailyNotYet} · ${streakLine}`;
  $('btn-today-daily').classList.toggle('solved', status.solvedToday);
  const view = cardView();
  $('home-streak-now').textContent = streakLine;
  const strk = $('home-streak-track');
  drawTrack(strk, view);
  strk.setAttribute('aria-label', view.trackLabel);
  const rows = trackSheetRows(state.save.track, status.current, trackOf(config as unknown as TrackConfig), trackNames());
  $('home-streak-list').replaceChildren(
    ...rows.map((row) => {
      const li = document.createElement('li');
      li.className = row.state;
      const art = document.createElement('span');
      art.className = 'reward-art';
      art.setAttribute('aria-hidden', 'true');
      art.append(trackArtEl(row.step.reward));
      const text = document.createElement('span');
      text.className = 'mini-text';
      // D171: the boosters are titled "Booster pair" and "Booster bundle", with what they hold after the day.
      const boosters = row.step.reward.kind === 'boosters';
      const name = document.createElement('strong');
      name.textContent = rewardTitle(row.step, trackNames());
      const st = document.createElement('span');
      st.className = 'soft';
      st.textContent = boosters ? `${row.status} \u00b7 ${row.name}` : row.status;
      text.append(name, st);
      li.append(art, text);
      if (row.state === 'collected') li.insertAdjacentHTML('beforeend', CHECK.replace('class="ico"', 'class="ico tick"'));
      return li;
    }),
  );
  const passes = state.save.daily.passes;
  $('home-streak-passes').textContent = passes ? t.passes(passes) : '';
  $('home-streak-passes').hidden = !passes;
  const ev = state.save.tutorialDone ? eventView(state.save.events, state.save.badges, today, config as unknown as EventsConfig) : null;
  $('btn-today-event').hidden = !ev;
  if (ev) {
    $('today-event-title').textContent = ev.name;
    $('today-event-sub').textContent = ev.sub;
    $('today-event-days').textContent = ev.days;
    $('today-event-bar').style.width = `${(100 * ev.cleared) / Math.max(1, ev.total)}%`;
  }
}

/** The Collection tab's counts and pictures: shells, badges, jar styles, scenes and the map. */
export function renderCollectionPanel(): void {
  const s = state.save;
  const shells = allShells(config);
  $('shells-label').textContent = t.homeScreen.count(s.shells.length, shells.length);
  const recent = s.shells.slice(-3).map((id) => byIdOr(shells, id));
  $('shell-ico').innerHTML = (recent.length ? recent.map((sh) => shellSvg(sh)) : [shellSvg(shells[0], true)]).map((svg) => `<span>${svg}</span>`).join('');
  $('shells-new').hidden = s.shells.length <= s.seenShells;
  const list = config.badges.list;
  const earned = list.filter((b) => s.badges.includes(b.id));
  $('badges-label').textContent = t.homeScreen.count(earned.length, list.length);
  $('badges-art').innerHTML = (earned.length ? earned.slice(-2).map((b) => badgeSvg(b, config)) : [medalSvg('play', 'jarsSealed', 1)]).map((svg) => `<span>${svg}</span>`).join('');
  const slots = (config as unknown as StylesConfig).styles.slots;
  const pieces = Object.values(slots).reduce((n, l) => n + l.length, 0);
  $('styles-count').textContent = t.homeScreen.count(s.styles.owned.length + Object.keys(slots).length, pieces);
  const themes = config.themes.list;
  const owned = themes.filter((th) => isOwned(th, s.themes.owned));
  const fresh = !$('scenes-new').hidden;
  $('scenes-count').textContent = fresh ? t.homeScreen.countNew(owned.length, themes.length, 1) : t.homeScreen.count(owned.length, themes.length);
  const picks = [byIdOr(themes, s.themes.selected), ...owned.filter((th) => th.id !== s.themes.selected), ...themes.filter((th) => !owned.includes(th))].slice(0, 3);
  $('scenes-art').replaceChildren(...picks.map((th) => sceneSwatchEl(th)));
  $('btn-map-tile').hidden = !mapAvailable(s);
  $('map-tile-sub').textContent = t.homeScreen.mapSub(s.level);
}

/** The settings the Profile tab switches: each drives the Settings sheet's own control, so the rules stay in one place. */
const SWITCHES = ['sound', 'music', 'realistic', 'patterns'] as const;

/** The Profile tab: the player, six stats and Settings. */
export function renderProfilePanel(): void {
  const s = state.save;
  $('me-art').innerHTML = portraitOf(s.profile);
  $('me-name').replaceChildren(plateEl(s.profile.plate, s.profile.name, 'plate-lg'));
  $('me-plate').textContent = `${t.levelBadge} ${s.level}`;
  const stats: [string, string][] = [
    [t.statLabels.levels, String(s.level - 1)],
    [t.statLabels.jarsSealed, s.stats.jarsSealed.toLocaleString('en')],
    [t.statLabels.dailiesSolved, String(s.stats.dailiesSolved)],
    [t.statLabels.bestStreak, String(s.daily.best)],
    [t.statLabels.perfectClears, String(s.stats.perfectClears)],
    [t.statLabels.shells, String(s.shells.length)],
  ];
  $('me-stats').replaceChildren(
    ...stats.map(([label, value]) => {
      const div = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      div.append(dt, dd);
      return div;
    }),
  );
  for (const key of SWITCHES) {
    const input = $<HTMLInputElement>(`set-${key}`);
    const sw = homeEl.querySelector<HTMLButtonElement>(`.hs-switch[data-setting="${key}"]`)!;
    const available = key !== 'realistic' || realisticOk();
    sw.disabled = !available;
    sw.setAttribute('aria-checked', String(available && s.settings[key]));
    if (key === 'realistic') $('me-set-realistic-help').textContent = available ? t.realisticHelp : t.realisticUnavailable;
    input.checked = available && s.settings[key];
  }
  $('btn-me-whatsnew').textContent = t.whatsNew.version;
}

let realisticCheck: (() => boolean) | null = null;
function realisticOk(): boolean {
  return realisticCheck ? realisticCheck() : true;
}

/** Wires the tab bar and the tabs' buttons. `realistic` says whether WebGL can draw Realistic sand. */
export function wireHomeTabs(realistic: () => boolean): void {
  realisticCheck = realistic;
  for (const tab of HOME_TABS) tabEl(tab).addEventListener('click', () => {
    audio.unlock();
    selectHomeTab(tab);
  });
  $('home-tablist').addEventListener('keydown', (e) => {
    const visible = shownTabs;
    const next = tabKey(e.key, visible.indexOf(current), visible.length);
    if (next === null) return;
    e.preventDefault();
    selectHomeTab(visible[next], true);
  });
  $('btn-see-today').addEventListener('click', () => selectHomeTab('today', true));
  $('hero-stage').addEventListener('click', play); // D173: the hero plays, like Play
  $('btn-today-daily').addEventListener('click', startDaily);
  $('btn-today-event').addEventListener('click', () => {
    audio.unlock();
    openEvent($('btn-today-event'));
  });
  $('btn-badges').addEventListener('click', () => {
    audio.unlock();
    openProfile();
    $('badges-title').scrollIntoView({ block: 'start' });
  });
  $('btn-map-tile').addEventListener('click', () => {
    audio.unlock();
    openMap();
  });
  $('btn-edit-me').addEventListener('click', openEditProfile);
  $('btn-save-profile').addEventListener('click', () => window.setTimeout(() => current === 'profile' && renderProfilePanel(), 0));
  $('btn-me-more').addEventListener('click', openProfile);
  $('btn-me-savecode').addEventListener('click', () => openTransfer($('btn-me-savecode')));
  $('btn-me-stats').addEventListener('click', () => openStats($('btn-me-stats')));
  $('btn-me-settings').addEventListener('click', openSettings);
  for (const sw of homeEl.querySelectorAll<HTMLButtonElement>('.hs-switch')) {
    sw.addEventListener('click', () => {
      const input = $<HTMLInputElement>(`set-${sw.dataset.setting}`);
      if (sw.disabled || input.disabled) return;
      input.checked = !input.checked;
      input.dispatchEvent(new Event('change')); // the Settings sheet's own handler saves and applies it
      renderProfilePanel();
    });
  }
  // A sheet closed over a tab (a scene bought, a style worn, a shell seen): its counts and dots catch up.
  const app = $('app');
  new MutationObserver((records) => {
    if (homeEl.hidden || !records.some((r) => r.target.parentElement === app && (r.target as HTMLElement).hidden)) return;
    if (layers.top() !== homeEl) return;
    if (current === 'collection') renderCollectionPanel();
    if (current === 'today') renderTodayPanel();
    if (current === 'profile') renderProfilePanel();
    renderStreakCard();
    renderTabs();
  }).observe(app, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
}
