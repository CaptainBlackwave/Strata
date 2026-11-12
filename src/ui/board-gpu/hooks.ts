/**
 * The GPU board's hooks into today's board (sprint 19 S2/S4). No Pixi here: the renderer is loaded
 * on demand, only when the switch is on, so the DOM board (the default) is unchanged and its bundle
 * carries none of it. The jar buttons stay as the input and accessibility layer; with the canvas on,
 * `#board[data-render='gpu']` hides their glass and sand (style.css) and keeps their focus ring,
 * selection lift, labels, keys and hit areas.
 */
import { pourAmount } from '../../core/board';
import { defaultDims } from '../sand';
import { boardEl, reducedMotion } from '../dom';
import { ANIM, audio, config, state } from '../state';
import { GPU_FLAG_KEY, type BoardMode, chooseBoardMode, detectWebGL } from './switch';
import { type JarGeometry, jarGeometry, restRect } from './geometry';
import { hexToRgb } from './paint';
import type { GlassLook } from './art';
import type { BoardLook, GpuBoard } from './renderer';
import { FLIP_MS } from '../logic/flip';
import { CLAM_OPEN_MS } from '../logic/clam';
import { FX_MS } from '../fx-plan';
import { boardAfterContext } from './events';
import type { PillLook } from './mech-art';

/** Today's `.jar` selection transition (style.css), mirrored on the canvas. */
const SELECT_MS = 160;
/** The `--buried` colour in style.css, used if the custom property can't be read. */
const BURIED_FALLBACK = '#b9a88d';
/** style.css `thaw` and `unlock` keyframes (ms). */
const THAW_MS = 760;
const UNLOCK_MS = 800;
/** style.css `cork-drop` and `nope`; the Shuffle hop in jars.ts `renderAllJars` (260 ms, 25 ms a jar). */
const CORK_MS = 520;
const NOPE_MS = 300;
const HOP_MS = 260;
const HOP_STAGGER = 25;
/** Night scenes, where the DOM dims the clam shell (style.css). */
const NIGHT_SCENES = new Set(['moonlit', 'harvestmoon', 'newyear']);

function storedFlag(): string | null {
  try {
    return localStorage.getItem(GPU_FLAG_KEY);
  } catch {
    return null;
  }
}

let mode: BoardMode = 'dom';
let gpu: GpuBoard | null = null;
let loading: Promise<void> | null = null;
/** The current board is drawn by the canvas. */
let active = false;
let resizeTimer = 0;

let watching = false;
/** WebGL works on this device (checked once). */
let webgl: boolean | null = null;

/** True when this device can draw the Realistic board (WebGL works). Settings disables the switch otherwise. */
export function realisticAvailable(): boolean {
  webgl ??= detectWebGL(() => document.createElement('canvas'));
  return webgl;
}

/** Listens for resizes and scene or style changes that move or recolour the canvas, once. */
function watchLayout(): void {
  if (watching) return;
  watching = true;
  window.addEventListener('resize', relayoutSoon);
  window.addEventListener('orientationchange', relayoutSoon);
  // A scene change (tokens on <html>, data-theme on <body>) or a worn style (data-* on #board) redraws the glass.
  const watch = new MutationObserver(() => {
    tokens = null;
    relayoutSoon();
  });
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  watch.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  watch.observe(boardEl, { attributes: true, attributeFilter: ['data-glass', 'data-sand'] });
}

/** Picks the board from the address, the dev flag, the Settings choice and WebGL. */
function decide(): BoardMode {
  return chooseBoardMode({ search: location.search, storedFlag: storedFlag(), dev: import.meta.env.DEV, webgl: realisticAvailable(), realistic: state.save?.settings.realistic === true });
}

/** Decides the board at boot: the Settings choice (D164), or `?board=gpu` / the dev flag for testing. */
export function initBoardMode(): BoardMode {
  mode = decide();
  if (mode === 'gpu') watchLayout();
  return mode;
}

/**
 * Switches between Classic and Realistic now (the Settings toggle, D164): the board in play is
 * redrawn by the chosen renderer, nothing else changes. Returns the board in use.
 */
export function applyBoardSetting(): BoardMode {
  mode = decide();
  if (mode === 'gpu') {
    watchLayout();
    gpuLayout();
  } else {
    active = false;
    boardEl.dataset.render = 'dom';
    gpu?.setVisible(false);
    state.jarEls.forEach((el) => el.classList.remove('gpu-away'));
  }
  return mode;
}

/** The board in use: `'gpu'` once the renderer has started, else `'dom'`. */
export function boardMode(): BoardMode {
  return mode === 'gpu' && gpu ? 'gpu' : 'dom';
}

function relayoutSoon(): void {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(gpuLayout, 80);
}

