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
  /** A tall-jar level's own length cap in solver pours, used when below its pour band's (D112). Absent: the band's. */
  readonly maxPours?: number;
  /** Tall-jar levels from this level on can get mechanics (decision D8). */
  readonly mechanicsFrom?: number;
  /**
   * Optional tall-jar shape rows (decision D82, R3). Like the main `curve`: a row applies from
   * `fromLevel` until the next row, omitted fields inherit from the previous row, and the first
   * row inherits from the fields above. Absent: every tall-jar level uses the fields above.
   * Example: `[{ fromLevel: 10, colors: 4 }, { fromLevel: 20, colors: 5 }]` makes level 10 a 4 × 8 board.
   */
  readonly curve?: readonly CurveRow[];
}

/** Difficulty ramp past level 45 (decision D1). */
export interface RampConfig {
  readonly spareOne: { readonly from: number; readonly to: number; readonly chanceFrom: number; readonly chanceTo: number; readonly salt: number; readonly maxAttempts: number };
  readonly mechanicChance: { readonly from: number; readonly to: number; readonly max: number };
}

/**
 * Breather levels (owner decision D107): from `from`, every level with
 * `level % every === offset` is an easier board with `fewerColors` fewer colours than the
 * curve gives and no spare-jar swap. Example: `{ from: 21, every: 5, offset: 3, fewerColors: 2 }`
 * makes every level ending in 3 or 8 from 23 on a breather.
 */
export interface BreatherConfig {
  readonly from: number;
  readonly every: number;
  readonly offset: number;
  readonly fewerColors: number;
  /** From `late.from`, a breather has `late.fewerColors` fewer colours instead (D111). Absent: no late step. */
  readonly late?: { readonly from: number; readonly fewerColors: number };
  /** The most special jars a breather may have; extra rolled ones are dropped, last first (D111). Absent: no cap. */
  readonly maxMechanics?: number;
}

/** The fewest colours a breather level can be cut down to: level 1's board. */
const MIN_COLORS = 3;

