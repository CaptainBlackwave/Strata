/** The global keyboard handler. */
import { $, btnNext, closeLayer, homeEl, layers, settingsEl, winEl } from '../dom';
import { onJarTap, play, requestRestart, useBooster } from './board';
import { setSelected } from './jars';
import { closeEditProfile, keepEditing, saveEditProfile } from './sheets/edit-profile';
import { closeScenes } from './sheets/scenes';
import { state } from '../state';

/** Wires the global keyboard handler: keys go to the top layer, and the board shortcuts work when none is open. */
export function wireKeys(): void {
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Keys go to the top layer only (F3); the board's shortcuts work when no layer is open.
    const top = layers.top();
    const onButton = document.activeElement instanceof HTMLButtonElement;
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
    if (top === $('profile') || top === $('transfer') || top === $('cabinet')) {
      if (e.key === 'Escape') closeLayer(top);
      return;
    }
    if (top === $('scenes')) {
      if (e.key === 'Escape') closeScenes();
      return;
    }
    if (top === $('intro') || top === $('whatsnew')) {
      // Enter on a focused button activates that button natively.
      if (e.key === 'Escape' || (e.key === 'Enter' && !onButton)) closeLayer(top);
      return;
    }
    if (top === homeEl) {
      // Enter/Space plays, unless another home button (profile, daily, shells, scenes) has focus.
      const focused = document.activeElement;
      if (focused instanceof HTMLButtonElement && focused.id !== 'btn-play') return;
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
    if (top) return;
    const k = e.key.toLowerCase();
    if (k === 'z') useBooster('undo');
    else if (k === 's') useBooster('shuffle');
    else if (k === 'j') useBooster('extraJar');
    else if (k === 'h') useBooster('hint');
    else if (k === 'r') requestRestart();
    else if (k === 'escape') setSelected(null);
    else {
      // 1-9 and 0 pick jars 1-10; with Shift they pick jars 11-20 (UX-board-8). Shift changes
      // e.key ("!"), so the top-row digit comes from e.code.
      const digit = /^Digit[0-9]$/.test(e.code) ? e.code.slice(5) : /^[0-9]$/.test(k) ? k : null;
      if (digit === null) return;
      const i = (digit === '0' ? 9 : Number(digit) - 1) + (e.shiftKey ? 10 : 0);
      if (i < state.jarEls.length) onJarTap(i);
    }
  });
}
