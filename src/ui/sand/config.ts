/**
 * Tuning for the falling-sand pour (sprint 19 S1, docs/architecture/adr-0001-gpu-sand-board.md).
 * Every number lives in `src/config/game-config.json` under `sand`; its `$comment` explains each one.
 */
import rawConfig from '../../config/game-config.json';
import type { SandDims } from './grid';

/** The `sand` block of game-config.json. Units are grid cells and simulation steps. */
export interface SandConfig {
  /** Cells across one jar grid. */
  readonly cols: number;
  /** Cells down one jar grid; one unit is `floor(rows / capacity)` rows. */
  readonly rows: number;
  /** Simulation rate the renderer aims for. */
  readonly stepsPerSecond: number;
  /** Most steps one frame may run. */
  readonly maxStepsPerFrame: number;
  /** The source jar's largest tilt, in degrees. */
  readonly maxTiltDeg: number;
  /** Tilt added per step while tipping, in degrees. */
  readonly tiltPerStepDeg: number;
  /** Tilt removed per step while tipping back, in degrees. */
  readonly returnPerStepDeg: number;
  /**
   * Flow direction at full tilt, in degrees below the horizontal toward the lip (negative points
   * up the tipped wall, out of the mouth). Keep it at or below `reposeDeg - 90` so straight up is
   * always an allowed move and every loose grain can leave.
   */
  readonly flowEndDeg: number;
  /** A grain only moves within this angle of the flow direction, in degrees. */
  readonly reposeDeg: number;
  /** Chance per step that a loose source grain tries to move. */
  readonly slideChance: number;
  /** Flow passes per step in the tilted source: how many cells a loose grain can move per step. */
  readonly flowPassesPerStep: number;
  /** Most grains that leave the source in one step. */
  readonly spillPerStep: number;
  /** Cells a grain can drop per step inside a grid. */
  readonly fallCellsPerStep: number;
  /** Drop from the lip to the target's mouth, in cells. */
  readonly airRows: number;
  /** Speed gain per step in the air, in cells per step. */
  readonly airGravity: number;
  /** Share of the target's width the stream lands across (0..1). */
  readonly streamSpread: number;
  /** How many columns a resting surface grain may creep to a lower spot. */
  readonly levelReach: number;
  /** Chance per step that a resting grain tries the long creep. */
  readonly levelChance: number;
  /** Steps without movement that count as settled. */
  readonly quietSteps: number;
  /** Most steps spent settling once every grain has landed and the jar is upright. */
  readonly settleSteps: number;
  /** Hard cap on the steps of one pour. */
  readonly maxSteps: number;
}

/** The shipped tuning, read from game-config.json. */
export const sandConfig: SandConfig = rawConfig.sand;

/** The grid size from a config. Example: `defaultDims() // { cols: 32, rows: 72 }` */
export function defaultDims(config: SandConfig = sandConfig): SandDims {
  return { cols: config.cols, rows: config.rows };
}

/** How many steps a frame should run, and the time carried to the next frame. */
export interface StepsDue {
  readonly steps: number;
  readonly carryMs: number;
}

/**
 * Frame-rate independent stepping: turns elapsed time into whole simulation steps at
 * `stepsPerSecond`, capped at `maxStepsPerFrame`. A capped frame drops its backlog so a slow
 * device plays the pour slower instead of stalling. Example: `stepsDue(0, 16.7).steps // 4`
 */
export function stepsDue(carryMs: number, elapsedMs: number, config: SandConfig = sandConfig): StepsDue {
  const msPerStep = 1000 / config.stepsPerSecond;
  const total = Math.max(0, carryMs) + Math.max(0, elapsedMs);
  const steps = Math.floor(total / msPerStep);
  if (steps > config.maxStepsPerFrame) return { steps: config.maxStepsPerFrame, carryMs: 0 };
  return { steps, carryMs: total - steps * msPerStep };
}