/** The game-config.json shape. */
export interface GameConfig {
  readonly baseSeed: number;
  /** Extra-jar uses allowed per level; null means no cap (decision D5). */
  readonly extraJarsPerLevel: number | null;
  readonly curve: readonly CurveRow[];
  /** Breather levels (D107). Absent: none. */
  readonly breather?: BreatherConfig;
  readonly ramp: RampConfig;
  readonly challenge: ChallengeConfig;
  readonly generator: {
    readonly maxAttempts: number;
    readonly solverNodeBudget: number;
    readonly maxSealedAtStart: number;
    readonly stepNodeBudget?: number;
    readonly stepAttemptNodeBudget?: number;
    /** Level length targets in solver pours (D36). Absent: no length cap. */
    readonly pourBands?: readonly PourBand[];
  };
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

/**
 * One level-length band (owner decision D36, sprint 7 B7). It covers levels from `from` up to
 * the next band's `from` - 1; the last band is open-ended. `max` is enforced at generation
 * (`maxPoursFor` in generator.ts); `median` is a target checked by the band test only.
 */
export interface PourBand {
  readonly from: number;
  readonly median: number;
  readonly max: number;
}

/**
 * Every jar mechanic. Each one has an intro card, a Jar guide entry and player-facing strings,
 * so the UI's lookup tables are keyed by this type. The hourglass (D96) joined in sprint 13 M1,
 * the sieve (D96) in sprint 13 M2 and the clam (D96) in sprint 13 M3.
 */
export type MechanicId = 'narrow' | 'frozen' | 'locked' | 'funnel' | 'hourglass' | 'sieve' | 'clam';

/**
 * The four original mechanics (sprint 3). They ride in `LevelSpec.mechanics`; the hourglass,
 * the sieve and the clam ride in their own flags, `LevelSpec.hourglass`, `.sieve` and `.clam`, so
 * the generator's placement stream and every board from before them stay byte-identical. They are
 * also the daily's Saturday rotation (until sprint 13 W1, D98) and the "all four special jars" badge.
 */
export type ClassicMechanicId = Exclude<MechanicId, 'hourglass' | 'sieve' | 'clam'>;

/** @deprecated Since sprint 13 M3 (the clam's UI) every mechanic is a `MechanicId`; kept as an alias for older branches. */
export type BoardMechanicId = MechanicId;

/**
 * True for the four original mechanics (`ClassicMechanicId`), false for the hourglass, the sieve
 * and the clam. Example: `config.mechanics.list.map((m) => m.id).filter(isClassicMechanic) // narrow … funnel`.
 */
export function isClassicMechanic(id: MechanicId): id is ClassicMechanicId {
  return id !== 'hourglass' && id !== 'sieve' && id !== 'clam';
}

/**
 * True for a mechanic with an intro card, Jar guide entry and strings. Since sprint 13 M3 (the
 * clam's UI) that is every mechanic again. Kept for older branches. Example: `hasMechanicCard('clam') // true`.
 */
export function hasMechanicCard(id: MechanicId): id is MechanicId {
  return typeof id === 'string';
}

/** @deprecated The sprint 13 core name of {@link isClassicMechanic}: the hourglass has a card now too. */
export const isCardMechanic = isClassicMechanic;

/**
 * Every mechanic on a level's board, in intro-card order: the spec's classic mechanics, then
 * the hourglass, the sieve and the clam, each when it has one. Example: level 181 gives `['clam']`.
 */
export function specMechanics(spec: Pick<LevelSpec, 'mechanics' | 'hourglass' | 'sieve' | 'clam'>): MechanicId[] {
  return [
    ...spec.mechanics,
    ...(spec.hourglass ? ['hourglass' as const] : []),
    ...(spec.sieve ? ['sieve' as const] : []),
    ...(spec.clam ? ['clam' as const] : []),
  ];
}

/** One mechanic's schedule and tuning in game-config.json. */
export interface MechanicConfig {
  readonly id: MechanicId;
  readonly unlockAt: number;
  /** Narrow jar capacity. */
  readonly cap?: number;
  /** How many jars get frozen. */
  readonly count?: number;
  /** Hourglass: it flips every this many successful pours on the board (D96). Default 3. */
  readonly every?: number;
  /**
   * Sieve: how many band colours the generator may prove on one deal, starting from the one the
   * placement stream drew (D96, §2.5). It keeps the first whose proof ends with the sieve sealed
   * in its colour, else the first proven one. Default 3; 1 keeps the drawn colour.
   */
  readonly colorTries?: number;
  /**
   * Clam: how many successful pours on the board it stays closed for (D96, §2.6). Its count starts
   * here and the pour that reaches zero opens it. Default 6; at least 1.
   */
  readonly opensAfter?: number;
}

/** Fully resolved parameters for one level. */
export interface LevelSpec {
  readonly level: number;
  readonly colors: number;
  readonly capacity: number;
  readonly spare: number;
  readonly buriedDepth: number;
  readonly challenge: boolean;
  /** Classic jar mechanics placed on this board (empty for a plain level). See `specMechanics`. */
  readonly mechanics: readonly ClassicMechanicId[];
  /** One filled jar is an hourglass (D96). Absent or false: none. See `ClassicMechanicId`. */
  readonly hourglass?: boolean;
  /** One filled jar is a sieve (D96, sprint 13 M2). Absent or false: none. See `ClassicMechanicId`. */
  readonly sieve?: boolean;
  /** One filled jar is a closed clam (D96, sprint 13 M3). Absent or false: none. See `ClassicMechanicId`. */
  readonly clam?: boolean;
}

/**
 * Splits mechanics into the classic mechanics and the hourglass, sieve and clam flags of a `LevelSpec`,
 * the one path every board recipe (levels, the daily, the weekly; sprint 13 W1) uses.
 * Example: `splitMechanics(['sieve']) // { mechanics: [], sieve: true }`.
 */
export function splitMechanics(ids: readonly MechanicId[]): { mechanics: ClassicMechanicId[]; hourglass?: true; sieve?: true; clam?: true } {
  return {
    mechanics: ids.filter(isClassicMechanic),
    ...(ids.includes('hourglass') ? { hourglass: true as const } : {}),
    ...(ids.includes('sieve') ? { sieve: true as const } : {}),
    ...(ids.includes('clam') ? { clam: true as const } : {}),
  };
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
    // Optional per-level shape rows (D82, R3), applied over the base tall-jar shape.
    let { colors: tc, capacity: tcap, spare: ts, buriedDepth: tb } = ch;
    for (const row of [...(ch.curve ?? [])].sort((a, b) => a.fromLevel - b.fromLevel)) {
      if (row.fromLevel > level) break;
      tc = row.colors ?? tc;
      tcap = row.capacity ?? tcap;
      ts = row.spare ?? ts;
      tb = row.buriedDepth ?? tb;
    }
    return {
      level,
      colors: Math.min(tc, maxColors),
      capacity: tcap,
      spare: ts,
      buriedDepth: tb,
      challenge: true,
      ...splitMechanics(ch.mechanicsFrom !== undefined && level >= ch.mechanicsFrom ? pickMechanics(level, config) : []),
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
  // Decisions D107, D111: a breather is the same recipe with fewer colours and at most
  // `maxMechanics` special jars, and it never gets the swap below.
  const breather = isBreather(level, config);
  const br = breather ? config.breather : undefined;
  if (br) colors = Math.max(MIN_COLORS, colors - (br.late && level >= br.late.from ? br.late.fewerColors : br.fewerColors));
  const rolled = pickMechanics(level, config);
  const { mechanics, hourglass, sieve, clam } = splitMechanics(br?.maxMechanics !== undefined ? rolled.slice(0, br.maxMechanics) : rolled);
  // Decision D28: a mechanic's debut level shows that mechanic alone, so no spare-jar swap.
  const debut = config.mechanics.list.some((m) => m.unlockAt === level);
  if (!debut && !breather && spare > 1 && spareOneChance(level, config) > 0) {
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
  return { level, colors: Math.min(colors, maxColors), capacity, spare, buriedDepth, challenge: false, mechanics, ...(hourglass ? { hourglass } : {}), ...(sieve ? { sieve } : {}), ...(clam ? { clam } : {}) };
}

/**
 * True when `level` is a breather (decision D107): an ordinary level at or past
 * `breather.from` whose number fits the `every`/`offset` rhythm. Tall-jar levels are never
 * breathers. Example: `isBreather(23, config) // true`, `isBreather(20, config) // false`.
 */
export function isBreather(level: number, config: GameConfig): boolean {
  const b = config.breather;
  if (!b || b.every <= 0 || level < b.from) return false;
  const ch = config.challenge;
  if (ch.every > 0 && level % ch.every === 0) return false;
  return level % b.every === b.offset;
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
