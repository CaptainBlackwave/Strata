/** DOM helpers shared by every screen: element lookups, the layer (dialog) helpers, the toast and the live region. */
import { type FocusTarget, LayerStack } from './layers';

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
  const opener = layers.close(el);
  if (restore) {
    if (canFocus(opener)) opener.focus();
    else {
      const top = layers.top();
      if (top) firstFocusable(top)?.focus();
    }
  }
  return opener;
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
export function announce(text: string): void {
  const el = $('announce');
  el.textContent = '';
  window.setTimeout(() => (el.textContent = text), 50);
}

export function showToast(text: string): void {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
}
