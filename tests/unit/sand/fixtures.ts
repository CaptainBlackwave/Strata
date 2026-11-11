// Story: production/sprints/sprint-19.md (S1). Shared helpers for the sand simulation tests.
import { type Board, legalMoves, pour } from '../../../src/core/board';
import { generateLevel } from '../../../src/core/generator';
import type { GameConfig } from '../../../src/core/levels';
import rawConfig from '../../../src/config/game-config.json';
import {
  countGrains, done, EMPTY, type PourSim, type SandGrid, sandConfig, step,
} from '../../../src/ui/sand';

export const gameConfig = rawConfig as unknown as GameConfig;

/** Grains in the source, the air and the target. */
export function totalGrains(sim: PourSim): number {
  return countGrains(sim.source) + sim.particles.count + countGrains(sim.target);
}

/** How many cells hold each value. */
export function histogram(grid: SandGrid): Map<number, number> {
  const h = new Map<number, number>();
  for (const c of grid.cells) if (c !== EMPTY) h.set(c, (h.get(c) ?? 0) + 1);
  return h;
}

/** Steps until done, calling `each` after every step. Fails loudly if the cap doesn't hold. */
export function runToDone(sim: PourSim, each?: (sim: PourSim) => void, cap = sandConfig.maxSteps): number {
  while (!done(sim)) {
    if (sim.steps > cap) throw new Error('step cap did not stop the pour');
    step(sim);
    each?.(sim);
  }
  return sim.steps;
}

/** A pour picked from a real generated level. */
export interface LevelPour {
  readonly level: number;
  readonly board: Board;
  readonly from: number;
  readonly to: number;
}

/**
 * Up to `perLevel` legal pours from each generated level whose jars the pour result doesn't
 * flip or open (hourglass flips and clam openings are the renderer's job, sprint 19 S5).
 */
export function levelPours(levels: readonly number[], perLevel: number): LevelPour[] {
  const out: LevelPour[] = [];
  for (const level of levels) {
    const board = generateLevel(level, gameConfig).board;
    let taken = 0;
    for (const { from, to } of legalMoves(board)) {
      if (taken >= perLevel) break;
      const r = pour(board, from, to);
      if ([from, to].some((i) => r.flipped.includes(i) || r.opened.includes(i) || board.jars[i].hourglass)) continue;
      out.push({ level, board, from, to });
      taken++;
    }
  }
  return out;
}
