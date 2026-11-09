/**
 * The overlay stack shared by every dialog, sheet and the Home screen (sprint 6 F3:
 * AX-2, AX-3, UX-all-1, UX-all-2). The top layer is the only interactive one: every
 * other child of the app root is made `inert`, so Tab and taps can't reach the covered
 * board or a lower layer. Layers draw in stack order, and each remembers its opener so
 * focus can go back to it on close.
 *
 * Written against tiny structural types so it can be unit-tested without a DOM.
 */

/** The parts of an element the stack touches. `HTMLElement` satisfies it. */
export interface LayerElement {
  hidden: boolean;
  inert: boolean;
  readonly style: { zIndex: string };
}

/** Anything focus can be returned to. */
export interface FocusTarget {
  focus(): void;
}

interface Entry<E> {
  readonly el: E;
  readonly opener: FocusTarget | null;
}

/** The stack of open overlays (menus, cards, dialogs): the top one gets focus and Escape, and closing returns focus to its opener. */
export class LayerStack<E extends LayerElement> {
  private stack: Entry<E>[] = [];
  /** A layer that stays on top until it closes (the other-tab overlay, D57). */
  private pinned: E | null = null;

  /**
   * @param siblings  every element that can be covered (the app root's children), read fresh on each change
   * @param alwaysLive elements that stay interactive and announced under any layer (the toast)
   * @param baseZ      z-index of the bottom layer; each higher layer draws one above
   */
  constructor(
    private readonly siblings: () => Iterable<E>,
    private readonly alwaysLive: readonly E[] = [],
    private readonly baseZ = 20,
  ) {}

  /** The interactive layer, or `null` when the board itself is in front. */
  top(): E | null {
    return this.stack.at(-1)?.el ?? null;
  }

  /** Whether `el` is open (anywhere in the stack). */
  has(el: E): boolean {
    return this.stack.some((x) => x.el === el);
  }

  /**
   * Shows `el` as the top layer. Opening a layer that is already open moves it to the
   * top and keeps its original opener.
   */
  open(el: E, opener: FocusTarget | null): void {
    const existing = this.stack.find((x) => x.el === el);
    this.stack = this.stack.filter((x) => x.el !== el);
    this.stack.push(existing ?? { el, opener });
    const pin = this.stack.findIndex((x) => x.el === this.pinned);
    if (pin >= 0 && el !== this.pinned) this.stack.push(...this.stack.splice(pin, 1)); // a later layer opens under the pin
    el.hidden = false;
    this.sync();
  }

  /** Opens `el` like {@link open} and keeps it on top: layers opened later go under it until it closes. */
  pin(el: E, opener: FocusTarget | null): void {
    this.pinned = el;
    this.open(el, opener);
  }

  /** Hides `el` and returns the element that opened it (or `null`). Closing a layer that isn't open just hides it. */
  close(el: E): FocusTarget | null {
    const entry = this.stack.find((x) => x.el === el);
    this.stack = this.stack.filter((x) => x.el !== el);
    if (el === this.pinned) this.pinned = null;
    el.hidden = true;
    el.style.zIndex = '';
    this.sync();
    return entry?.opener ?? null;
  }

  /** Applies `inert` and the draw order to match the stack. */
  private sync(): void {
    const top = this.top();
    for (const sib of this.siblings()) sib.inert = top !== null && sib !== top && !this.alwaysLive.includes(sib);
    this.stack.forEach((x, i) => (x.el.style.zIndex = String(this.baseZ + i)));
  }
}
