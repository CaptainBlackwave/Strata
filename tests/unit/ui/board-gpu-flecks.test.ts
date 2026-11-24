// Story: production/sprints/sprint-31.md R1 (D240, D244): Sparkle glass on the Realistic board.
// Regression (PR #68 review): the rim's gold flecks replaced the canvas path before the rim's dark edge
// was stroked, so Sparkle glass lost its rim outline. Flecks may only add fills: every outline drawn
// for Sparkle glass must be the same outline drawn for plain glass.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOOK, drawJarArt } from '../../../src/ui/board-gpu/art';
import type { JarGeometry } from '../../../src/ui/board-gpu/geometry';

/** A fake 2D context that records, for each stroke(), the path built since the last beginPath(). */
function recordingContext(strokes: string[][]): CanvasRenderingContext2D {
  let path: string[] = [];
  const target: Record<string, unknown> = {
    beginPath: () => { path = []; },
    stroke: () => { strokes.push([...path]); },
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  };
  for (const op of ['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'closePath']) {
    target[op] = (...args: number[]) => { path.push(`${op}(${args.map((n) => Number(n).toFixed(2)).join(',')})`); };
  }
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k as string] : () => {}),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

/** The outlines (stroked paths) drawJarArt draws for `look`. */
function outlines(look: typeof DEFAULT_LOOK): string[][] {
  const strokes: string[][] = [];
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => recordingContext(strokes) }),
  });
  const g = { glass: { x: 0, y: 0, width: 60, height: 160 }, button: { x: 0, y: 0, width: 60, height: 160 }, x: 30, y: 150, wall: 3, base: 4, innerWidth: 54, innerHeight: 140 } as unknown as JarGeometry;
  drawJarArt(g, 2, look);
  return strokes;
}

afterEach(() => vi.unstubAllGlobals());

describe('Sparkle glass on the Realistic board', () => {
  it('draws the same outlines as plain glass: the flecks never replace the rim edge', () => {
    const plain = outlines(DEFAULT_LOOK);
    const sparkle = outlines({ ...DEFAULT_LOOK, flecks: 'rgb(196, 146, 34)' });
    expect(plain.length).toBeGreaterThan(0);
    expect(sparkle).toEqual(plain);
  });
});
