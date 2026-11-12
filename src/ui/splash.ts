/**
 * The splash (sprint 21 A2, D179): index.html's inline-styled `#splash`, the logo jars on the saved
 * scene's background (read by a script in index.html's <head>, sprint 22 L2, D182), covers the page
 * from the first paint so nothing unstyled ever shows. Once the first screen is drawn it fades out (a short fade, none under reduced motion) and is removed.
 */
import { reducedMotion } from './dom';

/** The splash's fade out (ms). */
const FADE_MS = 180;

/** Removes the splash after the first screen has painted. Safe to call more than once. */
export function hideSplash(): void {
  const el = document.getElementById('splash');
  if (!el) return;
  // Two frames: the first screen's layout and paint land before the splash goes.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (reducedMotion() || typeof el.animate !== 'function') return el.remove();
      const fade = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' });
      fade.onfinish = () => el.remove();
      fade.oncancel = () => el.remove();
    }),
  );
}
