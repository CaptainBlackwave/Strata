// Story: production/sprints/sprint-19.md (S1), docs/architecture/adr-0001-gpu-sand-board.md: sand grids.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import {
  bandRows, cellOf, colorOfCell, countCell, countGrains, defaultDims, EMPTY, grainsPerUnit, gridFromJar,
  MAX_COLOR, NEUTRAL, sandConfig, stepsDue,
} from '../../../src/ui/sand';

const dims = defaultDims();

describe('sand grid sizes', () => {
  it('one unit is floor(rows / capacity) rows, and its grains are exactly one band', () => {
    for (const cap of [2, 3, 4, 5, 8]) {
      expect(bandRows(cap, dims)).toBe(Math.floor(dims.rows / cap));
      expect(grainsPerUnit(cap, dims)).toBe(dims.cols * Math.floor(dims.rows / cap));
    }
  });

  it('refuses a capacity the grid cannot hold', () => {
    expect(() => bandRows(0, dims)).toThrow();
    expect(() => bandRows(dims.rows + 1, dims)).toThrow();
  });

  it('defaultDims reads the sand block', () => {
    expect(dims).toEqual({ cols: config.sand.cols, rows: config.sand.rows });
  });
});

describe('cells', () => {
  it('colour ids map to id + 1 and back; the neutral id is no colour', () => {
    expect(cellOf(0)).toBe(1);
    expect(colorOfCell(cellOf(7))).toBe(7);
    expect(colorOfCell(EMPTY)).toBeNull();
    expect(colorOfCell(NEUTRAL)).toBeNull();
    expect(() => cellOf(MAX_COLOR + 1)).toThrow();
  });

  it('every palette colour fits below the neutral id', () => {
    expect(config.palette.length - 1).toBeLessThanOrEqual(MAX_COLOR);
  });
});

describe('gridFromJar', () => {
  it('fills bands bottom-up with hidden units as neutral sand and the rest empty', () => {
    const cap = 4;
    const band = bandRows(cap, dims);
    const g = gridFromJar({ units: [3, 1, 2], hidden: 2 }, cap, dims, 9);
    const rowValue = (y: number) => g.cells[y * dims.cols];
    expect(rowValue(dims.rows - 1)).toBe(NEUTRAL);
    expect(rowValue(dims.rows - band)).toBe(NEUTRAL);
    expect(rowValue(dims.rows - band - 1)).toBe(NEUTRAL);
    expect(rowValue(dims.rows - 2 * band - 1)).toBe(cellOf(2));
    expect(rowValue(dims.rows - 3 * band - 1)).toBe(EMPTY);
    expect(countGrains(g)).toBe(3 * grainsPerUnit(cap, dims));
    expect(countCell(g, NEUTRAL)).toBe(2 * grainsPerUnit(cap, dims));
    expect(countCell(g, cellOf(2))).toBe(grainsPerUnit(cap, dims));
  });

  it('is deterministic for a seed, shades included', () => {
    const a = gridFromJar({ units: [0, 1], hidden: 0 }, 4, dims, 5);
    const b = gridFromJar({ units: [0, 1], hidden: 0 }, 4, dims, 5);
    expect(a.cells).toEqual(b.cells);
    expect(a.shade).toEqual(b.shade);
  });

  it('refuses a jar taller than the grid', () => {
    expect(() => gridFromJar({ units: [0, 0, 0, 0, 0], hidden: 0 }, 4, dims)).toThrow();
  });
});

describe('stepsDue', () => {
  const msPerStep = 1000 / sandConfig.stepsPerSecond;

  it('turns elapsed time into whole steps and carries the rest', () => {
    const r = stepsDue(0, 2.5 * msPerStep);
    expect(r.steps).toBe(2);
    expect(r.carryMs).toBeCloseTo(0.5 * msPerStep);
    expect(stepsDue(r.carryMs, 0.6 * msPerStep).steps).toBe(1);
  });

  it('caps a long frame and drops the backlog', () => {
    expect(stepsDue(0, 1000)).toEqual({ steps: sandConfig.maxStepsPerFrame, carryMs: 0 });
  });
});
