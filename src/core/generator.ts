/**
 * Seeded level generator that only returns solver-proven boards.
 * Implements design/game-brief.md MVP 2.
 */
import { type Board, type Color, type Jar, isSealed, makeBoard } from './board';
import { type GameConfig, type LevelSpec, levelSpec } from './levels';
import { type Rng, createRng, mixSeed, shuffle } from './rng';
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
  const spec = levelSpec(level, config);
  const seed = mixSeed(config.baseSeed, level);
  // Fallback chain, so no level can ever fail to load: the full recipe, then with a
  // second ordinary spare, then without mechanics. Each step is still solver-proven.
  // Every step but the last is capped by total solver work (generator.stepNodeBudget),
  // which keeps level starts fast and stays identical on every device.
  const cap = config.generator.stepNodeBudget ?? Infinity;
  const perAttempt = config.generator.stepAttemptNodeBudget ?? config.generator.solverNodeBudget;
  const tries: [LevelSpec, number][] = [[spec, spec.spare === 1 ? config.ramp.spareOne.maxAttempts : config.generator.maxAttempts]];
  if (spec.spare === 1) tries.push([{ ...spec, spare: 2 }, config.generator.maxAttempts]);
  if (spec.mechanics.length) tries.push([{ ...spec, spare: 2, mechanics: [] }, config.generator.maxAttempts]);
  for (let i = 0; i < tries.length; i++) {
    try {
      const last = i === tries.length - 1;
      return generateFromSpec(tries[i][0], seed, config, tries[i][1], last ? Infinity : cap, last ? config.generator.solverNodeBudget : perAttempt);
    } catch (e) {
      if (i === tries.length - 1) throw e;
    }
  }
  throw new Error(`No solvable board for level ${level}`);
}

/**
 * Deals boards for `spec` from `baseSeed` until one is solver-proven winnable.
 * Shared by numbered levels and the daily puzzle.
 */
export function generateFromSpec(
  spec: LevelSpec,
  baseSeed: number,
  config: GameConfig,
  maxAttempts = config.generator.maxAttempts,
  totalNodeBudget = Infinity,
  attemptNodeBudget = config.generator.solverNodeBudget,
): GeneratedLevel {
  const { maxSealedAtStart } = config.generator;
  let spent = 0; // solver states across attempts: a deterministic cap on generation time
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seed = mixSeed(baseSeed, attempt);
    const dealt = dealBoard(spec, seed);
    // Mechanics use their own RNG stream, so a plain level's deal is untouched.
    const board = spec.mechanics.length ? applyMechanics(dealt, spec, createRng(mixSeed(seed, 0xa11ce)), config) : dealt;
    const sealed = board.jars.filter((j) => isSealed(j, board.capacity)).length;
    if (sealed > maxSealedAtStart) continue;
    if (!hasMechanics(board, spec)) continue; // a mechanic couldn't be placed on this deal
    const result = solve(board, Math.min(attemptNodeBudget, totalNodeBudget - spent));
    spent += result.nodes;
    if (result.solvable === true) {
      return { spec, board, seed, solutionLength: result.path.length, attempts: attempt + 1 };
    }
    if (spent >= totalNodeBudget) break;
  }
  throw new Error(`No solvable board for ${spec.level > 0 ? `level ${spec.level}` : 'this spec'} after ${maxAttempts} attempts`);
}

/**
 * Places a spec's mechanics on a dealt board. Narrow and funnel add an extra jar;
 * frozen and locked change random filled jars. A lock never uses a colour that
 * is inside its own jar (that would be an instant deadlock).
 */
export function applyMechanics(board: Board, spec: LevelSpec, rng: Rng, config: GameConfig): Board {
  const jars: Jar[] = [...board.jars];
  const filled = () => jars.map((j, i) => (j.units.length && !j.frozen && j.lock === undefined ? i : -1)).filter((i) => i >= 0);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  for (const id of spec.mechanics) {
    const tune = config.mechanics.list.find((m) => m.id === id);
    if (id === 'narrow') jars.push({ units: [], hidden: 0, cap: tune?.cap ?? 2 });
    else if (id === 'funnel') jars.push({ units: [], hidden: 0, funnel: true });
    else if (id === 'frozen') {
      for (let k = 0; k < (tune?.count ?? 1); k++) {
        const i = pick(filled());
        if (i !== undefined) jars[i] = { ...jars[i], frozen: true };
      }
    } else if (id === 'locked') {
      // A lock needs a jar missing at least one colour (its key). On tall jars that hold
      // every colour this can fail; the deal is then rejected and re-dealt.
      const absentIn = (i: number) => Array.from({ length: spec.colors }, (_, c) => c).filter((c) => !jars[i].units.includes(c));
      const candidates = filled().filter((i) => absentIn(i).length > 0);
      const i = pick(candidates);
      if (i !== undefined) jars[i] = { ...jars[i], lock: pick(absentIn(i)) };
    }
  }
  return { capacity: board.capacity, jars };
}

/** True when every mechanic the spec asks for is on the board. */
export function hasMechanics(board: Board, spec: LevelSpec): boolean {
  return spec.mechanics.every((id) =>
    id === 'narrow' ? board.jars.some((j) => j.cap !== undefined)
    : id === 'frozen' ? board.jars.some((j) => j.frozen)
    : id === 'locked' ? board.jars.some((j) => j.lock !== undefined)
    : board.jars.some((j) => j.funnel),
  );
}

/** The first-launch tutorial board from config: one pour seals a jar. */
export function tutorialBoard(config: GameConfig): Board {
  return makeBoard(config.tutorial.capacity, config.tutorial.jars);
}
