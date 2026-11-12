/** The global keyboard handler. */
import { closeShare } from './sheets/share';
import { currentHomeTab } from './home-tabs';
import { $, btnNext, closeLayer, homeEl, layers, settingsEl, winEl } from '../dom';
import { hasCommandModifier, keyToAction } from '../logic/keymap';
import { onJarTap, play, requestRestart, useBooster } from './board';
import { setSelected } from './jars';
import { onMapKey, onStoneCardKey } from './map';
import { closeEditProfile, keepEditing, saveEditProfile } from './sheets/edit-profile';
import { closeScenes } from './sheets/scenes';
import { closeStyles } from './sheets/styles';
import { state } from '../state';

/** Wires the global keyboard handler: keys go to the top layer, and the board shortcuts work when none is open. */
export function wireKeys(): void {
  window.addEventListener('keydown', (e) => {
    if (hasCommandModifier(e)) return;
    // Keys go to the top layer only (F3); the board's shortcuts work when no layer is open.
    const top = layers.top();
    const onButton = document.activeElement instanceof HTMLButtonElement;
    if (top === $('other-tab')) return; // blocking (D57): only Play here, by its own Enter/Space
    if (top === $('discard')) {
      if (e.key === 'Escape') keepEditing();
      return;
    }
    if (top === $('leave')) {
      if (e.key === 'Escape') closeLayer(top);
      return;
    }
    if (top === $('edit-profile')) {
      if (e.key === 'Escape') closeEditProfile();
      else if (e.key === 'Enter' && e.target === $('name-input')) saveEditProfile();
      return;
    }
    if (top === $('share-sheet')) {
      if (e.key === 'Escape') closeShare();
      return;
    }
    if (top === $('profile') || top === $('transfer') || top === $('cabinet') || top === $('weekly') || top === $('track') || top === $('event') || top === $('stats')) {
      if (e.key === 'Escape') closeLayer(top);
      return;
    }
    if (top === $('scenes')) {
      if (e.key === 'Escape') closeScenes();
      return;
    }
    if (top === $('styles')) {
      if (e.key === 'Escape') closeStyles();
      return;
    }
    if (top === $('intro') || top === $('whatsnew') || top === $('install') || top === $('daily-over') || top === $('friend')) {
      // Enter on a focused button activates that button natively.
      if (e.key === 'Escape' || (e.key === 'Enter' && !onButton)) closeLayer(top);
      return;
    }
    if (top === $('stone-card')) {
      onStoneCardKey(e);
      return;
    }
    if (top === $('map')) {
      onMapKey(e);
      return;
    }
    if (top === homeEl) {
      // Enter/Space plays, unless another home button (profile, daily, shells, scenes) has focus.
      const focused = document.activeElement;
      if (focused instanceof HTMLButtonElement && focused.id !== 'btn-play') return;
      if (currentHomeTab() !== 'play') return; // sprint 20: only the Play tab plays on Enter
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        play();
      }
      return;
    }
    if (top === winEl) {
      // Enter/Space on Share (or any focused button) activates that button, not Continue (UX-win-1).
      if ((e.key === 'Enter' || e.key === ' ') && !onButton) {
        e.preventDefault();
        btnNext.click();
      }
      return;
    }
    if (top === settingsEl) {
      if (e.key === 'Escape') closeLayer(settingsEl);
      return;
    }
    // Z/S/J/H/R, Escape, and 1-9 and 0 (Shift for 11-20) on the board: the pure mapping (UX-board-8, TD-12).
    const action = keyToAction(e, { layerOpen: top !== null, jarCount: state.jarEls.length });
    if (action === null) return;
    if (action.kind === 'booster') useBooster(action.id);
    else if (action.kind === 'restart') requestRestart();
    else if (action.kind === 'deselect') setSelected(null);
    else onJarTap(action.index);
  });
}