function load(): Promise<void> {
  loading ??= import('./renderer').then(async ({ GpuBoard }) => {
    const neutral = getComputedStyle(document.body).getPropertyValue('--buried').trim() || BURIED_FALLBACK;
    gpu = await GpuBoard.create({
      host: document.getElementById('app') ?? document.body,
      palette: config.palette.map((c) => hexToRgb(c.hex)),
      neutral: hexToRgb(neutral),
      paletteHex: config.palette.map((c) => c.hex),
      motion: {
        liftMs: ANIM.lift, backMs: ANIM.back, selectMs: SELECT_MS, flipMs: FLIP_MS, clamOpenMs: CLAM_OPEN_MS, thawMs: THAW_MS, unlockMs: UNLOCK_MS,
        corkMs: CORK_MS, nopeMs: NOPE_MS, hopMs: HOP_MS, hopStagger: HOP_STAGGER, glowMs: FX_MS.winGlowEach,
      },
      reducedMotion,
      dims: defaultDims(),
      onContext,
    });
    if (!gpu) mode = 'dom'; // WebGL failed after all: today's board stays
  }).catch(() => {
    mode = 'dom';
  });
  return loading;
}

/** Each jar's drawing geometry from its button and glass, at rest (the selection lift taken out). */
function readGeometry(): JarGeometry[] {
  const capacity = state.session.board.capacity;
  return state.jarEls.map((el) => {
    const glass = (el.querySelector('.glass') as HTMLElement).getBoundingClientRect();
    const tf = getComputedStyle(el).transform;
    const ty = tf && tf !== 'none' ? new DOMMatrixReadOnly(tf).m42 : 0;
    return jarGeometry(restRect(glass, ty), state.unitHeight, capacity, defaultDims(), restRect(el.getBoundingClientRect(), ty));
  });
}

/** The scene's and the worn glass's resolved colours; `null` until read (and after a change). */
let tokens: { glass: GlassLook; ink: string } | null = null;

/**
 * Resolves the glass colours the DOM uses: the worn piece's `--style-*` over the scene's `--glass-edge`
 * and `--glass` (style.css), read through a hidden probe in `#board` so `color-mix()` resolves.
 */
function readTokens(): { glass: GlassLook; ink: string } {
  const probe = document.createElement('i');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;color:transparent';
  boardEl.appendChild(probe);
  const read = (expr: string, fallback: string): string => {
    probe.style.color = 'transparent';
    probe.style.color = expr;
    const v = getComputedStyle(probe).color;
    return v && v !== 'rgba(0, 0, 0, 0)' ? v : fallback;
  };
  const body = read('var(--glass)', 'rgba(255,255,255,0.38)');
  const edge = read('var(--style-edge, var(--glass-edge))', 'rgba(90,70,50,0.55)');
  const glass: GlassLook = {
    edge,
    body: read('var(--style-body, var(--glass))', body),
    band: read('var(--style-band, transparent)', 'rgba(0,0,0,0)'),
    rim: read('var(--style-rim, var(--glass))', body),
    shadow: 'rgb(60,44,24)',
    night: NIGHT_SCENES.has(document.body.dataset.theme ?? '') || isDark(read('var(--bg-bottom)', '#f1dfc1')),
  };
  const ink = read('var(--ink)', '#4a3b2c');
  probe.remove();
  return { glass: { ...glass, shadow: glass.night ? 'rgb(0,0,0)' : 'rgb(60,44,24)' }, ink };
}

/** True for a dark CSS colour (`rgb(…)`): a night scene's background. */
function isDark(color: string): boolean {
  const m = /rgba?\(([^)]+)\)/.exec(color);
  if (!m) return false;
  const [r, g, b] = m[1].split(',').map((x) => parseFloat(x));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 90;
}

/** The scene's glow colours (`--glow`, `--glow-core`: `r, g, b` triplets, D73). */
function glowTokens(): { glow: string; glowCore: string } {
  const css = getComputedStyle(document.documentElement);
  return { glow: css.getPropertyValue('--glow').trim() || '255, 236, 170', glowCore: css.getPropertyValue('--glow-core').trim() || '255, 246, 216' };
}

/** The look now: tokens (cached), the worn sand and cork pieces and the patterns setting. */
function currentLook(): BoardLook {
  tokens ??= readTokens();
  return { glass: tokens.glass, ink: tokens.ink, sand: boardEl.dataset.sand ?? 'plain', patterns: state.save.settings.patterns, cork: boardEl.dataset.cork ?? 'cork', ...glowTokens() };
}

/** The hint's "from" jar, from the DOM's `.hint-from` class (board.ts `showHint`), or `null`. */
function hintFrom(): number | null {
  const i = state.jarEls.findIndex((el) => el.classList.contains('hint-from'));
  return i < 0 ? null : i;
}

/**
 * WebGL lost or got back its context (S6). Lost: the DOM board takes over at once (its jars are
 * always up to date), so play goes on. Restored: back to the canvas if the player still wants it.
 */
function onContext(lost: boolean): void {
  if (boardAfterContext(lost, decide()) === 'dom') {
    active = false;
    boardEl.dataset.render = 'dom';
    gpu?.setVisible(false);
    state.jarEls.forEach((el) => el.classList.remove('gpu-away'));
    return;
  }
  tokens = null;
  gpuLayout();
}

/**
 * After the DOM board is (re)built: picks canvas or DOM for this board and lays the canvas out over
 * the jar buttons. Hooked at the end of `buildJars`, and on resize and orientation change.
 */
