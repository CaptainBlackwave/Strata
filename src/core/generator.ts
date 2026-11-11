/**
 * Seeded level generator that only returns solver-proven boards.
 * Implements design/game-brief.md MVP 2.
 */
import { type Board, type Color, type Jar, isSealed, makeBoard, pour } from './board';
import { type GameConfig, type LevelSpec, levelSpec } from './levels';
import { type Rng, createRng, mixSeed, shuffle } from './rng';
import { type SolveResult, solve } from './solver';

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
 * A numbered tall-jar level is capped at `challenge.maxPours` when that is lower (D112).
 * Example: `maxPoursFor(153, config) // 70`, `maxPoursFor(60, config) // 50`
 */
export function maxPoursFor(level: number, config: GameConfig): number {
  const bands = [...(config.generator.pourBands ?? [])].sort((a, b) => a.from - b.from);
  if (!bands.length) return Infinity;
  let band = bands[bands.length - 1];
  if (level >= bands[0].from) for (const b of bands) if (b.from <= level) band = b;
  // Decision D112: a numbered tall-jar level has its own cap when that is lower.
  const ch = config.challenge;
  const tall = level > 0 && ch.every > 0 && level % ch.every === 0;
  return tall && ch.maxPours !== undefined ? Math.min(band.max, ch.maxPours) : band.max;
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
  return runFallbackSteps(levelSteps(spec, config), mixSeed(config.baseSeed, level), config, spec);
}

/**
 * One step of a fallback chain (TD-5): the spec to deal and the caps `generateFromSpec` gets
 * for it (attempts, solver work for the whole step, solver work per attempt).
 */
export interface FallbackStep<S extends LevelSpec = LevelSpec> {
  readonly spec: S;
  readonly maxAttempts: number;
  readonly totalNodeBudget: number;
  readonly attemptNodeBudget: number;
}

/**
 * A numbered level's fallback chain, so no level can ever fail to load: the full recipe,
 * then with a second ordinary spare (one-spare levels only), then without the hourglass,
 * the sieve and the clam but with the classic mechanics (levels with both kinds only, D96), then without
 * mechanics (levels with mechanics only). Every step but the last is capped by total solver work
 * (`generator.stepNodeBudget`), which keeps level starts fast and identical on every device.
 * Example: `levelSteps(levelSpec(150, config), config).length // 2 or 3`
 */
export function levelSteps(spec: LevelSpec, config: GameConfig): FallbackStep[] {
  const g = config.generator;
  const tries: [LevelSpec, number][] = [[spec, spec.spare === 1 ? config.ramp.spareOne.maxAttempts : g.maxAttempts]];
  if (spec.spare === 1) tries.push([{ ...spec, spare: 2 }, g.maxAttempts]);
  // An hourglass, sieve or clam with classic mechanics: try the classic ones alone before dropping them all (D96).
  if ((spec.hourglass || spec.sieve || spec.clam) && spec.mechanics.length) tries.push([{ ...withoutMechanics(spec), mechanics: spec.mechanics, spare: 2 }, g.maxAttempts]);
  if (hasAnyMechanic(spec)) tries.push([{ ...withoutMechanics(spec), spare: 2 }, g.maxAttempts]);
  const { cap, perAttempt } = stepBudgets(config);
  return tries.map(([s, maxAttempts], i) => {
    const last = i === tries.length - 1;
    return { spec: s, maxAttempts, totalNodeBudget: last ? Infinity : cap, attemptNodeBudget: last ? g.solverNodeBudget : perAttempt };
  });
}

/** What `runFallbackSteps` calls; injectable so the runner's ordering can be unit-tested. */
export interface FallbackDeps {
  readonly generate: (spec: LevelSpec, seed: number, config: GameConfig, maxAttempts: number, totalNodeBudget: number, attemptNodeBudget: number) => GeneratedLevel;
  readonly finish: (spec: LevelSpec, seed: number, config: GameConfig, shortest?: GeneratedLevel) => GeneratedLevel;
}

/**
 * Runs a fallback chain (F7, TD-5), shared by numbered levels and the daily, which only build
 * their own `steps`. Each step is tried in order with `seed`; the first that is solver-proven
 * within the length cap (D36) is returned. A step that throws falls through to the next, and
 * the shortest over-cap deal any `NoDealError` carried is kept. When every step fails, the
 * chain ends with `lastResort(base, …)`, which never throws.
 * Example: `runFallbackSteps(levelSteps(spec, config), seed, config, spec)`
 */
