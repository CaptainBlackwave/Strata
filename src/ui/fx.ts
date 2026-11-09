/**
 * Effects built from DOM nodes and the Web Animations API: sand splashes, the seal shimmer,
 * the level-clear grains, the win bloom, the coin flight, the map touches and the screen
 * cross-fades. Implements design/competitive-roadmap.md item C1 (game feel) and sprint 10 F5
 * (D68: calm, a little richer; nothing loud or long). Timings and counts are in fx-plan.ts.
 *
 * Rules every effect here follows:
 * - transform and opacity only;
 * - nothing at all under `prefers-reduced-motion`, and nothing starts while the tab is hidden;
 * - every animation is tracked: a tap or key finishes them all at once, and they pause while
 *   the tab is hidden;
 * - particles stay within FX_BUDGET (60, the scene-fx cap).
 */
import { FX_COUNT, FX_MS, coinFlightPlan, effectAllowed, winBloomPlan } from './fx-plan';
import { sceneWinDisplayRuns } from './scene-fx';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Whether an effect may start now (reduced motion off, tab visible). */
const allowed = () => effectAllowed({ reduced: reduced(), hidden: document.hidden });
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

// ---- Tracking: skip on tap or key, pause while hidden ------------------------

const running = new Set<Animation>();
let wired = false;

/** Registers `a` so a tap or key finishes it and a hidden tab pauses it. Returns `a`. */
function track(a: Animation): Animation {
  wire();
  running.add(a);
  const drop = () => running.delete(a);
  a.addEventListener('finish', drop);
  a.addEventListener('cancel', drop);
  if (document.hidden) a.pause();
  return a;
}

/** Finishes every running effect at once (a tap or key during one skips it). */
export function finishEffects(): void {
  for (const a of [...running]) {
    try {
      a.finish();
    } catch {
      a.cancel(); // an animation that cannot finish (no end time) is dropped
    }
  }
}

/** Finishes the effects running on `el` only (e.g. Home's fade when the map opens over it at once). */
export function settle(el: Element): void {
  for (const a of [...running]) if ((a.effect as KeyframeEffect | null)?.target === el) a.finish();
}

function wire(): void {
  if (wired) return;
  wired = true;
  window.addEventListener('pointerdown', finishEffects, { capture: true, passive: true });
  window.addEventListener('keydown', finishEffects, { capture: true });
  document.addEventListener('visibilitychange', () => {
    for (const a of running) {
      if (document.hidden) a.pause();
      else a.play();
    }
  });
}

// ---- Particles -----------------------------------------------------------------

/** Options for one burst of particles. */
export interface BurstOptions {
  readonly x: number;
  readonly y: number;
  readonly colors: readonly string[];
  readonly count: number;
  /** Max travel distance in px. */
  readonly spread: number;
  /** Launch direction in degrees (0 = up), and the cone width around it. */
  readonly angle?: number;
  readonly cone?: number;
  readonly size?: number;
  readonly duration?: number;
  readonly gravity?: number;
  readonly className?: string;
}

/** Spawns a burst of particles at viewport coordinates. Example: `burst({ x, y, colors: ['#f2a541'], count: 12, spread: 30 })` */
export function burst(o: BurstOptions): void {
  if (!allowed()) return;
  const layer = fxLayer();
  const cone = ((o.cone ?? 360) * Math.PI) / 180;
  const base = (((o.angle ?? 0) - 90) * Math.PI) / 180;
  for (let i = 0; i < o.count; i++) {
    const p = document.createElement('i');
    p.className = o.className ?? 'grain';
    const size = (o.size ?? 5) * (0.6 + Math.random() * 0.8);
    p.style.cssText = `left:${o.x}px;top:${o.y}px;width:${size}px;height:${size}px;background:${o.colors[i % o.colors.length]}`;
    layer.appendChild(p);
    const a = base + (Math.random() - 0.5) * cone;
    const d = o.spread * (0.35 + Math.random() * 0.65);
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    const g = o.gravity ?? 0;
    const dur = (o.duration ?? 600) * (0.7 + Math.random() * 0.6);
    track(
      p.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) scale(0.9)`, opacity: 1, offset: 0.6 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + g}px)) scale(0.3)`, opacity: 0 },
        ],
        { duration: dur, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' },
      ),
    ).addEventListener('finish', () => p.remove());
  }
}

