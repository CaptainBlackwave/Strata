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
 * Thrown by `generateFromSpec` when no attempt gives a solver-proven deal within the length
 * cap. `shortest` is the shortest proven deal that was over the cap, if any was found, so
 * a fallback chain can keep it instead of ending on an unproven board (D36).
 */
export class NoDealError extends Error {
  readonly shortest: GeneratedLevel | undefined;
  constructor(message: string, shortest: GeneratedLevel | undefined) {
    super(message);
    this.name = 'NoDealError';
    this.shortest = shortest;
  }
}

/**
 * The most solver pours (`solutionLength`) a generated board may need at `level`, from
 * `generator.pourBands` (owner decision D36, sprint 7 B7): the max of the band with the
 * largest `from` at or below `level`. A level below every band, which is the daily
 * (level 0), gets the last band's max, because the daily's hardest weekday boards are
 * late-game sized. `Infinity` when no bands are configured.
 * Example: `maxPoursFor(153, config) // 70`
 */
export function maxPoursFor(level: number, config: GameConfig): number {
  const bands = [...(config.generator.pourBands ?? [])].sort((a, b) => a.from - b.from);
  if (!bands.length) return Infinity;
  let band = bands[bands.length - 1];
  if (level >= bands[0].from) for (const b of bands) if (b.from <= level) band = b;
  return band.max;
}

/**
 * The solver-work caps for the fallback steps (F7, D36), in one place so levels and the daily
 * agree: `cap` bounds a whole step (`generator.stepNodeBudget`), `perAttempt` one attempt
 * (`generator.stepAttemptNodeBudget`). Each falls back to `generator.solverNodeBudget`.
 * Example: `const { cap, perAttempt } = stepBudgets(config);`.
 */
export function stepBudgets(config: GameConfig): { readonly cap: number; readonly perAttempt: number } {
  const g = config.generator;
  return { cap: g.stepNodeBudget ?? g.solverNodeBudget, perAttempt: g.stepAttemptNodeBudget ?? g.solverNodeBudget };
}

