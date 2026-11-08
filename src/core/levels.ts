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
  /** Tall-jar levels from this level on can get mechanics (decision D8). */
  readonly mechanicsFrom?: number;
}

/** Difficulty ramp past level 45 (decision D1). */
export interface RampConfig {
  readonly spareOne: { readonly from: number; readonly to: number; readonly chanceFrom: number; readonly chanceTo: number; readonly salt: number; readonly maxAttempts: number };
  readonly mechanicChance: { readonly from: number; readonly to: number; readonly max: number };
}

/** The game-config.json shape. */
export interface GameConfig {
  readonly baseSeed: number;
  /** Extra-jar uses allowed per level; null means no cap (decision D5). */
  readonly extraJarsPerLevel: number | null;
  readonly curve: readonly CurveRow[];
  readonly ramp: RampConfig;
  readonly challenge: ChallengeConfig;
  readonly generator: { readonly maxAttempts: number; readonly solverNodeBudget: number; readonly maxSealedAtStart: number; readonly stepNodeBudget?: number; readonly stepAttemptNodeBudget?: number };
  readonly hint: { readonly solverNodeBudget: number };
  /** `totalNodeBudget` caps solver states across all attempts of one shuffle (F7, GA-SB-4). */
  readonly shuffle: { readonly maxAttempts: number; readonly solverNodeBudget: number; readonly totalNodeBudget?: number };
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
      mechanics: ch.mechanicsFrom !== undefined && level >= ch.mechanicsFrom ? pickMechanics(level, config) : [],
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
  const mechanics = pickMechanics(level, config);
  if (spare > 1 && spareOneChance(level, config) > 0) {
    // Decision D1 (revised 2026-11-08): one of the two spares becomes a special jar.
    // A board with a single ordinary spare is almost never winnable, but one ordinary
    // spare plus a narrow jar or a funnel almost always is.
    const rng = createRng(mixSeed(config.ramp.spareOne.salt, level));
    if (rng() < spareOneChance(level, config)) {
      spare = 1;
      if (!mechanics.includes('narrow') && !mechanics.includes('funnel')) {
        const funnelUnlocked = config.mechanics.list.some((m) => m.id === 'funnel' && m.unlockAt <= level);
        mechanics.push(funnelUnlocked && rng() < 0.5 ? 'funnel' : 'narrow');
      }
    }
  }
  return { level, colors: Math.min(colors, maxColors), capacity, spare, buriedDepth, challenge: false, mechanics };
}

const lerp = (level: number, from: number, to: number, a: number, b: number) =>
  level <= from ? a : level >= to ? b : a + ((b - a) * (level - from)) / (to - from);

/**
 * Chance that a normal level has 1 spare jar instead of 2 (decision D1): 0 before
 * `ramp.spareOne.from`, then linear from `chanceFrom` to `chanceTo`.
 * Example: `spareOneChance(150, config) // 0.75`
 */
export function spareOneChance(level: number, config: GameConfig): number {
  const r = config.ramp.spareOne;
  return level < r.from ? 0 : lerp(level, r.from, r.to, r.chanceFrom, r.chanceTo);
}

/**
 * Chance that a level gets a mechanic (decision D1): `mechanics.chance` up to
 * `ramp.mechanicChance.from`, rising linearly to `max` at `to`.
 * Example: `mechanicChance(120, config) // 0.5`
 */
export function mechanicChance(level: number, config: GameConfig): number {
  const r = config.ramp.mechanicChance;
  return lerp(level, r.from, r.to, config.mechanics.chance, r.max);
}

/**
 * Which mechanics a level gets: its debut mechanic on an unlock level, otherwise
 * `mechanicChance(level)` of levels get one unlocked mechanic, with a second one
 * possible from `comboFrom`. Deterministic per level. Tall-jar levels only call this
 * from `challenge.mechanicsFrom` (decision D8).
 */
export function pickMechanics(level: number, config: GameConfig): MechanicId[] {
  const m = config.mechanics;
  const debut = m.list.find((x) => x.unlockAt === level);
  if (debut) return [debut.id];
  const unlocked = m.list.filter((x) => x.unlockAt <= level).map((x) => x.id);
  if (!unlocked.length) return [];
  const rng = createRng(mixSeed(m.salt, level));
  if (rng() >= mechanicChance(level, config)) return [];
  const first = unlocked[Math.floor(rng() * unlocked.length)];
  if (level < m.comboFrom || unlocked.length < 2 || rng() >= m.comboChance) return [first];
  const others = unlocked.filter((x) => x !== first);
  return [first, others[Math.floor(rng() * others.length)]];
}

/**
 * The level a `?level=N` launch address may open: any level the player has reached,
 * never beyond their progress (decision D3, replay only). Invalid input opens their
 * current level. Example: `launchLevel(100, 5) // 5`
 */
export function launchLevel(requested: number, nextLevel: number): number {
  if (!Number.isInteger(requested) || requested < 1) return nextLevel;
  return Math.min(requested, nextLevel);
}
