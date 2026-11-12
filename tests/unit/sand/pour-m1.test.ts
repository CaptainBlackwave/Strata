// Story: production/sprints/sprint-19.md (M1): strata-r8z (no spill until the lip is over the
// target: the renderer holds the spill while the jar moves) and strata-085 (a narrow stream under
// the lip). The pour's guarantees (conservation, exact amount, ends on the board) still hold.
import { describe, expect, it } from 'vitest';
import { makeBoard, pour } from '../../../src/core/board';
import { countGrains, defaultDims, done, finish, grainsPerUnit, gridFromJar, planPour, sandConfig, step } from '../../../src/ui/sand';
import { totalGrains } from './fixtures';

const dims = defaultDims();
const SEED = 77;
/** A jar of three units whose top unit pours into an empty jar. */
const board = () => makeBoard(4, [[0, 1, 1, 2], []]);

describe('holding the spill (strata-r8z)', () => {
  it('no grain leaves the source while the spill is held, even at full tilt', () => {
    // Arrange
    const sim = planPour(board(), 0, 1, dims, SEED);
    // Act: long enough to reach full tilt and bring grains to the mouth.
    for (let k = 0; k < 120; k++) step(sim, { holdSpill: true });
    // Assert
    expect(sim.emitted).toBe(0);
    expect(sim.particles.count).toBe(0);
    expect(sim.tilt).toBeCloseTo((sandConfig.maxTiltDeg * Math.PI) / 180);
    expect(sim.phase).toBe('tilt');
  });

  it('released, the pour completes exactly, and spills at once', () => {
    // Arrange
    const b = board();
    const sim = planPour(b, 0, 1, dims, SEED);
    const total = totalGrains(sim);
    for (let k = 0; k < 50; k++) step(sim, { holdSpill: true });
    // Act
    step(sim);
    const firstEmitted = sim.emitted;
    while (!done(sim)) {
      step(sim);
      expect(totalGrains(sim)).toBe(total);
    }
    // Assert
    expect(firstEmitted).toBeGreaterThan(0);
    expect(sim.emitted).toBe(grainsPerUnit(4, dims));
    expect(sim.landed).toBe(sim.required);
    const after = pour(b, 0, 1).board;
    finish(sim, after);
    expect(sim.target.cells).toEqual(gridFromJar(after.jars[1], 4, dims).cells);
  });
});

describe('a narrow stream (strata-085)', () => {
  it('every falling grain stays within the stream width under the lip', () => {
    // Arrange
    const streamCol = 9.6;
    const streamWidth = 1.5;
    const sim = planPour(board(), 0, 1, dims, SEED, { streamCol, streamWidth });
    let seen = 0;
    // Act / Assert
    while (!done(sim)) {
      step(sim);
      const v = sim.particles;
      for (let p = 0; p < v.count; p++) {
        expect(Math.abs(v.x[p] - streamCol)).toBeLessThanOrEqual(streamWidth / 2 + 1e-6);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('grains fall through the jar to the pile, so a narrow stream still pours in good time', () => {
    // Arrange
    const sim = planPour(board(), 0, 1, dims, SEED, { streamCol: 9.6, streamWidth: 1.5 });
    const wide = planPour(board(), 0, 1, dims, SEED);
    // Act
    let landedAt = 0;
    let wideAt = 0;
    while (!done(sim)) {
      step(sim);
      if (!landedAt && sim.landed === sim.required) landedAt = sim.steps;
    }
    while (!done(wide)) {
      step(wide);
      if (!wideAt && wide.landed === wide.required) wideAt = wide.steps;
    }
    // Assert: within a few steps of the wide stream, and every grain is in the target.
    expect(landedAt).toBeGreaterThan(0);
    expect(landedAt).toBeLessThanOrEqual(wideAt + 15);
    expect(countGrains(sim.target)).toBe(sim.required);
  });

  it('a grain lands on the pile below its column, not at the mouth', () => {
    // Arrange
    const sim = planPour(board(), 0, 1, dims, SEED, { streamCol: 16, streamWidth: 1 });
    // Act: until the first grain lands.
    while (sim.landed === 0) step(sim);
    // Assert: the first landed grain is on the floor of the empty target, under the stream.
    const { cols, rows, cells } = sim.target;
    let row = -1;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (cells[y * cols + x]) row = y;
    expect(row).toBeGreaterThan(rows - 4);
  });
});
