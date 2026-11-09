// TD-5 (docs/tech-debt.md): one fallback-step runner shared by numbered levels and the daily.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { makeBoard } from '../../../src/core/board';
import { type DailyConfig, dailySeed, dailySpec, dailySteps, generateDaily } from '../../../src/core/daily';
import { type FallbackStep, type GeneratedLevel, NoDealError, generateLevel, levelSteps, runFallbackSteps, stepBudgets } from '../../../src/core/generator';
import { type GameConfig, type LevelSpec, levelSpec } from '../../../src/core/levels';
import { mixSeed } from '../../../src/core/rng';

const cfg = config as unknown as GameConfig & DailyConfig;
const SEED = 1234;
const base: LevelSpec = { level: 7, colors: 3, capacity: 4, spare: 1, buriedDepth: 0, challenge: false, mechanics: ['narrow'] };
/** A step for `spare` with distinguishable caps, so the test can see which caps each call got. */
const step = (spare: number): FallbackStep => ({ spec: { ...base, spare }, maxAttempts: spare * 10, totalNodeBudget: spare * 100, attemptNodeBudget: spare * 1000 });
/** A stand-in deal with a given solution length, tagged by its spec. */
const deal = (spec: LevelSpec, solutionLength: number): GeneratedLevel => ({ spec, board: makeBoard(4, [[]]), seed: SEED, solutionLength, attempts: 1 });

/** Records every call; `outcomes[i]` decides what call `i` does: a length succeeds, an error is thrown. */
function harness(outcomes: (number | Error)[]) {
  const calls: { spec: LevelSpec; seed: number; caps: number[] }[] = [];
  const finishes: { spec: LevelSpec; shortest: GeneratedLevel | undefined }[] = [];
  const finished = deal({ ...base, spare: 99 }, 999);
  const generate = (spec: LevelSpec, seed: number, _c: GameConfig, maxAttempts: number, total: number, perAttempt: number) => {
    const outcome = outcomes[calls.length];
    calls.push({ spec, seed, caps: [maxAttempts, total, perAttempt] });
    if (outcome instanceof Error) throw outcome;
    return deal(spec, outcome);
  };
  const finish = (spec: LevelSpec, _s: number, _c: GameConfig, shortest?: GeneratedLevel) => {
    finishes.push({ spec, shortest });
    return finished;
  };
  return { calls, finishes, finished, deps: { generate, finish } };
}

describe('runFallbackSteps (TD-5)', () => {
  it('tries the steps in order and returns the first that succeeds, without trying later ones', () => {
    // Arrange
    const h = harness([new NoDealError('no', undefined), 40, 30]);
    // Act
    const got = runFallbackSteps([step(1), step(2), step(3)], SEED, cfg, base, h.deps);
    // Assert
    expect(h.calls.map((c) => c.spec.spare)).toEqual([1, 2]);
    expect(got.spec.spare).toBe(2);
    expect(got.solutionLength).toBe(40);
    expect(h.finishes).toEqual([]);
  });

  it('passes each step its own seed and caps', () => {
    const h = harness([new Error('a'), new Error('b'), 10]);
    runFallbackSteps([step(1), step(2), step(3)], SEED, cfg, base, h.deps);
    expect(h.calls.map((c) => c.seed)).toEqual([SEED, SEED, SEED]);
    expect(h.calls.map((c) => c.caps)).toEqual([[10, 100, 1000], [20, 200, 2000], [30, 300, 3000]]);
  });

  it('falls through any thrown error, and ends with the last resort on the base spec when every step fails', () => {
    const h = harness([new Error('not a NoDealError'), new NoDealError('no', undefined)]);
    const got = runFallbackSteps([step(1), step(2)], SEED, cfg, base, h.deps);
    expect(h.calls).toHaveLength(2);
    expect(h.finishes).toEqual([{ spec: base, shortest: undefined }]);
    expect(got).toBe(h.finished);
  });

  it('hands the last resort the shortest over-cap deal any step carried (the first wins ties)', () => {
    const first = deal({ ...base, spare: 1 }, 50);
    const tie = deal({ ...base, spare: 2 }, 50);
    const shorter = deal({ ...base, spare: 3 }, 45);
    const longer = deal({ ...base, spare: 4 }, 60);
    const h = harness([new NoDealError('a', first), new NoDealError('b', tie), new NoDealError('c', shorter), new NoDealError('d', longer)]);
    runFallbackSteps([step(1), step(2), step(3), step(4)], SEED, cfg, base, h.deps);
    expect(h.finishes[0].shortest).toBe(shorter);
    const h2 = harness([new NoDealError('a', first), new NoDealError('b', tie)]);
    runFallbackSteps([step(1), step(2)], SEED, cfg, base, h2.deps);
    expect(h2.finishes[0].shortest).toBe(first);
  });

  it('goes straight to the last resort for an empty step list', () => {
    const h = harness([]);
    runFallbackSteps([], SEED, cfg, base, h.deps);
    expect(h.calls).toEqual([]);
    expect(h.finishes).toHaveLength(1);
  });
});

describe('the step lists levels and the daily build (TD-5)', () => {
  const { cap, perAttempt } = stepBudgets(cfg);
  const g = cfg.generator;

  it('a one-spare level with mechanics: full recipe, a second spare, then no mechanics; only the last step is uncapped', () => {
    const steps = levelSteps(base, cfg);
    expect(steps.map((s) => [s.spec.spare, s.spec.mechanics])).toEqual([[1, ['narrow']], [2, ['narrow']], [2, []]]);
    expect(steps.map((s) => [s.maxAttempts, s.totalNodeBudget, s.attemptNodeBudget])).toEqual([
      [cfg.ramp.spareOne.maxAttempts, cap, perAttempt],
      [g.maxAttempts, cap, perAttempt],
      [g.maxAttempts, Infinity, g.solverNodeBudget],
    ]);
  });

  it('a plain two-spare level has one uncapped step', () => {
    const plain: LevelSpec = { ...base, spare: 2, mechanics: [] };
    expect(levelSteps(plain, cfg)).toEqual([{ spec: plain, maxAttempts: g.maxAttempts, totalNodeBudget: Infinity, attemptNodeBudget: g.solverNodeBudget }]);
  });

  it('the daily: the full recipe uncapped, then without its mechanic capped', () => {
    const key = Array.from({ length: 14 }, (_, d) => `2026-11-${String(d + 1).padStart(2, '0')}`).find((k) => dailySpec(k, cfg).mechanics.length)!;
    const spec = dailySpec(key, cfg);
    const steps = dailySteps(spec, cfg);
    expect(steps.map((s) => [s.spec.mechanics.length, s.maxAttempts, s.totalNodeBudget, s.attemptNodeBudget])).toEqual([
      [1, g.maxAttempts, Infinity, g.solverNodeBudget],
      [0, g.maxAttempts, cap, perAttempt],
    ]);
  });

  it('generateLevel and generateDaily are runFallbackSteps over their own lists', () => {
    for (const level of [1, 21, 150, 153]) {
      const spec = levelSpec(level, cfg);
      expect(generateLevel(level, cfg), `level ${level}`).toEqual(runFallbackSteps(levelSteps(spec, cfg), mixSeed(cfg.baseSeed, level), cfg, spec));
    }
    const key = '2026-11-08';
    const spec = dailySpec(key, cfg);
    expect(generateDaily(key, cfg)).toEqual(runFallbackSteps(dailySteps(spec, cfg), dailySeed(key, cfg), cfg, spec));
  });
});
