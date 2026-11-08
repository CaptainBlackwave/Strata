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
}

/** Fully resolved parameters for one level. */
export interface LevelSpec {
  readonly level: number;
  readonly colors: number;
  readonly capacity: number;
  readonly spare: number;
  readonly buriedDepth: number;
  readonly challenge: boolean;
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
  return { level, colors: Math.min(colors, maxColors), capacity, spare, buriedDepth, challenge: false };
}
