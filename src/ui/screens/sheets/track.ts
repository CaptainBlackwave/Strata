/**
 * The streak track sheet (0.15.1, strata-dll; design/gdd/daily-puzzle.md §2.4): every track day with
 * its reward, small art and whether it is collected, next or later, opened from the Home link under
 * the daily card. The rules are the pure core/streak-track.ts; the rows are logic/streak-track.ts.
 */
import { streakStatus } from '../../../core/daily';
import { type StyleSlot } from '../../../core/styles';
import { type TrackConfig, type TrackReward, trackOf } from '../../../core/streak-track';
import { themeById } from '../../../core/themes';
import { trackSheetRows } from '../../logic/streak-track';
import { dailyKey } from '../../clock';
import { type FocusTarget } from '../../layers';
import { t } from '../../strings';
import { $, closeLayer, openLayer } from '../../dom';
import { trackNames } from '../home';
import { plateEl, portraitOf } from './profile';
import { sceneSwatchEl } from './scenes';
import { styleSwatchEl } from './styles';
import { audio, config, state } from '../../state';

/** A reward's small art: a portrait in the frame, the plate, a jar in the glass, the scene, or the boosters' toolbar icons. */
function artOf(reward: TrackReward): HTMLElement {
  const art = document.createElement('span');
  art.className = `track-art track-art-${reward.kind}`;
  art.setAttribute('aria-hidden', 'true');
  if (reward.kind === 'frame') art.innerHTML = portraitOf({ avatar: state.save.profile.avatar, frame: reward.id });
  else if (reward.kind === 'plate') art.append(plateEl(reward.id, state.save.profile.name, 'plate-sm'));
  else if (reward.kind === 'style') {
    const [slot, id] = reward.piece.split(':');
    art.append(styleSwatchEl(slot as StyleSlot, id));
  } else if (reward.kind === 'scene') art.append(sceneSwatchEl(themeById(config, reward.id)));
  else {
    for (const id of Object.keys(reward.boosters)) {
      const svg = document.querySelector(`[data-booster="${id}"] svg`);
      if (svg) art.append(svg.cloneNode(true));
    }
  }
  return art;
}

/** Fills the sheet from the save: the live streak, then one row per track day. */
export function renderTrack(): void {
  const streak = streakStatus(state.save.daily, dailyKey(state.clock)).current;
  $('track-streak').textContent = t.track.current(streak);
  const rows = trackSheetRows(state.save.track, streak, trackOf(config as unknown as TrackConfig), trackNames());
  $('track-list').replaceChildren(
    ...rows.map((row) => {
      const li = document.createElement('li');
      li.className = `track-row ${row.state}`;
      const text = document.createElement('span');
      text.className = 'track-text';
      const name = document.createElement('b');
      name.textContent = row.name;
      const status = document.createElement('span');
      status.className = 'track-status';
      status.textContent = row.status;
      text.append(name, status);
      li.append(artOf(row.step.reward), text);
      return li;
    }),
  );
}

/** Opens the sheet; focus goes to Close (the rows are not controls) and returns to `opener`. */
export function openTrack(opener: FocusTarget | null = document.activeElement as HTMLElement | null): void {
  renderTrack();
  openLayer($('track'), $('btn-close-track'), opener);
}

/** Wires Home's link and the sheet's Close. */
export function wireTrack(): void {
  $('btn-track').addEventListener('click', () => {
    audio.unlock();
    audio.play('select');
    openTrack($('btn-track'));
  });
  $('btn-close-track').addEventListener('click', () => closeLayer($('track')));
}
