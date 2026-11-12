/**
 * Native feel on phones (sprint 21 A4, D179). style.css does most of it: no long-press callouts or
 * text selection on game controls, and `touch-action: none` on the board, so a pinch or double tap
 * there never zooms. Older iPhone Safari zooms on a pinch whatever `touch-action` says, so its
 * `gesturestart` is cancelled on the board too. The rest of the page keeps pinch zoom (D44, AX-17),
 * and the status bar colour follows the scene in theme.ts (`themeColor`).
 */
import { boardEl } from './dom';

/** Stops Safari's own pinch zoom on the board. Call once at boot. */
export function wireNativeFeel(): void {
  // `gesturestart` is Safari-only and not in the DOM typings; elsewhere it never fires.
  boardEl.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  // A long press on a control opens no menu (Android Chrome has no -webkit-touch-callout).
  boardEl.addEventListener('contextmenu', (e) => e.preventDefault());
}
