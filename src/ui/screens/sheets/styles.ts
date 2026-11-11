/**
 * The Jar styles sheet (design/gdd/jar-styles.md §3.2–§3.3, sprint 12 S4): three slots of pieces,
 * previewed on sample jars before buying, then bought or worn. The rules are the pure
 * core/styles.ts and logic/styles-sheet.ts; the art is CSS keyed by `data-glass`, `data-cork` and
 * `data-sand` (S3), which {@link applyStyles} sets on the board and Home.
 */
import { STYLE_SLOTS, type StyleSlot, buyStyle, earnedDay, stylesOpen, wearStyle } from '../../../core/styles';
import { styleAction, stylesNewDue } from '../../logic/styles-sheet';
import { applyStyleAttrs } from '../../style-art';
import { type FocusTarget } from '../../layers';
import { writeSave } from '../../storage';
import { t } from '../../strings';
import { $, closeLayer, openLayer, showToast } from '../../dom';
import { updateHud } from '../hud';
import { audio, config, state } from '../../state';

/** The pieces shown on the sample jars: the worn ones, overridden by the one being looked at. */
let preview: Record<StyleSlot, string> | null = null;
/** The piece the main button acts on. */
let focus: { slot: StyleSlot; id: string } | null = null;

/** A piece's display name, e.g. "Sea glass". */
function nameOf(slot: StyleSlot, id: string): string {
  return t.styles.names[slot]?.[id] ?? id;
}

/** Wears the saved styles on the board and the Home art. Call after boot, a reload or a change. */
export function applyStyles(): void {
  applyStyleAttrs($('board'), state.save.styles.worn);
  applyStyleAttrs($('home'), state.save.styles.worn);
}

/** Shows or hides the Home button and its one-time "New" mark (§3.2). */
export function renderStylesButton(): void {
  const open = stylesOpen(state.save.level, state.save.styles, config);
  $('btn-styles').hidden = !open || !state.save.tutorialDone;
  $('styles-new').hidden = !stylesNewDue(state.save.onboarding, open);
}

/** Sample jar markup like the board's: `colors` are palette indexes, bottom first. */
function jarHtml(colors: readonly number[], sealed: boolean): string {
  const units = colors
    .map((c) => {
      const pat = state.save.settings.patterns ? ` pat-${c % config.palette.length}` : '';
      return `<span class="unit${pat}" style="--c:${config.palette[c].hex}"></span>`;
    })
    .join('');
  return `<span class="jar${sealed ? ' sealed' : ''}"><span class="cork"></span><span class="glass"><span class="sand">${units}</span><span class="shine"></span></span></span>`;
}

/** The three sample jars on the stage: a sealed one, a mixed one, and another sealed one. */
const STAGE_HTML = () => jarHtml([0, 0, 0, 0], true) + jarHtml([1, 2, 1, 3], false) + jarHtml([2, 2, 2, 2], true);

/** One piece's button: a tiny sealed jar wearing it, the name, and Wearing / Owned / its price. */
function pieceButton(slot: StyleSlot, id: string, price: number): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'style-piece';
  btn.dataset.slot = slot;
  btn.dataset.id = id;
  btn.setAttribute('aria-pressed', String(preview?.[slot] === id));
  const swatch = document.createElement('span');
  swatch.className = 'style-preview style-swatch';
  swatch.setAttribute('aria-hidden', 'true');
  applyStyleAttrs(swatch, { ...state.save.styles.worn, [slot]: id });
  swatch.innerHTML = jarHtml([slot === 'sand' ? 1 : 0, slot === 'sand' ? 1 : 0, slot === 'sand' ? 1 : 0, slot === 'sand' ? 1 : 0], true);
  const name = document.createElement('span');
  name.className = 'scene-name';
  name.textContent = nameOf(slot, id);
  const status = document.createElement('span');
  status.className = 'scene-status';
  const action = styleAction(state.save.styles, state.save.wallet.coins, state.save.level, slot, id, config);
  if (action === 'wearing') status.textContent = t.styles.wearing;
  else if (action === 'wear') status.textContent = id === config.styles.slots[slot][0].id || price === 0 && earnedDay(slot, id, config) === undefined ? t.styles.free : t.styles.owned;
  else if (action === 'earned') {
    status.textContent = t.track.locked(earnedDay(slot, id, config) ?? 0); // streak-only: never a price (sprint 16)
    status.classList.add('locked');
  } else {
    status.textContent = String(price);
    status.classList.add('price');
    const unit = document.createElement('span'); // "1700 coins", not a bare number (as Scenes, UX-scenes-3)
    unit.className = 'sr-only';
    unit.textContent = ` ${t.coins}`;
    status.append(unit);
  }
  btn.append(swatch, name, status);
  btn.addEventListener('click', () => {
    preview = { ...(preview ?? state.save.styles.worn), [slot]: id };
    focus = { slot, id };
    audio.play('select');
    renderStyles();
    $('styles-slots').querySelector<HTMLElement>(`[data-slot="${slot}"][data-id="${id}"]`)?.focus(); // keep focus on the rebuilt button
  });
  return btn;
}

