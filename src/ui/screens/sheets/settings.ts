/** The Settings sheet, its toggles and the "Leave this board?" dialog. */
import { writeSave } from '../../storage';
import { $, closeLayer, homeEl, layers, openLayer, settingsEl } from '../../dom';
import { renderAllJars } from '../jars';
import { audio, state } from '../../state';
import { needsLeaveConfirm } from '../../logic/leave';
import { applyTheme, currentTheme } from '../../theme';

let leaveAction: (() => void) | null = null;

export function openSettings(): void {
  for (const key of ['sound', 'music', 'haptics', 'patterns', 'southern'] as const) $<HTMLInputElement>(`set-${key}`).checked = state.save.settings[key];
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
      if (key === 'patterns') renderAllJars();
      if (key === 'southern') applyTheme(currentTheme()); // the In season badge and Match my clock follow it (P2)
    });
  }
}