export function runFallbackSteps<S extends LevelSpec>(
  steps: readonly FallbackStep<S>[],
  seed: number,
  config: GameConfig,
  base: S,
  deps: FallbackDeps = { generate: generateFromSpec, finish: lastResort },
): GeneratedLevel & { spec: S } {
  let shortest: GeneratedLevel | undefined;
  for (const step of steps) {
    try {
      return deps.generate(step.spec, seed, config, step.maxAttempts, step.totalNodeBudget, step.attemptNodeBudget) as GeneratedLevel & { spec: S };
    } catch (e) {
      shortest = shorterDeal(shortest, e); // fall through to the next, easier step
    }
  }
  return deps.finish(base, seed, config, shortest) as GeneratedLevel & { spec: S };
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
  const easier: S = { ...withoutMechanics(spec), spare: Math.max(2, spec.spare) + 1 };
  try {
    return generateFromSpec(easier, seed, config, config.generator.maxAttempts, cap, perAttempt) as GeneratedLevel & { spec: S };
  } catch (e) {
    const kept = shorterDeal(shortest, e);
    if (kept) return kept as GeneratedLevel & { spec: S };
    const plain: S = { ...withoutMechanics(spec), spare: 2 };
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
    const board = hasAnyMechanic(spec) ? applyMechanics(dealt, spec, createRng(mixSeed(seed, 0xa11ce)), config) : dealt;
    const sealed = board.jars.filter((j) => isSealed(j, board.capacity)).length;
    if (sealed > maxSealedAtStart) continue;
    if (!hasMechanics(board, spec)) continue; // a mechanic couldn't be placed on this deal
    const proof = proveDeal(board, Math.min(attemptNodeBudget, totalNodeBudget - spent), maxPours, spec.colors, sieveColorTries(config));
    spent += proof.nodes;
    const result = proof.result;
    if (result.solvable === true) {
      const found: GeneratedLevel = { spec, board: proof.board, seed, solutionLength: result.path.length, attempts: attempt + 1 };
      if (found.solutionLength <= maxPours) return found;
      if (!shortest || found.solutionLength < shortest.solutionLength) shortest = found;
    }
    if (spent >= totalNodeBudget) break;
  }
  throw new NoDealError(`No solvable board within ${maxPours} pours for ${spec.level > 0 ? `level ${spec.level}` : 'this spec'} after ${maxAttempts} attempts`, shortest);
}

/** The sieve's `colorTries` from config (D96, §2.5): at least 1, default 3. */
function sieveColorTries(config: GameConfig): number {
  return Math.max(1, Math.floor(config.mechanics.list.find((m) => m.id === 'sieve')?.colorTries ?? 3));
}

/** A proven (or refuted) deal: the board as finally banded, its solve result, and the solver states spent. */
export interface DealProof {
  readonly board: Board;
  readonly result: SolveResult;
  readonly nodes: number;
}

/**
 * Proves a dealt board with the solver (`budget` states in all). A board without a sieve is
 * solved once, exactly as before the sieve. A board with one chooses its band colour (D96,
 * §2.5): it tries `tries` colours of the `colors` on the board, from the dealt band onward
 * (band, band + 1, … wrapping), and returns the first whose proof fits `maxPours` and ends
 * with the sieve sealed in its colour; failing that the first proof that fits; failing that
 * the shortest proof; failing that the dealt band's result. Every try spends from `budget`.
 * Example: `proveDeal(board, 40_000, 70, spec.colors, 3).board.jars[i].sieve`
 */
export function proveDeal(board: Board, budget: number, maxPours: number, colors: number, tries: number): DealProof {
  const at = board.jars.findIndex((j) => j.sieve !== undefined);
  if (at < 0) {
    const result = solve(board, budget);
    return { board, result, nodes: result.nodes };
  }
  const dealt = board.jars[at].sieve!;
  let nodes = 0;
  let first: DealProof | undefined; // the dealt band's own result, whatever it is
  let fits: DealProof | undefined; // the first proof within maxPours
  let shortest: DealProof | undefined; // the shortest proof over maxPours
  for (let k = 0; k < Math.min(tries, colors) && nodes < budget; k++) {
    const banded: Board = k === 0 ? board : { capacity: board.capacity, jars: board.jars.map((j, i) => (i === at ? { ...j, sieve: (dealt + k) % colors } : j)) };
    const result = solve(banded, budget - nodes);
    nodes += result.nodes;
    const proof: DealProof = { board: banded, result, nodes };
    first ??= proof;
    if (result.solvable !== true) continue;
    if (result.path.length > maxPours) {
      if (!shortest || result.path.length < shortest.result.path.length) shortest = proof;
      continue;
    }
    if (endsSealed(banded, result, at)) return { ...proof, nodes };
    fits ??= proof;
  }
  return { ...(fits ?? shortest ?? first!), nodes };
}

