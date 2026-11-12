/**
 * The board events' motion on the canvas (sprint 19 S5/S6), as pure functions of progress, so the
 * canvas moves exactly as style.css and fx.ts move the DOM board. Each takes `u`, 0..1 through the
 * effect (already eased where CSS eases the whole run), and returns what to draw.
 */
import { cubicBezier } from './geometry';
import type { BoardMode } from './switch';

/** A transform for one frame: an offset in CSS px, a rotation in degrees, a scale and an opacity. */
export interface Pose {
  readonly x: number;
  readonly y: number;
  readonly rotate: number;
  readonly scale: number;
  readonly alpha: number;
}

const REST: Pose = { x: 0, y: 0, rotate: 0, scale: 1, alpha: 1 };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * How high jar `i` is lifted, as a share of `--lift`: the selected jar fully, the hint's "from" jar
 * half (style.css `.jar.hint-from:not(.selected)`), the jar a pour carries away not at all.
 */
export function liftTarget(i: number, selected: number | null, hintFrom: number | null, carried: number | null): number {
  if (i === carried) return 0;
  if (i === selected) return 1;
  return i === hintFrom ? 0.5 : 0;
}

const corkEase = cubicBezier(0.3, 1.5, 0.5, 1);

/**
 * The cork dropping in (style.css `cork-drop`, 520 ms, `cubic-bezier(0.3, 1.5, 0.5, 1)`): from 160%
 * of its height above, tipped −18° and faint, past its seat at 55% (6% low, 4°), to rest.
 * `h` is the cork's height in px.
 */
export function corkDrop(u: number, h: number): Pose {
  if (u >= 1) return REST;
  const e = corkEase(Math.max(0, u));
  if (e < 0.55) {
    const t = e / 0.55;
    return { x: 0, y: lerp(-1.6, 0.06, t) * h, rotate: lerp(-18, 4, t), scale: lerp(0.9, 1, t), alpha: t };
  }
  const t = (e - 0.55) / 0.45;
  return { x: 0, y: lerp(0.06, 0, t) * h, rotate: lerp(4, 0, t), scale: 1, alpha: 1 };
}

/** The refusal shake (style.css `nope`, 300 ms ease-in-out): −4, +4, −4, +4 px at 20, 40, 60, 80%. */
export function nopeShake(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  const keys = [0, -4, 4, -4, 4, 0];
  const f = u * 5;
  const k = Math.min(4, Math.floor(f));
  const t = f - k;
  const s = t * t * (3 - 2 * t); // ease-in-out between keyframes
  return lerp(keys[k], keys[k + 1], s);
}

/** The Shuffle hop (jars.ts `renderAllJars(true)`, 260 ms linear): up 6 px and back. */
export function shuffleHop(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  return u < 0.5 ? -12 * u : -6 + 12 * (u - 0.5);
}

const glowEase = cubicBezier(0.3, 0.6, 0.4, 1);

/**
 * One jar's glow in the win run (fx.ts `winGlowRun`, `FX_MS.winGlowEach`): it rises to full at 45%,
 * from 92% size, then eases back to 55%, and holds there until the card opens.
 */
export function glowAt(u: number): { alpha: number; scale: number } {
  if (u <= 0) return { alpha: 0, scale: 0.92 };
  const e = glowEase(Math.min(1, u));
  if (e < 0.45) {
    const t = e / 0.45;
    return { alpha: t, scale: lerp(0.92, 1, t) };
  }
  return { alpha: lerp(1, 0.55, (e - 0.45) / 0.55), scale: 1 };
}

/**
 * A pour still settling must snap to its end when the board moved on (Undo, Restart, Shuffle, an
 * extra jar or a new pour): once it has released the input, any board but its own result.
 */
export function mustSnapPour(released: boolean, sameBoard: boolean): boolean {
  return released && !sameBoard;
}

/**
 * The board after a WebGL context event (S6): a lost context goes to the DOM board at once, so play
 * continues; a restored one goes back to what the player chose (`wanted`, from the Settings toggle
 * and the address), and stays on the DOM while still lost.
 */
export function boardAfterContext(lost: boolean, wanted: BoardMode): BoardMode {
  return lost ? 'dom' : wanted;
}
