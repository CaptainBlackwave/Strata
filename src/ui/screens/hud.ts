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
    btn.disabled = !usable;
    const label = state.armedBooster === id ? t.boosterArmedLabel(BOOSTER_NAMES[id], price) : free ? t.boosterFree(BOOSTER_NAMES[id]) : t.boosterLabel(BOOSTER_NAMES[id], charges, price);
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
  coachEl.style.setProperty('--coach-shift', '0px');
  const box = coachText.getBoundingClientRect();
  const shift = box.left < 8 ? 8 - box.left : box.right > window.innerWidth - 8 ? window.innerWidth - 8 - box.right : 0;
  coachEl.style.setProperty('--coach-shift', `${shift}px`);
}
