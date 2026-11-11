// Story: production/sprints/sprint-19.md (S1), docs/architecture/adr-0001-gpu-sand-board.md (decisions 2, 3):
// the simulated pour moves exactly the rules' amount, conserves grains, ends on the board, and is deterministic.
import { describe, expect, it } from 'vitest';
import { type Board, makeBoard, pour, pourAmount } from '../../../src/core/board';
import {
  bandRows, cellOf, countCell, countGrains, defaultDims, done, finish, grainsPerUnit, gridFromJar, NEUTRAL, planPour,
  type PourSim, sandConfig, type SnapReport, step,
} from '../../../src/ui/sand';
import { histogram, levelPours, runToDone, totalGrains } from './fixtures';

const dims = defaultDims();
const SEED = 1234;

/** True when `cells` from `offset` on equal `want` (a plain loop: deep-equal per step is slow). */
function sameFrom(cells: Uint8Array, want: Uint8Array, offset: number): boolean {
  for (let i = 0; i < want.length; i++) if (cells[offset + i] !== want[i]) return false;
  return true;
}

interface Checked {
  readonly sim: PourSim;
  readonly snap: SnapReport;
}

/**
 * Plays a pour to the end, checking every step: grains are conserved, only grains of the poured
 * colour leave, never more than the rules' amount, and the source's held cells (everything below
 * the poured bands, hidden sand included) never change. Then finishes and checks the board.
 */
function playAndCheck(board: Board, from: number, to: number, seed = SEED): Checked {
  const sim = planPour(board, from, to, dims, seed);
  const amount = pourAmount(board, from, to);
  const band = bandRows(board.capacity, dims);
  const required = amount * grainsPerUnit(board.capacity, dims);
  expect(sim.required).toBe(required);
  const total = totalGrains(sim);
  const srcStart = histogram(sim.source);
  const dstStart = histogram(sim.target);
  const poured = cellOf(sim.color);
  // Held: the source rows below the poured bands.
  const heldFrom = (dims.rows - (board.jars[from].units.length - amount) * band) * dims.cols;
  const held = sim.source.cells.slice(heldFrom);
  const targetNeutral = countCell(sim.target, NEUTRAL);
  runToDone(sim, (s) => {
    expect(totalGrains(s)).toBe(total);
    expect(s.emitted).toBeLessThanOrEqual(required);
    expect(sameFrom(s.source.cells, held, heldFrom), 'a held grain moved').toBe(true);
    const src = histogram(s.source);
    for (const [cell, n] of srcStart) {
      if (cell !== poured) expect(src.get(cell) ?? 0, `cell ${cell} left the source`).toBe(n);
    }
    for (let p = 0; p < s.particles.count; p++) expect(s.particles.cell[p]).toBe(poured);
    const dst = histogram(s.target);
    for (const [cell, n] of dstStart) if (cell !== poured) expect(dst.get(cell)).toBe(n);
    expect(countCell(s.target, NEUTRAL)).toBe(targetNeutral);
    expect(s.tilt).toBeGreaterThanOrEqual(0);
    expect(s.tilt).toBeLessThanOrEqual((sandConfig.maxTiltDeg * Math.PI) / 180 + 1e-9);
  });
  expect(sim.emitted).toBe(required);
  expect(sim.landed).toBe(required);
  expect(sim.particles.count).toBe(0);
  expect(sim.tilt).toBe(0);
  expect((srcStart.get(poured) ?? 0) - countCell(sim.source, poured)).toBe(required);
  const after = pour(board, from, to).board;
  const snap = finish(sim, after);
  expect(sim.source.cells).toEqual(gridFromJar(after.jars[from], after.capacity, dims).cells);
  expect(sim.target.cells).toEqual(gridFromJar(after.jars[to], after.capacity, dims).cells);
  expect(snap.ratio).toBeLessThan(0.02);
  return { sim, snap };
}

describe('planPour', () => {
  it('needs exactly pourAmount × grainsPerUnit grains', () => {
    const board = makeBoard(4, [[0, 1, 1, 1], [2, 1]]);
    const sim = planPour(board, 0, 1, dims, SEED);
    expect(sim.amount).toBe(2);
    expect(sim.required).toBe(2 * grainsPerUnit(4, dims));
    expect(sim.color).toBe(1);
    expect(sim.side).toBe(1);
    expect(planPour(makeBoard(4, [[], [0, 1]]), 1, 0, dims, SEED).side).toBe(-1);
    expect(planPour(board, 0, 1, dims, SEED, { side: -1 }).side).toBe(-1);
  });

  it('refuses an illegal pour', () => {
    expect(() => planPour(makeBoard(4, [[0], [1]]), 0, 1, dims, SEED)).toThrow();
  });
});