/** The shorter of a kept deal and the over-cap deal a caught error carries; the first wins ties. */
export function shorterDeal(kept: GeneratedLevel | undefined, error: unknown): GeneratedLevel | undefined {
  const found = error instanceof NoDealError ? error.shortest : undefined;
  return found && (!kept || found.solutionLength < kept.solutionLength) ? found : kept;
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
 * Never throws for a valid level number: when every solver-proven step fails it ends
 * with `fallbackBoard` (F7, GA-LG-3).
 */
export function generateLevel(level: number, config: GameConfig): GeneratedLevel {
  const spec = levelSpec(level, config);
  const seed = mixSeed(config.baseSeed, level);
  // Fallback chain, so no level can ever fail to load: the full recipe, then with a
  // second ordinary spare, then without mechanics. Each step is still solver-proven.
  // Every step but the last is capped by total solver work (generator.stepNodeBudget),
  // which keeps level starts fast and stays identical on every device.
  // Every step is also capped by length (generator.pourBands, D36). When no step finds a deal
  // within it, the shortest proven deal any step found is kept (see lastResort).
  const { cap, perAttempt } = stepBudgets(config);
  let shortest: GeneratedLevel | undefined;
  const tries: [LevelSpec, number][] = [[spec, spec.spare === 1 ? config.ramp.spareOne.maxAttempts : config.generator.maxAttempts]];
  if (spec.spare === 1) tries.push([{ ...spec, spare: 2 }, config.generator.maxAttempts]);
  if (spec.mechanics.length) tries.push([{ ...spec, spare: 2, mechanics: [] }, config.generator.maxAttempts]);
  for (let i = 0; i < tries.length; i++) {
    try {
      const last = i === tries.length - 1;
      return generateFromSpec(tries[i][0], seed, config, tries[i][1], last ? Infinity : cap, last ? config.generator.solverNodeBudget : perAttempt);
    } catch (e) {
      shortest = shorterDeal(shortest, e); // fall through to the next, easier step
    }
  }
  return lastResort(spec, seed, config, shortest);
}

/**
 * The end of every fallback chain (F7, GA-LG-3, GA-DP-1): a plain deal with one more spare
 * jar, capped like the middle steps, then `fallbackBoard`, which can't fail. Shared by
 * numbered levels and the daily. The returned spec says what was actually built.
 * Length cap (D36): if that deal is over `maxPoursFor` too, the shortest proven deal seen
 * (`shortest`, passed in from the earlier steps, or this step's own) is returned instead of
 * `fallbackBoard`, which is used only when no step proved any board.
 */
export function lastResort<S extends LevelSpec>(spec: S, seed: number, config: GameConfig, shortest?: GeneratedLevel): GeneratedLevel & { spec: S } {
  const { cap, perAttempt } = stepBudgets(config);
  const easier: S = { ...spec, spare: Math.max(2, spec.spare) + 1, mechanics: [] };
  try {
    return generateFromSpec(easier, seed, config, config.generator.maxAttempts, cap, perAttempt) as GeneratedLevel & { spec: S };
  } catch (e) {
    const kept = shorterDeal(shortest, e);
    if (kept) return kept as GeneratedLevel & { spec: S };
    const plain: S = { ...spec, spare: 2, mechanics: [] };
    const board = fallbackBoard(plain, seed);
    return { spec: plain, board, seed, solutionLength: board.jars.filter((j) => j.units.length).length + 1, attempts: 0 };
  }
}

/**
 * A board that is winnable by construction, so it needs no solver proof (F7, GA-LG-3).
 * Full jar `i` holds `capacity - 1` units of colour `i` under one unit of colour `i + 1`
 * (wrapping), plus 2 empty jars. It is won in `colors + 1` pours: move jar 0's top to a
 * spare, then pour each jar's top onto the jar of its colour, from the last jar down,
 * and finally pour the spare back onto jar 1. Nothing is sealed at the start. Colour
 * labels and jar order are shuffled from `seed`; `buriedDepth` is applied as usual.
 * Uses `max(2, spec.colors)` colours and assumes `spec.capacity >= 2`. Mechanics are dropped.
 * Example: `fallbackBoard(levelSpec(152, config), seed).jars.length // colours + 2`
 */
export function fallbackBoard(spec: LevelSpec, seed: number): Board {
  const rng = createRng(mixSeed(seed, 0xfa11));
  const colors = Math.max(2, spec.colors);
  const label = shuffle(Array.from({ length: colors }, (_, c) => c), rng);
  const jars: Color[][] = [];
  for (let i = 0; i < colors; i++) jars.push([...new Array<Color>(spec.capacity - 1).fill(label[i]), label[(i + 1) % colors]]);
  jars.push([], []);
  shuffle(jars, rng);
  const hidden = jars.map((j) => (j.length ? Math.min(spec.buriedDepth, j.length - 1) : 0));
  return makeBoard(spec.capacity, jars, hidden);
}

/**
 * Deals boards for `spec` from `baseSeed` until one is solver-proven winnable in at most
 * `maxPoursFor(spec.level)` pours (D36). A proven deal over that cap is rejected like an
 * unwinnable one and the next attempt is dealt. Shared by numbered levels and the daily.
 * Throws a `NoDealError` (carrying the shortest over-cap proven deal, if any) when no
 * attempt succeeds.
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
  const maxPours = maxPoursFor(spec.level, config);
  let shortest: GeneratedLevel | undefined; // the shortest proven deal over the length cap
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
      const found: GeneratedLevel = { spec, board, seed, solutionLength: result.path.length, attempts: attempt + 1 };
      if (found.solutionLength <= maxPours) return found;
      if (!shortest || found.solutionLength < shortest.solutionLength) shortest = found;
    }
    if (spent >= totalNodeBudget) break;
  }
  throw new NoDealError(`No solvable board within ${maxPours} pours for ${spec.level > 0 ? `level ${spec.level}` : 'this spec'} after ${maxAttempts} attempts`, shortest);
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
