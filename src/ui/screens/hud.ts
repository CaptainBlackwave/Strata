/** The board HUD (moves, coins, booster buttons) and the tutorial pointer. */
import { type BoosterId } from '../../core/economy';
import { t } from '../strings';
import { $, coachEl, coachText, coinsEl, frameWrites, movesEl, setAttr, setText, toolButtons } from '../dom';
import { BOOSTER_NAMES, config, state } from '../state';
import { boosterHintShown } from './onboarding';

/**
 * Redraws the HUD from the session now. Each text and label is written only when it changed, so an
 * unchanged HUD costs no style or accessibility work.
 */
export function updateHud(): void {
  setText(movesEl, String(state.session.moves));
  setText($('moves-label'), t.poursLabel(state.session.moves));
  // A friend's pours to beat (sharing §3.2), only on the challenged level.
  const versus = state.mode === 'level' && state.versus && state.versus.level === state.level ? state.versus : null;
  $('versus').hidden = !versus;
  if (versus) {
    setText($('versus-text'), t.friend.target(versus.pours));
    setText($('versus-sr'), t.friend.targetSr(versus.pours));
  }
  setText(coinsEl, String(state.save.wallet.coins));
  const over = state.session.status === 'won';
  for (const btn of toolButtons) {
    const id = btn.dataset.booster as BoosterId;
    const charges = state.save.wallet.boosters[id];
    const price = config.boosters[id].price;
    // A free booster (owner decision D-a: Undo) shows no charge or price badge.
    const free = (config.boosters[id] as { free?: boolean }).free === true;
    const badge = btn.querySelector('.badge') as HTMLElement;
    badge.hidden = free;
    setText(badge, charges > 0 ? String(charges) : String(price));
    badge.classList.toggle('price', charges === 0);
    const usable =
      !over && state.mode !== 'tutorial' && (id !== 'undo' || state.session.canUndo) && (id !== 'extraJar' || state.session.extraJarsLeft > 0);
    // TD-13: while Hint or Shuffle waits for the worker, that button is disabled and busy at
    // once; the visible cue (and disabling the other one) waits for `thinkingShown`, so a fast
    // answer doesn't flicker. A second assist tap is ignored by useBooster meanwhile.
    const thinking = state.thinking === id;
    const held = state.thinkingShown && state.thinking !== null && (id === 'hint' || id === 'shuffle');
    btn.disabled = !usable || thinking || held;
    if (thinking) setAttr(btn, 'aria-busy', 'true');
    else btn.removeAttribute('aria-busy');
    btn.classList.toggle('thinking', thinking && state.thinkingShown);
    setText(btn.querySelector('.tool-name') as HTMLElement, thinking && state.thinkingShown ? t.thinking : BOOSTER_NAMES[id]);
    const label = thinking ? t.boosterThinkingLabel(BOOSTER_NAMES[id]) : state.armedBooster === id ?t.boosterArmedLabel(BOOSTER_NAMES[id], price) : free ? t.boosterFree(BOOSTER_NAMES[id]) : t.boosterLabel(BOOSTER_NAMES[id], charges, price);
    setAttr(btn, 'aria-label', label);
  }
  ($('btn-restart') as HTMLButtonElement).disabled = state.mode === 'tutorial';
  // UX-board-9: in the tutorial a caption says why the tools are off, and each one points at it.
  const tutorial = state.mode === 'tutorial';
  const note = $('tools-note');
  const boosterHint = !tutorial && boosterHintShown(); // O2: level 1 names the boosters once
  note.hidden = !tutorial && !boosterHint;
  setText(note, boosterHint ? t.onboarding.boosterHint : t.toolsLocked);
  for (const btn of [...toolButtons, $('btn-restart')]) {
    if (tutorial) setAttr(btn, 'aria-describedby', 'tools-note');
    else btn.removeAttribute('aria-describedby');
  }
}

/**
 * Redraws the HUD in the next frame, together with the live region (sprint 22 L1): what a pour calls,
 * so its text writes land in one batch. Calls in the same frame redraw once.
 */
export function scheduleHud(): void {
  frameWrites.queue('hud', () => {
    if (state.session) updateHud();
  });
}

/** Shows the tutorial pointer on jar `i` with a caption, or hides it with `null`. */
export function coach(i: number | null, text = ''): void {
  if (i === null || !state.jarEls[i]) {
    coachEl.hidden = true;
    return;
  }
  const r = state.jarEls[i].getBoundingClientRect();
  coachEl.style.left = `${r.left + r.width / 2}px`;
  coachEl.style.top = `${r.top + r.height * 0.55}px`;
  coachText.textContent = text;
  coachEl.hidden = false;
  // Keep the wrapped caption 8 px inside the screen when the jar sits near an edge (UX-board-10).
  // Computed from the jar's centre and the caption's layout width, not its drawn box, which can be stale.
  const centre = r.left + r.width / 2;
  const half = coachText.offsetWidth / 2;
  const left = centre - half;
  const right = centre + half;
  const shift = left < 8 ? 8 - left : right > window.innerWidth - 8 ? window.innerWidth - 8 - right : 0;
  coachEl.style.setProperty('--coach-shift', `${shift}px`);
  // At large text the caption below the jar can cover the "tools unlock" note (UX-board-9);
  // then it sits above the jar instead.
  coachEl.classList.remove('above');
  const note = $('tools-note');
  if (!note.hidden) {
    const c = coachText.getBoundingClientRect();
    const n = note.getBoundingClientRect();
    if (c.bottom > n.top && c.top < n.bottom) coachEl.classList.add('above');
  }
}
