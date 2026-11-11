import { describe, expect, it } from 'vitest';
import { NEUTRAL, gridFromJar } from '../../../../src/ui/sand';
import { cornerMask, hexToRgb, paintAir, paintGrid } from '../../../../src/ui/board-gpu/paint';

const DIMS = { cols: 8, rows: 8 };
const PALETTE = [hexToRgb('#c8553d'), hexToRgb('#2a9d8f')];
const NEUTRAL_RGB = hexToRgb('#b9a88d');
const alpha = (px: number) => px >>> 24;
const red = (px: number) => px & 255;

describe('hexToRgb', () => {
  it('reads #rrggbb', () => {
    expect(hexToRgb('#c8553d')).toEqual({ r: 200, g: 85, b: 61 });
    expect(() => hexToRgb('red')).toThrow();
  });
});

describe('paintGrid', () => {
  it('is transparent where the grid is empty and opaque where there is sand', () => {
    const grid = gridFromJar({ units: [0], hidden: 0 }, 2, DIMS, 3); // bottom 4 rows
    const out = new Uint32Array(64 * 4);
    paintGrid(grid, PALETTE, NEUTRAL_RGB, out, 2);
    expect(alpha(out[0])).toBe(0);
    expect(alpha(out[16 * 16 - 1])).toBe(255);
  });
  it('tints by colour, and hidden sand is neutral', () => {
    const grid = gridFromJar({ units: [1, 0], hidden: 1 }, 2, DIMS, 3);
    expect(grid.cells[DIMS.cols * 7]).toBe(NEUTRAL);
    const out = new Uint32Array(256);
    paintGrid(grid, PALETTE, NEUTRAL_RGB, out, 2);
    const top = out[2 * 16 * 2 + 4]; // the colour band (row 2)
    const bottom = out[15 * 16 + 4]; // the hidden band
    expect(red(top)).toBeGreaterThan(150); // terracotta is red
    expect(Math.abs(red(bottom) - NEUTRAL_RGB.r)).toBeLessThan(60);
  });
  it('is deterministic: the same grid paints the same texels', () => {
    const grid = gridFromJar({ units: [0, 1], hidden: 0 }, 2, DIMS, 9);
    const a = new Uint32Array(256);
    const b = new Uint32Array(256);
    paintGrid(grid, PALETTE, NEUTRAL_RGB, a, 2);
    paintGrid(grid, PALETTE, NEUTRAL_RGB, b, 2);
    expect(a).toEqual(b);
  });
  it('the corner mask clears texels outside the rounded bottom', () => {
    const mask = cornerMask(16, 16, 4, 4);
    expect(mask[15 * 16]).toBe(0);
    expect(mask[15 * 16 + 8]).toBe(1);
    expect(mask[0]).toBe(1);
    const grid = gridFromJar({ units: [0, 0], hidden: 0 }, 2, DIMS, 1);
    const out = new Uint32Array(256);
    paintGrid(grid, PALETTE, NEUTRAL_RGB, out, 2, mask);
    expect(alpha(out[15 * 16])).toBe(0);
    expect(alpha(out[15 * 16 + 8])).toBe(255);
  });
});

describe('paintAir', () => {
  it('draws each live grain once and clears the rest', () => {
    const view = { count: 1, x: new Float32Array([4.2, 1]), y: new Float32Array([-4, -1]), cell: new Uint8Array([1, 2]), shade: new Uint8Array([0, 0]) };
    const out = new Uint32Array(8 * 2 * 8 * 2).fill(0xffffffff);
    paintAir(view, 8, 8, PALETTE, NEUTRAL_RGB, out, 2);
    const lit = [...out].filter((px) => alpha(px) === 255).length;
    expect(lit).toBe(4); // one grain, 2 × 2 texels
  });
});

describe('paintGrid falling grains', () => {
  it('draws a falling grain (nothing above or below) once, somewhere near its cell', () => {
    const grid = gridFromJar({ units: [], hidden: 0 }, 2, DIMS, 1);
    grid.cells[3 * DIMS.cols + 4] = 1;
    grid.shade[3 * DIMS.cols + 4] = 77;
    const out = new Uint32Array(256);
    paintGrid(grid, PALETTE, NEUTRAL_RGB, out, 2);
    const lit = [...out.keys()].filter((t) => alpha(out[t]) === 255);
    expect(lit.length).toBe(4);
    for (const t of lit) expect(Math.abs(Math.floor(t / 16 / 2) - 3)).toBeLessThanOrEqual(3);
  });
});
