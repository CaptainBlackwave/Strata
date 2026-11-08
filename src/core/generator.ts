/**
 * Seeded level generator that only returns solver-proven boards.
 * Implements design/game-brief.md MVP 2.
 */
import { type Board, type Color, isSealed, makeBoard } from './board';
import { type GameConfig, type LevelSpec, levelSpec } from './levels';
import { createRng, mixSeed, shuffle } from './rng';
import { solve } from './solver';

/** A generated level along with its proof of solvability. */
export interface GeneratedLevel {
  readonly spec: LevelSpec;
  readonly board: Board;
  readonly seed: number;
  /** A known solution length. Not guaranteed optimal. */
  readonly solutionLength: number;
  readonly attempts: number;
}

/**
 * Deals `colors × capacity` units into `colors` full jars, then adds `spare` empty
 * jars. Each full jar buries `buriedDepth` units from its bottom (its top stays visible).
 */
export function dealBoard(spec: LevelSpec, seed: number): Board {
  const rng = createRng(seed);
  const units: Color[] = [];
  for (let c = 0; c < spec.colors; c++) for (let k = 0; k < spec.capacity; k++) units.push(c);
  shuffle(units, rng);
  const jars: Color[][] = [];
  for (let i = 0; i < spec.colors; i++) jars.push(units.slice(i * spec.capacity, (i + 1) * spec.capacity));
  for (let i = 0; i < spec.spare; i++) jars.push([]);
  const hidden = jars.map((j) => (j.length ? Math.min(spec.buriedDepth, j.length - 1) : 0));
  return makeBoard(spec.capacity, jars, hidden);
}

/**
 * Generates the level for `level`. The same level number always gives the same board.
 * Throws if no solvable board is found within `generator.maxAttempts`.
 */
export function generateLevel(level: number, config: GameConfig): GeneratedLevel {
  return generateFromSpec(levelSpec(level, config), mixSeed(config.baseSeed, level), config);
}

/**
 * Deals boards for `spec` from `baseSeed` until one is solver-proven winnable.
 * Shared by numbered levels and the daily puzzle.
 */
export function generateFromSpec(spec: LevelSpec, baseSeed: number, config: GameConfig): GeneratedLevel {
  const { maxAttempts, solverNodeBudget, maxSealedAtStart } = config.generator;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seed = mixSeed(baseSeed, attempt);
    const board = dealBoard(spec, seed);
    const sealed = board.jars.filter((j) => isSealed(j, board.capacity)).length;
    if (sealed > maxSealedAtStart) continue;
    const result = solve(board, solverNodeBudget);
    if (result.solvable === true) {
      return { spec, board, seed, solutionLength: result.path.length, attempts: attempt + 1 };
    }
  }
  throw new Error(`No solvable board for ${spec.level > 0 ? `level ${spec.level}` : 'this spec'} after ${maxAttempts} attempts`);
}

/** The first-launch tutorial board from config: one pour seals a jar. */
export function tutorialBoard(config: GameConfig): Board {
  return makeBoard(config.tutorial.capacity, config.tutorial.jars);
}