export function gpuLayout(): void {
  if (mode !== 'gpu' || !state.session) return;
  if (!gpu) {
    void load().then(() => gpu && gpuLayout());
    return;
  }
  const board = state.session.board;
  active = state.jarEls.length === board.jars.length;
  boardEl.dataset.render = active ? 'gpu' : 'dom';
  gpu.setVisible(active);
  if (!active) return;
  gpu.setLook(currentLook());
  gpu.layout(readGeometry(), board, state.selected);
}

/** A jar was redrawn or the selection changed: the canvas catches up (only changed jars redraw). */
export function gpuInvalidate(): void {
  if (!active || !gpu) return;
  gpu.setLook(currentLook()); // the patterns setting or the sand piece may have changed
  gpu.sync(state.session.board, state.selected, false, hintFrom());
  markAway();
}

/** Jar `i` sealed (from `sealFx`): the canvas cork drops in. */
export function gpuSeal(i: number): void {
  if (active && gpu) gpu.seal(i, state.session.board.jars[i], state.session.board.capacity);
}

/** A refused tap on jar `i` (from `nope`): the canvas jar shakes as the button does. */
export function gpuNope(i: number): void {
  if (active && gpu) gpu.nope(i);
}

/** Shuffle's hop (from `renderAllJars(true)`) on the canvas jars. */
export function gpuHop(): void {
  if (active && gpu) gpu.hop();
}

/**
 * The win glow run on the canvas (from `showWin`), or `null` on the DOM board, where `winGlowRun`
 * draws it. Returns the stop function.
 */
export function gpuWinGlow(steps: readonly { readonly jar: number; readonly at: number }[]): (() => void) | null {
  return active && gpu ? gpu.winGlow(steps) : null;
}

/** The DOM's hourglass count pill on jar `i`, measured so the canvas can carry it in a pour. */
function pillOf(i: number): (PillLook & { left: number; top: number }) | null {
  const el = state.jarEls[i]?.querySelector('.hourglass-mark') as HTMLElement | null;
  if (!el || !state.session.board.jars[i].hourglass) return null;
  const r = el.getBoundingClientRect();
  if (!r.width) return null;
  const css = getComputedStyle(el);
  const tf = getComputedStyle(state.jarEls[i]).transform;
  const ty = tf && tf !== 'none' ? new DOMMatrixReadOnly(tf).m42 : 0;
  return {
    left: r.left, top: r.top - ty, width: r.width, height: r.height,
    bg: css.backgroundColor, fg: css.color, border: css.borderTopColor,
    font: `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`, text: el.textContent ?? '',
  };
}

/** The hourglass flip on the canvas (from `flipFx`). */
export function gpuFlip(i: number, delay: number): void {
  if (active && gpu) gpu.flip(i, delay);
}

/** The clam opening on the canvas (from `clamOpenFx`). */
export function gpuClamOpen(i: number, delay: number): void {
  if (active && gpu) gpu.clamOpen(i, delay);
}

/** Stops the canvas's flips and clam openings (from `cancelFlips`). */
export function gpuCancelFlips(): void {
  if (active && gpu) gpu.cancelFlips();
}

/** The jar a pour carries away keeps its DOM text marks (hourglass count) off its empty button. */
function markAway(): void {
  const away = gpu?.away ?? null;
  state.jarEls.forEach((el, i) => el.classList.toggle('gpu-away', i === away));
}

/** True when the canvas plays this pour. Reduced motion never simulates: the DOM path snaps. */
export function gpuOwnsPour(): boolean {
  return active && !!gpu && !reducedMotion();
}

/** What a GPU pour hands back to the board screen when it ends. */
export interface GpuPourEnds {
  /** Puts the input lock back (`finishPour`). */
  readonly finish: (from: number) => void;
  /** Shows the win card if the board was won (`showWin`). */
  readonly win: () => void;
}

/**
 * The pour on the canvas (in place of `animatePour`'s DOM animation). The session stays the truth:
 * `state.session.pour` is called once, when the first grain reaches the target (where the DOM
 * calls it, as its stream lands), and the canvas snaps to the board it returns.
 */
export function gpuPour(from: number, to: number, ends: GpuPourEnds): Promise<void> {
  state.busy = true;
  const board = state.session.board;
  const moved = pourAmount(board, from, to);
  const targetLen = board.jars[to].units.length;
  const seed = (state.session.moves + 1) * 7919 + from * 131 + to;
  const pill = pillOf(from);
  state.jarEls[from]?.classList.add('gpu-away');
  return gpu!
    .playPour(from, to, board, seed, {
      pill,
      spill: () => audio.play('pour', { units: moved }),
      land: () => {
        state.session.pour(from, to);
        audio.play('land', { pitch: targetLen, units: moved });
        return state.session.board;
      },
      release: () => {
        state.returning.add(from);
        ends.finish(from);
      },
    })
    .then(() => {
      markAway();
      state.returning.delete(from);
      if (state.pendingWin) ends.win();
    });
}
