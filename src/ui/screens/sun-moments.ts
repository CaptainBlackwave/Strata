/**
 * The sunrise moment (sprint 29 N4, D223; design/gdd/jar-mechanics.md §2.11 "Moments"): when the
 * sunrise jar is filled, a warm light comes up over the board for a moment, "the day begins". The
 * board calls `sunriseMoment()` when a pour event carries `sunrise` (screens/board.ts). The dusk win
 * is in screens/win.ts.
 *
 * One fixed layer (`.sun-dawn`, style.css) above the board and its canvas, so the Classic and the
 * Realistic board brighten alike; opacity only. Reduced motion or a hidden tab: nothing plays, the
 * moment is the filled half-sun alone (instant, as the beam and the tide). A tap or key finishes it,
 * as every effect (fx.ts). Timings are in logic/sun.ts.
 */
import { trackEffect } from '../fx';
import { reducedMotion } from '../dom';
import { SUNRISE_MS, sunriseFrames, sunrisePlays } from '../logic/sun';

/** Brightens the board for a moment: the sunrise jar was just filled. Safe to call at any time. */
export function sunriseMoment(): void {
  document.querySelector('.sun-dawn')?.remove(); // a second call (Undo, then the same pour) starts afresh
  if (!sunrisePlays({ reduced: reducedMotion(), hidden: document.hidden })) return;
  const host = document.getElementById('app') ?? document.body;
  const light = document.createElement('div');
  light.className = 'sun-dawn';
  light.setAttribute('aria-hidden', 'true');
  host.appendChild(light);
  const a = trackEffect(light.animate(sunriseFrames(), { duration: SUNRISE_MS, easing: 'ease-in-out', fill: 'both' }));
  const done = () => light.remove();
  a.addEventListener('finish', done);
  a.addEventListener('cancel', done);
}

/**
 * The dusk over the board while a sunset win's glow run plays (D223: the win plays with a dusk tint).
 * The tint (`.sun-dusk`) fades in over `fadeMs` (0 under reduced motion: it is simply there) above the
 * board, then the win card's own dusk (`.win.dusk`) takes over. Returns the function that clears it,
 * after `afterMs` (the win overlay's own fade-in, so the tint never dips).
 */
export function duskMoment(fadeMs: number): (afterMs: number) => void {
  document.querySelector('.sun-dusk')?.remove();
  const host = document.getElementById('app') ?? document.body;
  const tint = document.createElement('div');
  tint.className = 'sun-dusk';
  tint.setAttribute('aria-hidden', 'true');
  host.appendChild(tint);
  if (fadeMs > 0) trackEffect(tint.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fadeMs, easing: 'ease-out', fill: 'backwards' }));
  return (afterMs) => {
    if (afterMs > 0) window.setTimeout(() => tint.remove(), afterMs);
    else tint.remove();
  };
}