/**
 * Gentle motes in `layer`: small round grains that fade in, drift up `rise` px with a little
 * sideways sway and fade out, each finishing within `within` ms. Positions come from `at`.
 */
function motes(layer: HTMLElement, n: number, colors: readonly string[], at: () => readonly [number, number], rise: readonly [number, number], within: number): void {
  for (let i = 0; i < n; i++) {
    const [x, y] = at();
    const m = document.createElement('i');
    m.className = 'mote';
    const size = rand(3, 5.5);
    m.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${colors[i % colors.length]}`;
    layer.appendChild(m);
    const dur = rand(within * 0.7, within * 0.9);
    const up = rand(rise[0], rise[1]);
    const side = rand(-10, 10);
    track(
      m.animate(
        [
          { transform: 'translate(-50%, -50%)', opacity: 0 },
          { transform: `translate(calc(-50% + ${side * 0.4}px), calc(-50% - ${up * 0.35}px))`, opacity: 0.95, offset: 0.3 },
          { transform: `translate(calc(-50% + ${side}px), calc(-50% - ${up}px))`, opacity: 0 },
        ],
        { duration: dur, delay: rand(0, within - dur), easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' },
      ),
    ).addEventListener('finish', () => m.remove());
  }
}

// ---- Seal -----------------------------------------------------------------------

/**
 * The seal (D68): a soft band of light sweeps up the sealed jar's glass and a few sand
 * motes in its colour rise off the cork, about 600 ms. The cork drop stays in CSS.
 */
export function sealShimmer(jar: HTMLElement, color: string): void {
  if (!allowed()) return;
  const glass = jar.querySelector<HTMLElement>('.glass');
  if (!glass) return;
  glass.querySelector('.seal-sweep')?.remove();
  const sweep = document.createElement('span');
  sweep.className = 'seal-sweep';
  sweep.setAttribute('aria-hidden', 'true');
  glass.appendChild(sweep);
  const h = glass.clientHeight;
  track(
    sweep.animate(
      [
        { transform: 'translateY(100%)', opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { opacity: 0.9, offset: 0.75 },
        { transform: `translateY(${-h}px)`, opacity: 0 },
      ],
      { duration: FX_MS.seal, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' },
    ),
  ).addEventListener('finish', () => sweep.remove());
  const r = glass.getBoundingClientRect();
  motes(fxLayer(), FX_COUNT.sealMotes, [color, '#fff6d8'], () => [rand(r.left + r.width * 0.2, r.right - r.width * 0.2), r.top + rand(-4, 8)], [22, 42], FX_MS.seal);
}

// ---- Win ------------------------------------------------------------------------

/** The level-clear grains in every board colour, thrown up from the board: two soft bursts. */
export function celebrate(colors: readonly string[]): void {
  if (!allowed()) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const per = FX_COUNT.celebrate / 2;
  for (let k = 0; k < 2; k++) {
    window.setTimeout(() => {
      burst({ x: w * (0.32 + 0.36 * k), y: h * 0.62, colors, count: per, spread: h * 0.32, angle: 0, cone: 70, size: 6, duration: 1100, gravity: h * 0.2 });
    }, k * 160);
  }
}

/**
 * The win bloom (D68): a soft glow opens behind the win card and sand motes in the board's
 * colours drift up around it, about 1 s, then the glow stays still. It draws inside the win
 * overlay, above the dim backdrop and below the card. When the scene draws its own win
 * display there (D40), the bloom stays out of the way so the two never stack.
 */
export function winBloom(colors: readonly string[]): void {
  const host = document.getElementById('win');
  host?.querySelector('.win-bloom')?.remove();
  const card = host?.querySelector<HTMLElement>('.win-card');
  if (!host || !card || !allowed()) return;
  const plan = winBloomPlan(sceneWinDisplayRuns());
  if (!plan.glow) return;
  const layer = document.createElement('div');
  layer.className = 'win-bloom';
  layer.setAttribute('aria-hidden', 'true');
  host.prepend(layer);
  const r = card.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const w = card.offsetWidth;
  const h = card.offsetHeight;
  const glow = document.createElement('span');
  glow.className = 'bloom-glow';
  const size = Math.max(w, h) * 1.7;
  glow.style.cssText = `left:${cx}px;top:${cy}px;width:${size}px;height:${size}px`;
  layer.appendChild(glow);
  track(
    glow.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.55)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.55 },
        { transform: 'translate(-50%, -50%) scale(1.04)', opacity: 0.7 },
      ],
      { duration: FX_MS.winBloom, easing: 'cubic-bezier(.25,.6,.3,1)', fill: 'forwards' },
    ),
  );
  // Motes start just outside the card's edges, so none drifts over its text.
  const at = (): [number, number] => {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return [rand(cx - w / 2, cx + w / 2), cy - h / 2 - rand(4, 18)];
    if (side === 1) return [rand(cx - w / 2, cx + w / 2), cy + h / 2 + rand(10, 40)];
    return [side === 2 ? cx - w / 2 - rand(6, 22) : cx + w / 2 + rand(6, 22), rand(cy - h / 2, cy + h / 2)];
  };
  motes(layer, plan.motes, [...colors, '#fff6d8'], at, [26, 56], FX_MS.winBloom);
}

/**
 * The coin flight on a first clear (D68): 3 to 5 coins fly from `from` (the reward pill's
 * coin) to `to` (the coin counter) in about 500 ms; `onLand` runs when the last one lands,
 * at once without motion, or when a tap skips the flight.
 */
export function flyCoins(from: Element | null, to: Element | null, reward: number, onLand: () => void): void {
  const plan = coinFlightPlan(reward);
  if (!from || !to || !plan.count || !allowed()) return onLand();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (!a.width || !b.width) return onLand(); // a hidden end (closed card or chip): nothing to fly between
  const x0 = a.left + a.width / 2;
  const y0 = a.top + a.height / 2;
  const dx = b.left + b.width / 2 - x0;
  const dy = b.top + b.height / 2 - y0;
  const layer = fxLayer();
  let left = plan.count;
  for (let k = 0; k < plan.count; k++) {
    const c = document.createElement('i');
    c.className = 'coin fly-coin';
    c.style.cssText = `left:${x0}px;top:${y0}px`;
    layer.appendChild(c);
    const sway = (k - (plan.count - 1) / 2) * 10;
    track(
      c.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.8)', opacity: 0 },
          { transform: `translate(calc(-50% + ${dx * 0.45 + sway}px), calc(-50% + ${dy * 0.45 - 26}px)) scale(1.05)`, opacity: 1, offset: 0.45 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.75)`, opacity: 1, offset: 0.92 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6)`, opacity: 0 },
        ],
        { duration: plan.each, delay: k * plan.stagger, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'both' },
      ),
    ).addEventListener('finish', () => {
      c.remove();
      if (--left === 0) onLand();
    });
  }
}

// ---- Map ------------------------------------------------------------------------

/**
 * What the map shows when it next opens (sprint 10 F5): `reveal` is the lowest level first
 * cleared since the map was last seen (the stretch from it to the next stone fades in), and
 * `perfect` a level whose replay just earned Perfect (its mark pops in). Both are consumed
 * by the next open, also under reduced motion, so they never play late.
 */
export const mapFx: { reveal: number | null; perfect: number } = { reveal: null, perfect: 0 };

/** A small pop for a mark that just appeared (the Perfect mark on a stone), after the map's fade-in. */
export function popIn(el: Element): void {
  if (!allowed()) return;
  track(
    el.animate(
      [
        { transform: 'scale(0)', opacity: 0 },
        { transform: 'scale(1.25)', opacity: 1, offset: 0.6 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: FX_MS.mapPop, delay: FX_MS.mapDelay, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'backwards' },
    ),
  );
}

/**
 * The newly unlocked stretch: `dots` fade in one after another along it, then the solid
 * path (`stroke`) fades in under them and the dots fade away. `done` runs at the end, at
 * once without motion, or when a tap skips it. Returns false if it did not run.
 */
export function revealStretchFx(stroke: Element, dots: readonly Element[], done: () => void): boolean {
  if (!allowed()) return false;
  const dotMs = 340;
  const span = FX_MS.pathReveal - dotMs;
  const stagger = dots.length > 1 ? Math.min(50, (span * 0.6) / (dots.length - 1)) : 0;
  dots.forEach((d, i) =>
    track(
      d.animate(
        [{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1)', offset: 0.35 }, { opacity: 1, transform: 'scale(1)', offset: 0.7 }, { opacity: 0, transform: 'scale(1)' }],
        { duration: dotMs + span * 0.4, delay: FX_MS.mapDelay + i * stagger, fill: 'both' },
      ),
    ),
  );
  track(
    stroke.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FX_MS.pathReveal * 0.55, delay: FX_MS.mapDelay + FX_MS.pathReveal * 0.45, easing: 'ease-out', fill: 'both' }),
  ).addEventListener('finish', done);
  return true;
}

// ---- Screen transitions -----------------------------------------------------------

/** A screen fading in over the one below (Home over the board, the map over Home), with an optional rise in px. */
export function screenIn(el: HTMLElement, rise = 0): void {
  if (!allowed()) return;
  track(
    el.animate([{ opacity: 0, transform: `translateY(${rise}px)` }, { opacity: 1, transform: 'none' }], {
      duration: FX_MS.transition,
      easing: 'cubic-bezier(.2,.6,.3,1)',
    }),
  );
}

/**
 * Keeps `el` out of sight while the screen over it fades in, then shows it (Home under a map
 * opened straight from the board, so the fade is board to map, not via Home).
 */
export function screenHold(el: HTMLElement): void {
  if (!allowed()) return;
  track(el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.99 }, { opacity: 1 }], { duration: FX_MS.transition }));
}

/**
 * A screen fading out over the one it reveals. The real screen closes at once (input,
 * focus and state never wait); a still copy of it fades out on top, takes no input and is
 * hidden from assistive tech, so a tap or key goes straight to the new screen.
 */
export function screenOut(el: HTMLElement): void {
  if (!allowed() || el.hidden) return;
  const ghost = el.cloneNode(true) as HTMLElement;
  const src = [el, ...el.querySelectorAll<HTMLElement>('*')];
  const dst = [ghost, ...ghost.querySelectorAll<HTMLElement>('*')];
  for (const d of dst) d.removeAttribute('id');
  ghost.classList.add('screen-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  ghost.style.zIndex = '';
  document.body.appendChild(ghost);
  src.forEach((s, i) => {
    const d = dst[i];
    if (s.scrollTop) d.scrollTop = s.scrollTop;
    if (s instanceof HTMLCanvasElement && d instanceof HTMLCanvasElement && s.width && s.height) d.getContext('2d')?.drawImage(s, 0, 0);
  });
  track(ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FX_MS.transition, easing: 'ease-out', fill: 'forwards' })).addEventListener('finish', () => ghost.remove());
}

function fxLayer(): HTMLElement {
  let layer = document.getElementById('fx');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'fx';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  return layer;
}
