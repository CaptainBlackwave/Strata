/**
 * Which board draws the jars (sprint 19 S2, docs/architecture/adr-0001-gpu-sand-board.md decision 5).
 * Pure: the caller passes the address, the stored flag and whether WebGL works.
 */
import type { Board } from '../../core/board';

/** The DOM board (today's, the default) or the PixiJS board. */
export type BoardMode = 'gpu' | 'dom';

/** The dev-only localStorage key that turns the GPU board on (`localStorage['strata.board'] = 'gpu'`). */
export const GPU_FLAG_KEY = 'strata.board';

/** What `chooseBoardMode` decides from. */
export interface BoardSwitchInput {
  /** `location.search`. `?board=gpu` turns the GPU board on; `?board=dom` always wins. */
  readonly search: string;
  /** The stored dev flag, or `null`. */
  readonly storedFlag: string | null;
  /** A dev build (`import.meta.env.DEV`): only then is the stored flag read. */
  readonly dev: boolean;
  /** WebGL is available. Without it the DOM board is used. */
  readonly webgl: boolean;
}

/**
 * The board to use. Off unless asked for: `?board=gpu`, or the stored flag in a dev build.
 * Example: `chooseBoardMode({ search: '?board=gpu', storedFlag: null, dev: false, webgl: true }) // 'gpu'`
 */
export function chooseBoardMode(input: BoardSwitchInput): BoardMode {
  const asked = new URLSearchParams(input.search).get('board');
  if (asked === 'dom') return 'dom';
  const wanted = asked === 'gpu' || (input.dev && input.storedFlag === 'gpu');
  return wanted && input.webgl ? 'gpu' : 'dom';
}

/** Anything that can hand out a drawing context, like an `HTMLCanvasElement`. */
export interface ContextSource {
  getContext(id: string): unknown;
}

/** True when `make()` gives a canvas with a WebGL 2 or WebGL 1 context. Never throws. */
export function detectWebGL(make: () => ContextSource | null): boolean {
  try {
    const canvas = make();
    if (!canvas) return false;
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * True when this board must stay on the DOM for now: a jar with a special mechanic, or
 * colour-blind patterns turned on.
 * TODO(sprint 19 S3): draw narrow, frozen, locked, funnel, hourglass, sieve and clam jars, and the
 * grain-anchored patterns, on the canvas, then remove this fallback.
 */
export function needsDomBoard(board: Board, patterns: boolean): boolean {
  if (patterns) return true;
  return board.jars.some(
    (j) => j.cap !== undefined || j.frozen === true || j.lock !== undefined || j.funnel === true || j.hourglass !== undefined || j.sieve !== undefined || j.clam !== undefined,
  );
}
