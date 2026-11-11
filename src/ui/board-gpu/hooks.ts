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
import { GPU_FLAG_KEY, type BoardMode, chooseBoardMode, detectWebGL, needsDomBoard } from './switch';
import { type JarGeometry, jarGeometry, restRect } from './geometry';
import { hexToRgb } from './paint';
import type { GpuBoard } from './renderer';

/** Today's `.jar` selection transition (style.css), mirrored on the canvas. */
const SELECT_MS = 160;
/** The `--buried` colour in style.css, used if the custom property can't be read. */
const BURIED_FALLBACK = '#b9a88d';

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

/** Decides the board once, at boot. `?board=gpu` (or the dev flag) and WebGL give the GPU board. */
export function initBoardMode(): BoardMode {
  mode = chooseBoardMode({
    search: location.search,
    storedFlag: storedFlag(),
    dev: import.meta.env.DEV,
    webgl: detectWebGL(() => document.createElement('canvas')),
  });
  if (mode === 'gpu') {
    window.addEventListener('resize', relayoutSoon);
    window.addEventListener('orientationchange', relayoutSoon);
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
      motion: { liftMs: ANIM.lift, backMs: ANIM.back, selectMs: SELECT_MS },
      reducedMotion,
      dims: defaultDims(),
    });
    if (!gpu) mode = 'dom'; // WebGL failed after all: today's board stays
  }).catch(() => {
    mode = 'dom';
  });
  return loading;
}

/** Each jar's drawing geometry from its button, at rest (the selection lift taken out). */
function readGeometry(): JarGeometry[] {
  const capacity = state.session.board.capacity;
  return state.jarEls.map((el) => {
    const glass = (el.querySelector('.glass') as HTMLElement).getBoundingClientRect();
    const tf = getComputedStyle(el).transform;
    const ty = tf && tf !== 'none' ? new DOMMatrixReadOnly(tf).m42 : 0;
    return jarGeometry(restRect(glass, ty), state.unitHeight, capacity, defaultDims());
  });
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
  // TODO(sprint 19 S3): special jars and patterns on the canvas; until then such a board is DOM.
  active = !needsDomBoard(board, state.save.settings.patterns) && state.jarEls.length === board.jars.length;
  boardEl.dataset.render = active ? 'gpu' : 'dom';
  gpu.setVisible(active);
  if (active) gpu.layout(readGeometry(), board, state.selected);
}

/** A jar was redrawn or the selection changed: the canvas catches up (only changed jars redraw). */
export function gpuInvalidate(): void {
  if (active && gpu) gpu.sync(state.session.board, state.selected);
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
  return gpu!
    .playPour(from, to, board, seed, {
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
      state.returning.delete(from);
      if (state.pendingWin) ends.win();
    });
}
