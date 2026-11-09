/** The Settings sheet, its toggles and the "Leave this board?" dialog. */
import { writeSave } from '../../storage';
import { $, closeLayer, homeEl, layers, openLayer, settingsEl } from '../../dom';
import { renderAllJars } from '../jars';
import { audio, state } from '../../state';
import { needsLeaveConfirm } from '../../logic/leave';
import { applyTheme, currentTheme } from '../../theme';
import { t } from '../../strings';

let leaveAction: (() => void) | null = null;

/** Each volume slider, the switch that mutes it, and its saved field (D66). */
const VOLUMES = [
  { mute: 'sound', field: 'soundVolume' },
  { mute: 'music', field: 'musicVolume' },
] as const;
type Volume = (typeof VOLUMES)[number];

/** The shortest gap between two sound previews while a slider is dragged, in ms (not a gameplay value). */
const PREVIEW_GAP_MS = 120;
let lastPreview = -Infinity;

const sliderOf = (v: Volume) => $<HTMLInputElement>(`set-${v.mute}-volume`);

/** Shows a slider at its saved level, with its spoken percentage, disabled while its switch mutes it. */
function syncSlider(v: Volume): void {
  const el = sliderOf(v);
  el.value = String(Math.round(state.save.settings[v.field] * 100));
  // Read back the value the slider shows: it snaps to its step (a saved 0.33 shows as 35%).
  el.setAttribute('aria-valuetext', t.volumeValue(Number(el.value)));
  el.disabled = !state.save.settings[v.mute];
}

/** A slider moved: apply the level live, preview a sound at it (throttled), and save on release. */
function onSlider(v: Volume, el: HTMLInputElement, commit: boolean): void {
  const percent = Math.min(100, Math.max(0, Math.round(Number(el.value) || 0)));
  state.save.settings[v.field] = percent / 100;
  el.setAttribute('aria-valuetext', t.volumeValue(percent));
  audio.unlock();
  audio.configure(state.save.settings); // music changes live
  const now = performance.now();
  if (v.mute === 'sound' && now - lastPreview >= PREVIEW_GAP_MS) {
    lastPreview = now;
    audio.play('land', { pitch: 2 });
  }
  if (commit) writeSave(state.save);
}

export function openSettings(): void {
  for (const key of ['sound', 'music', 'haptics', 'patterns', 'southern'] as const) $<HTMLInputElement>(`set-${key}`).checked = state.save.settings[key];
  for (const v of VOLUMES) syncSlider(v);
  $('btn-home').hidden = layers.has(homeEl); // already Home when opened from Home
  openLayer(settingsEl, $('set-sound'));
}

/**
 * Runs `action` (go Home, replay the tutorial) from Settings. If a board is part-way
 * played, asks "Leave this board?" first, because the board isn't kept.
 */
export function leaveBoard(action: () => void): void {
  // Home itself, no pours made or a won board: nothing is lost, so act at once (TD-12).
  if (!needsLeaveConfirm({ onHome: layers.has(homeEl), moves: state.session?.moves ?? 0, won: state.session?.status === 'won' })) {
    closeLayer(settingsEl, false);
    action();
    return;
  }
  leaveAction = action;
  openLayer($('leave'), $('btn-keep-playing'));
}

export function confirmLeave(): void {
  const action = leaveAction;
  leaveAction = null;
  closeLayer($('leave'), false);
  closeLayer(settingsEl, false);
  action?.();
}

/** Wires Settings, the leave-board dialog and the toggles. Home and the tutorial come from the caller, so this sheet imports no screen. */
export function wireSettings(go: { home: () => void; tutorial: () => void }): void {
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-home-settings').addEventListener('click', openSettings);
  $('btn-close-settings').addEventListener('click', () => closeLayer(settingsEl));
  $('btn-home').addEventListener('click', () => leaveBoard(go.home));
  $('btn-keep-playing').addEventListener('click', () => closeLayer($('leave')));
  $('btn-leave').addEventListener('click', confirmLeave);
  $('btn-tutorial').addEventListener('click', () =>
    leaveBoard(() => {
      closeLayer(homeEl, false);
      go.tutorial();
    }),
  );
  for (const key of ['sound', 'music', 'haptics', 'patterns', 'southern'] as const) {
    $<HTMLInputElement>(`set-${key}`).addEventListener('change', (e) => {
      state.save.settings[key] = (e.target as HTMLInputElement).checked;
      writeSave(state.save);
      audio.configure(state.save.settings);
      for (const v of VOLUMES) if (v.mute === key) syncSlider(v); // a muted slider shows disabled
      if (key === 'patterns') renderAllJars();
      if (key === 'southern') applyTheme(currentTheme()); // the In season badge and Match my clock follow it (P2)
    });
  }
  for (const v of VOLUMES) {
    const el = sliderOf(v);
    el.addEventListener('input', () => onSlider(v, el, false));
    el.addEventListener('change', () => onSlider(v, el, true));
  }
}
