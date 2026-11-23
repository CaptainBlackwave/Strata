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
 *
 * The light waits until the pour has finished (`delayMs`, logic/sun.ts `sunriseDelay`). The wait is a
 * timer, not an animation delay, so a tap while the jar flies home does not skip a light that has not
 * shown yet; and if an Undo or Restart takes the filled sunrise jar back meanwhile, it never plays.
 */
import { trackEffect } from '../fx';
import { reducedMotion } from '../dom';
import { state } from '../state';
import { SUNRISE_MS, sunriseFrames, sunrisePlays, sunriseRisen } from '../logic/sun';

let waiting = 0;

/**
 * Brightens the board for a moment, `delayMs` from now: the sunrise jar was just filled. Safe to call
 * at any time; a second call replaces a light that is waiting or playing.
 */
export function sunriseMoment(delayMs = 0): void {
  window.clearTimeout(waiting);
  waiting = 0;
  document.querySelector('.sun-dawn')?.remove(); // a second call (Undo, then the same pour) starts afresh
  if (!sunrisePlays({ reduced: reducedMotion(), hidden: document.hidden })) return;
  if (delayMs > 0) {
    waiting = window.setTimeout(() => {
      waiting = 0;
      if (sunriseRisen(state.session.board)) sunriseMoment();
    }, delayMs);
    return;
  }
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