/** Redraws the sheet: coins, the stage, the three slots and the main button. */
export function renderStyles(): void {
  const worn = state.save.styles.worn;
  preview ??= { ...worn };
  $('styles-coins').textContent = String(state.save.wallet.coins);
  const stage = $('styles-preview');
  applyStyleAttrs(stage, preview);
  stage.innerHTML = STAGE_HTML();
  $('styles-slots').replaceChildren(
    ...STYLE_SLOTS.map((slot) => {
      const section = document.createElement('section');
      section.className = 'styles-slot';
      const h = document.createElement('h3');
      h.id = `styles-slot-${slot}`;
      h.textContent = t.styles.slots[slot];
      const grid = document.createElement('div');
      grid.className = 'style-grid';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-labelledby', h.id);
      grid.append(...config.styles.slots[slot].map((p) => pieceButton(slot, p.id, p.price)));
      section.append(h, grid);
      return section;
    }),
  );
  const btn = $<HTMLButtonElement>('btn-style-action');
  if (!focus) {
    btn.hidden = true;
    $('styles-previewing').textContent = '';
    return;
  }
  const piece = config.styles.slots[focus.slot].find((p) => p.id === focus!.id)!;
  const name = nameOf(focus.slot, focus.id);
  const action = styleAction(state.save.styles, state.save.wallet.coins, state.save.level, focus.slot, focus.id, config);
  btn.hidden = action === 'wearing' || action === 'closed';
  btn.disabled = action === 'need' || action === 'earned';
  btn.textContent =
    action === 'wear' ? t.styles.wear(name) : action === 'buy' ? t.styles.buy(name, piece.price) : action === 'earned' ? t.track.locked(piece.earned ?? 0) : t.styles.need(piece.price, state.save.wallet.coins);
  $('styles-previewing').textContent = action === 'wearing' ? '' : t.styles.previewing(name);
}

/** The main button: buy (then wear) or wear the focused piece. */
function confirmStyle(): void {
  if (!focus) return;
  const { slot, id } = focus;
  const action = styleAction(state.save.styles, state.save.wallet.coins, state.save.level, slot, id, config);
  if (action === 'buy') {
    const r = buyStyle(state.save.wallet, state.save.styles, state.save.level, slot, id, config);
    if (!r.ok) return;
    state.save.wallet = r.wallet;
    state.save.styles = r.state;
    audio.play('sceneBought');
    showToast(t.styles.bought(nameOf(slot, id)));
  } else if (action === 'wear') {
    state.save.styles = wearStyle(state.save.styles, slot, id, config);
    audio.play('select');
  } else return;
  writeSave(state.save);
  applyStyles();
  $('home-coins').textContent = String(state.save.wallet.coins);
  updateHud();
  preview = { ...state.save.styles.worn };
  renderStyles();
  $('styles-slots').querySelector<HTMLElement>(`[data-slot="${slot}"][data-id="${id}"]`)?.focus();
}

/** Opens the sheet; focus goes to the first slot's worn piece and returns to `opener` on close. */
export function openStyles(opener: FocusTarget | null = document.activeElement as HTMLElement | null): void {
  preview = { ...state.save.styles.worn };
  focus = null;
  renderStyles();
  const first = $('styles-slots').querySelector<HTMLElement>('[aria-pressed="true"]');
  openLayer($('styles'), first, opener);
}

/** Closes the sheet; nothing previewed is kept. */
export function closeStyles(): void {
  closeLayer($('styles'));
  preview = null;
  focus = null;
}

/** Wires the Home button, the main button and Close. */
export function wireStyles(): void {
  $('btn-styles').addEventListener('click', () => {
    audio.unlock();
    if (!$('styles-new').hidden) {
      state.save.onboarding.stylesNewSeen = true; // the mark has done its job
      writeSave(state.save);
      $('styles-new').hidden = true;
    }
    openStyles($('btn-styles'));
  });
  $('btn-style-action').addEventListener('click', confirmStyle);
  $('btn-close-styles').addEventListener('click', closeStyles);
}
