/** The board HUD (moves, coins, booster buttons) and the tutorial pointer. */
import { type BoosterId } from '../../core/economy';
import { t } from '../strings';
import { $, coachEl, coachText, coinsEl, movesEl, toolButtons } from '../dom';
import { BOOSTER_NAMES, config, state } from '../state';

export function updateHud(): void {
  movesEl.textContent = String(state.session.moves);
  $('moves-label').textContent = t.poursLabel(state.session.moves);
  coinsEl.textContent = String(state.save.wallet.coins);
  const over = state.session.status === 'won';
  for (const btn of toolButtons) {
    const id = btn.dataset.booster as BoosterId;
    const charges = state.save.wallet.boosters[id];
    const price = config.boosters[id].price;
    // A free booster (owner decision D-a: Undo) shows no charge or price badge.
    const free = (config.boosters[id] as { free?: boolean }).free === true;
    const badge = btn.querySelector('.badge') as HTMLElement;
    badge.hidden = free;
    badge.textContent = charges > 0 ? String(charges) : String(price);
    badge.classList.toggle('price', charges === 0);
    const usable =
      !over && state.mode !== 'tutorial' && (id !== 'undo' || state.session.canUndo) && (id !== 'extraJar' || state.session.extraJarsLeft > 0);
    // TD-13: while Hint or Shuffle waits for the worker, that button is disabled and busy at
    // once; the visible cue (and disabling the other one) waits for `thinkingShown`, so a fast
    // answer doesn't flicker. A second assist tap is ignored by useBooster meanwhile.
    const thinking = state.thinking === id;
    const held = state.thinkingShown && state.thinking !== null && (id === 'hint' || id === 'shuffle');
    btn.disabled = !usable || thinking || held;
    if (thinking) btn.setAttribute('aria-busy', 'true');
    else btn.removeAttribute('aria-busy');
    btn.classList.toggle('thinking', thinking && state.thinkingShown);
    (btn.querySelector('.tool-name') as HTMLElement).textContent = thinking && state.thinkingShown ? t.thinking : BOOSTER_NAMES[id];
    const label = thinking ? t.boosterThinkingLabel(BOOSTER_NAMES[id]) : state.armedBooster === id ?t.boosterArmedLabel(BOOSTER_NAMES[id], price) : free ? t.boosterFree(BOOSTER_NAMES[id]) : t.boosterLabel(BOOSTER_NAMES[id], charges, price);
    btn.setAttribute('aria-label', label);
  }
  ($('btn-restart') as HTMLButtonElement).disabled = state.mode === 'tutorial';
  // UX-board-9: in the tutorial a caption says why the tools are off, and each one points at it.
  const tutorial = state.mode === 'tutorial';
  $('tools-note').hidden = !tutorial;
  for (const btn of [...toolButtons, $('btn-restart')]) {
    if (tutorial) btn.setAttribute('aria-describedby', 'tools-note');
    else btn.removeAttribute('aria-describedby');
  }
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
