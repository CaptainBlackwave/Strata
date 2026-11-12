/** DOM helpers shared by every screen: element lookups, the layer (dialog) helpers, the toast and the live region. */
import { type FocusTarget, LayerStack } from './layers';
import { createFrameBatch, liveRegionPlan } from './logic/frame-batch';

export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
export const boardEl = $('board');
export const levelLabel = $('level-label');
export const challengeTag = $('challenge-tag');
export const movesEl = $('moves');
export const coinsEl = $('coins');
export const toastEl = $('toast');
export const winEl = $('win');
export const homeEl = $('home');
export const settingsEl = $('settings');
export const coachEl = $('coach');
export const coachText = $('coach-text');
export const btnNext = $<HTMLButtonElement>('btn-next');
export const toolButtons = [...document.querySelectorAll<HTMLButtonElement>('.tool[data-booster]')];

/** Every overlay draws in stack order; only the top one is interactive (the toast stays live). */
export const layers = new LayerStack<HTMLElement>(() => [...($('app').children as HTMLCollectionOf<HTMLElement>)], [toastEl], 20);

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer = 0;

/** Whether focus can land on `el`: on the page, not hidden, not inert and not disabled. */
export function canFocus(el: unknown): el is HTMLElement {
  return el instanceof HTMLElement && el.isConnected && !el.closest('[hidden],[inert]') && !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0;
}

/** The first control in `layer` that can take focus. */
export function firstFocusable(layer: HTMLElement): HTMLElement | null {
  const all = layer.querySelectorAll<HTMLElement>('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
  return [...all].find(canFocus) ?? null;
}

/**
 * Opens `el` as the top layer: everything behind becomes inert, and focus moves to
 * `first` (or the layer's first control). `opener` gets focus back on close; it defaults
 * to whatever had focus.
 */
export function openLayer(el: HTMLElement, first: HTMLElement | null = null, opener: FocusTarget | null = document.activeElement as HTMLElement | null): void {
  layers.open(el, opener === document.body ? null : opener);
  const target = canFocus(first) ? first : firstFocusable(el);
  target?.focus();
}

/**
 * Closes `el`. With `restore`, focus returns to its opener, or to the new top layer's
 * first control if the opener is gone. Returns the opener, so a sub-screen that replaces
 * this layer can hand focus back to the same place.
 */
export function closeLayer(el: HTMLElement, restore = true): FocusTarget | null {
  const wasOpen = !el.hidden;
  const opener = layers.close(el);
  if (wasOpen) fadeOut(el);
  if (restore) {
    if (canFocus(opener)) opener.focus();
    else {
      const top = layers.top();
      if (top) firstFocusable(top)?.focus();
    }
  }
  return opener;
}

/** Sprint 18 F4: how long a sheet, card or the win card takes to fade and slide out (ms, under 200). */
const LAYER_OUT_MS = 160;

/**
 * Sprint 18 F4 (D149): a closing sheet, card or win card fades and slides out. The layer itself is
 * already hidden (focus, inert and the stack moved on at once); a copy with no ids, inert and
 * hidden from assistive tech, plays the exit and is removed. Nothing under reduced motion or in a
 * hidden tab, and only for overlay layers (`.sheet`, `.cabinet`, `.win`).
 */
function fadeOut(el: HTMLElement): void {
  if (reducedMotion() || document.hidden || !el.matches('.sheet, .cabinet, .win') || !el.parentElement) return;
  const ghost = el.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  ghost.hidden = false;
  ghost.inert = true;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.classList.add('layer-ghost');
  ghost.style.zIndex = el.style.zIndex || '40';
  el.parentElement.append(ghost);
  const card = ghost.querySelector<HTMLElement>('.sheet-card, .cabinet-card, .win-card');
  const opts: KeyframeAnimationOptions = { duration: LAYER_OUT_MS, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' };
  card?.animate([{ transform: 'none' }, { transform: ghost.matches('.sheet') ? 'translateY(24px)' : 'translateY(8px) scale(0.98)' }], opts);
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], opts).finished.then(
    () => ghost.remove(),
    () => ghost.remove(),
  );
}

export function wait(ms: number): Promise<void> {
  return new Promise((res) => window.setTimeout(res, ms));
}

/** Hides the toast at once (e.g. when the win card opens). */
export function hideToast(): void {
  window.clearTimeout(toastTimer);
  toastEl.classList.remove('show');
}

/**
 * Reads `text` out through the polite live region outside the app root, so no layer makes it
 * inert (UX-board-5). Clearing it first lets the same sentence be read twice in a row.
 */
/**
 * The text writes a board change makes (the HUD, the live region), flushed together once per frame
 * (sprint 22 L1, D181) so a pour costs one style and layout pass for them, not several.
 */
export const frameWrites = createFrameBatch((flush) => requestAnimationFrame(flush));

/** Sets `el`'s text only when it differs: an equal write still replaces the text node and dirties layout. */
export function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

/** Sets an attribute only when it differs (an equal write still invalidates style and the accessibility tree). */
export function setAttr(el: HTMLElement, name: string, value: string): void {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

let announceTimer = 0;

/**
 * Says `text` through the polite live region, in the next frame's batched writes. New text is one
 * write; the same text again is cleared and written 50 ms later so a screen reader still reads it.
 */
export function announce(text: string): void {
  frameWrites.queue('announce', () => {
    const el = $('announce');
    window.clearTimeout(announceTimer);
    if (liveRegionPlan(el.textContent ?? '', text) === 'write') {
      el.textContent = text;
      return;
    }
    el.textContent = '';
    announceTimer = window.setTimeout(() => (el.textContent = text), 50);
  });
}

export function showToast(text: string): void {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
}