/** True when replaying a winning `result` on `board` leaves jar `at` sealed. */
function endsSealed(board: Board, result: SolveResult, at: number): boolean {
  let b = board;
  for (const m of result.path) b = pour(b, m.from, m.to).board;
  return isSealed(b.jars[at], b.capacity);
}

/** True when a spec asks for any jar mechanic, the hourglass, the sieve and the clam included (D96). */
export function hasAnyMechanic(spec: LevelSpec): boolean {
  return spec.mechanics.length > 0 || spec.hourglass === true || spec.sieve === true || spec.clam === true;
}

/** The spec with every mechanic dropped, the hourglass, the sieve and the clam included: a fallback step's recipe. */
export function withoutMechanics<S extends LevelSpec>(spec: S): S {
  const { hourglass: _dropped, sieve: _sieve, clam: _clam, ...rest } = spec;
  return { ...rest, mechanics: [] } as unknown as S;
}

/**
 * Places a spec's mechanics on a dealt board. Narrow and funnel add an extra jar;
 * frozen and locked change random filled jars. A lock never uses a colour that
 * is inside its own jar (that would be an instant deadlock). The hourglass (D96) is placed
 * last, on a filled jar that is not sealed, frozen, locked, narrow or a funnel; its sand is
 * shown (`hidden: 0`), since a flip would bring buried sand to the top. The sieve (D96, §2.5)
 * is placed after that, on a filled jar that is not sealed, frozen, locked, narrow, a funnel
 * or the hourglass, banded in a colour drawn from the board's `spec.colors`; its burial is kept
 * (`proveDeal` may then move the band). The clam (D96, §2.6) is placed after that, on a filled
 * jar that is not sealed, frozen, locked, narrow, a funnel, the hourglass or the sieve, closed for
 * `opensAfter` pours; its burial is kept. The stream `rng` is only drawn from for mechanics the
 * spec has, so a spec without the hourglass, the sieve or the clam deals exactly the board it did
 * before they existed.
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
  if (spec.hourglass) {
    const tune = config.mechanics.list.find((m) => m.id === 'hourglass');
    const every = Math.max(1, Math.floor(tune?.every ?? 3));
    const plainJar = (j: Jar) => j.cap === undefined && !j.funnel && !isSealed(j, board.capacity);
    const i = pick(filled().filter((k) => plainJar(jars[k])));
    if (i !== undefined) jars[i] = { ...jars[i], hidden: 0, hourglass: { every, left: every } };
  }
  if (spec.sieve) {
    const plainJar = (j: Jar) => j.cap === undefined && !j.funnel && !j.hourglass && j.sieve === undefined && !isSealed(j, board.capacity);
    const i = pick(filled().filter((k) => plainJar(jars[k])));
    const color = Math.floor(rng() * spec.colors);
    if (i !== undefined) jars[i] = { ...jars[i], sieve: color };
  }
  if (spec.clam) {
    const tune = config.mechanics.list.find((m) => m.id === 'clam');
    const opensAfter = Math.max(1, Math.floor(tune?.opensAfter ?? 6));
    const plainJar = (j: Jar) => j.cap === undefined && !j.funnel && !j.hourglass && j.sieve === undefined && j.clam === undefined && !isSealed(j, board.capacity);
    const i = pick(filled().filter((k) => plainJar(jars[k])));
    if (i !== undefined) jars[i] = { ...jars[i], clam: opensAfter };
  }
  return { capacity: board.capacity, jars };
}

/** True when every mechanic the spec asks for is on the board. */
export function hasMechanics(board: Board, spec: LevelSpec): boolean {
  if (spec.hourglass && !board.jars.some((j) => j.hourglass)) return false;
  if (spec.sieve && !board.jars.some((j) => j.sieve !== undefined)) return false;
  if (spec.clam && !board.jars.some((j) => j.clam !== undefined)) return false;
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
