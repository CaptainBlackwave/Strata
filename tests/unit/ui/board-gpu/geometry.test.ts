import { describe, expect, it } from 'vitest';
import { cubicBezier, jarGeometry, lipLocal, mouthRow, pourLip, pourSide, restRect } from '../../../../src/ui/board-gpu/geometry';

const DIMS = { cols: 32, rows: 72 };
const glassAt = (left: number, top = 300) => ({ left, top, width: 68, height: 189 });

describe('jarGeometry', () => {
  const g = jarGeometry(glassAt(100), 42, 4, DIMS);
  it('puts the origin at the interior bottom centre, inset like the DOM sand', () => {
    expect(g.x).toBe(134);
    expect(g.y).toBeCloseTo(300 + 189 - 5.5);
    expect(g.innerWidth).toBeCloseTo(68 - 11);
  });
  it('makes one unit band exactly one DOM unit tall', () => {
    expect(g.cellH * 18).toBeCloseTo(42);
    expect(g.gridHeight).toBeCloseTo(42 * 4);
    expect(g.gridHeight).toBeLessThanOrEqual(g.innerHeight);
    expect(g.cellW * DIMS.cols).toBeCloseTo(g.innerWidth);
  });
  it('lifts like the DOM --lift', () => {
    expect(g.lift).toBeCloseTo(68 * 0.32);
  });
  it('a capacity with headroom rows still fits the interior', () => {
    const g5 = jarGeometry(glassAt(0), 28, 5, DIMS);
    expect(g5.cellH * 14).toBeCloseTo(28);
    expect(g5.gridHeight).toBeLessThanOrEqual(g5.innerHeight);
  });
});

describe('restRect', () => {
  it('takes the selection lift out', () => {
    expect(restRect({ left: 1, top: 80, width: 2, height: 3 }, -20)).toEqual({ left: 1, top: 100, width: 2, height: 3 });
  });
});

describe('pour placement', () => {
  const src = jarGeometry(glassAt(20), 42, 4, DIMS);
  const dst = jarGeometry(glassAt(200), 42, 4, DIMS);
  it('the lip is the interior top corner on the pour side', () => {
    expect(lipLocal(src, 1)).toEqual({ x: src.innerWidth / 2, y: -src.innerHeight });
    expect(lipLocal(src, -1).x).toBe(-src.innerWidth / 2);
  });
  it('waits over the target near edge, airRows cells above its grid', () => {
    const lip = pourLip(dst, 1, 24);
    expect(lip.x).toBeCloseTo(dst.x - dst.innerWidth / 2);
    expect(lip.y).toBeCloseTo(dst.y - dst.gridHeight - 24 * dst.cellH);
    expect(pourLip(dst, -1, 24).x).toBeCloseTo(dst.x + dst.innerWidth / 2);
  });
  it('pours toward the target, unless the jar would leave the canvas', () => {
    expect(pourSide(src, dst, 412)).toBe(1);
    expect(pourSide(dst, src, 412)).toBe(-1);
    // A target at the far left, poured from its right: tipping right would leave the canvas.
    const edge = jarGeometry(glassAt(4), 42, 4, DIMS);
    const right = jarGeometry(glassAt(300), 42, 4, DIMS);
    expect(pourSide(right, edge, 412)).toBe(-1);
    const left = jarGeometry(glassAt(-100), 42, 4, DIMS);
    expect(pourSide(left, edge, 412)).toBe(-1);
  });
});

describe('cubicBezier', () => {
  it('starts at 0, ends at 1 and is monotonic for the DOM curves', () => {
    for (const e of [cubicBezier(0.3, 0.7, 0.4, 1), cubicBezier(0.4, 0, 0.3, 1)]) {
      expect(e(0)).toBe(0);
      expect(e(1)).toBe(1);
      let prev = 0;
      for (let t = 0.05; t < 1; t += 0.05) {
        const v = e(t);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
    expect(cubicBezier(0, 0, 1, 1)(0.3)).toBeCloseTo(0.3, 3);
  });
});

describe('narrow jars', () => {
  it('a full-height jar has its mouth at row 0', () => {
    expect(mouthRow(jarGeometry(glassAt(0), 42, 4, DIMS), DIMS.rows)).toBe(0);
  });
  it('a narrow jar (2 of 4 units, shorter glass) has its mouth inside the grid, above its sand', () => {
    // style.css: a narrow glass is unitHeight × cap + round(unitHeight × 0.45) tall.
    const g = jarGeometry({ left: 12, top: 400, width: 44, height: 42 * 2 + 19 }, 42, 4, DIMS, { left: 0, top: 380, width: 68, height: 201 });
    const mouth = mouthRow(g, DIMS.rows);
    expect(mouth).toBeGreaterThan(0);
    expect((DIMS.rows - mouth) * g.cellH).toBeLessThanOrEqual(g.innerHeight + 1e-6);
    expect(DIMS.rows - mouth).toBeGreaterThanOrEqual(2 * 18); // room for its two units
    expect(g.lift).toBeCloseTo(68 * 0.32); // the lift follows the button, as the DOM's --lift
  });
  it('the lip waits airRows above a narrow target mouth', () => {
    const g = jarGeometry({ left: 12, top: 400, width: 44, height: 103 }, 42, 4, DIMS);
    const mouth = mouthRow(g, DIMS.rows);
    expect(pourLip(g, 1, 24, mouth).y).toBeCloseTo(g.y - (DIMS.rows - mouth) * g.cellH - 24 * g.cellH);
  });
});