describe('a full pour (hand-made boards)', () => {
  const snaps: number[] = [];

  it('multi-unit pour into an empty jar', () => {
    const { snap } = playAndCheck(makeBoard(4, [[0, 1, 1, 1], []]), 0, 1);
    snaps.push(snap.changed);
    expect(snap.revealed).toBe(0);
  });

  it('a pour onto the same colour', () => {
    snaps.push(playAndCheck(makeBoard(4, [[2, 0], [0]]), 0, 1).snap.changed);
  });

  it('a pour that fills the target to the brim', () => {
    const board = makeBoard(4, [[0, 2, 1], [3, 1, 1]]);
    const { sim, snap } = playAndCheck(board, 0, 1);
    expect(countCell(sim.target, 0)).toBe(0);
    snaps.push(snap.changed);
  });

  it('only part of the top run moves when the target has less room; the rest of the run stays', () => {
    const board = makeBoard(4, [[0, 1, 1, 1], [2, 2, 1]]);
    expect(pourAmount(board, 0, 1)).toBe(1);
    const { sim } = playAndCheck(board, 0, 1);
    expect(countCell(sim.source, cellOf(1))).toBe(2 * grainsPerUnit(4, dims));
  });

  it('capacity 8 (tall jars)', () => {
    snaps.push(playAndCheck(makeBoard(8, [[0, 2, 1, 1, 1], [3, 1]]), 0, 1).snap.changed);
  });

  it('a jar with hidden units below: hidden grains never move, and the revealed band is counted apart', () => {
    const board = makeBoard(4, [[2, 3, 1], [1]], [2, 0]);
    const { snap } = playAndCheck(board, 0, 1);
    // The pour reveals the source's new top unit: one band of neutral sand becomes colour 3.
    expect(snap.revealed).toBe(grainsPerUnit(4, dims));
    snaps.push(snap.changed);
  });

  it('a pour to the left works the same', () => {
    snaps.push(playAndCheck(makeBoard(4, [[], [0, 1, 1]]), 1, 0).snap.changed);
  });

  it('the snap stays small', () => {
    console.log(`sand snap: ${snaps.join(', ')} cells changed of ${2 * dims.cols * dims.rows}`);
    expect(Math.max(...snaps)).toBeLessThan(0.02 * 2 * dims.cols * dims.rows);
  });
});

describe('a full pour (generated levels)', () => {
  it('every checked pour from real levels conserves grains, moves the exact amount and ends on the board', () => {
    const pours = levelPours([1, 4, 9, 15, 30, 45], 2);
    expect(pours.length).toBeGreaterThanOrEqual(8);
    let worst = 0;
    for (const p of pours) worst = Math.max(worst, playAndCheck(p.board, p.from, p.to, p.level).snap.ratio);
    console.log(`sand snap on ${pours.length} level pours: worst ${(worst * 100).toFixed(2)}% of cells`);
  }, 30000);
});

describe("the prototype's 'jar empties, then snaps back' bug", () => {
  it('the source never holds fewer grains than the jar keeps after the pour, at any step', () => {
    const board = makeBoard(4, [[0, 2, 3, 1], []]);
    const sim = planPour(board, 0, 1, dims, SEED);
    const keeps = 3 * grainsPerUnit(4, dims);
    let lowest = Infinity;
    runToDone(sim, (s) => {
      lowest = Math.min(lowest, countGrains(s.source));
    });
    expect(lowest).toBe(keeps);
    // The source already is the post-pour jar: nothing in it snaps back.
    const after = pour(board, 0, 1).board;
    expect(sim.source.cells).toEqual(gridFromJar(after.jars[0], 4, dims).cells);
  });
});

describe('determinism', () => {
  const board = makeBoard(4, [[0, 1, 1, 1], [2, 1]]);
  const at = (seed: number, n: number) => {
    const sim = planPour(board, 0, 1, dims, seed);
    for (let i = 0; i < n; i++) step(sim);
    const k = sim.particles.count;
    return {
      source: [...sim.source.cells], shade: [...sim.source.shade], target: [...sim.target.cells], targetShade: [...sim.target.shade],
      tilt: sim.tilt, x: [...sim.particles.x.slice(0, k)], y: [...sim.particles.y.slice(0, k)], cell: [...sim.particles.cell.slice(0, k)],
    };
  };

  it('the same seed gives identical grids and particles at step N', () => {
    for (const n of [40, 90, 160]) expect(at(SEED, n)).toEqual(at(SEED, n));
  });

  it('a different seed gives a different pour', () => {
    expect(at(SEED + 1, 90)).not.toEqual(at(SEED, 90));
  });

  it('mid-pour there are grains in the air', () => {
    expect(at(SEED, 90).cell.length).toBeGreaterThan(0);
  });
});

describe('the step cap', () => {
  it('done() becomes true within the default cap, well before it', () => {
    const sim = planPour(makeBoard(8, [[0, 1, 1, 1, 1, 1, 1], []]), 0, 1, dims, SEED);
    expect(runToDone(sim)).toBeLessThan(sandConfig.maxSteps);
  });

  it('a tiny cap stops the pour, and finish still lands exactly on the board', () => {
    const board = makeBoard(4, [[0, 1, 1], []]);
    const config = { ...sandConfig, maxSteps: 30 };
    const sim = planPour(board, 0, 1, dims, SEED, { config });
    const steps = runToDone(sim, undefined, config.maxSteps);
    expect(steps).toBe(config.maxSteps);
    expect(done(sim)).toBe(true);
    step(sim);
    expect(sim.steps).toBe(config.maxSteps);
    const after = pour(board, 0, 1).board;
    finish(sim, after);
    expect(sim.source.cells).toEqual(gridFromJar(after.jars[0], 4, dims).cells);
    expect(sim.target.cells).toEqual(gridFromJar(after.jars[1], 4, dims).cells);
    expect(sim.particles.count).toBe(0);
  });
});

describe('performance', () => {
  it('a full pour on a 4-capacity jar averages well under the step budget in Node', () => {
    const board = makeBoard(4, [[0, 1, 1, 1], []]);
    planPour(board, 0, 1, dims, 1); // warm up
    const warm = planPour(board, 0, 1, dims, 2);
    runToDone(warm);
    const sim = planPour(board, 0, 1, dims, SEED);
    const t0 = performance.now();
    const steps = runToDone(sim);
    const ms = (performance.now() - t0) / steps;
    console.log(`sand step: ${ms.toFixed(3)} ms average over ${steps} steps (${sim.required} grains)`);
    expect(ms).toBeLessThan(5);
  });
});
