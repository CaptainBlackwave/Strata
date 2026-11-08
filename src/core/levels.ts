import { createRng, mixSeed } from './rng';

/**
 * Difficulty curve: maps a level number to its board parameters from config.
 * Implements design/game-brief.md MVP 3.
 */

/** One curve row as stored in game-config.json. Omitted fields inherit from the previous row. */
export interface CurveRow {
  readonly fromLevel: number;
  readonly colors?: number;
  readonly capacity?: number;
  readonly spare?: number;
  readonly buriedDepth?: number;
}

/** The parameters of a challenge level (tall jars, teardown rule R3). */
export interface ChallengeConfig {
  readonly every: number;
  readonly colors: number;
  readonly capacity: number;
  readonly spare: number;
  readonly buriedDepth: number;
}

/** The game-config.json shape. */
export interface GameConfig {
  readonly baseSeed: number;
  readonly extraJarsPerLevel: number;
  readonly curve: readonly CurveRow[];
  readonly challenge: ChallengeConfig;
  readonly generator: { readonly maxAttempts: number; readonly solverNodeBudget: number; readonly maxSealedAtStart: number };
  readonly hint: { readonly solverNodeBudget: number };
  readonly shuffle: { readonly maxAttempts: number; readonly solverNodeBudget: number };
  readonly tutorial: { readonly capacity: number; readonly jars: readonly (readonly number[])[] };
  readonly palette: readonly { readonly id: string; readonly hex: string }[];
  readonly mechanics: {
    readonly salt: number;
    readonly chance: number;
    readonly comboFrom: number;
    readonly comboChance: number;
    readonly list: readonly MechanicConfig[];
  };
}

/** The four sprint-3 jar mechanics. */
export type MechanicId = 'narrow' | 'frozen' | 'locked' | 'funnel';

/** One mechanic's schedule and tuning in game-config.json. */
export interface MechanicConfig {
  readonly id: MechanicId;
  readonly unlockAt: number;
  /** Narrow jar capacity. */
  readonly cap?: number;
  /** How many jars get frozen. */
  readonly count?: number;
}

/** Fully resolved parameters for one level. */
export interface LevelSpec {
  readonly level: number;
  readonly colors: number;
  readonly capacity: number;
  readonly spare: number;
  readonly buriedDepth: number;
  readonly challenge: boolean;
  /** Jar mechanics placed on this board (empty for a plain level). */
  readonly mechanics: readonly MechanicId[];
}

/**
 * Resolves the spec for `level` (1-based). Colours are clamped to the palette size.
 * Example: `levelSpec(1, config)` gives `{ colors: 3, capacity: 4, spare: 2, … }`.
 */
export function levelSpec(level: number, config: GameConfig): LevelSpec {
  if (!Number.isInteger(level) || level < 1) throw new RangeError(`Level must be a positive integer, got ${level}`);
  const maxColors = config.palette.length;
  const ch = config.challenge;
  if (ch.every > 0 && level % ch.every === 0) {
    return {
      level,
      colors: Math.min(ch.colors, maxColors),
      capacity: ch.capacity,
      spare: ch.spare,
      buriedDepth: ch.buriedDepth,
      challenge: true,
      mechanics: [],
    };
  }
  let colors = 3;
  let capacity = 4;
  let spare = 2;
  let buriedDepth = 0;
  for (const row of [...config.curve].sort((a, b) => a.fromLevel - b.fromLevel)) {
    if (row.fromLevel > level) break;
    colors = row.colors ?? colors;
    capacity = row.capacity ?? capacity;
    spare = row.spare ?? spare;
    buriedDepth = row.buriedDepth ?? buriedDepth;
  }
  return { level, colors: Math.min(colors, maxColors), capacity, spare, buriedDepth, challenge: false, mechanics: pickMechanics(level, config) };
}

/**
 * Which mechanics a (non-challenge) level gets: its debut mechanic on an unlock level,
 * otherwise about `chance` of levels get one unlocked mechanic, with a second one
 * possible from `comboFrom`. Deterministic per level.
 */
export function pickMechanics(level: number, config: GameConfig): MechanicId[] {
  const m = config.mechanics;
  const debut = m.list.find((x) => x.unlockAt === level);
  if (debut) return [debut.id];
  const unlocked = m.list.filter((x) => x.unlockAt <= level).map((x) => x.id);
  if (!unlocked.length) return [];
  const rng = createRng(mixSeed(m.salt, level));
  if (rng() >= m.chance) return [];
  const first = unlocked[Math.floor(rng() * unlocked.length)];
  if (level < m.comboFrom || unlocked.length < 2 || rng() >= m.comboChance) return [first];
  const others = unlocked.filter((x) => x !== first);
  return [first, others[Math.floor(rng() * others.length)]];
}
