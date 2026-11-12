/**
 * Which board draws the jars (sprint 19 S2, docs/architecture/adr-0001-gpu-sand-board.md decision 5).
 * Pure: the caller passes the address, the stored flag and whether WebGL works.
 */
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
  /** The player's Settings choice: Realistic (true) or Classic (false, the default; D164). */
  readonly realistic?: boolean;
}

/**
 * The board to use: Realistic when the player chose it in Settings (D164), or for testing with
 * `?board=gpu` or the stored flag in a dev build; Classic otherwise. `?board=dom` always wins, and
 * without WebGL it is always Classic.
 * Example: `chooseBoardMode({ search: '', storedFlag: null, dev: false, webgl: true, realistic: true }) // 'gpu'`
 */
export function chooseBoardMode(input: BoardSwitchInput): BoardMode {
  const asked = new URLSearchParams(input.search).get('board');
  if (asked === 'dom') return 'dom';
  const wanted = input.realistic === true || asked === 'gpu' || (input.dev && input.storedFlag === 'gpu');
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
