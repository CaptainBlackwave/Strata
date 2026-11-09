/** The profile card, the avatar and plate helpers every screen uses, and the progress that unlocks are measured against (design/gdd/player-profile.md). */
import { allShells, setProgress } from '../../../core/collection';
import { streakStatus } from '../../../core/daily';
import { byIdOr, isOwned } from '../../../core/themes';
import { type Profile, type Progress, STAT_KEYS, generateName, progressOf, repairProfile } from '../../../core/profile';
import { STAT_ICONS, portraitSvg } from '../../avatars';
import { t } from '../../strings';
import { $, closeLayer, openLayer } from '../../dom';
import { dailyKey } from '../../clock';
import { config, state } from '../../state';
import { backfillSaveBadges, renderBadgeShelf } from './badges';

/** The progress values unlocks are measured against, from the live save. */
export function progressNow(): Progress {
  return progressOf({
    level: state.save.level,
    bestStreak: state.save.daily.best,
    shellsOwned: state.save.shells.length,
    setsCompleted: setProgress(state.save.shells, config).filter((p) => p.complete).length,
    stats: state.save.stats,
  });
}

/**
 * Makes the saved profile safe to show: a valid name, and only known, unlocked picks. Runs after
 * every load (start-up, import, another tab's save), so it also back-fills the badges already
 * earned, quietly (badges.md §3.5).
 */
export function repairSaveProfile(): void {
  state.save.profile = repairProfile(state.save.profile, config, progressNow(), () => generateName(state.rng, t.nameWords));
  backfillSaveBadges();
}

export function avatarOf(id: string) {
  return byIdOr(config.profile.avatars, id);
}

export function plateOf(id: string) {
  return byIdOr(config.profile.plates, id);
}

/** An avatar in its frame, as SVG markup. */
export function portraitOf(p: Pick<Profile, 'avatar' | 'frame'>): string {
  return portraitSvg(avatarOf(p.avatar), p.frame);
}

/** A name on its plate. The name is set as text, never as markup (it can be typed by the player). */
export function plateEl(plateId: string, name: string, extra = ''): HTMLElement {
  const plate = plateOf(plateId);
  const el = document.createElement('span');
  el.className = `plate${extra ? ` ${extra}` : ''}`;
  el.dataset.plate = plate.id;
  el.style.setProperty('--pl-bg', plate.bg);
  el.style.setProperty('--pl-bg2', plate.bg2 ?? plate.bg);
  el.style.setProperty('--pl-edge', plate.edge);
  el.style.setProperty('--pl-ink', plate.ink);
  const text = document.createElement('span');
  text.className = 'plate-text';
  text.textContent = name;
  el.append(text);
  return el;
}

export function renderProfileChip(): void {
  const chip = $('btn-profile');
  chip.hidden = !state.save.tutorialDone;
  chip.setAttribute('aria-label', t.profileLabel(state.save.profile.name));
  $('profile-chip-art').innerHTML = portraitOf(state.save.profile);
  $('profile-chip-plate').replaceChildren(plateEl(state.save.profile.plate, state.save.profile.name, 'plate-sm'));
}

export function openProfile(): void {
  renderProfile();
  openLayer($('profile'), $('btn-close-profile'));
}

export function renderProfile(): void {
  $('profile-art').innerHTML = portraitOf(state.save.profile);
  $('profile-plate').replaceChildren(plateEl(state.save.profile.plate, state.save.profile.name, 'plate-lg'));
  $('profile-level').textContent = String(state.save.level);
  const sets = setProgress(state.save.shells, config);
  const scenesOwned = config.themes.list.filter((x) => isOwned(x, state.save.themes.owned)).length;
  const s = state.save.stats;
  const rows: [keyof typeof t.statLabels, string][] = [
    ['levels', String(state.save.level - 1)],
    ['perfectClears', String(s.perfectClears)],
    ['streak', String(streakStatus(state.save.daily, dailyKey(state.clock)).current)],
    ['bestStreak', String(state.save.daily.best)],
    ['dailiesSolved', String(s.dailiesSolved)],
    ['shells', `${state.save.shells.length}/${allShells(config).length}`],
    ['sets', `${sets.filter((p) => p.complete).length}/${sets.length}`],
    ['scenes', `${scenesOwned}/${config.themes.list.length}`],
    ['pours', s.pours.toLocaleString('en')],
    ['jarsSealed', s.jarsSealed.toLocaleString('en')],
    ['coinsEarned', s.coinsEarned.toLocaleString('en')],
    ['boostersUsed', String(s.boostersUsed)],
  ];
  $('stats-grid').replaceChildren(
    ...rows.map(([key, value]) => {
      const tile = document.createElement('div');
      tile.className = 'stat';
      tile.innerHTML = `<svg class="stat-ico" viewBox="0 0 24 24" aria-hidden="true">${STAT_ICONS[key]}</svg><dt></dt><dd></dd>`;
      const dt = tile.querySelector('dt')!;
      dt.textContent = t.statLabels[key];
      if ((STAT_KEYS as readonly string[]).includes(key)) {
        // UX-profile-2: an asterisk ties the counter to the footnote; a screen reader hears the words.
        const mark = document.createElement('span');
        mark.className = 'stat-new';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = t.statNewMark;
        const sr = document.createElement('span');
        sr.className = 'sr-only';
        sr.textContent = t.statNewSr;
        dt.append(mark, sr);
      }
      tile.querySelector('dd')!.textContent = value;
      return tile;
    }),
  );
  $('stats-note').textContent = t.statsFootnote;
  renderBadgeShelf();
}

/** Wires the profile sheet's open and close buttons. */
export function wireProfile(): void {
  $('btn-profile').addEventListener('click', openProfile);
  $('btn-close-profile').addEventListener('click', () => closeLayer($('profile')));
}
